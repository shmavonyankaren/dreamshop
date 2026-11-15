/** priceCents is the compatibility field name for integer ISO minor units (not always 1/100). */
export type Price = { price?: string; priceCents?: number; currency?: string };
export const MAX_PRICE_CENTS = 999_999_999;
const codes = new Set(Intl.supportedValuesOf("currency"));
export function currencyDigits(code: string): number | null {
  if (!codes.has(code)) return null;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: code }).resolvedOptions().maximumFractionDigits ?? null;
}
export function currencyOptions() {
  const names = new Intl.DisplayNames(["en"], { type: "currency" });
  return [...codes].map(code => ({ code, name: names.of(code) ?? code, digits: currencyDigits(code)! }));
}
export function parseMinorUnits(value: string, currency: string): number | null {
  const digits = currencyDigits(currency);
  if (digits === null || !/^(0|[1-9]\d*)(\.\d+)?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  if (fraction.length > digits) return null;
  const units = Number(whole) * 10 ** digits + Number(fraction.padEnd(digits, "0"));
  return Number.isSafeInteger(units) && units <= MAX_PRICE_CENTS ? units : null;
}
export function hasPrice(value: Price): value is Price & { priceCents: number; currency: string } {
  return typeof value.currency === "string" && currencyDigits(value.currency) !== null && Number.isSafeInteger(value.priceCents) && value.priceCents! >= 0 && value.priceCents! <= MAX_PRICE_CENTS;
}
export function priceInput(units: number, currency: string): string {
  const digits = currencyDigits(currency);
  if (digits === null) return "";
  const scale = 10 ** digits;
  return String(Math.floor(units / scale)) + (digits ? "." + String(units % scale).padStart(digits, "0") : "");
}
export function formatMinorUnits(units: number, currency: string): string {
  const digits = currencyDigits(currency);
  if (digits === null) return "Price unavailable";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(units / 10 ** digits);
}
export function formatPrice(value: Price): string {
  if (hasPrice(value)) return formatMinorUnits(value.priceCents, value.currency);
  if (value.currency !== undefined || value.priceCents !== undefined) return "Price unavailable";
  return value.price?.trim() ? value.price.trim() + " (currency unspecified)" : "Price unavailable";
}
// Retained helpers for existing EUR consumers.
export const parseEuroCents = (value: string) => parseMinorUnits(value, "EUR");
export const euroInput = (units: number) => priceInput(units, "EUR");
export const formatEuroCents = (units: number) => formatMinorUnits(units, "EUR");
export function hasEuroPrice(value: Price): value is Price & { priceCents: number; currency: "EUR" } { return value.currency === "EUR" && hasPrice(value); }
