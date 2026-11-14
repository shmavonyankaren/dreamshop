"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, useUser } from "@clerk/nextjs";
const entries = [{ label: "Overview", href: "/account" }, { label: "Personal Information", href: "/account#profile" }, { label: "Addresses" }, { label: "Payment Methods" }, { label: "Orders" }, { label: "Wishlist", href: "/favourites" }, { label: "Security", href: "/account#security" }, { label: "Notifications" }, { label: "Preferences" }];
export function AccountNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useUser(); const path = usePathname();
  return <div><div className="mb-5 border-b border-sidebar-border pb-5 text-center"><div className="mb-3 flex justify-center"><UserButton appearance={{ elements: { userButtonAvatarBox: "size-20" } }} /></div><p className="font-bold">{user?.fullName || user?.username || "Your account"}</p><p className="break-all text-xs text-slate-300">{user?.primaryEmailAddress?.emailAddress}</p><span className="mt-3 inline-block rounded-full bg-sidebar-accent px-3 py-1 text-xs">Customer account</span></div><nav aria-label="Account navigation" className="space-y-1">{entries.map(item => item.href ? <Link key={item.label} href={item.href} onClick={onNavigate} aria-current={path === item.href ? "page" : undefined} className="flex min-h-11 items-center rounded-xl px-3 text-sm hover:bg-sidebar-accent aria-[current=page]:bg-primary aria-[current=page]:text-white">{item.label}</Link> : <div key={item.label} aria-disabled="true" className="flex min-h-11 items-center justify-between gap-3 px-3 text-sm text-slate-300"><span>{item.label}</span><span className="text-xs">Planned</span></div>)}</nav></div>;
}
