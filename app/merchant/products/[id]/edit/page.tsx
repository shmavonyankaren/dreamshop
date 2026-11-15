import { notFound } from "next/navigation";
import { currencySettings } from "@/lib/server/currency-service";
import { ProductForm } from "@/components/merchant/MerchantForms";
import { merchantProduct } from "@/lib/server/merchant-products";
import { getStorefrontCategories } from "@/lib/server/storefront-service";
import { storeImages } from "@/lib/server/store-images";
import { productIdSchema } from "@/lib/cart-contract";
export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; if (!productIdSchema.safeParse(id).success) notFound();
  const [product, categories, images, currencies] = await Promise.all([merchantProduct(id), getStorefrontCategories(), storeImages(), currencySettings()]);
  if (!product) notFound();
  return <><h1 className="text-3xl">Edit product</h1><section className="ds-panel space-y-2 p-5"><h2 className="text-lg">Moderation: {product.moderationStatus}</h2>{product.moderationStatus === "held" && <><p className="break-words">{product.moderationReason}</p><p className="text-sm text-muted-foreground">You may edit or archive this product, but only a Super Admin can release the hold. Restoring publication does not make a held product available.</p></>}</section><ProductForm product={product} categories={categories} images={images} currencies={currencies} /></>;
}
