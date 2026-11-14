import { CatalogControls } from "@/components/products/CatalogControls";
import { ProductGrid } from "@/components/products/StorefrontProducts";
import { Breadcrumbs, Pagination } from "@/components/ui/foundation";
import CartSyncStatus from "@/components/cart/CartSyncStatus";
import { getCatalog, getStorefrontCategories } from "@/lib/server/storefront-service";
import { catalogHref, type SearchParams } from "@/lib/storefront-contract";
import { storefrontMetadata } from "@/lib/storefront-metadata";
export const metadata = storefrontMetadata("Shop the catalog", "Browse Dreamshop products. Search the catalog, explore categories, and discover something new.", "/all-products");
export default async function AllProducts({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const [catalog, categoryResult] = await Promise.all([getCatalog(params), getStorefrontCategories().then(categories => ({ categories, error: false })).catch(() => ({ categories: [], error: true }))]);
  return <div className="ds-container space-y-7 py-8"><Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Shop" }]} /><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="mb-3 text-sm font-semibold uppercase tracking-widest text-brand-text">The Dreamshop collection</p><h1 className="ds-page-title">Find something <span className="text-brand-text">you love.</span></h1><p className="mt-3 text-body-secondary">Explore products. Follow your curiosity.</p></div><p className="text-sm text-body-secondary">{catalog.total} {catalog.total === 1 ? "product" : "products"}</p></div><CartSyncStatus /><CatalogControls query={catalog.query} categories={categoryResult.categories} />{categoryResult.error && <p role="status">Category options could not load. Search is still available; refresh to retry.</p>}<ProductGrid products={catalog.products} /><Pagination page={catalog.query.page} totalPages={catalog.totalPages} hrefForPage={page => catalogHref({ ...catalog.query, page })} /></div>;
}
