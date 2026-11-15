"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Layers,
  Coins,
  Store,
  Users,
  Package,
  ShieldCheck,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
export function AdminNavigation({ onNavigate }: { onNavigate: () => void }) {
  const path = usePathname();
  const links = [
    { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { label: "Category management", href: "/admin/categories", icon: Layers },
    { label: "Merchants & stores", href: "/admin/merchants", icon: Store },
    {
      label: "Applications",
      href: "/admin/merchants/applications",
      icon: ShieldCheck,
    },
    { label: "Users & access", href: "/admin/users", icon: Users },
    { label: "Products", href: "/admin/products", icon: Package },
    { label: "Currencies", href: "/admin/currencies", icon: Coins },
  ];
  const selected = links
    .filter(
      (link) =>
        path === link.href ||
        (link.href !== "/admin" && path.startsWith(link.href + "/")),
    )
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <nav aria-label="Super Admin navigation" className="space-y-1">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          onClick={onNavigate}
          aria-current={selected === link.href ? "page" : undefined}
          className={cn(
            "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm",
            selected === link.href
              ? "bg-primary text-primary-foreground"
              : "hover:bg-sidebar-accent",
          )}
        >
          <link.icon className="size-5 shrink-0" />
          {link.label}
        </Link>
      ))}
      <div className="mt-4 border-t border-sidebar-border pt-4">
        {["Financial reporting", "Orders & payouts", "System settings"].map(
          (label) => (
            <p
              key={label}
              className="flex min-h-11 items-center justify-between gap-2 px-3 text-sm opacity-65"
            >
              <span>{label}</span>
              <span className="text-xs">Planned</span>
            </p>
          ),
        )}
      </div>
      <Link
        href="/all-products"
        onClick={onNavigate}
        className="flex min-h-11 items-center gap-3 px-3 text-sm"
      >
        <ArrowLeft className="size-4" />
        Back to shop
      </Link>
    </nav>
  );
}
