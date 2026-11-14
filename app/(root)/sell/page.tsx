import Link from "next/link";
import { merchantOnboarding } from "@/lib/server/store-service";
import { StoreForm } from "@/components/merchant/MerchantForms";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/foundation";
export const dynamic = "force-dynamic";
export default async function SellPage() {
  const data = await merchantOnboarding();
  const descriptions = { none: "Tell us about your store. Our marketplace team will review your application.", pending: "Your application is awaiting Super Admin review. You can continue shopping while we review it.", approved: data.store ? "Your store is ready. Open your workspace to manage products and store settings." : "Your application is approved. Complete your store profile to start adding products.", rejected: "Your application was not approved. Contact support to discuss a review.", suspended: "Your merchant access is suspended. Contact support for assistance." };
  return <div className="ds-container space-y-6 py-8"><section className="ds-panel space-y-4 p-6 sm:p-9"><Badge tone="brand">Sell on Dreamshop</Badge><h1 className="text-3xl sm:text-4xl">Your store. Your next chapter.</h1><p className="max-w-2xl text-muted-foreground">{descriptions[data.status]}</p><p className="text-sm font-semibold">Application: {data.status === "none" ? "Not applied" : data.status}</p>{data.status === "approved" && data.store && <Button asChild><Link href="/merchant">Open merchant workspace</Link></Button>}{["rejected", "suspended"].includes(data.status) && <Button asChild variant="outline"><Link href="/contact">Contact support</Link></Button>}</section>{data.status === "none" && <StoreForm mode="application" />}{data.status === "approved" && !data.store && <StoreForm mode="setup" initial={data.application ?? undefined} />}</div>;
}
