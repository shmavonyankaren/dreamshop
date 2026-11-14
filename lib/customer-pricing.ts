// The current schema has no currency. Never imply that mixed/unknown currency
// amounts form a payable total. Retain the seller's string for presentation.
export function cartPriceSummary(items: { price: string; quantity: number }[]) {
  if (!items.length) return { itemCount: 0, reason: "Your cart is empty." };
  const valid = items.every(item => /^(0|[1-9]\d*)(\.\d{1,2})?$/.test(item.price) && Number.isSafeInteger(item.quantity) && item.quantity >= 1 && item.quantity <= 99);
  return { itemCount: items.reduce((sum, item) => sum + item.quantity, 0), reason: valid ? "Subtotal is unavailable until a shared currency is defined. Prices are shown as listed." : "Some listed prices cannot be safely totaled. Prices are shown as listed." };
}
