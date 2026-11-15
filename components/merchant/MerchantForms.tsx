"use client";
import { useState, useId, useRef, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { hasPrice, priceInput, currencyDigits } from "@/lib/money";
import Image from "next/image";
import { Upload, Store, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select, FormField } from "@/components/ui/foundation";
import {
  submitStoreApplication,
  setupStore,
  saveStoreSettings,
  saveStoreProduct,
  changeProductStatus,
} from "@/lib/actions/store.actions";
import { validateImage, type StoreDTO } from "@/lib/merchant-contract";
import type { CurrencySettings } from "@/lib/server/currency-service";
import type { ProductDTO } from "@/lib/cart-contract";
import type { ActionResult } from "@/lib/authorization-contract";

function useSave(creatingProduct = false) {
  const locked = useRef(false);
  const router = useRouter(),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function run(
    action: () => Promise<ActionResult<unknown>>,
    destination?: string,
  ) {
    if (creatingProduct && locked.current) return;
    locked.current = true;
    let created = false;
    setBusy(true);
    setMessage("");
    try {
      const result = await action();
      if (!result.ok) {
        setMessage(result.error.message);
        return;
      }
      if (creatingProduct) {
        created = true;
        setMessage("Product created successfully. Opening your products...");
        toast.success("Product created successfully.");
        router.replace("/merchant/products");
        return;
      }
      setMessage("Saved successfully.");
      if (destination) router.push(destination);
      router.refresh();
    } catch {
      setMessage("Unable to save. Check your connection and try again.");
    } finally {
      if (!created) { locked.current = false; setBusy(false); }
    }
  }
  return { busy, message, run };
}
type LibraryImage = { id: string; url: string };
export function ImagePicker({
  label,
  value,
  onChange,
  images = [],
  onBusy,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  images?: LibraryImage[];
  onBusy?: (busy: boolean) => void;
}) {
  const id = useId(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function upload(file?: File) {
    if (!file) return;
    setError("");
    setBusy(true);
    onBusy?.(true);
    try {
      if (file.size > 2 * 1024 * 1024)
        throw new Error("Choose an image up to 2 MB.");
      validateImage(new Uint8Array(await file.arrayBuffer()), file.type);
      const response = await fetch("/api/merchant/images", {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
        signal: AbortSignal.timeout(30000),
      });
      const result = await response.json();
      if (!result.ok) throw new Error(result.error.message);
      onChange(result.data.url);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Upload failed. Try again.",
      );
    } finally {
      setBusy(false);
      onBusy?.(false);
    }
  }
  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <FormField
        id={id}
        label={label}
        hint="PNG, JPEG or WebP · Up to 2 MB. Published images are public; do not upload private documents."
      >
        <input
          id={id}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={busy}
          aria-describedby={`${id}-hint`}
          className="block min-h-11 w-full min-w-0 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-accent file:p-3 file:text-accent-foreground"
          onChange={(e) => void upload(e.target.files?.[0])}
        />
      </FormField>
      {busy && (
        <p role="status">
          <Upload className="mr-2 inline size-4" />
          Uploading…
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {value && (
        <div className="flex items-center gap-3">
          <Image
            unoptimized
            src={value}
            alt={`${label} preview`}
            width={120}
            height={100}
            className="h-24 w-28 rounded-lg bg-muted object-contain"
          />
          <Button type="button" variant="outline" onClick={() => onChange("")}>
            Clear selection
          </Button>
        </div>
      )}
      {images.length > 0 && (
        <details>
          <summary className="cursor-pointer py-3 text-sm font-semibold">
            Choose an existing store image
          </summary>
          <div className="grid max-h-56 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-5">
            {images.map((image) => (
              <button
                type="button"
                key={image.id}
                aria-label={`Select image ${image.id.slice(-6)}`}
                onClick={() => onChange(image.url)}
                className="rounded-lg border border-border p-2 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Image
                  unoptimized
                  src={image.url}
                  alt="Store library image"
                  width={80}
                  height={80}
                  className="h-16 w-full object-contain"
                />
              </button>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
export function StoreForm({
  mode,
  initial,
  images = [],
}: {
  mode: "application" | "setup" | "settings";
  initial?: Partial<StoreDTO>;
  images?: LibraryImage[];
}) {
  const { busy, message, run } = useSave(),
    [logo, setLogo] = useState(initial?.logo ?? ""),
    [banner, setBanner] = useState(initial?.banner ?? ""),
    [logoBusy, setLogoBusy] = useState(false),
    [bannerBusy, setBannerBusy] = useState(false);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget),
      fields = {
        name: String(form.get("name")),
        description: String(form.get("description")),
        contactEmail: String(form.get("contactEmail")),
      };
    void run(
      () =>
        mode === "application"
          ? submitStoreApplication({
              ...fields,
              supportingInformation: String(form.get("supportingInformation")),
            })
          : mode === "setup"
            ? setupStore({ ...fields, slug: String(form.get("slug")) })
            : saveStoreSettings({ ...fields, logo, banner }),
      mode === "setup" ? "/merchant" : undefined,
    );
  }
  return (
    <form onSubmit={submit} className="ds-panel space-y-5 p-5 sm:p-7">
      <fieldset disabled={busy} className="min-w-0 space-y-5">
        <div className="grid gap-5 md:grid-cols-2">
          <FormField id="store-name" label="Store name">
            <Input
              id="store-name"
              name="name"
              required
              minLength={2}
              maxLength={100}
              defaultValue={initial?.name}
            />
          </FormField>
          <FormField
            id="store-email"
            label="Contact email"
            hint="Private: used for marketplace communication."
          >
            <Input
              id="store-email"
              name="contactEmail"
              type="email"
              required
              maxLength={254}
              defaultValue={initial?.contactEmail}
            />
          </FormField>
        </div>
        <FormField id="store-description" label="Store description">
          <Textarea
            id="store-description"
            name="description"
            required
            minLength={10}
            maxLength={3000}
            defaultValue={initial?.description}
          />
        </FormField>
        {mode === "application" && (
          <FormField
            id="supporting"
            label="Supporting information (optional)"
            hint="Tell us what you plan to sell. Do not include sensitive documents."
          >
            <Textarea
              id="supporting"
              name="supportingInformation"
              maxLength={1000}
            />
          </FormField>
        )}
        {mode === "setup" && (
          <FormField
            id="store-slug"
            label="Store URL"
            hint="3–60 lowercase letters, numbers and single hyphens. This cannot be changed later."
          >
            <Input
              id="store-slug"
              name="slug"
              required
              minLength={3}
              maxLength={60}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              placeholder="your-store"
            />
          </FormField>
        )}
        {mode === "settings" && (
          <>
            <p className="break-all text-sm text-muted-foreground">
              Store URL: {initial?.slug}
            </p>
            <FormField id="store-status" label="Store presentation">
              <Select
                id="store-status"
                name="status"
                defaultValue={initial?.status}
              >
                <option value="active">Active</option>
                <option value="paused">
                  Paused — hide future public store page
                </option>
              </Select>
            </FormField>
            <div className="grid gap-5 xl:grid-cols-2">
              <ImagePicker
                label="Store logo"
                value={logo}
                onChange={setLogo}
                images={images}
                onBusy={setLogoBusy}
              />
              <ImagePicker
                label="Store banner"
                value={banner}
                onChange={setBanner}
                images={images}
                onBusy={setBannerBusy}
              />
            </div>
          </>
        )}
        <Button disabled={busy || logoBusy || bannerBusy} type="submit">
          <Store className="size-4" />
          {busy
            ? "Saving…"
            : mode === "application"
              ? "Submit application"
              : mode === "setup"
                ? "Create my store"
                : "Save store settings"}
        </Button>
      </fieldset>
      <p role="status" className="text-sm">
        {message}
      </p>
    </form>
  );
}
export function ProductForm({
  product,
  categories,
  images,
  currencies,
}: {
  product?: ProductDTO;
  categories: { _id: string; name: string }[];
  currencies: CurrencySettings;
  images: LibraryImage[];
}) {
  const [currency, setCurrency] = useState(product && hasPrice(product) ? product.currency : currencies.defaultCurrency);
  const [amount, setAmount] = useState(product && hasPrice(product) ? priceInput(product.priceCents, product.currency) : "");
  const disabledCurrency = !currencies.enabled.includes(currency);
  const digits = currencyDigits(currency) ?? 2;
  const [imageUrl, setImage] = useState(product?.imageUrl ?? ""),
    [uploading, setUploading] = useState(false),
    { busy, message, run } = useSave(!product);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    void run(
      () =>
        saveStoreProduct({
          ...(product ? { id: product._id } : {}),
          product: {
            title: String(data.get("title")),
            description: String(data.get("description")),
            price: String(data.get("price")),
            currency,
            category: String(data.get("category")),
            tags: String(data.get("tags"))
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean),
            imageUrl,
          },
        }),
      "/merchant/products",
    );
  }
  return (
    <form onSubmit={submit} className="ds-panel p-5 sm:p-7">
      <fieldset
        disabled={busy}
        className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]"
      >
        <div className="min-w-0 space-y-5">
          <FormField id="title" label="Product name">
            <Input
              id="title"
              name="title"
              required
              maxLength={200}
              defaultValue={product?.title}
            />
          </FormField>
          <FormField id="description" label="Description">
            <Textarea
              id="description"
              name="description"
              required
              maxLength={10000}
              defaultValue={product?.description}
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="price"
              label={`Price (${currency})`}
              hint={disabledCurrency ? "This currency is disabled. The saved price is preserved. To reprice, select an enabled currency and enter the amount explicitly." : product && !hasPrice(product) ? "This product has no confirmed currency. Enter its price explicitly; the old amount is not converted." : `Use up to ${digits} decimal places. Changing currency requires entering a new price; no conversion is performed.`}
            >
              <Input
                id="price"
                name="price"
                required
                inputMode="decimal"
                pattern={digits ? `(0|[1-9][0-9]*)(\\.[0-9]{1,${digits}})?` : "(0|[1-9][0-9]*)"}
                maxLength={32}
                value={amount}
                onChange={event => setAmount(event.target.value)}
                readOnly={disabledCurrency}
              />
            </FormField>
            <FormField id="product-currency" label="Currency">
              <Select id="product-currency" name="currency" value={currency} onChange={event => { setCurrency(event.target.value); setAmount(""); }}>
                {disabledCurrency && <option value={currency} disabled>{currency} (disabled - saved price only)</option>}
                {currencies.enabled.map(code => <option key={code} value={code}>{code}</option>)}
              </Select>
            </FormField>
            <FormField id="category" label="Category">
              <Select
                id="category"
                name="category"
                required
                defaultValue={product?.category?._id ?? ""}
              >
                <option value="" disabled>
                  Select category
                </option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
          <FormField
            id="tags"
            label="Tags"
            hint="Separate tags with commas. Up to 32 tags, 60 characters each."
          >
            <Input
              id="tags"
              name="tags"
              maxLength={1951}
              defaultValue={product?.tags?.join(", ")}
            />
          </FormField>
        </div>
        <div className="min-w-0 space-y-4">
          <ImagePicker
            label="Product image"
            value={imageUrl}
            onChange={setImage}
            images={images}
            onBusy={setUploading}
          />
          <p className="text-sm text-muted-foreground">
            Products use your store’s image library. Replaced images stay in the
            library until you remove them.
          </p>
        </div>
        <Button
          type="submit"
          disabled={busy || uploading || !imageUrl || !categories.length}
        >
          <Save className="size-4" />
          {busy ? "Saving…" : "Save product"}
        </Button>
      </fieldset>
      {!categories.length && (
        <p className="mt-4 text-sm">
          A Super Admin must add a category before you can create products.
        </p>
      )}
      <p role="status" className="mt-4 text-sm">
        {message}
      </p>
    </form>
  );
}
export function ProductStatusButton({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const { busy, message, run } = useSave(),
    [confirm, setConfirm] = useState(false);
  return (
    <div>
      <Button
        variant="outline"
        disabled={busy}
        onClick={() => setConfirm(true)}
      >
        {status === "archived" ? "Restore" : "Archive"}
      </Button>
      {confirm && (
        <div className="mt-2 space-y-2 text-sm">
          <p>
            {status === "archived"
              ? "Make this product available again?"
              : "Hide this product from browsing, carts and wishlists?"}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy}
              onClick={() =>
                void run(() =>
                  changeProductStatus({
                    id,
                    status: status === "archived" ? "active" : "archived",
                  }),
                ).then(() => setConfirm(false))
              }
            >
              Confirm
            </Button>
            <Button variant="outline" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      <p role="status" className="text-xs">
        {message}
      </p>
    </div>
  );
}
export function ImageLibrary({ images }: { images: LibraryImage[] }) {
  const router = useRouter(),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function remove(id: string) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/merchant/images?id=${id}`, {
        method: "DELETE",
        signal: AbortSignal.timeout(15000),
      });
      const result = await response.json();
      if (!result.ok) throw new Error(result.error.message);
      setMessage("Unused image removed.");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to remove image.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="ds-panel space-y-4 p-5">
      <h2 className="text-xl">Image library · {images.length}/100</h2>
      <p className="text-sm text-muted-foreground">
        Remove unused images to free space. Images referenced by products
        (including archived products), logos or banners cannot be removed.
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {images.map((image) => (
          <div key={image.id} className="rounded-xl border border-border p-3">
            <Image
              src={image.url}
              unoptimized
              alt="Store image"
              width={120}
              height={100}
              className="h-24 w-full object-contain"
            />
            <Button
              className="mt-2 w-full"
              disabled={busy}
              variant="outline"
              onClick={() => void remove(image.id)}
            >
              Remove unused
            </Button>
          </div>
        ))}
      </div>
      <p role="status" className="text-sm">
        {message}
      </p>
    </section>
  );
}
