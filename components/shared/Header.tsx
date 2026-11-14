"use client";
import Link from "next/link";
import { Heart, UserRound } from "lucide-react";
import { useId, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, Search } from "lucide-react";
import Logo from "./Logo";
import NavigationMenu from "./NavigationMenu";
import AuthHeader from "./AuthHeader";
import { ModeToggle } from "./ModeToggle";
import ShoppingCart from "@/components/products/ShoppingCart";
import { Drawer } from "@/components/ui/interactive";
import { IconButton } from "@/components/ui/foundation";
function ProductSearch({ onSearch }: { onSearch?: () => void }) { const searchId = useId(); return <form action="/all-products" role="search" onSubmit={onSearch} className="flex min-w-0 flex-1 items-center rounded-full border border-white/20 bg-white/10 focus-within:ring-2 focus-within:ring-coral"><label htmlFor={searchId} className="sr-only">Search products</label><input id={searchId} name="q" type="search" maxLength={200} placeholder="Search products and more?" className="min-h-11 min-w-0 flex-1 rounded-l-full bg-transparent pl-4 text-sm text-white placeholder:text-slate-300 focus-visible:outline-none" /><button type="submit" aria-label="Search products" className="flex size-11 shrink-0 items-center justify-center rounded-full text-white"><Search className="size-5" aria-hidden="true" /></button></form>; }
export default function Header() {
  const [open,setOpen] = useState(false); const pathname = usePathname();
  return <header className="sticky top-0 z-40 border-b border-white/10 bg-nav-from/95 text-white backdrop-blur-xl"><div className="ds-container max-w-[1320px] flex min-h-16 flex-wrap items-center gap-x-4 gap-y-2 py-2"><Logo /><div className="hidden lg:block"><NavigationMenu /></div><div className="hidden min-w-0 flex-1 xl:block"><ProductSearch /></div><div className="ml-auto flex items-center gap-1"><div className="hidden sm:block"><ModeToggle /></div><Link href="/favourites" aria-label="My wishlist" className="flex size-11 items-center justify-center rounded-lg hover:bg-white/10"><Heart className="size-5" aria-hidden="true" /></Link><Link href="/account" aria-label="My account" className="flex size-11 items-center justify-center rounded-lg hover:bg-white/10"><UserRound className="size-5" aria-hidden="true" /></Link><ShoppingCart /><AuthHeader /><div className="lg:hidden"><Drawer key={pathname} title="Explore Dreamshop" open={open} onOpenChange={setOpen} trigger={<IconButton label="Open navigation" className="text-white hover:bg-white/10 hover:text-white"><Menu /></IconButton>}><div className="space-y-5 rounded-xl bg-sidebar p-4 text-white"><ProductSearch onSearch={() => setOpen(false)} /><NavigationMenu onNavigate={() => setOpen(false)} /><ModeToggle /><p className="border-t border-sidebar-border pt-4 text-sm text-slate-300">Browse the shop or visit Help for answers.</p></div></Drawer></div></div><div className="w-full xl:hidden"><ProductSearch /></div></div></header>;
}
