import { hasPrice, formatMinorUnits, type Price } from "./money";

export function cartPriceSummary(items: (Price & { quantity: number; available?: boolean })[]): { itemCount: number; subtotal?: string; reason: string } {
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  if (!items.length) return { itemCount, reason: "Your cart is empty." };
  let cents = 0;
  const currency = items[0].currency;
  for (const item of items) {
    if (item.available === false || !hasPrice(item) || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) {
      return { itemCount, reason: "Subtotal cannot be safely calculated: some items are unavailable or have an unconfirmed currency or price." };
    }
    if (item.currency !== currency) return { itemCount, reason: "Mixed currencies: a combined subtotal is unavailable. No currency conversion is performed." };
    cents += item.priceCents * item.quantity;
    if (!Number.isSafeInteger(cents)) return { itemCount, reason: "These prices cannot be safely totaled." };
  }
  return { itemCount, subtotal: formatMinorUnits(cents, currency!), reason: `Product subtotal in ${currency}. Shipping and taxes are not calculated. Checkout is not available.` };
}
