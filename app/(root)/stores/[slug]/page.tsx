import { notFound } from "next/navigation";
import Image from "next/image";
import {
  getPublicStore,
  eligiblePublicStore,
} from "@/lib/server/public-stores";
import { storefrontMetadata } from "@/lib/storefront-metadata";
import { getStorefrontCategories } from "@/lib/server/storefront-service";
import { ProductGrid } from "@/components/products/StorefrontProducts";
import {
  Input,
  Select,
  Pagination,
  Breadcrumbs,
} from "@/components/ui/foundation";
import { Button } from "@/components/ui/button";
import { safeProductImage, type SearchParams } from "@/lib/storefront-contract";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const store = await eligiblePublicStore((await params).slug);
  return store
    ? storefrontMetadata(
        store.name,
        store.description.slice(0, 160),
        `/stores/${store.slug}`,
      )
    : { title: "Store unavailable", robots: { index: false } };
}
export default async function PublicStorePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { slug } = await params,
    data = await getPublicStore(slug, await searchParams);
  if (!data) notFound();
  const categories = await getStorefrontCategories(),
    { store } = data;
  return (
    <div className="ds-container space-y-6 py-8">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Shop", href: "/all-products" },
          { label: store.name },
        ]}
      />
      <header className="ds-panel overflow-hidden">
        {safeProductImage(store.banner) && (
          <Image
            src={store.banner}
            unoptimized
            alt=""
            width={1440}
            height={320}
            className="h-36 w-full object-cover sm:h-56"
          />
        )}
        <div className="flex flex-col gap-5 p-6 sm:flex-row sm:p-8">
          {safeProductImage(store.logo) && (
            <Image
              src={store.logo}
              unoptimized
              alt={`${store.name} logo`}
              width={96}
              height={96}
              className="size-24 rounded-2xl border border-border bg-white object-contain"
            />
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-primary">
              Dreamshop merchant store
            </p>
            <h1 className="mt-2 text-3xl font-bold break-words sm:text-4xl">
              {store.name}
            </h1>
            <p className="mt-3 max-w-3xl whitespace-pre-wrap break-words text-muted-foreground">
              {store.description}
            </p>
          </div>
        </div>
      </header>
      <section className="ds-panel space-y-4 p-5">
        <h2 className="text-xl">Products · {data.total}</h2>
        <form className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1 text-sm">
            Search this store
            <Input
              name="q"
              maxLength={100}
              defaultValue={data.query.q}
              placeholder="Product name or keyword"
            />
          </label>
          <label className="space-y-1 text-sm">
            Category
            <Select name="category" defaultValue={data.query.category}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="space-y-1 text-sm">
            Sort
            <Select name="sort" defaultValue={data.query.sort}>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="name-asc">Name A–Z</option>
              <option value="name-desc">Name Z–A</option>
            </Select>
          </label>
          <Button>Find products</Button>
        </form>
      </section>
      <ProductGrid products={data.products} />
      <Pagination
        page={data.query.page}
        totalPages={data.totalPages}
        hrefForPage={(page) =>
          `/stores/${store.slug}?${new URLSearchParams({ q: data.query.q, category: data.query.category, sort: data.query.sort, page: String(page) })}`
        }
      />
    </div>
  );
}
