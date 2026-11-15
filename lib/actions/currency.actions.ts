"use server";
import { revalidatePath } from "next/cache";
import { marketplaceResult } from "../server/marketplace-response";
import { saveCurrencySettings } from "../server/currency-service";
export async function updateCurrencies(input: unknown) {
  const result = await marketplaceResult(() => saveCurrencySettings(input));
  if (result.ok) {
    revalidatePath("/admin/currencies");
    revalidatePath("/merchant/products", "layout");
  }
  return result;
}
