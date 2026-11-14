"use client";
import Link from "next/link";
import { useState } from "react";
import { Heart, ArrowRight, Trash2 } from "lucide-react";
import { useWishlist } from "./WishlistProvider";
import { FavoriteButton } from "./FavoriteButton";
import { StorefrontImage } from "@/components/products/StorefrontImage";
import { StorefrontPurchase } from "@/components/products/StorefrontPurchase";
import { ProductPrice } from "@/components/products/StorefrontProducts";
import { MarketingHero } from "@/components/shared/MarketingHero";
import { EmptyState, ErrorFeedback, LoadingIndicator, Select } from "@/components/ui/foundation";
import { Button } from "@/components/ui/button";
import CartSyncStatus from "@/components/cart/CartSyncStatus";
export function WishlistPage() {
  const { data, loading, busy, error, refresh, change } = useWishlist();
  const [category, setCategory] = useState("");
  const categories = [...new Map(data.products.flatMap(product => product.category ? [[product.category._id, product.category.name] as const] : [])).entries()];
  const products = data.products.filter(product => !category || product.category?._id === category);
  return <div className="ds-container grid gap-5 py-6 lg:grid-cols-[240px_minmax(0,1fr)]">
    <aside className="self-start rounded-2xl border border-sidebar-border bg-sidebar p-5 text-sidebar-foreground"><h2 className="text-2xl">My Wishlist</h2><p className="mt-2 text-sm text-slate-300">All your saved products in one place.</p><div className="my-6 flex justify-center"><Heart className="size-20 text-coral" strokeWidth={1} aria-hidden="true" /></div><div className="rounded-xl bg-primary p-3 font-semibold">{loading || error ? "—" : data.count} Saved Items</div><nav className="mt-5 space-y-2" aria-label="Wishlist navigation"><Link href="/account" className="flex min-h-11 items-center gap-2">My Account<ArrowRight className="size-4" /></Link><Link href="/all-products" className="flex min-h-11 items-center gap-2">Continue Shopping<ArrowRight className="size-4" /></Link></nav><p className="mt-5 border-t border-sidebar-border pt-5 text-xs text-slate-300">Collections and price alerts are planned.</p></aside>
    <div className="min-w-0 space-y-5"><MarketingHero label="My Wishlist" title={<>Favorites / <span className="text-primary">Wishlist</span></>} description="Your saved products, all in one place. Explore your favorites and add them to your cart when you’re ready." /><CartSyncStatus />
      {loading ? <LoadingIndicator label="Loading your wishlist…" /> : error ? <ErrorFeedback action={<Button onClick={refresh}>Retry</Button>}>{error}</ErrorFeedback> : <>
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl">{data.count} Saved Items</h2><div><label htmlFor="wishlist-category" className="sr-only">Filter wishlist by category</label><Select id="wishlist-category" value={category} onChange={event => setCategory(event.target.value)}><option value="">All Categories</option>{categories.map(([id,name]) => <option key={id} value={id}>{name}</option>)}</Select></div></div>
        {!data.count ? <EmptyState title="Your wishlist is waiting" description="Save products with the heart button to find them here later." action={<Button asChild><Link href="/all-products">Explore products</Link></Button>} /> : <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{products.map(product => <article key={product._id} className="ds-panel relative grid grid-cols-[35%_minmax(0,1fr)] items-center gap-3 p-4"><div className="absolute right-2 top-2 z-10"><FavoriteButton productId={product._id} title={product.title} /></div><Link href={'/all-products/'+product._id} aria-label={'View '+product.title}><div className="aspect-square"><StorefrontImage src={product.imageUrl} title={product.title} /></div></Link><div className="min-w-0 pt-10"><h3 className="break-words text-sm"><Link href={'/all-products/'+product._id}>{product.title}</Link></h3><p className="my-2 text-xs text-muted-foreground">{product.category?.name || "Product"}</p><ProductPrice price={product.price} /></div><div className="col-span-2 mt-1"><StorefrontPurchase productId={product._id} title={product.title} /></div><Button className="col-span-2 w-full" variant="outline" disabled={busy} onClick={() => void change(product._id,"remove").catch(() => {})}><Trash2 aria-hidden="true" />Remove</Button></article>)}</div>
          {!products.length && !!category && <p className="ds-panel p-5">No saved products in this category. <button className="underline" onClick={() => setCategory("")}>Clear filter</button></p>}
          {data.unavailableIds.length > 0 && <section className="ds-panel p-5"><h2 className="text-lg">Unavailable products</h2><p className="my-3 text-sm text-muted-foreground">{data.unavailableIds.length} saved products have been removed from the catalog. You can remove these saved references.</p>{data.unavailableIds.map((id,index) => <div key={id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border py-2"><span className="text-sm">Unavailable item {index+1}</span><Button variant="outline" disabled={busy} onClick={() => void change(id,"remove").catch(() => {})}>Remove</Button></div>)}</section>}
        </>}
      </>}
    </div>
  </div>;
}
