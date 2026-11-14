import { z } from "zod";
import { productIdSchema, type ProductDTO } from "./cart-contract";
export const MAX_WISHLIST_ITEMS = 500;
export const wishlistMutationSchema = z.object({ productId: productIdSchema, action: z.enum(["add", "remove"]) }).strict();
export type WishlistDTO = { products: ProductDTO[]; unavailableIds: string[]; savedIds: string[]; count: number };
