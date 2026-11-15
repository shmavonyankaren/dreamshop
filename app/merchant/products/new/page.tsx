import { currencySettings } from "@/lib/server/currency-service";
import { ProductForm } from "@/components/merchant/MerchantForms";
import { getStorefrontCategories } from "@/lib/server/storefront-service";
import { storeImages } from "@/lib/server/store-images";
export default async function NewProduct() {
  const [categories, images, currencies] = await Promise.all([getStorefrontCategories(), storeImages(), currencySettings()]);
  return <><h1 className="text-3xl">Add a product</h1><ProductForm categories={categories} images={images} currencies={currencies} /></>;
}
