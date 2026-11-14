import "server-only";
import Wishlist from "../db/models/wishlist.model";
import Product from "../db/models/product.model";
import { connectDB } from "../db/connection";
import { requireAuthenticatedUser } from "./authenticated-user";
import { CartError } from "../cart-contract";
import { MAX_WISHLIST_ITEMS, wishlistMutationSchema, type WishlistDTO } from "../wishlist-contract";
import { PRODUCT_FIELDS, toProductDTO, type ProductRecord } from "./product-dto";

async function readOwnedWishlist(owner: string): Promise<WishlistDTO> {
  const record = await Wishlist.findById(owner).select("products");
  const savedIds: string[] = (record?.products ?? []).map((id: { toString(): string }) => id.toString());
  if (!savedIds.length) return { products: [], unavailableIds: [], savedIds: [], count: 0 };
  const records = await Product.find({ _id: { $in: savedIds } }).select(PRODUCT_FIELDS).populate({ path: "category", select: "_id name" }).limit(MAX_WISHLIST_ITEMS);
  const byId = new Map<string, ReturnType<typeof toProductDTO>>(records.map((record: ProductRecord) => { const product = toProductDTO(record); return [product._id, product]; }));
  const products = [...savedIds].reverse().flatMap(id => byId.has(id) ? [byId.get(id)!] : []);
  return { products, savedIds, unavailableIds: savedIds.filter(id => !byId.has(id)), count: savedIds.length };
}
export async function getWishlist() {
  const user = await requireAuthenticatedUser();
  await connectDB();
  return readOwnedWishlist(user.id);
}
export async function mutateWishlist(input: unknown) {
  const user = await requireAuthenticatedUser();
  const { productId, action } = wishlistMutationSchema.parse(input);
  await connectDB();
  if (action === "remove") {
    await Wishlist.updateOne({ _id: user.id }, { $pull: { products: productId } });
  } else {
    if (!await Product.exists({ _id: productId })) throw new CartError(404, "PRODUCT_UNAVAILABLE", "This product is no longer available.");
    try { await Wishlist.updateOne({ _id: user.id }, { $setOnInsert: { products: [] } }, { upsert: true }); }
    catch (error) { if ((error as { code?: number }).code !== 11000) throw error; }
    // Capacity and deduplication are enforced in the same atomic document write.
    const result = await Wishlist.updateOne({ _id: user.id, $or: [{ [`products.${MAX_WISHLIST_ITEMS - 1}`]: { $exists: false } }, { products: productId }] }, { $addToSet: { products: productId } });
    if (!result.matchedCount) {
      throw new CartError(409, "WISHLIST_LIMIT", "Your wishlist is full. Remove an item before adding another.");
    }
  }
  return readOwnedWishlist(user.id);
}
