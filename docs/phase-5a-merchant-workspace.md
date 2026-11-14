# Phase 5A — Merchant workspace

## Implementation and routes

- `/sell`: signed-in customer application, server-derived application status, approved-merchant store setup, and link to the workspace. Discoverable from the main navigation and footer.
- `/merchant`: real product statistics, recent product rows, store settings shortcut, and an explicitly planned sales/payouts panel.
- `/merchant/products`: store-scoped search, category filtering, four sort choices, bounded pagination, status, creation date, edit and archive/restore actions.
- `/merchant/products/new` and `/merchant/products/[id]/edit`: validated product forms, existing admin-managed categories, image uploads/library selection, and success/error feedback.
- `/merchant/settings`: profile/contact/logo/banner editing, read-only operational status, and safe unused-image removal.
- `/api/merchant/images`: authenticated, same-origin POST/DELETE; `/api/store-images/[id]`: public raster-image delivery.

The previously attached merchant dashboard screenshot remains accessible in the conversation and informed the navy/slate shell, left navigation, coral actions, pale rounded cards, compact product rows and sidebar panels. Financial figures and charts from the reference were deliberately replaced by real catalog statistics and a planned-feature explanation. No reference directory was assumed. No new generic hero illustration was introduced. No browser screenshot comparison or pixel-fidelity claim is made.

The existing collapsible desktop sidebar and Radix mobile drawer remain in use. Product rows stack on narrow screens rather than shrinking a desktop table. Forms have bounded widths, wrapping labels and single-column layouts below their grid breakpoints. The source was reviewed for 375, 640, 768, 1024 and 1440 px layouts; these sizes were **not browser-tested**.

## Store architecture and state

`Store` contains immutable owner and slug, name, description, private contact email, logo/banner URLs, operational status and timestamps. The database needs unique indexes on `owner` and `slug`. Store ownership is always taken from the authenticated internal User ID. Setup checks both uniqueness constraints within the existing globally coordinated marketplace transaction; indexes protect against writers outside this application as well.

Distinct state authorities:

| State | Authority and behavior |
| --- | --- |
| `User.status` | Clerk identity lifecycle; inactive/deleted accounts are denied |
| `User.applicationStatus` | Existing marketplace account suspension policy |
| `User.merchantStatus` | Existing none → pending → approved/rejected review lifecycle; approved may be suspended |
| `Store.status` | Operational state; active on creation, suspended blocks management; paused is reserved for future storefront operations |
| Stripe onboarding | Not implemented, inferred or granted by any of these states |

Merchants cannot change operational status, owner, slug, approval state or administrative capabilities through profile forms/actions. Name, description, private contact email and store-owned images are allowlisted. No store-status moderation UI is implemented yet. Account deletion leaves a non-reassignable historical owner reference; all management still requires a current active identity. Store creation never changes merchant authorization.

## Applications and review

`MerchantApplication` uses the user ID as its built-in unique `_id`. It stores proposed name, description, contact email, optional supporting information and timestamps. No sensitive documents are requested. Application submission uses the existing transaction coordinator, sets only pending status, and writes the existing authorization audit. Concurrent/repeated pending submissions are idempotent; they do not overwrite the first application or duplicate its audit.

Pending, rejected and suspended users see their server-derived status on `/sell`, without workspace access. Rejected applicants contact support; reopening follows the existing administrative transition policy. An approved applicant with no store sees setup; approved applicants with stores receive a workspace link. Customer capabilities remain unchanged.

Review uses the existing authenticated Super Admin `reviewMerchantApplication({ userId, status, reason })` Server Action / `reviewMerchantAccess` service. Every invocation checks `merchant:approve` independently. A trusted, authenticated admin server component can read the submitted details using server-only `getApplicationForReview(userId)`. No anonymous approval endpoint, public application list, new role-assignment API, or admin review UI was introduced. Existing applications submitted through the older no-details action remain supported; those applicants enter store details after approval.

## Product transition and management

New merchant products have `Product.store → Store.owner → User`; the existing `Product.owner` is retained and assigned to the same authenticated user. `store` is optional and immutable during this transition. `status` is active/archived; missing status on old records is treated as active. The public Product DTO remains unchanged and contains neither owner nor store internals.

Legacy records are **not claimed during setup**. They remain publicly browsable, preserve their existing owner, and are absent from the new store workspace. Existing legacy owner-scoped edit/delete services still operate on unassigned records. Their bulk deletion paths explicitly exclude store products. New store products require a valid authorized store and a store-owned uploaded image. Existing explicit Super Admin platform product update/delete capabilities remain intact; the pre-existing platform product creation path can still create unassigned products for a Super Admin without merchant approval. This exception does not grant store-management access.

The new product workspace reads only the current store. Edits and archival include both the current store and owner in the mutation filter; a different store's or missing product gets the same not-found response. Product fields use existing strict Zod validation, numeric price-string rules and existing category existence checks. Arbitrary category creation, ownership changes and role injection are rejected. Images are checked against the owned image collection in the same mutation transaction.

Archival is reversible. Catalog counts/lists, detail lookup, recommendations, public ID lookup, legacy public product actions, cart product validation and wishlist reads all exclude archived products. Cart population treats them as unavailable while retaining stored references and quantities; wishlist saved IDs remain and are reported as unavailable. Restoring a product makes those preserved references usable again. Existing merge receipt/idempotency logic is unchanged. Store products cannot be hard-deleted through legacy merchant actions; explicit Super Admin deletion remains an administrative capability. Archived products still reserve their category and image references.

Prices remain the existing decimal strings. No currency is invented, and no financial totals or analytics are calculated.

## Image storage and safety

Images use the existing MongoDB deployment, in a separate `storeimages` collection with binary data excluded from ordinary projections. This avoids a new external provider or credentials. `sharp` 0.34.5 was already installed transitively through Next and is now a pinned direct dependency for the server's decoding pipeline.

- Uploads require an active, approved merchant and an owned, non-suspended store, checked before reading the body and again within the storage mutation.
- The route checks same origin and bounds the streamed request body to 2 MiB independently of Content-Length.
- PNG/JPEG/WebP MIME types and matching signatures are required; SVG and arbitrary HTML are rejected.
- Sharp decodes the input with a 16-million-pixel limit and warning-level failure handling, auto-orients, scales inside 2000 × 2000, and produces a WebP without source metadata. The encoded result is also limited to 2 MiB. Only the first frame is used.
- IDs are generated by MongoDB; caller filenames and filesystem paths are never used.
- Each store may retain at most 100 images. Quota checks and insertion are serialized by the existing transaction coordinator.
- Public delivery sets an explicit image content type, `nosniff`, restrictive CSP and a five-minute cache. Images are public assets, not a private document service; the uploader says this explicitly.
- Referenced product images (including archived products), logo and banner cannot be deleted. Replacement changes only the validated reference; the old image stays available until manually removed when unused. Deletion is store-scoped. Deleted images can remain in intermediary caches for up to five minutes.

No external storage setup is required. Production needs the existing MongoDB write permissions, index/collection provisioning below, and a Node deployment supporting Sharp. Large-scale object storage/CDN migration, upload rate limiting beyond store quotas and asset retention tooling remain future operational work. The request/type/size controls are implemented; no upload control is a placeholder.

Sharp options were checked against its [official constructor documentation](https://sharp.pixelplumbing.com/api-constructor/).

## Dashboard and public storefront preparation

Metrics come from a store-filtered aggregation: total products, active products, archived products and distinct non-null category references. Recent rows come from the bounded store product query. There is no revenue, units-sold, order, balance, payout or customer-count data.

`/stores/[slug]` is **deferred**. Slug uniqueness, store presentation fields, store-product references and an explicit `publicStoreDTO` prepare for it. The future public DTO includes only name, slug, description, logo and banner; it omits contact email, owner, internal IDs and privileges. No links pretend that a public store page exists. General public catalog browsing continues without authentication.

## Database deployment, inventory and migration

This implementation did not connect to production to inspect records and did not run production migrations, index creation or data writes. Inspection covered repository schemas, callers and isolated test fixtures. A live inventory is required before any legacy backfill. The read-only helper prints counts and index definitions, never documents, credentials or personal information:

```powershell
# Select a staging database in the environment first. Honors MONGODB_DB_NAME.
node scripts/inspect-merchant-data.cjs --read-only
```

The report identifies unassigned products, missing owners, store-assigned products, archived products, mismatched/missing store relationships and deployed store indexes. This helper was added but not executed against a real database during this task.

Transactions continue to require an Atlas cluster / replica set or supported sharded deployment. Standalone MongoDB is unsupported. Existing User, authorization coordinator/audit and category infrastructure requirements still apply. There is no fallback that bypasses transaction checks.

Provision the new collections and indexes explicitly in staging and then through the deployment process. `autoIndex` is disabled for Store, StoreImage, MerchantApplication and Product. Example mongosh commands, **not executed by the app or this task**:

```javascript
// Select the intended database explicitly before executing these commands.
// Create these collections only if absent (skip an already-existing collection).
db.createCollection("stores")
db.createCollection("storeimages")
db.createCollection("merchantapplications")
db.stores.createIndex({ owner: 1 }, { unique: true })
db.stores.createIndex({ slug: 1 }, { unique: true })
db.storeimages.createIndex({ store: 1 })
db.products.createIndex({ store: 1, createdAt: -1, _id: -1 })
```

MongoDB's built-in unique `_id` index enforces one application per user. Before creating unique indexes, inspect and reconcile any pre-existing duplicates; do not drop data or use `syncIndexes` blindly. Verify transaction support and uniqueness with two simultaneous store creations on an isolated database. Automated tests simulate serialized transactions and duplicate-key constraints but are not real replica-set integration tests.

Any later legacy migration must be separately reviewed: snapshot affected records; identify each existing owner and approved store; flag missing/deleted/suspended owners, ownerless records and conflicting associations; produce an explicit ID-to-store mapping; then backfill only approved mappings with predicates on both `_id` and original `owner`. Do not infer ownership from email, Clerk metadata or the newest store. Preserve the legacy `owner` field. Do not run an automatic catch-all backfill.

Rollback: this change adds fields/collections without removing existing ownership or product fields. Keep a migration manifest for any future backfill and unset only its explicitly assigned store references if rollback is necessary. **Do not roll public readers back to code that ignores archival status** while archived records exist: they would become visible again. Disable merchant writes and retain archive-aware readers during rollback. Keep image delivery available while product URLs reference it. Store images and application history must not be deleted as an incidental rollback step.

## Verification

Automated suites run together:

```powershell
node --test tests/merchant.test.cjs tests/authorization.test.cjs tests/identity.test.cjs tests/cart.test.cjs tests/storefront.test.cjs tests/customer.test.cjs tests/connection.test.cjs tests/ui-consistency.test.cjs
npx tsc --noEmit --incremental false
git -c core.safecrlf=false diff --check
npm run build
```

Results: **249 passed, 0 failed** — merchant 39, authorization 47, identity 35, cart 59, storefront 21, customer 27, connection 8, UI 13. `npm run test:merchant` also selects the merchant suite. The previous 207 tests remain; the authorization fixture was extracted and expanded, not replaced with weaker assertions. New tests cover applications, tenant separation, suspended/deleted identities, store/slug concurrency, strict payloads, product creation/edit/archive/restore, legacy isolation, category/price validation, upload origin/auth/stream limits, actual Sharp decoding, MIME spoofing, image quotas/reference safety, statistics and private-field exclusion. Cart/wishlist/storefront mocks now honor archive filters and have explicit archive regressions.

TypeScript passed. Modified/new-source ESLint checked 38 TS/TSX/CJS files with no errors or warnings, using ESLint's `lintText` API for literal filenames (including bracketed route paths). Diff whitespace check passed. Production build passed using process-local dummy Clerk/Resend values and an unreachable local Mongo URI, with all database-backed routes dynamic; no real services were used for the build.

The npm install completed. Its repository-wide audit reported 45 vulnerabilities (2 low, 18 moderate, 20 high, 5 critical); no unrelated automatic dependency upgrades were attempted. This is not a claim that these are introduced by Sharp or reachable through these changes.

Not verified here: real Clerk browser sessions, live MongoDB transactions/indexes, database failover, browser keyboard interactions, rendered responsive sizes or pixel comparison. No browser tools were available. Stage these before launch, including two merchants attempting cross-store direct actions, simultaneous setup with colliding slugs, suspension during a write, full image upload/replacement/removal and archived cart restoration.

## File inventory

Created:

```text
app/(root)/sell/page.tsx
app/api/merchant/images/route.ts
app/api/store-images/[id]/route.ts
app/merchant/error.tsx
app/merchant/loading.tsx
app/merchant/page.tsx
app/merchant/products/[id]/edit/page.tsx
app/merchant/products/new/page.tsx
app/merchant/products/page.tsx
app/merchant/settings/page.tsx
components/merchant/MerchantForms.tsx
components/merchant/ProductTable.tsx
docs/phase-5a-merchant-workspace.md
lib/actions/store.actions.ts
lib/db/models/merchant-application.model.ts
lib/db/models/store-image.model.ts
lib/db/models/store.model.ts
lib/merchant-contract.ts
lib/server/merchant-products.ts
lib/server/store-images.ts
lib/server/store-service.ts
scripts/inspect-merchant-data.cjs
tests/helpers/marketplace-fixture.cjs
tests/merchant.test.cjs
```

Modified:

```text
app/api/products/route.ts
components/layout/WorkspaceShell.tsx
components/shared/Footer.tsx
components/shared/NavigationMenu.tsx
lib/actions/cart.actions.ts
lib/actions/product.action.ts
lib/db/models/product.model.ts
lib/server/product-service.ts
lib/server/storefront-service.ts
lib/server/wishlist-service.ts
package.json
package-lock.json
proxy.ts
tests/authorization.test.cjs
tests/cart.test.cjs
tests/customer.test.cjs
tests/storefront.test.cjs
```

Deleted: none.

## Remaining scope and recommended next phase

Complete staging/index/browser verification, then implement an authenticated Super Admin application review UI and public store pages with explicit operational-visibility policy. Follow with reviewed legacy-product mapping and migration tooling. Stripe, orders, inventory reservations, payouts and financial analytics remain out of scope. No Clerk identity changes, Super Admin privilege assignment changes, cart synchronization replacement or production data migration were made.
