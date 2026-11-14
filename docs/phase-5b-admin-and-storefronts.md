# Phase 5B — Super Admin operations and public storefronts

## Delivered routes and permission boundaries

| Route | Purpose |
| --- | --- |
| `/admin` | Operational metrics, application preview, category overview, recent stores/products and recent audits |
| `/admin/merchants/applications` | Searchable, status-filtered, paginated applications |
| `/admin/merchants` | Merchant account/store directory |
| `/admin/merchants/[id]` | Application details, merchant decisions, store operations and history |
| `/admin/users` | Private administrative user directory, capability/status filters |
| `/admin/users/[id]` | Account details, marketplace suspension/reactivation and history |
| `/admin/categories` | Flat category creation, rename and safe deletion |
| `/admin/products` | Product ownership oversight, filters, archive/restore |
| `/stores/[slug]` | Anonymous public store profile and eligible product grid |

The existing protected admin layout is retained. Every admin read service independently requires `users:manage`, `category:manage`, or `product:manage:any`; every write independently uses the existing capability-checked marketplace transaction. A signed-in customer or merchant cannot access these private services by calling an action directly. No capability is inferred from client props or Clerk metadata.

Phase 5A was still uncommitted at the start of this task. Its files and behavior were preserved; the inventory below describes this phase's additions and edits relative to that starting state.

## Dashboard definitions and query bounds

All values come from MongoDB counts. No complete collection is fetched to calculate totals.

| Metric | Exact definition |
| --- | --- |
| Registered users | All retained User documents, including suspended/deleted identities |
| Active customer accounts | Identity status and application account status both active; missing legacy status is treated as active. Includes active merchants/admins because they retain customer capabilities |
| Active approved merchants | Active customer definition plus `merchantStatus: approved` |
| Pending applications | `merchantStatus: pending`, excluding deleted identities; account suspension does not erase an application |
| Total stores | All Store documents, including paused/suspended |
| Operationally active stores | `Store.status: active`; this is not a count of publicly eligible stores because owner eligibility is a separate condition |
| Total products | All Product documents, including legacy and archived products |
| Archived products | `Product.status: archived` |
| Categories | All Category documents |

Dashboard previews are limited to four applications, stores, products and categories; six of the latest twenty audit records are shown. Directory page sizes are capped at 24, page numbers at 10,000, and queries have a five-second database execution bound. Enrichment performs bounded indexed lookups for the returned page only. Public pages are capped at 48 products and public store-link enrichment at 48 references. Deep offset pages and substring searches can remain expensive; timeouts fail through controlled errors, not partial unlabelled results. Search is escaped literal text, never caller-provided Mongo operators.

Directories sort stably by registration/creation time plus ID, or name plus ID. Application submission date is displayed separately; the current application directory sorts by account registration, as labelled. Application/user/merchant search matches applicant/account name, username or email, not proposed-store descriptions. Category sorting uses name because the existing category schema has no creation timestamp. Product filter dropdowns show up to 100 recent approved merchants and 200 categories; directory/detail links can scope products to any particular owner/store/category beyond those choices.

“Recent activity” sections identify newly created records or actual audit entries. They do not imply last-login tracking. Revenue, commissions, growth rates, orders and payouts remain explicitly unavailable.

## Application and merchant administration

Application lists and details reuse User.merchantStatus and Phase 5A MerchantApplication records. Legacy pending users without detailed application records remain reviewable, with that limitation visibly explained.

The existing `reviewMerchantAccess` / `reviewMerchantApplication` workflow supplies approval, rejection, merchant suspension, reinstatement and reopening a rejected application. There is no parallel approval system. Each operation validates the target user and legal transition, reauthenticates the administrator inside the coordinated transaction and records the existing audit event.

Dialogs submit the displayed `expectedStatus`. A conflicting stale decision is rejected with a refresh message. Repeating a decision that is already applied is an idempotent success without an extra audit. Two conflicting approvals/rejections serialize through the existing authorization control write. Deleted identities cannot be changed, including through previously existing access-management functions.

Store administration lives in merchant/user detail pages rather than a duplicate store directory. Administrators can view the associated store and product count, activate it, pause/deactivate its storefront, or suspend its management. Store activation requires an active, approved owner. Owner identity is write-locked during the transaction so a concurrent Clerk lifecycle change conflicts and retries. A missing or deleted owner cannot be reactivated by changing store status. No ownership transfer is exposed.

An existing store whose owner's merchant status was reset to `none` remains inspectable through `/admin/users/[id]`; the merchant directory intentionally lists current pending/approved/rejected/suspended merchant accounts. No destructive account deletion or store deletion was added.

## Users & Access

Authorized operators can inspect limited user fields, application state, the associated store and recent audit history. Emails are present only in these authenticated administrative views. Clerk IDs, synchronization fingerprints and arbitrary user documents are never serialized.

Account suspension/reactivation changes only the existing `applicationStatus`. It cannot clear a Clerk ban/deletion, grant merchant access or assign Super Admin. Existing last-active-Super-Admin protection remains in the same transactional workflow. Deleted identities are read-only. The role/capability explanation panel is informational; the screenshot's arbitrary role creation/assignment controls are not implemented.

## Categories and product oversight

Category creation, rename and deletion reuse the existing secure category services and now write transactional category audits. Categories referenced by any product, including archived products, cannot be deleted. The UI explains that products must first be reassigned. Repeating an identical rename is a no-op. Category name uniqueness remains the existing unique name index; duplicate names receive a controlled conflict.

Category hierarchy, slugs, visibility states and creation timestamps are not present in the existing schema. The page presents a coherent flat taxonomy without fabricated fields. A future hierarchy migration needs parent/cycle rules, sibling slug uniqueness, reassignment behavior and an explicit backfill/rollback plan.

Product oversight includes image, title, category, price as stored, ownership/store, creation date and status. Operators may archive or restore with a reason and expected status. This uses the existing explicit `product:manage:any` capability. Ordinary update schemas cannot change owner/store fields. No fictitious pending-product queue or new approval state was introduced.

Existing explicit platform edit/delete services remain available and now record audits; no new destructive bulk UI was added. Archive/restore is the only new product control shown in this interface. A single product status is shared with the merchant workflow: this phase does **not** introduce a separate administrative moderation lock that prevents an approved merchant from restoring their own archived product. To stop a merchant operating during an investigation, suspend merchant/store capabilities. A permanent moderation hold requires a future domain policy rather than an invented partial approval state.

## Public storefront behavior

`/stores/[slug]` is explicitly public in Clerk middleware. The server validates the slug and requires all of:

1. An existing store with operational status `active`.
2. An existing owner whose identity and marketplace account are active (legacy missing account statuses retain the existing active default).
3. The owner's merchant status is `approved`.

Missing, invalid, paused, suspended or otherwise non-active stores, and stores with missing/deleted/suspended/unapproved owners, produce the same not-found result. No administrative reason or owner identity is disclosed. Database failures instead use an error/retry state. Metadata applies the same visibility check and avoids indexing unavailable stores.

Public store DTOs contain only name, slug, description, logo and banner. Products are scoped by both store ID **and owner ID**, require active/missing legacy product status, and are filtered/paginated on the server. Archived, draft, cross-store and mismatched-owner records are excluded. Private contact email, internal store/owner IDs, approval fields, Clerk details and administrative flags are absent from public DTOs.

The page includes uploaded store art when available, product count, literal search, category filtering, sorting, pagination, existing purchase/wishlist controls and links to product details. Catalog cards and product details receive only an eligible store's name/slug for their “Visit store” link. Legacy products keep their existing public DTO and receive no invented store association.

**Operational distinction:** pausing/suspending a storefront removes that public store page and its store links. It does not automatically archive every product in the general marketplace catalog. Existing general catalog/cart/wishlist availability remains product-status based. Use product archival to remove a listing from those paths. This preserves the separate account, merchant, store and product states; no hidden bulk migration or mass mutation is performed. Publicly uploaded image assets also retain their existing public delivery/cache policy rather than becoming private documents when a store is paused.

## Audit guarantees

The existing `authorization_audits` collection is extended with `targetType` and successful `outcome`; legacy records display as user/success events. Each successful consequential mutation records actor, target, action, timestamp, reason and relevant state. Category and store/product-status audits contain before/after values. Existing platform product-edit audits record changed field names rather than copying full descriptions or unnecessary content; deletes record prior existence.

Audit creation and mutation commit in the same transaction. An audit-write failure rolls the mutation back. Transaction retries do not append duplicate committed audits. State transitions/renames that are already applied return without a new event. Rejected/unauthorized operations return controlled errors and do not create a misleading successful audit. Failed attempts are not persisted as a separate security-event stream in this phase.

Audit reads are restricted to Super Admin, newest-first and capped at twenty records; user/store details scope histories by target. A full searchable/exportable audit explorer is deferred. Reasons ask administrators not to include sensitive information. No tokens/passwords/credentials are logged.

## Indexes and deployment safety

Existing transaction requirements are unchanged: Atlas / a replica set or a compatible transactional deployment, with the Phase 3B coordination and audit collections provisioned. There is no non-transactional fallback. The Phase 5A store owner/slug unique indexes and image/application collections are still required. No production connection, migration, index deployment or destructive operation was run in this phase.

Additional declared indexes (autoIndex remains disabled on the affected models):

```javascript
// Select the intended staging database explicitly before provisioning.
db.users.createIndex({ createdAt: -1, _id: -1 })
db.users.createIndex({ merchantStatus: 1, createdAt: -1, _id: -1 })
db.users.createIndex({ status: 1, applicationStatus: 1, merchantStatus: 1 })
db.stores.createIndex({ status: 1, createdAt: -1, _id: -1 })
db.stores.createIndex({ createdAt: -1, _id: -1 })
db.products.createIndex({ store: 1, status: 1, createdAt: -1, _id: -1 })
db.products.createIndex({ category: 1, createdAt: -1, _id: -1 })
db.products.createIndex({ owner: 1, createdAt: -1, _id: -1 })
db.products.createIndex({ status: 1, createdAt: -1, _id: -1 })
db.products.createIndex({ createdAt: -1, _id: -1 })
db.authorization_audits.createIndex({ at: -1, _id: -1 })
db.authorization_audits.createIndex({ target: 1, at: -1, _id: -1 })
```

Existing indexes include unique User.clerkId, Category.name, Store.owner/slug, StoreImage.store, Product.store/createdAt and MongoDB `_id` uniqueness. Verify actual deployment indexes before launch; declarations are not evidence they exist. Do not drop existing indexes via an unreviewed `syncIndexes` call. Case-insensitive substring regex queries are not guaranteed to use normal name indexes; inspect plans and latency in staging before scaling, and adopt a dedicated search/index strategy if required. Exact collection-wide counts are server-side and time-bounded but still incur work proportional to collection/index size; no real-time claim is made.

No legacy owner/store backfill is performed. The Phase 5A read-only inventory and reviewed ID-to-store migration/rollback requirements still apply. New fields on audit events have compatible defaults; historical audit records are not rewritten. Clerk identity behavior and role assignment are unchanged apart from rejecting mutations of deleted target identities in access-management services.

## Visual implementation and manual verification

The approved Super Admin Dashboard, Category Management, Users & Access, Merchant Dashboard and public-home screenshots remain visible in the earlier conversation and were used as visual specifications. No `design-references/` folder was assumed. Shared components reproduce the navy/slate shell, coral navigation/actions, pale rounded panels, metric cards, filters, badges, detail areas and audit activity layout. Admin routes reuse the existing collapsible sidebar/mobile drawer and breadcrumbs. Dialogs use the existing Radix primitive for focus management and accessible titles/descriptions. Inputs have labels and errors, actions have pending feedback, rows wrap into mobile cards, and existing reduced-motion styling remains in effect.

Remaining design differences: the exact isolated promotional device artwork from the screenshots is not available as an embeddable source asset, so the admin hero uses the reference palette and composition without substituting a new generic illustration. Fictional financial charts, growth percentages, example identities, ratings, category hierarchies and arbitrary role assignment are replaced by real data or clear supported-scope explanations. The nine required real metrics occupy more cards than the screenshot. No pixel-perfect or browser comparison claim is made.

No browser tools were available. Manual staging checklist at **375, 640, 768, 1024 and 1440 px**, plus wide desktop:

- Compare the admin dashboard, users and categories pages against the corresponding attached screenshots: panel hierarchy, coral active navigation, sidebar, typography, spacing and contrast.
- Check long names/emails/descriptions and narrow filter rows; ensure no page-level horizontal scrolling.
- Open and collapse the sidebar; use the mobile drawer and verify its focus trap, Escape behavior and focus return.
- Open each confirmation dialog with the keyboard; check visible focus, reason labels, pending-state controls, cancellation and successful refresh.
- Test empty, loading, not-found, conflict and database-error states; ensure raw exceptions/credentials are absent.
- Review pending and legacy applications, inspect a previous decision, then attempt conflicting decisions in two sessions.
- Browse a public store signed out, search/filter/page through it, follow product/store links, use cart/wishlist, and test missing/paused/suspended/deleted-owner stores.
- Check real uploaded logo/banner/product images with different aspect ratios; do not add mock branding or ratings.

## Verification results

```powershell
node --test tests/admin-storefront.test.cjs tests/merchant.test.cjs tests/authorization.test.cjs tests/identity.test.cjs tests/cart.test.cjs tests/storefront.test.cjs tests/customer.test.cjs tests/connection.test.cjs tests/ui-consistency.test.cjs
npx tsc --noEmit --incremental false
git -c core.safecrlf=false diff --check
npm run build
```

**297 passed, 0 failed:** new admin/public-store suite 48; merchant 39; authorization 47; identity 35; cart 59; storefront 21; customer 27; connection 8; UI 13. `npm run test:admin` runs the new suite. Earlier assertions remain: the identity schema test now verifies the complete expanded non-unique index list while preserving unique Clerk identity, and the storefront projection test permits internal store/owner references needed for link lookup while still asserting that neither reaches public DTOs.

TypeScript passed. Modified/new-source ESLint checked 69 TS/TSX/CJS files (including the preserved Phase 5A changes) with no warnings/errors, using literal-path `lintText` calls. Diff whitespace checks passed. Production build passed with process-local dummy Clerk/Resend values and an unreachable local Mongo URI; all DB-backed admin/store routes are dynamic. No production data or real service calls were used for the build.

New tests cover private-read denial, active-count definitions, bounded pagination, approval conflicts/idempotency, account/store states, last-admin protection, deleted targets, transactional audit rollback, category reference safety, product moderation, public eligibility, store/owner isolation, archive/draft exclusion, legacy compatibility, safe DTOs, literal search, sorting/pagination and middleware publicity. These use isolated in-memory persistence/transaction fixtures; real MongoDB concurrency, index plans, failover, real Clerk browser sessions and rendered responsiveness remain unverified.

Before deployment, provision indexes in staging, validate transactions with two independent clients, simulate audit-write failure, test suspension during a concurrent mutation and run the manual checklist. No new dependency was added in Phase 5B.

## File inventory for Phase 5B

Created:

```text
app/(root)/stores/[slug]/page.tsx
app/(root)/stores/[slug]/loading.tsx
app/(root)/stores/[slug]/error.tsx
app/admin/page.tsx
app/admin/loading.tsx
app/admin/error.tsx
app/admin/categories/page.tsx
app/admin/merchants/page.tsx
app/admin/merchants/[id]/page.tsx
app/admin/merchants/applications/page.tsx
app/admin/products/page.tsx
app/admin/users/page.tsx
app/admin/users/[id]/page.tsx
components/admin/AdminActions.tsx
components/admin/AdminNavigation.tsx
components/admin/AdminShared.tsx
components/admin/UserDetail.tsx
lib/actions/admin.actions.ts
lib/admin-contract.ts
lib/server/admin-audit.ts
lib/server/admin-mutations.ts
lib/server/admin-queries.ts
lib/server/public-stores.ts
tests/admin-storefront.test.cjs
docs/phase-5b-admin-and-storefronts.md
```

Modified relative to the Phase 5A starting state:

```text
app/(root)/all-products/[productId]/page.tsx
components/layout/WorkspaceShell.tsx
components/products/StorefrontProducts.tsx
lib/db/models/authorization.model.ts
lib/db/models/product.model.ts
lib/db/models/store.model.ts
lib/db/models/user.model.ts
lib/server/access-management.ts
lib/server/category-service.ts
lib/server/product-service.ts
lib/server/storefront-service.ts
package.json
proxy.ts
tests/helpers/marketplace-fixture.cjs
tests/identity.test.cjs
tests/storefront.test.cjs
```

Removed: none.

## Recommended next milestone

Finish staging/index and reference-based browser verification, then define moderation holds and store/product-wide visibility policy, complete any reviewed legacy ownership migration, and improve administrative search/audit exploration. Taxonomy hierarchy requires a separate design/migration. Stripe, order processing, refunds, commissions, payouts and financial analytics remain deferred.
