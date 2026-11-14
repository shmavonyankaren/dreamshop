"use client";
import Link from "next/link";
import { useClerk, useUser } from "@clerk/nextjs";
import { Heart, ShoppingBag, ShieldCheck, UserRound, ArrowRight } from "lucide-react";
import { MarketingHero } from "@/components/shared/MarketingHero";
import { Button } from "@/components/ui/button";
import { useWishlist } from "./WishlistProvider";
import { useCart } from "@/components/CartContext";
import CartSyncStatus from "@/components/cart/CartSyncStatus";
export function AccountOverview({ profile }: { profile: { displayName: string | null; email: string | null; username: string | null; avatar: string | null; joined: string | null } }) {
  const { user } = useUser(); const { openUserProfile } = useClerk();
  const { data, loading, error, refresh } = useWishlist(); const { cartItemsCount } = useCart();
  const name = user?.fullName || user?.username || profile.displayName || "there";
  return <div className="space-y-5"><MarketingHero label="My Account" title={<>Welcome back, <span className="text-primary">{name}!</span></>} description="Manage your profile, revisit your saved products, and keep your Dreamshop account up to date." /><CartSyncStatus />
    <div className="grid gap-4 sm:grid-cols-2"><Link href="/favourites" className="ds-panel flex items-center gap-4 p-5"><span className="marketing-icon"><Heart /></span><div><h2 className="text-base">Wishlist Items</h2><p className="text-3xl font-bold">{loading || error ? "—" : data.count}</p></div></Link><Link href="/cart" className="ds-panel flex items-center gap-4 p-5"><span className="marketing-icon"><ShoppingBag /></span><div><h2 className="text-base">Items in Your Cart</h2><p className="text-3xl font-bold">{cartItemsCount}</p></div></Link></div>
    {error && <p role="alert">{error} <button onClick={refresh} className="underline">Retry wishlist</button></p>}
    <div className="grid gap-4 xl:grid-cols-2"><section id="profile" className="ds-panel p-6"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-xl"><UserRound className="text-primary" />Personal Information</h2><Button variant="outline" onClick={() => openUserProfile()}>Edit profile</Button></div><dl className="divide-y divide-border text-sm">{[["Full name",name],["Email address",user?.primaryEmailAddress?.emailAddress || profile.email || "Not provided"],["Username",user?.username || profile.username || "Not provided"],["Account type","Customer access"]].map(([label,value]) => <div key={label} className="grid gap-2 py-4 sm:grid-cols-[140px_1fr]"><dt className="text-muted-foreground">{label}</dt><dd className="break-all font-medium">{value}</dd></div>)}</dl></section>
    <section id="security" className="ds-panel p-6"><h2 className="mb-5 flex items-center gap-2 text-xl"><ShieldCheck className="text-primary" />Security & Account</h2><p className="text-sm text-muted-foreground">Manage your profile, sign-in methods, and available security settings through Clerk.</p><Button className="mt-5 w-full" variant="outline" onClick={() => openUserProfile()}>Manage account & security<ArrowRight /></Button><p className="mt-5 text-sm text-muted-foreground">Addresses, payment methods, order history, and notification preferences are planned. No payment details are stored here.</p></section></div>
  </div>;
}
