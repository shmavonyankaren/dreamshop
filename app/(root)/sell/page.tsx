import Link from "next/link";
import { merchantOnboarding } from "@/lib/server/store-service";
import { StoreForm } from "@/components/merchant/MerchantForms";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/foundation";
export const dynamic = "force-dynamic";
export default async function SellPage() {
  const data = await merchantOnboarding();
  const adminWithoutMerchant = data.canManageMerchants && data.status !== "approved";
  const storeSuspended = data.status === "approved" && data.store?.status === "suspended";
  const descriptions = {
    none: "Tell us about your store. Our marketplace team will review your application.",
    pending: "Your application is awaiting Super Admin review. You can continue shopping while we review it.",
    approved: storeSuspended ? "Your store is suspended. Contact support for assistance. You can continue shopping." : data.store ? "Your store is ready. Open your workspace to manage products and store settings." : "Your application is approved. Complete your store profile to start adding products.",
    rejected: "Your application was not approved. Contact support to discuss a review.",
    suspended: "Your merchant access is suspended. Contact support for assistance.",
  };
  return <div className="ds-container space-y-6 py-8">
    <section className="ds-panel space-y-4 p-6 sm:p-9">
      <Badge tone="brand">Sell on Dreamshop</Badge>
      <h1 className="text-3xl sm:text-4xl">Your store. Your next chapter.</h1>
      {adminWithoutMerchant ? <><p className="max-w-2xl text-muted-foreground">You have Super Admin access to manage marketplace merchants. Merchant approval is separate: your administrator access does not automatically give you a store or merchant workspace.</p>{data.status !== "none" && <p className="max-w-2xl text-muted-foreground">{descriptions[data.status]}</p>}</> : <p className="max-w-2xl text-muted-foreground">{descriptions[data.status]}</p>}
      <p className="text-sm font-semibold">Application: {data.status === "none" ? "Not applied" : data.status}</p>
      <div className="flex flex-wrap gap-3">
        {adminWithoutMerchant && <Button asChild><Link href="/admin/merchants">Manage merchants</Link></Button>}
        {data.status === "approved" && data.store && !storeSuspended && <Button asChild><Link href="/merchant">Open merchant workspace</Link></Button>}
        {(["rejected", "suspended"].includes(data.status) || storeSuspended) && <Button asChild variant="outline"><Link href="/contact">Contact support</Link></Button>}
        <Button asChild variant="outline"><Link href="/all-products">Continue shopping</Link></Button>
      </div>
    </section>
    {data.status === "none" && !adminWithoutMerchant && <StoreForm mode="application" />}
    {data.status === "approved" && !data.store && <StoreForm mode="setup" initial={data.application ?? undefined} />}
  </div>;
}
