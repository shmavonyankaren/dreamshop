import { adminUsers } from "@/lib/server/admin-queries";
import { AdminHero, AdminFilters, AdminPagination, UserRows } from "@/components/admin/AdminShared";
import type { SearchParams } from "@/lib/storefront-contract";
export default async function ApplicationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const data = await adminUsers(await searchParams, "applications");
  return <><AdminHero title="Merchant Applications" description="Review proposed stores and supporting information before granting merchant access. Open an application to read details and record a decision." /><section className="ds-panel space-y-5 p-5"><h2 className="text-xl">Applications · {data.total}</h2><AdminFilters query={data.query} statuses={["pending", "approved", "rejected", "suspended"]} /><UserRows users={data.rows} merchant /><AdminPagination path="/admin/merchants/applications" data={data} /></section></>;
}
