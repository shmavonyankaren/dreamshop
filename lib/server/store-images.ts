import "server-only";
import sharp from "sharp";
import StoreImage from "../db/models/store-image.model";
import Product from "../db/models/product.model";
import { ownedStore } from "./store-service";
import { authorizedMutation } from "./marketplace-transaction";
import { requireAuthenticatedUser } from "./authenticated-user";
import { AuthorizationError } from "../authorization-contract";
import { validateImage, MAX_IMAGE_BYTES } from "../merchant-contract";
import { productIdSchema } from "../cart-contract";

export async function uploadStoreImage(bytes: Uint8Array, mime: string) {
  try { validateImage(bytes, mime); } catch (error) { throw new AuthorizationError(400, "INVALID_IMAGE", (error as Error).message); }
  await ownedStore(await requireAuthenticatedUser());
  let normalized: Buffer;
  try { normalized = await sharp(bytes, { limitInputPixels: 16000000, failOn: "warning" }).rotate().resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer(); }
  catch { throw new AuthorizationError(400, "INVALID_IMAGE", "Unable to decode this image. Choose a valid image up to 16 megapixels."); }
  if (normalized.length > MAX_IMAGE_BYTES) throw new AuthorizationError(400, "INVALID_IMAGE", "This image is too large after processing.");
  return authorizedMutation("merchant:access", async (actor, session) => {
    const store = await ownedStore(actor, session);
    if (await StoreImage.countDocuments({ store: store._id }).session(session) >= 100) throw new AuthorizationError(409, "IMAGE_LIMIT", "Your store has 100 images. Remove unused images before uploading more.");
    const [image] = await StoreImage.create([{ store: store._id, data: normalized, mime: "image/webp" }], { session });
    return { id: String(image._id), url: `/api/store-images/${image._id}` };
  });
}
export async function storeImages() {
  const store = await ownedStore(await requireAuthenticatedUser());
  const images = await StoreImage.find({ store: store._id }).select("_id").sort({ createdAt: -1 }).limit(100);
  return images.map((image: { _id: unknown }) => ({ id: String(image._id), url: `/api/store-images/${image._id}` }));
}
export async function deleteStoreImage(input: unknown) {
  return authorizedMutation("merchant:access", async (actor, session) => {
    const id = productIdSchema.parse(input), store = await ownedStore(actor, session), url = `/api/store-images/${id}`;
    if (store.logo === url || store.banner === url || await Product.exists({ imageUrl: url }).session(session)) throw new AuthorizationError(409, "IMAGE_IN_USE", "Replace this image in the store profile or product before removing it.");
    await StoreImage.deleteOne({ _id: id, store: store._id }, { session });
    return { removed: true };
  });
}
