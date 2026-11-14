import Link from "next/link";
import { merchantProducts } from "@/lib/server/merchant-products";
import { getStorefrontCategories } from "@/lib/server/storefront-service";
import { ProductTable } from "@/components/merchant/ProductTable";
import { Input, Select, Pagination } from "@/components/ui/foundation";
import { Button } from "@/components/ui/button";
import type { SearchParams } from "@/lib/storefront-contract";
export default async function ProductsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [data, categories] = await Promise.all([merchantProducts(await searchParams), getStorefrontCategories()]);
  return <><header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-3xl">Products</h1><p className="mt-2 text-body-secondary">{data.total} matching products in your store</p></div><Button asChild><Link href="/merchant/products/new">Add product</Link></Button></header><section className="ds-panel space-y-5 p-4 sm:p-6"><form className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><label className="space-y-1 text-sm">Search<Input name="q" maxLength={100} defaultValue={data.query.q} placeholder="Search product names" /></label><label className="space-y-1 text-sm">Category<Select name="category" defaultValue={data.query.category ?? ""}><option value="">All categories</option>{categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}</Select></label><label className="space-y-1 text-sm">Sort<Select name="sort" defaultValue={data.query.sort}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="name-asc">Name A–Z</option><option value="name-desc">Name Z–A</option></Select></label><Button type="submit" className="self-end">Apply filters</Button></form><ProductTable products={data.products} /><Pagination page={data.query.page} totalPages={data.totalPages} hrefForPage={page => `/merchant/products?${new URLSearchParams({ q: data.query.q, category: data.query.category ?? "", sort: data.query.sort, page: String(page) })}`} /></section></>;
}
