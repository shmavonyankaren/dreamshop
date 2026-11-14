import "server-only";
import { ZodError } from "zod";
import { CartError } from "../cart-contract";
import { AuthorizationError, type ActionResult } from "../authorization-contract";

export async function marketplaceResult<T>(operation: () => Promise<T>): Promise<ActionResult<T>> {
  try { return { ok: true, data: await operation() }; }
  catch (error) {
    if (error instanceof AuthorizationError || error instanceof CartError) {
      return { ok: false, error: { status: error.status, code: error.code, message: error.message } };
    }
    if (error instanceof ZodError) return { ok: false, error: { status: 400, code: "INVALID_INPUT", message: "Invalid marketplace input." } };
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      return { ok: false, error: { status: 409, code: "CONFLICT", message: "This operation conflicts with an existing record." } };
    }
    console.error("Marketplace operation failed", { name: error instanceof Error ? error.name : "UnknownError" });
    return { ok: false, error: { status: 503, code: "UNAVAILABLE", message: "The operation could not be completed. Please retry." } };
  }
}
