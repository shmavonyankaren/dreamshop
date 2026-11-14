import { requireRouteAccess } from "@/lib/server/authorization";
import { WishlistPage } from "@/components/customer/WishlistPage";
export const metadata = { title: "My wishlist", robots: { index: false, follow: false } };
export default async function Favourites() { await requireRouteAccess("account"); return <WishlistPage />; }
