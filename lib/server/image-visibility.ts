import "server-only";
import Store from "../db/models/store.model";
import User from "../db/models/user.model";
import { activeOwnerFilter, countEligibleProducts, objectId } from "./product-eligibility";
import { requireAuthenticatedUser } from "./authenticated-user";
import { CartError } from "../cart-contract";

export async function canReadStoreImage(id: string, storeId: string) {
  const url = `/api/store-images/${id}`;
  if (await countEligibleProducts({ store: objectId(storeId), imageUrl: url })) return true;
  const store = await Store.findById(storeId).select("owner status logo banner").maxTimeMS(5000);
  if (store?.status === "active" && (store.logo === url || store.banner === url) && await User.exists({ _id: store.owner, ...activeOwnerFilter }).maxTimeMS(5000)) return true;
  // Unpublished/held images remain reviewable by their authorized owner or an admin.
  try {
    const actor = await requireAuthenticatedUser();
    return actor.superAdmin || !!store && String(store.owner) === actor.id && actor.merchantStatus === "approved" && store.status !== "suspended";
  } catch (error) { if (error instanceof CartError) return false; throw error; }
}
