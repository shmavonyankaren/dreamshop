"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export default function NavigationMenu({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return <nav aria-label="Main navigation" className="flex flex-col gap-1 lg:flex-row">{[{ label: "Home", href: "/" }, { label: "Shop", href: "/all-products" }, { label: "About", href: "/about-us" }, { label: "Help", href: "/faq" }].map(({label,href}) => <Link key={href} href={href} onClick={onNavigate} className="ds-nav-link" aria-current={pathname === href || href !== "/" && pathname.startsWith(href + "/") ? "page" : undefined}>{label}</Link>)}</nav>;
}
