import Link from "next/link";
import { Search, SlidersHorizontal } from "lucide-react";
import { SORTS, type CatalogQuery } from "@/lib/storefront-contract";
import { Input, Select } from "@/components/ui/foundation";
import { Button } from "@/components/ui/button";
export function CatalogControls({ query, categories }: { query: CatalogQuery; categories: { _id: string; name: string }[] }) {
  return <form action="/all-products" className="ds-panel grid items-end gap-4 p-5 sm:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_auto_auto]">
    <div className="space-y-2"><label htmlFor="catalog-search" className="flex items-center gap-2 text-sm font-semibold"><Search className="size-4" aria-hidden="true" />Search products</label><Input key={query.q} id="catalog-search" type="search" name="q" defaultValue={query.q} placeholder="What are you looking for?" maxLength={100} /></div>
    <div className="space-y-2"><label htmlFor="catalog-category" className="text-sm font-semibold">Category</label><Select key={query.category} id="catalog-category" name="category" defaultValue={query.category}><option value="">All categories</option>{query.category && !categories.some(c => c._id === query.category) && <option value={query.category}>Selected category</option>}{categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}</Select></div>
    <div className="space-y-2"><label htmlFor="catalog-sort" className="text-sm font-semibold">Sort by</label><Select key={query.sort} id="catalog-sort" name="sort" defaultValue={query.sort}>{Object.entries(SORTS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></div><input type="hidden" name="pageSize" value={query.pageSize} /><Button type="submit"><SlidersHorizontal aria-hidden="true" />Apply</Button><Button asChild variant="outline"><Link href="/all-products">Reset</Link></Button>
  </form>;
}
