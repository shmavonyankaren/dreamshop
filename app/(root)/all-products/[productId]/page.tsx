import { FavoriteButton } from "@/components/customer/FavoriteButton";
import { cache } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getRelatedProducts, getStorefrontProduct } from "@/lib/server/storefront-service";
import { storefrontMetadata } from "@/lib/storefront-metadata";
import { catalogHref } from "@/lib/storefront-contract";
import { Breadcrumbs, Badge } from "@/components/ui/foundation";
import { ProductGrid, ProductPrice } from "@/components/products/StorefrontProducts";
import { StorefrontImage } from "@/components/products/StorefrontImage";
import { StorefrontPurchase } from "@/components/products/StorefrontPurchase";
import CartSyncStatus from "@/components/cart/CartSyncStatus";
const getProduct = cache(getStorefrontProduct);
type Props = { params: Promise<{ productId: string }> };
export async function generateMetadata({ params }: Props) { const { productId } = await params; const product = await getProduct(productId); return product ? storefrontMetadata(product.title, product.description.slice(0, 160), `/all-products/${product._id}`) : { title: "Product not found", robots: { index: false } }; }
export default async function ProductDetails({ params }: Props) {
  const product = await getProduct((await params).productId);
  if (!product) notFound();
  const related = await getRelatedProducts(product).then(products => ({ products, error: false })).catch(() => ({ products: [], error: true }));
  return <div className="ds-container space-y-8 py-8"><Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Shop", href: "/all-products" }, ...(product.category ? [{ label: product.category.name, href: catalogHref({ category: product.category._id }) }] : []), { label: product.title }]} /><CartSyncStatus />
    <div className="grid min-w-0 gap-6 lg:grid-cols-2"><section aria-label="Product image" className="ds-panel relative overflow-hidden bg-[radial-gradient(ellipse_at_center,#ffe4e8,transparent_70%)]"><div className="aspect-square p-3 sm:p-8"><StorefrontImage src={product.imageUrl} title={product.title} priority /></div></section><section className="ds-panel flex min-w-0 flex-col gap-6 p-6 sm:p-9">{product.category && <Link href={catalogHref({ category: product.category._id })} className="self-start"><Badge tone="brand">{product.category.name}</Badge></Link>}{product.publicStore && <Link href={`/stores/${product.publicStore.slug}`} className="font-semibold text-primary hover:underline">Visit {product.publicStore.name}</Link>}<h1 className="ds-page-title break-words">{product.title}</h1><div className="text-primary"><ProductPrice price={product.price} /></div><p className="whitespace-pre-wrap break-words text-muted-foreground">{product.description}</p>{product.tags.length > 0 && <ul aria-label="Product tags" className="flex flex-wrap gap-2">{product.tags.map((tag, i) => <li key={`${tag}-${i}`} className="max-w-full break-words"><Badge>{tag}</Badge></li>)}</ul>}<div className="mt-auto border-t border-border pt-6"><StorefrontPurchase productId={product._id} title={product.title} quantitySelector /><div className="mt-3"><FavoriteButton productId={product._id} title={product.title} showLabel /></div><Link href="/cart" className="mt-4 flex min-h-11 items-center justify-center font-semibold text-primary underline-offset-4 hover:underline">View your cart</Link></div></section></div>
    <section className="space-y-5"><h2>More to explore{product.category ? ` in ${product.category.name}` : ""}</h2>{related.error ? <p role="status">Related products could not load. Explore the <Link className="underline" href="/all-products">full catalog</Link>.</p> : related.products.length ? <ProductGrid products={related.products} /> : <p className="text-body-secondary">No related products to show yet. <Link className="underline" href="/all-products">Explore all products</Link>.</p>}</section>
  </div>;
}
