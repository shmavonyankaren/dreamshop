"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, PanelLeftClose, PanelLeftOpen, LayoutDashboard, ArrowLeft } from "lucide-react";
import { Drawer } from "@/components/ui/interactive";
import { Badge, Breadcrumbs, IconButton } from "@/components/ui/foundation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AccountNavigation } from "@/components/customer/AccountNavigation";

export type WorkspaceArea = "account" | "merchant" | "admin";
const navigation: Record<WorkspaceArea, string[]> = {
  account: ["Overview", "Personal information", "Addresses", "Payment methods", "Orders", "Wishlist", "Security", "Notifications", "Preferences"],
  merchant: ["Dashboard", "Products", "Orders", "Inventory", "Payments & payouts", "Analytics", "Customers", "Store settings"],
  admin: ["Dashboard", "Marketplace statistics", "Categories", "Merchants", "Customers", "Products", "Approvals & moderation", "Users & access", "Orders & transactions", "System settings"],
};
export function WorkspaceShell({ area, children }: { area: WorkspaceArea; children: ReactNode }) {
  const [open, setOpen] = useState(false), [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const title = area === "account" ? "My account" : area === "merchant" ? "Merchant workspace" : "Super Admin";
  const nav = area === "account" ? <AccountNavigation onNavigate={() => setOpen(false)} /> : <nav aria-label={`${title} navigation`} className="space-y-1">{navigation[area].map((label) => <div key={label} aria-disabled="true" className="flex min-h-11 items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm opacity-65"><span>{label}</span><span className="text-xs">Planned</span></div>)}<Link href="/all-products" onClick={() => setOpen(false)} className="mt-5 flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm hover:bg-sidebar-accent"><ArrowLeft className="size-4" aria-hidden="true" />Back to shop</Link></nav>;
  return <div className="ds-container grid min-w-0 flex-1 gap-6 py-6 lg:grid-cols-[auto_minmax(0,1fr)]">
    <aside className={cn("hidden self-start rounded-2xl border border-sidebar-border bg-sidebar p-4 text-sidebar-foreground lg:block lg:sticky lg:top-28", collapsed ? "w-20" : "w-64")}>
      <div className="mb-5 flex items-center justify-between gap-2">{!collapsed && <h2 className="text-lg">{title}</h2>}<IconButton label={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setCollapsed(!collapsed)} className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-white">{collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}</IconButton></div>{collapsed ? <LayoutDashboard className="mx-auto size-5" aria-hidden="true" /> : nav}
    </aside>
    <div className="min-w-0 space-y-6"><div className="flex flex-wrap items-center justify-between gap-3"><Breadcrumbs items={[{ label: "Dreamshop", href: "/" }, { label: title }]} /><div className="lg:hidden"><Drawer key={pathname} open={open} onOpenChange={setOpen} title={title} trigger={<IconButton label="Open workspace navigation"><Menu /></IconButton>}><div className="rounded-xl bg-sidebar p-3 text-sidebar-foreground">{nav}</div></Drawer></div></div><Badge tone="brand">{title}</Badge>{children}</div>
  </div>;
}
export function MetricCard({ label, value, description }: { label: string; value: ReactNode; description?: string }) { return <Card><CardHeader><CardTitle>{label}</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold tabular-nums">{value}</p>{description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}</CardContent></Card>; }
export function ChartPanel({ title, description, children }: { title: string; description: string; children: ReactNode }) { return <Card><CardHeader><CardTitle>{title}</CardTitle><p className="text-sm text-muted-foreground">{description}</p></CardHeader><CardContent><div role="figure" aria-label={description} className="min-w-0">{children}</div></CardContent></Card>; }
