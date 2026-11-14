import "server-only";
import { z } from "zod";
import { productIdSchema } from "../cart-contract";

const image = z.string().trim().min(1).max(2048).refine((value) => {
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) return true;
  try { return ["https:", "http:"].includes(new URL(value).protocol); } catch { return false; }
}, "Use a local image path or HTTP(S) URL");
export const productFieldsSchema = z.object({
  title: z.string().trim().min(1).max(200), description: z.string().trim().min(1).max(10000),
  imageUrl: image, price: z.string().max(32).regex(/^(0|[1-9]\d*)(\.\d+)?$/),
  tags: z.array(z.string().trim().min(1).max(60)).max(32).optional(), category: productIdSchema,
}).strict();
export const productUpdateSchema = z.object({ productId: productIdSchema,
  product: productFieldsSchema.partial().refine((value) => Object.values(value).some((field) => field !== undefined), "An edit is required"),
}).strict();
export const productDeleteSchema = z.object({ productId: productIdSchema }).strict();
export const bulkDeleteSchema = z.object({ productIds: z.array(productIdSchema).min(1).max(100)
  .refine((ids) => new Set(ids).size === ids.length, "Duplicate IDs") }).strict();
export const categoryCreateSchema = z.object({ categoryName: z.string().trim().min(1).max(100) }).strict();
export const categoryUpdateSchema = categoryCreateSchema.extend({ categoryId: productIdSchema }).strict();
export const categoryDeleteSchema = z.object({ categoryId: productIdSchema }).strict();
