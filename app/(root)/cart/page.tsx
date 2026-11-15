import CartClient from "@/components/cart/CartClient";
import { Breadcrumbs } from "@/components/ui/foundation";
export const metadata = { title: "Shopping cart", robots: { index: false } };
export default function CartPage() {
  return (
    <div className="ds-container space-y-6 py-8">
      <Breadcrumbs
        items={[{ label: "Home", href: "/" }, { label: "Shopping cart" }]}
      />
      <div>
        <h1 className="ds-page-title">
          Your Shopping <span className="text-brand-text">Cart</span>
        </h1>
        <p className="mt-2 text-body-secondary">
          Review your products and adjust quantities.
        </p>
      </div>
      <CartClient />
    </div>
  );
}
