import "server-only";
import type { ClientSession } from "mongoose";
import { z } from "zod";
import { connectDB } from "../db/connection";
import { AuthorizationControl, AuthorizationAudit } from "../db/models/authorization.model";
import { AuthorizationError } from "../authorization-contract";
import { currencyDigits, hasPrice, type Price } from "../money";
import { authorizedMutation } from "./marketplace-transaction";
import { requireCapability } from "./authorization";

const code = z.string().refine(value => currencyDigits(value) !== null, "Choose a supported ISO currency");
const settingsSchema = z.object({
  enabled: z.array(code).min(1).max(200).refine(values => new Set(values).size === values.length),
  defaultCurrency: code,
  revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER - 1),
}).strict().refine(value => value.enabled.includes(value.defaultCurrency), "The default currency must be enabled");
export type CurrencySettings = z.infer<typeof settingsSchema>;
export async function currencySettings(session?: ClientSession): Promise<CurrencySettings> {
  await connectDB();
  const query = AuthorizationControl.findOne({ _id: "marketplace" }).select("currencySettings").maxTimeMS(5000);
  if (session) query.session(session);
  const record = await query;
  // This initializes the marketplace policy only, never a product's currency.
  if (!record?.currencySettings) return { enabled: ["EUR", "USD"], defaultCurrency: "EUR", revision: 0 };
  const value = record.currencySettings.toObject?.() ?? record.currencySettings;
  return settingsSchema.parse(value);
}
export async function adminCurrencySettings() {
  await requireCapability("currency:manage");
  return currencySettings();
}
export async function saveCurrencySettings(input: unknown) {
  return authorizedMutation("currency:manage", async (actor, session) => {
    const requested = settingsSchema.parse(input);
    const before = await currencySettings(session);
    if (before.revision !== requested.revision) throw new AuthorizationError(409, "CONFLICT", "Currencies changed. Reload this page before saving again.");
    const after = { ...requested, revision: before.revision + 1 };
    await AuthorizationControl.updateOne({ _id: "marketplace" }, { $set: { currencySettings: after } }, { session, runValidators: true });
    await AuthorizationAudit.create([{ actor: actor.id, target: actor.id, targetType: "user", action: "currency.settings.update", before, after, reason: "Marketplace currency configuration", outcome: "success", at: new Date() }], { session });
    return after;
  });
}
/** Called inside the shared authorization transaction, so disabling and pricing serialize. */
export async function requireEnabledPrice(next: Price, previous: Price | null, session: ClientSession) {
  if (!hasPrice(next)) throw new AuthorizationError(400, "INVALID_PRICE", "Enter an explicit price and currency.");
  const settings = await currencySettings(session);
  if (settings.enabled.includes(next.currency)) return;
  if (previous && hasPrice(previous) && previous.currency === next.currency && previous.priceCents === next.priceCents) return;
  throw new AuthorizationError(400, "CURRENCY_DISABLED", "This currency is disabled. Choose an enabled currency and enter a new price, or keep the saved price unchanged.");
}
