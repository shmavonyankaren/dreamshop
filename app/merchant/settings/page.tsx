import { StoreForm, ImageLibrary } from "@/components/merchant/MerchantForms";
import { ownedStore, storeDTO } from "@/lib/server/store-service";
import { requireAuthenticatedUser } from "@/lib/server/authenticated-user";
import { storeImages } from "@/lib/server/store-images";
export default async function StoreSettings() {
  const [store, images] = await Promise.all([ownedStore(await requireAuthenticatedUser()), storeImages()]);
  return <><h1 className="text-3xl">Store settings</h1><StoreForm mode="settings" initial={storeDTO(store)} images={images} /><ImageLibrary images={images} /></>;
}
