# Phase 4B — Public storefront

## Implemented experience

The homepage now contains a light rounded hero with coral accents, real product imagery when available (a CSS/Lucide composition otherwise), category cards, eight newest products, a coral discovery banner, and customer/merchant information. The shared Phase 4A header and footer remain mounted only once. There are no sale dates, discounts, review ratings, inventory claims, shipping promises, fabricated statistics, or public administrator signup options.

The `design-references/` folder is absent. The ten screenshots attached earlier in the conversation remain the references: homepage, product detail, account, wishlist, merchant/admin dashboards, category management, Users & Access, About, and Contact. Homepage and product detail directly inform this phase; the other screenshots supply the common navy canvas, pale panels, coral buttons, rounded corners, and typography. There is no separate catalog screenshot; it extends those shared conventions. No copied or generated product artwork was introduced.

## Data and query architecture

`lib/server/storefront-service.ts` is server-only and performs reads through the existing MongoDB connection and models. No schemas, mutations, ownership rules, authentication, or production indexes changed.

- `getHomepageData`: independently settles category and catalog reads so one failure does not suppress the other section. Failures remain distinguishable from empty collections without returning internal errors.
- `getCatalog`: validates query parameters, counts the matching records, clamps the requested page to the available pages, and fetches only that page.
- `getStorefrontCategories`: selects `_id name`, orders by name and ID, and retrieves at most 200 records. Home displays the first eight; catalog exposes the returned category options. Larger category collections need a searchable/paginated category picker in a later phase. Valid category URLs beyond the picker limit still filter correctly.
- `getStorefrontProduct`: validates the 24-character hex ID before database access; invalid/missing IDs return null and the route renders not-found. It does not require authentication.
- `getRelatedProducts`: same-category records excluding the current ID, newest first, at most four. Missing categories or no matches produce an honest empty state. A failed related lookup does not prevent the product from being viewed.

Public product reads use the existing `PRODUCT_FIELDS` projection and `toProductDTO`. Only `_id`, title, description, imageUrl, price, string tags, and category `_id/name` are returned. Only category is populated. No owner document, email, Clerk identifier, capability, or internal authorization data is populated or serialized. Existing legacy product actions remain for compatibility; the storefront no longer calls the unbounded `getAllProducts` or ships an entire catalog into ProductsClient.

## Catalog URL contract

The existing `/all-products` URL is retained. GET forms and navigation links are the source of truth; there is no separate client filter state. Refresh and browser history therefore retain filters.

| Parameter | Behavior |
| --- | --- |
| `q` | Trimmed literal substring, at most 100 characters; title, description, and tags; case-insensitive |
| `category` | Validated 24-character hex ID; normalized lowercase; invalid/repeated values fall back to all categories |
| `sort` | `newest`, `oldest`, `name-asc`, `name-desc`; other values fall back to newest |
| `page` | Positive safe decimal integer; invalid input defaults to 1; values beyond results clamp to last page |
| `pageSize` | Default 12, bounded 1–48; configurable through URL and retained by forms/links |

Repeated query values and object-shaped inputs are not accepted as scalar filters. Regex metacharacters are escaped, and only server-selected Mongo fields/operators are constructed. Sort keys are allowlisted. Applying filters resets pagination; next/previous retain search, category, sort, and page size. Names use MongoDB's default string ordering, not a locale-specific collation.

Pagination uses count plus skip/limit with `_id` as a deterministic secondary sort. It supplies exact matching counts at the time of the count query. Count and row retrieval are separate reads, so concurrent catalog changes can shift rows/totals. Deep offsets and unanchored case-insensitive regex search can become expensive; reads have a 5-second Mongo query time limit. At larger scale, migrate to cursor pagination and an indexed search solution rather than increasing retrieval limits.

Price is stored as a string with no explicit currency field. The UI displays the stored price without inventing a currency. Price sorting is deliberately unavailable; numeric price/currency modeling and a controlled data migration must precede that option. No migration ran.

## Product details and cart

The previously empty `/all-products/[productId]` page now renders breadcrumbs, one real image, title, category, description, tags, stored price, quantity selection, add-to-cart, a real cart link, and related products. There are no invented thumbnails, product variants, specifications, stock, merchant verification badges, or reviews. A dedicated loading skeleton and product not-found state are included. The root error boundary continues to sanitize unexpected failures.

The product lookup is memoized within the server request with React cache so metadata and the page share it. The existing public middleware rule for `/all-products(.*)` is unchanged.

StorefrontPurchase is the interactive boundary. It waits for Clerk to load, validates quantities against the existing maximum (99), prevents concurrent clicks on that control, reports failures, and shows a toast after successful addition. It delegates to `addStorefrontItem`; it does not own a second cart store. CartProvider still handles count refresh and durable synchronization. CartSyncStatus remains visible on all three storefront surfaces.

Authenticated additions use the existing `/api/cart/add` client utility with only product ID and quantity, then notify the shared cart provider. Guest additions use `addGuestCartQuantity`, which wraps the existing local-cart save/validation path with the existing Web Lock and cart-change event. The old `mutateGuestCart("add", ...)` contract still adds exactly one item. Its behavior and all original cart assertions are preserved. Selected-quantity addition is atomic, including cumulative quantity validation, and preserves pending merge state. A new regression test adds quantity during an in-flight merge and verifies it is applied exactly once.

## Reusable components

- `StorefrontProducts`: ProductCard, ProductGrid, ProductPrice, CategoryCard, ProductGridSkeleton; empty state uses the Phase 4A primitive.
- `StorefrontImage`: actual image with descriptive alt text, reserved aspect-ratio space, lazy loading except the primary image, and an error/missing-image fallback. HTTPS and local absolute paths are accepted. Remote images render directly without creating an unrestricted Next image proxy; remote availability and merchant-provided asset sizes remain external dependencies.
- `StorefrontPurchase`: quantity controls and add-to-cart feedback shared by cards and details.
- `CatalogControls`: labeled search, category, and sort controls with Apply and Reset, backed by GET navigation.
- Existing Breadcrumbs, Pagination, Badge, Button, ErrorFeedback, Skeleton, header, footer, and cart status are reused.

The legacy ProductList, ProductCard, SearchAndFilters, and ProductsClient files were retained for compatibility, but are no longer used by the redesigned catalog. No unrelated component deletion was performed.

## Responsive and accessibility decisions

The homepage hero stacks below lg; category cards flow from one to four columns. Product grids use one column on mobile, two at sm, three at lg, and four at xl. Product details stack image above information below lg. Filters use compact labeled rows on mobile instead of a drawer; they expand into columns on larger screens. Pagination and CTAs wrap. Images use object-contain inside aspect-ratio containers.

Controls use semantic links/buttons, visible focus styles, descriptive labels, status/alert announcements, native selects, and 44px button targets. Decorative icons are hidden from assistive technology. Reduced motion follows the Phase 4A stylesheet. Prices and unsupported features are not embellished with invented data.

## SEO

Homepage, catalog, and product pages use Next Metadata APIs for titles, descriptions, and Open Graph text. Product metadata uses the real title and description. Canonical and Open Graph URLs are emitted only if `NEXT_PUBLIC_SITE_URL` is a valid HTTP(S) URL; no production domain is assumed. Catalog variants canonicalize to `/all-products`. Missing products are noindex. Product structured data and offers are deferred because currency, availability, and review contracts are not established.

## Index recommendations (not applied)

Evaluate with production-shaped staging data and explain plans before deploying:

- `{ createdAt: -1, _id: -1 }` for newest/oldest browsing.
- `{ category: 1, createdAt: -1, _id: -1 }` for category/date browsing.
- `{ title: 1, _id: 1 }` and `{ category: 1, title: 1, _id: 1 }` for name sorting and category/name sorting; reverse scans support descending variants.
- `{ name: 1, _id: 1 }` for category options if needed beyond the existing unique name index.

These indexes do not solve unanchored regex search across three fields. A dedicated search index/service needs its own design and operational review. No index creation or database writes were performed during implementation or verification.

## Verification

Commands: `npm run test:authorization`, `npm run test:identity`, `npm run test:cart`, `npm run test:storefront`, `npx tsc --noEmit --incremental false`, `git diff --check`, and `npm run build`.

Final suite results: authorization 47 passed, identity 35 passed, cart 58 passed, storefront 20 passed (160 total). The final production build and diff whitespace check passed. Existing tests were not weakened. Storefront tests execute real query/DTO/validation/cart helper code with mocked persistence and network boundaries; they are not live-Mongo integration tests or browser tests. The cart suite includes the real cart API/service and durable merge code behind test persistence boundaries.

Modified-file ESLint uses its API to handle literal Clerk catch-all paths correctly. It gathers changed and untracked `.ts`, `.tsx`, and `.cjs` paths with `git diff --name-only --diff-filter=ACMR` and `git ls-files --others --exclude-standard`, then runs `eslint.lintText(contents, { filePath })` for each. Earlier-phase uncommitted files are included in this check and preserved.

TypeScript and ESLint passed (64 modified/untracked source files, zero lint warnings/errors). The exact ESLint invocation is:

```powershell
@'
const {execFileSync}=require('node:child_process');
const {ESLint}=require('eslint');
(async()=>{
const files=[...new Set([...execFileSync('git',['-c','core.safecrlf=false','diff','--name-only','--diff-filter=ACMR'],{encoding:'utf8'}).split(/\r?\n/),...execFileSync('git',['ls-files','--others','--exclude-standard'],{encoding:'utf8'}).split(/\r?\n/)].filter(f=>/\.(ts|tsx|cjs)$/.test(f)))];
const eslint=new ESLint(); const results=[];
for(const file of files) results.push(...await eslint.lintText(require('node:fs').readFileSync(file,'utf8'),{filePath:file}));
console.log((await eslint.loadFormatter('stylish')).format(results));
console.log(`Checked ${files.length} modified/untracked source files`);
process.exitCode=results.some(r=>r.errorCount||r.warningCount)?1:0;
})();
'@ | node
```

Build isolation uses process-local dummy Clerk/Resend credentials and `mongodb://127.0.0.1:1/dreamshop_phase4b?serverSelectionTimeoutMS=1000`. The homepage is now dynamic; catalog/detail routes are also dynamic. Build verification does not need live products, a production database, or a valid user session. No environment files are modified.

```powershell
$env:NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_' + [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes('example.clerk.accounts.dev$'))
$env:CLERK_SECRET_KEY = 'sk_test_phase4b_local_only'
$env:CLERK_WEBHOOK_SIGNING_SECRET = 'phase4b-local-only'
$env:MONGODB_URI = 'mongodb://127.0.0.1:1/dreamshop_phase4b?serverSelectionTimeoutMS=1000'
$env:RESEND_API_KEY = 're_phase4b_local_only'
npm run build
```

No browser tool is available in this session. The prior headless Chrome attempt was blocked by automatic approval review, and the existing development lock/process was not touched or retried. No screenshots or 375/640/768/1024/1440px browser tests are claimed.

### Manual visual and interaction checklist

1. At each requested width (375, 640, 768, 1024, 1440), inspect homepage, catalog, and a real product in both themes. Check document-level horizontal overflow, hero stacking, long titles/tags/category labels, image proportions, filters, grid columns, and pagination.
2. Use keyboard only: skip link, header search/menu, all category/card links, filters, sort, pagination, quantity controls, cart action, and toast/status feedback. Verify focus visibility and drawer focus return.
3. Apply search/category/sort, navigate pages, refresh, and use back/forward. Check the URL and visible result count stay consistent. Test empty searches, invalid IDs, missing products, missing images, and failed remote image loads.
4. In a staging session, add multiple units as a guest, reload, sign in, and verify exactly-once synchronization. Add as an authenticated user and verify count/cart updates. Test cumulative quantity limits and failed network requests.
5. Check loading/error states and category-only/related-product failures. Verify that internal errors and private owner fields never appear in rendered output or public payloads.

## Files in this phase

Modified: `app/page.tsx`, `app/(root)/all-products/page.tsx`, `app/(root)/all-products/[productId]/page.tsx`, `lib/utils/localCart.ts`, `package.json`, `tests/cart.test.cjs`.

Created: `app/(root)/all-products/loading.tsx`, `app/(root)/all-products/[productId]/loading.tsx`, `app/(root)/all-products/[productId]/not-found.tsx`, `components/products/CatalogControls.tsx`, `components/products/StorefrontImage.tsx`, `components/products/StorefrontProducts.tsx`, `components/products/StorefrontPurchase.tsx`, `lib/storefront-contract.ts`, `lib/storefront-metadata.ts`, `lib/server/storefront-service.ts`, `lib/utils/storefront-cart.ts`, `tests/storefront.test.cjs`, and this document. No files removed.

## Deferred functionality and next phase

Stripe, checkout, merchant/admin dashboards, payouts, reviews, inventory, variants, discounts, persisted favorites, merchant storefronts/verification, shipping estimates, numeric price sorting, and currency migration remain out of scope. Live integration and visual/browser verification remain outstanding.

Next recommended implementation phase: customer account, favorites, and cart visual redesign. Persisted favorites requires an explicit backend design before exposing working save controls; existing cart reconciliation and authorization must remain intact.
