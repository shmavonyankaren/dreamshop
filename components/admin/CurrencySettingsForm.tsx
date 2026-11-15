"use client";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { updateCurrencies } from "@/lib/actions/currency.actions";
import type { CurrencySettings } from "@/lib/server/currency-service";
import { Button } from "@/components/ui/button";
import { Input, Select, FormField } from "@/components/ui/foundation";

export function CurrencySettingsForm({ initial, options }: { initial: CurrencySettings; options: { code: string; name: string; digits: number }[] }) {
  const [settings, setSettings] = useState(initial), [search, setSearch] = useState(""), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const locked = useRef(false), router = useRouter();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current) return;
    locked.current = true; setBusy(true); setMessage("");
    try {
      const result = await updateCurrencies(settings);
      if (!result.ok) { setMessage(result.error.message); return; }
      setSettings(result.data); setMessage("Currency settings saved."); router.refresh();
    } catch { setMessage("Unable to save currencies. Please try again."); }
    finally { locked.current = false; setBusy(false); }
  }
  return <form onSubmit={submit} className="ds-panel space-y-5 p-5 sm:p-7">
    <p className="text-sm text-muted-foreground">Enabled currencies are available for new prices. Disabling a currency preserves existing prices. Changing the default only affects new products; it does not convert prices.</p>
    <fieldset disabled={busy} className="space-y-5">
      <FormField id="default-currency" label="Default currency">
        <Select id="default-currency" value={settings.defaultCurrency} onChange={event => setSettings({ ...settings, defaultCurrency: event.target.value })}>
          {settings.enabled.map(code => <option key={code} value={code}>{code}</option>)}
        </Select>
      </FormField>
      <FormField id="currency-search" label="Find an ISO currency"><Input id="currency-search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Currency code or name" /></FormField>
      <p className="text-sm">{settings.enabled.length} currencies enabled. Choose another default before disabling the current default.</p>
      <div className="max-h-96 overflow-auto rounded-xl border border-border">
        {options.filter(option => (option.code + " " + option.name).toLowerCase().includes(search.toLowerCase())).map(option => <label key={option.code} className="flex min-h-12 items-center gap-3 border-b border-border p-3 last:border-0">
          <input type="checkbox" className="size-4 accent-primary focus-visible:ring-2 focus-visible:ring-ring" checked={settings.enabled.includes(option.code)} disabled={option.code === settings.defaultCurrency} onChange={event => setSettings({ ...settings, enabled: event.target.checked ? [...settings.enabled, option.code] : settings.enabled.filter(code => code !== option.code) })} />
          <span className="flex-1">{option.code} &middot; {option.name}{option.code === settings.defaultCurrency ? " (default)" : ""}</span><span className="text-xs text-muted-foreground">{option.digits} decimal places</span>
        </label>)}
      </div>
      <Button type="submit" disabled={busy}>{busy ? "Saving..." : "Save currencies"}</Button>
    </fieldset>
    <p role="status" aria-live="polite" className="text-sm">{message}</p>
  </form>;
}
