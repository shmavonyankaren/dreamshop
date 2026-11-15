import Link from "next/link";
import { adminUsers } from "@/lib/server/admin-queries";
import {
  AdminHero,
  AdminFilters,
  AdminPagination,
  UserRows,
} from "@/components/admin/AdminShared";
import { Button } from "@/components/ui/button";
import type { SearchParams } from "@/lib/storefront-contract";
export default async function MerchantsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const data = await adminUsers(await searchParams, "merchants");
  return (
    <>
      <AdminHero
        title="Merchants & Stores"
        description="Inspect applications, account restrictions and store operations independently."
      >
        <Button asChild>
          <Link href="/admin/merchants/applications?status=pending">
            Review pending applications
          </Link>
        </Button>
      </AdminHero>
      <section className="ds-panel space-y-5 p-5">
        <h2 className="text-xl">Merchant accounts · {data.total}</h2>
        <AdminFilters
          query={data.query}
          statuses={["approved", "suspended", "pending", "rejected"]}
        />
        <UserRows users={data.rows} merchant />
        <AdminPagination path="/admin/merchants" data={data} />
      </section>
    </>
  );
}
