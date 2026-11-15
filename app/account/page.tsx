import { getCustomerProfile } from "@/lib/server/customer-service";
import { AccountOverview } from "@/components/customer/AccountOverview";
export const metadata = {
  title: "My account",
  robots: { index: false, follow: false },
};
export default async function AccountPage() {
  return <AccountOverview profile={await getCustomerProfile()} />;
}
