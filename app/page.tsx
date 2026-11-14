import { FavoriteButton } from "@/components/customer/FavoriteButton";
import Link from "next/link";
import { ArrowRight, ShoppingCart, Store, Search, Layers, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorFeedback } from "@/components/ui/foundation";
import { MarketingHero, ElectronicsArtwork } from "@/components/shared/MarketingHero";
import { MarketingCard } from "@/components/shared/MarketingCard";
import { StorefrontImage } from "@/components/products/StorefrontImage";
import { StorefrontPurchase } from "@/components/products/StorefrontPurchase";
import { catalogHref } from "@/lib/storefront-contract";
import CartSyncStatus from "@/components/cart/CartSyncStatus";
import { getHomepageData } from "@/lib/server/storefront-service";
import { storefrontMetadata } from "@/lib/storefront-metadata";
export const dynamic = "force-dynamic";
export const metadata = storefrontMetadata("Dreamshop ? Shop smarter", "Explore products and categories on the Dreamshop marketplace.", "/");
export default async function Home() {
  const data = await getHomepageData();
  return <div className="ds-container marketing-page"><CartSyncStatus />
    <MarketingHero label="Discover Dreamshop" title={<>Shop Smarter with<br /><span className="text-primary">Dreamshop</span></>} description="Discover products for your everyday from independent merchants ? all in one place.">
      <div className="mt-4 flex flex-wrap gap-3"><Button asChild><Link href="/all-products"><ShoppingCart />Shop Now</Link></Button><Button asChild variant="outline"><Link href="#categories">Explore Categories<ArrowRight /></Link></Button></div>
      <div className="mt-4 flex flex-wrap gap-4 text-xs font-medium text-muted-foreground"><span className="flex items-center gap-2"><Search className="size-4" />Discover products</span><span className="flex items-center gap-2"><Layers className="size-4" />Browse categories</span><span className="flex items-center gap-2"><ShieldCheck className="size-4" />Account protection</span></div>
    </MarketingHero>
    <section id="categories" className="grid items-center gap-4 xl:grid-cols-[230px_minmax(0,1fr)]"><div><h2>Shop by Category</h2><p className="text-sm text-body-secondary">Find exactly what you need</p></div>
      {data.categoryError ? <ErrorFeedback title="Categories could not load">Please try refreshing. The database is currently unavailable.</ErrorFeedback> : data.categories.length ? <div className="marketing-strip">{data.categories.slice(0,5).map(category => <Link key={category._id} href={catalogHref({category:category._id})} className="ds-panel flex min-h-16 items-center gap-3 px-3 py-2"><Layers className="size-6 shrink-0 text-primary" aria-hidden="true" /><span className="min-w-0 flex-1 text-sm font-semibold">{category.name}</span><ArrowRight className="size-4 shrink-0" aria-hidden="true" /></Link>)}</div> : <p className="ds-panel p-5 text-sm">Categories will appear here as they are added.</p>}
    </section>
    <section><div className="marketing-section-heading"><div><h2>Explore Our Products</h2><p>Discover the latest additions to Dreamshop</p></div><Link href="/all-products" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-text underline">View All Products<ArrowRight className="size-4" /></Link></div>
      {data.productError ? <ErrorFeedback title="Products could not load">Please try refreshing. We could not reach the product catalog.</ErrorFeedback> : data.products.length ? <div className="marketing-products">{data.products.slice(0,5).map(product => <article key={product._id} className="ds-panel marketing-product"><Link href={'/all-products/'+product._id} aria-label={'View '+product.title} className="marketing-product-image"><StorefrontImage src={product.imageUrl} title={product.title} /></Link><div className="min-w-0"><h3><Link href={'/all-products/'+product._id}>{product.title}</Link></h3><FavoriteButton productId={product._id} title={product.title} /><p className="product-price">{product.price || 'Price unavailable'}</p><StorefrontPurchase productId={product._id} title={product.title} /></div></article>)}</div> : <p className="ds-panel p-6">No products are available yet. Please visit again as the catalog grows.</p>}
    </section>
    <section className="marketing-banner grid items-center gap-4 sm:grid-cols-[1fr_1fr_auto]"><div><p className="text-xs font-semibold uppercase tracking-wide">Discover something new</p><h2 className="mt-1 text-3xl!">Your next great find</h2><p className="mt-1 text-sm">Explore the Dreamshop collection</p></div><ElectronicsArtwork className="mx-auto hidden max-w-80 sm:block" /><Button asChild variant="outline"><Link href="/all-products">Shop Now<ArrowRight /></Link></Button></section>
    <section className="grid gap-4 lg:grid-cols-[260px_1fr_1fr]"><div><h2>A Marketplace<br />for Everyone</h2><p className="mt-1 text-sm text-body-secondary">Connecting product discovery and independent merchants.</p></div><MarketingCard icon={ShoppingCart} title="For Customers"><p>Discover products, explore categories, and keep your finds in your cart.</p></MarketingCard><MarketingCard icon={Store} title="For Merchants"><p>A shared marketplace for independent businesses.</p><Link href="/about-us" className="inline-flex min-h-11 items-center gap-2 font-semibold text-primary">Learn about Dreamshop<ArrowRight className="size-4" /></Link></MarketingCard></section>
  </div>;
}
