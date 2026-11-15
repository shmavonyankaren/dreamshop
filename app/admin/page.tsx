import Link from "next/link";
import { adminDashboard } from "@/lib/server/admin-queries";
import {
  AdminHero,
  AdminMetrics,
  AuditHistory,
  UserRows,
  StatusBadge,
} from "@/components/admin/AdminShared";
import { Button } from "@/components/ui/button";
export const dynamic = "force-dynamic";
export default async function AdminDashboard() {
  const data = await adminDashboard(),
    m = data.metrics;
  return (
    <>
      <AdminHero
        title="Dreamshop Marketplace Control Center"
        description="Manage merchants, customers, categories and products. Review marketplace operations using current records."
      >
        <Button asChild>
          <Link href="/admin/merchants/applications?status=pending">
            Review applications
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/admin/categories">Manage categories</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/admin/users">Users & access</Link>
        </Button>
      </AdminHero>
      <h2 className="text-2xl">Marketplace overview</h2>
      <AdminMetrics
        metrics={[
          { label: "Registered users", value: m.users },
          { label: "Active customer accounts", value: m.activeCustomers },
          { label: "Active approved merchants", value: m.merchants },
          { label: "Pending applications", value: m.pending },
          { label: "Total stores", value: m.stores },
          { label: "Operationally active stores", value: m.activeStores },
          { label: "Total products", value: m.products },
          { label: "Archived products", value: m.archived },
          { label: "Categories", value: m.categories },
        ]}
      />
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="ds-panel min-w-0 space-y-4 p-5">
          <div className="flex flex-wrap justify-between gap-3">
            <h2 className="text-xl">Merchant applications</h2>
            <Link
              className="text-sm text-primary underline"
              href="/admin/merchants/applications?status=pending"
            >
              View all
            </Link>
          </div>
          <UserRows users={data.applications} merchant />
        </section>
        <section className="ds-panel space-y-4 p-5">
          <h2 className="text-xl">Category management</h2>
          {data.categories.map((c) => (
            <div
              key={c.id}
              className="flex justify-between gap-3 border-b border-border pb-3"
            >
              <Link
                className="break-words font-semibold hover:underline"
                href={`/admin/products?category=${c.id}`}
              >
                {c.name}
              </Link>
              <span className="shrink-0 text-sm text-muted-foreground">
                {c.productCount} products
              </span>
            </div>
          ))}
          {!data.categories.length && (
            <p className="text-sm text-muted-foreground">
              Create a category to organize the marketplace.
            </p>
          )}
          <Button asChild variant="outline">
            <Link href="/admin/categories">Manage categories</Link>
          </Button>
        </section>
      </div>
      <div className="grid min-w-0 gap-5 xl:grid-cols-2">
        <section className="ds-panel space-y-4 p-5">
          <h2 className="text-xl">Recently created stores</h2>
          {data.stores.map((s) => (
            <div
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3"
            >
              <Link
                href={`/admin/merchants/${s.owner}`}
                className="break-words font-semibold hover:underline"
              >
                {s.name}
              </Link>
              <StatusBadge status={s.status} />
            </div>
          ))}
          {!data.stores.length && (
            <p className="text-sm text-muted-foreground">No stores yet.</p>
          )}
          <h2 className="pt-3 text-xl">Recent product listings</h2>
          {data.products.map((p) => (
            <div
              key={p._id}
              className="flex flex-wrap justify-between gap-3 border-b border-border pb-3"
            >
              <Link
                className="break-words hover:underline"
                href={`/admin/products?q=${encodeURIComponent(p.title)}`}
              >
                {p.title}
              </Link>
              <StatusBadge status={p.status} />
            </div>
          ))}
          {!data.products.length && (
            <p className="text-sm text-muted-foreground">No products yet.</p>
          )}
        </section>
        <AuditHistory rows={data.audit} />
      </div>
      <section className="ds-panel p-6">
        <h2 className="text-xl">Marketplace financial reporting</h2>
        <p className="mt-2 text-muted-foreground">
          Available after checkout integration. Revenue, orders, commissions and
          payouts are not available yet.
        </p>
      </section>
    </>
  );
}
