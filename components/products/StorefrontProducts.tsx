import { FavoriteButton } from "@/components/customer/FavoriteButton";
import Link from "next/link";
import { ArrowUpRight, Layers } from "lucide-react";
import type { ProductDTO } from "@/lib/cart-contract";
import { catalogHref } from "@/lib/storefront-contract";
import { EmptyState, Skeleton } from "@/components/ui/foundation";
import { StorefrontImage } from "./StorefrontImage";
import { StorefrontPurchase } from "./StorefrontPurchase";
export function ProductPrice({ price }: { price: string }) { return <p className="break-words text-xl font-bold tabular-nums">{price?.trim() || "Price unavailable"}</p>; }
export function ProductCard({ product }: { product: ProductDTO }) {
  return <article className="ds-panel group relative flex min-w-0 flex-col overflow-hidden"><div className="absolute right-2 top-2 z-10"><FavoriteButton productId={product._id} title={product.title} /></div><Link href={`/all-products/${product._id}`} className="block" aria-label={`View ${product.title}`}><div className="aspect-[4/3] overflow-hidden bg-gradient-to-br from-white to-secondary"><StorefrontImage src={product.imageUrl} title={product.title} /></div></Link><div className="flex flex-1 flex-col gap-3 p-5"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{product.category?.name || "Explore Dreamshop"}</p><h3 className="break-words"><Link href={`/all-products/${product._id}`} className="hover:text-primary">{product.title}</Link></h3><div className="mt-auto space-y-4"><ProductPrice price={product.price} /><StorefrontPurchase productId={product._id} title={product.title} /></div></div></article>;
}
export function ProductGrid({ products }: { products: ProductDTO[] }) { return products.length ? <div className="grid min-w-0 grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{products.map(product => <ProductCard key={product._id} product={product} />)}</div> : <EmptyState title="No products here yet" description="Try another category or search, or visit again as the catalog grows." />; }
export function CategoryCard({ category }: { category: { _id: string; name: string } }) { return <Link href={catalogHref({ category: category._id })} className="ds-panel flex min-w-0 items-center gap-3 p-5 transition-transform hover:-translate-y-1"><span className="rounded-xl bg-accent p-3 text-primary"><Layers className="size-5" aria-hidden="true" /></span><span className="min-w-0 flex-1 break-words font-semibold">{category.name}</span><ArrowUpRight aria-hidden="true" className="size-4 shrink-0" /></Link>; }
export function ProductGridSkeleton() { return <div role="status"><span className="sr-only">Loading products</span><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <div key={i} className="ds-panel space-y-4 p-5"><Skeleton className="aspect-[4/3]" /><Skeleton className="h-5 w-3/4" /><Skeleton className="h-5 w-1/2" /><Skeleton className="h-11" /></div>)}</div></div>; }
