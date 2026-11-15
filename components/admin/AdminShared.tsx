import Link from "next/link";
import {
  ShieldCheck,
  Users,
  Store,
  Layers,
  Package,
  Activity,
} from "lucide-react";
import { Input, Select, Badge, Pagination } from "@/components/ui/foundation";
import { Button } from "@/components/ui/button";
import {
  adminHref,
  type AdminAudit,
  type AdminUser,
  type AdminStore,
  type parseAdminQuery,
} from "@/lib/admin-contract";
import { ConfirmAdminAction } from "./AdminActions";
import type { ReactNode } from "react";
export function AdminHero({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <header className="ds-panel overflow-hidden bg-[radial-gradient(ellipse_at_top_right,#ffe0e8,transparent_65%)] p-6 sm:p-8">
      <Badge tone="brand">
        <ShieldCheck className="size-4" />
        Super Admin
      </Badge>
      <h1 className="mt-4 text-3xl font-bold sm:text-4xl">{title}</h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">{description}</p>
      {children && <div className="mt-5 flex flex-wrap gap-3">{children}</div>}
    </header>
  );
}
export function AdminMetrics({
  metrics,
}: {
  metrics: { label: string; value: number }[];
}) {
  const icons = [Users, Store, Package, Layers, Activity];
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
      {metrics.map((m, i) => {
        const Icon = icons[i % icons.length];
        return (
          <section
            key={m.label}
            className="ds-panel flex items-center gap-4 p-5"
          >
            <span className="rounded-2xl bg-accent p-3 text-primary">
              <Icon className="size-6" />
            </span>
            <div>
              <h2 className="text-sm font-semibold">{m.label}</h2>
              <p className="text-3xl font-bold tabular-nums">
                {m.value.toLocaleString("en-US")}
              </p>
            </div>
          </section>
        );
      })}
    </div>
  );
}
export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      tone={
        status === "active" || status === "approved"
          ? "success"
          : status === "pending" || status === "paused"
            ? "warning"
            : status === "suspended" ||
                status === "deleted" ||
                status === "rejected"
              ? "error"
              : "neutral"
      }
    >
      {status}
    </Badge>
  );
}
export function AdminFilters({
  query,
  statuses = [],
  roles = false,
  productFilters = false,
  categoryOnly = false,
  options,
}: {
  query: ReturnType<typeof parseAdminQuery>;
  statuses?: string[];
  roles?: boolean;
  productFilters?: boolean;
  categoryOnly?: boolean;
  options?: {
    merchants: { id: string; name: string }[];
    categories: { id: string; name: string }[];
  };
}) {
  return (
    <form className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <label className="space-y-1 text-sm">
        Search
        <Input
          name="q"
          placeholder="Search names or titles"
          maxLength={100}
          defaultValue={query.q}
        />
      </label>
      {statuses.length > 0 && (
        <label className="space-y-1 text-sm">
          Status
          <Select name="status" defaultValue={query.status}>
            <option value="">All statuses</option>
            {statuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </label>
      )}
      {roles && (
        <label className="space-y-1 text-sm">
          Capability
          <Select name="role" defaultValue={query.role}>
            <option value="">All users</option>
            <option value="customer">
              Customers without merchant/admin access
            </option>
            <option value="merchant">Approved merchants</option>
            <option value="admin">Super Admins</option>
          </Select>
        </label>
      )}
      {productFilters && (
        <>
          <label className="space-y-1 text-sm">
            Moderation
            <Select name="moderation" defaultValue={query.moderation}>
              <option value="">All moderation states</option>
              <option value="clear">Clear</option>
              <option value="held">Held</option>
            </Select>
          </label>
          <label className="space-y-1 text-sm">
            Merchant
            <Select name="merchant" defaultValue={query.merchant}>
              <option value="">All merchants</option>
              {query.merchant &&
                !options?.merchants.some((m) => m.id === query.merchant) && (
                  <option value={query.merchant}>Selected merchant</option>
                )}
              {options?.merchants.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
            <span className="text-xs text-muted-foreground">
              Recent approved merchants; use the merchant directory for others.
            </span>
          </label>
          <label className="space-y-1 text-sm">
            Category
            <Select name="category" defaultValue={query.category}>
              <option value="">All categories</option>
              {query.category &&
                !options?.categories.some((c) => c.id === query.category) && (
                  <option value={query.category}>Selected category</option>
                )}
              {options?.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </label>
          {query.store && (
            <input type="hidden" name="store" value={query.store} />
          )}
        </>
      )}
      <label className="space-y-1 text-sm">
        Sort
        <Select
          name="sort"
          defaultValue={
            categoryOnly && !query.sort.startsWith("name")
              ? "name-asc"
              : query.sort
          }
        >
          {!categoryOnly && (
            <>
              <option value="newest">Newest registered / created</option>
              <option value="oldest">Oldest registered / created</option>
            </>
          )}
          <option value="name-asc">Name A–Z</option>
          <option value="name-desc">Name Z–A</option>
        </Select>
      </label>
      <Button type="submit">Apply filters</Button>
    </form>
  );
}
export function AdminPagination({
  path,
  data,
}: {
  path: string;
  data: { totalPages: number; query: ReturnType<typeof parseAdminQuery> };
}) {
  return (
    <Pagination
      page={data.query.page}
      totalPages={data.totalPages}
      hrefForPage={(page) => adminHref(path, data.query, page)}
    />
  );
}
export function UserRows({
  users,
  merchant = false,
}: {
  users: (AdminUser & {
    store?: AdminStore | null;
    application?: { name: string; createdAt: string | null } | null;
  })[];
  merchant?: boolean;
}) {
  return (
    <div className="space-y-3">
      {!users.length && (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
          No accounts match these filters.
        </p>
      )}
      {users.map((user) => (
        <article
          key={user.id}
          className="grid min-w-0 gap-3 rounded-xl border border-border p-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]"
        >
          <div className="min-w-0">
            <Link
              className="font-semibold break-words hover:underline"
              href={`/admin/${merchant ? "merchants" : "users"}/${user.id}`}
            >
              {user.name}
            </Link>
            <p className="break-all text-sm text-muted-foreground">
              {user.email ?? "No email available"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Registered {user.createdAt?.slice(0, 10) ?? "Not recorded"}
            </p>
            {user.application && (
              <p className="mt-2 text-sm">
                Application: {user.application.name} ·{" "}
                {user.application.createdAt?.slice(0, 10) ?? "Date unavailable"}
              </p>
            )}
            {merchant && (
              <p className="mt-2 text-sm">
                {user.store
                  ? `${user.store.name} · ${user.store.productCount} products · store ${user.store.status}`
                  : "Store setup incomplete"}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-start gap-2">
            <StatusBadge status={user.status} />
            {user.applicationStatus !== "active" && (
              <Badge tone="error">Account policy suspended</Badge>
            )}
            <Badge>{user.superAdmin ? "Super Admin" : "Customer"}</Badge>
            {user.merchantStatus !== "none" && (
              <StatusBadge status={user.merchantStatus} />
            )}
          </div>
          <Button asChild variant="outline">
            <Link
              href={`/admin/${merchant ? "merchants" : "users"}/${user.id}`}
            >
              View details
            </Link>
          </Button>
        </article>
      ))}
    </div>
  );
}
export function AuditHistory({ rows }: { rows: AdminAudit[] }) {
  return (
    <section className="ds-panel space-y-4 p-5">
      <h2 className="flex items-center gap-2 text-xl">
        <Activity className="size-5 text-primary" />
        Recent audited actions
      </h2>
      {!rows.length && (
        <p className="text-sm text-muted-foreground">
          No recorded administrative actions.
        </p>
      )}
      <ol className="space-y-3">
        {rows.map((row) => (
          <li
            key={row.id}
            className="min-w-0 border-l-2 border-primary/30 pl-4 text-sm"
          >
            <div className="flex flex-wrap justify-between gap-2">
              <strong className="break-words">{row.action}</strong>
              <span className="text-muted-foreground">
                {row.at?.replace("T", " ").slice(0, 16) ?? "Date unavailable"}{" "}
                UTC
              </span>
            </div>
            <p className="mt-1 break-words">{row.reason}</p>
            <p className="text-xs text-muted-foreground">
              {row.outcome} · {row.targetType}
            </p>
            <details className="mt-1 text-xs">
              <summary className="cursor-pointer py-2">Audit details</summary>
              <p className="break-all">
                Actor: {row.actor} · Target: {row.target}
              </p>
              <p className="break-all">Before: {row.before}</p>
              <p className="break-all">After: {row.after}</p>
            </details>
          </li>
        ))}
      </ol>
    </section>
  );
}
export function MerchantDecisionActions({ user }: { user: AdminUser }) {
  if (user.status === "deleted")
    return (
      <p className="text-sm text-muted-foreground">
        Deleted identities cannot be changed.
      </p>
    );
  const actions =
    user.merchantStatus === "pending"
      ? [
          { status: "approved", label: "Approve application" },
          { status: "rejected", label: "Reject application" },
        ]
      : user.merchantStatus === "approved"
        ? [{ status: "suspended", label: "Suspend merchant" }]
        : user.merchantStatus === "suspended"
          ? [{ status: "approved", label: "Reinstate merchant" }]
          : user.merchantStatus === "rejected"
            ? [{ status: "pending", label: "Reopen application" }]
            : [];
  return (
    <div className="flex flex-wrap gap-3">
      {actions.map((action) => (
        <ConfirmAdminAction
          key={action.status}
          kind="merchant"
          id={user.id}
          status={action.status}
          expectedStatus={user.merchantStatus}
          label={action.label}
          description="This changes merchant capabilities only. Account access and store operational status remain separate. A reason is required."
        />
      ))}
    </div>
  );
}
