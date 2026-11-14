"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { UserButton, useUser } from "@clerk/nextjs";
import { navigateAccountSection } from "@/lib/utils/accountSections";

const sections = [{ label: "Overview", hash: "#overview" }, { label: "Personal Information", hash: "#profile" }, { label: "Security", hash: "#security" }];
const planned = ["Addresses", "Payment Methods", "Orders", "Notifications", "Preferences"];
function subscribe(listener: () => void) {
  window.addEventListener("hashchange", listener); window.addEventListener("popstate", listener);
  return () => { window.removeEventListener("hashchange", listener); window.removeEventListener("popstate", listener); };
}
export function AccountNavigation({ onNavigate }: { onNavigate?: (hash?: string) => void }) {
  const { user } = useUser(); const path = usePathname();
  const hash = useSyncExternalStore(subscribe, () => window.location.hash, () => "");
  const active = hash === "#profile" || hash === "#security" ? hash : "#overview";
  return <div><div className="mb-5 border-b border-sidebar-border pb-5 text-center"><div className="mb-3 flex justify-center"><UserButton appearance={{ elements: { userButtonAvatarBox: "size-20" } }} /></div><p className="font-bold">{user?.fullName || user?.username || "Your account"}</p><p className="break-all text-xs text-slate-300">{user?.primaryEmailAddress?.emailAddress}</p><span className="mt-3 inline-block rounded-full bg-sidebar-accent px-3 py-1 text-xs">Customer account</span></div>
    <nav aria-label="Account navigation" className="space-y-1"><p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-300">On this page</p>
      {sections.map(item => <a key={item.hash} href={`/account${item.hash}`} aria-current={path === "/account" && active === item.hash ? "location" : undefined} onClick={event => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const navigated = navigateAccountSection(item.hash);
        if (navigated) event.preventDefault();
        onNavigate?.(navigated ? item.hash : undefined);
      }} className="flex min-h-11 items-center rounded-xl px-3 text-sm hover:bg-sidebar-accent aria-[current=location]:bg-primary aria-[current=location]:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral">{item.label}</a>)}
      <Link href="/favourites" onClick={() => onNavigate?.()} className="flex min-h-11 items-center rounded-xl px-3 text-sm hover:bg-sidebar-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral">Wishlist</Link>
      <div className="mt-4 border-t border-sidebar-border pt-4"><p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-300">Coming later</p>{planned.map(label => <div key={label} aria-disabled="true" aria-label={`${label}: Planned`} className="flex min-h-11 items-center justify-between gap-3 px-3 text-sm text-slate-300"><span>{label}</span><span className="text-xs">Planned</span></div>)}</div>
    </nav></div>;
}
