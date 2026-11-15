import "server-only";
import { z } from "zod";
import { productIdSchema } from "../cart-contract";

import { parseMinorUnits, priceInput, currencyDigits } from "../money";

const image = z.string().trim().min(1).max(2048).refine((value) => {
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) return true;
  try { return ["https:", "http:"].includes(new URL(value).protocol); } catch { return false; }
}, "Use a local image path or HTTP(S) URL");
const productShape = z.object({
  title: z.string().trim().min(1).max(200), description: z.string().trim().min(1).max(10000),
  imageUrl: image, price: z.string().max(32), currency: z.string().refine(code => currencyDigits(code) !== null, "Choose a supported ISO currency"),
  tags: z.array(z.string().trim().min(1).max(60)).max(32).optional(), category: productIdSchema,
}).strict();
const validPrice = (value: { price?: string; currency?: string }) => value.price === undefined || (value.currency !== undefined && parseMinorUnits(value.price, value.currency) !== null);
export const productFieldsSchema = productShape.refine(validPrice, "Invalid price for this currency").transform(value => ({ ...value, price: priceInput(parseMinorUnits(value.price, value.currency)!, value.currency), priceCents: parseMinorUnits(value.price, value.currency)! }));
export const productUpdateSchema = z.object({ productId: productIdSchema,
  product: productShape.partial().refine(value => (value.price === undefined) === (value.currency === undefined), "Price and currency must be supplied together").refine(validPrice, "Invalid price for this currency").transform(value => value.price === undefined ? value : ({ ...value, price: priceInput(parseMinorUnits(value.price, value.currency!)!, value.currency!), priceCents: parseMinorUnits(value.price, value.currency!)! })).refine((value) => Object.values(value).some((field) => field !== undefined), "An edit is required"),
}).strict();
export const productDeleteSchema = z.object({ productId: productIdSchema }).strict();
export const bulkDeleteSchema = z.object({ productIds: z.array(productIdSchema).min(1).max(100)
  .refine((ids) => new Set(ids).size === ids.length, "Duplicate IDs") }).strict();
export const categoryCreateSchema = z.object({ categoryName: z.string().trim().min(1).max(100) }).strict();
export const categoryUpdateSchema = categoryCreateSchema.extend({ categoryId: productIdSchema }).strict();
export const categoryDeleteSchema = z.object({ categoryId: productIdSchema }).strict();
