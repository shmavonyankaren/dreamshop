import { z } from "zod";

export const MAX_CART_ITEMS = 100;
export const MAX_QUANTITY = 99;
export const MAX_CART_BODY_BYTES = 16_384;
export const productIdSchema = z.string().regex(/^[a-fA-F0-9]{24}$/, "Invalid product ID").transform((id) => id.toLowerCase());
export const quantitySchema = z.number().int().min(1).max(MAX_QUANTITY);
export const cartItemSchema = z.object({ productId: productIdSchema, quantity: quantitySchema }).strict();
export const cartItemsSchema = z.array(cartItemSchema).max(MAX_CART_ITEMS).refine(
  (items) => new Set(items.map((item) => item.productId)).size === items.length,
  "Duplicate products are not allowed",
);
export const addCartSchema = cartItemSchema.extend({ quantity: quantitySchema.default(1) });
export const removeCartSchema = z.object({ productId: productIdSchema }).strict();
export const operationIdSchema = z.string().uuid().transform((id) => id.toLowerCase());
export const mergeCartSchema = z.object({
  items: cartItemsSchema,
  operationId: operationIdSchema.optional(),
  parentOperationId: operationIdSchema.optional(),
  actorHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
}).strict().refine((value) => value.items.length > 0 || !!value.parentOperationId,
  "An empty merge requires a previous operation")
  .refine((value) => !value.parentOperationId || !!value.operationId,
    "A follow-up requires an operation ID");
export type LocalCartItem = z.infer<typeof cartItemSchema>;

export type ProductDTO = {
  _id: string;
  title: string;
  description: string;
  imageUrl: string;
  price: string;
  tags: string[];
  category: { _id: string; name: string } | null;
};
export type CartDTO = { items: { product: ProductDTO; quantity: number; available?: boolean }[] };
export type CartApiResponse = { cart: CartDTO | null; count: number };
export type MergeReason = "PRODUCT_UNAVAILABLE" | "QUANTITY_LIMIT" | "ITEM_LIMIT" | "ACCOUNT_CHANGED";
export type MergeItemOutcome = {
  productId: string;
  requested: number;
  applied: number;
  before: number;
  after: number;
  reason?: MergeReason;
};
export type MergeOutcome = {
  operationId: string;
  items: MergeItemOutcome[];
};
export type MergeResponse = CartApiResponse & { reconciliation: MergeOutcome };
export const MAX_MERGE_RECEIPTS = 256;

export class CartError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export function unavailableProduct(id: string): ProductDTO { return { _id: id, title: "Unavailable product", description: "This saved item is currently unavailable.", imageUrl: "", price: "", tags: [], category: null }; }
