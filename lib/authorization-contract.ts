export type MerchantStatus = "none" | "pending" | "approved" | "rejected" | "suspended";
export type ApplicationStatus = "active" | "suspended";
export type Capability = "customer:access" | "merchant:access" | "product:create" |
  "product:update:own" | "product:delete:own" | "product:manage:any" |
  "currency:manage" | "category:manage" | "merchant:approve" | "users:manage";
export class AuthorizationError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: { status: number; code: string; message: string } };
