import { adminUsers } from "@/lib/server/admin-queries";
import {
  AdminHero,
  AdminFilters,
  AdminPagination,
  UserRows,
} from "@/components/admin/AdminShared";
import type { SearchParams } from "@/lib/storefront-contract";
export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const data = await adminUsers(await searchParams);
  return (
    <>
      <AdminHero
        title="Users & Access"
        description="Review customer accounts, merchant capabilities and account restrictions across Dreamshop."
      />
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
        <section className="ds-panel min-w-0 space-y-5 p-5">
          <h2 className="text-xl">All matching users · {data.total}</h2>
          <AdminFilters
            query={data.query}
            statuses={["active", "suspended", "deleted"]}
            roles
          />
          <UserRows users={data.rows} />
          <AdminPagination path="/admin/users" data={data} />
        </section>
        <aside className="ds-panel self-start space-y-5 p-5">
          <h2 className="text-xl">Capabilities & permissions</h2>
          {[
            {
              title: "Customer",
              text: "Active accounts can browse, save products and use their cart.",
            },
            {
              title: "Merchant",
              text: "Approved merchants retain customer access and can operate their own store.",
            },
            {
              title: "Super Admin",
              text: "Authorized platform operators review merchants and manage marketplace records.",
            },
          ].map((role) => (
            <section
              key={role.title}
              className="rounded-xl border border-border p-4"
            >
              <h3>{role.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{role.text}</p>
            </section>
          ))}
          <p className="text-sm text-muted-foreground">
            Role assignment is not available here. No new roles or arbitrary
            privilege changes are supported.
          </p>
        </aside>
      </div>
    </>
  );
}
