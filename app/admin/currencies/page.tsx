import { adminCurrencySettings } from "@/lib/server/currency-service";
import { currencyOptions } from "@/lib/money";
import { CurrencySettingsForm } from "@/components/admin/CurrencySettingsForm";
import { AdminHero } from "@/components/admin/AdminShared";
export default async function CurrenciesPage() {
  const settings = await adminCurrencySettings();
  const options = currencyOptions().sort((a, b) => Number(settings.enabled.includes(b.code)) - Number(settings.enabled.includes(a.code)) || a.code.localeCompare(b.code));
  return <><AdminHero title="Marketplace currencies" description="Manage supported pricing currencies and the default for new products." /><CurrencySettingsForm key={settings.revision} initial={settings} options={options} /></>;
}
