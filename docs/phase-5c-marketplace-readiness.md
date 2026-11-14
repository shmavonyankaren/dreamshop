# Phase 5C: Marketplace visibility, moderation and database readiness

## A. Implementation summary

One database-side eligibility pipeline now governs public product reads and customer additions. Administrative holds are independent of merchant publication state, revision checked, and audited transactionally. New products require an authenticated owner's store. Saved unavailable items remain removable. An explicit, non-destructive provisioning tool prepares ten marketplace collections and their indexes.

The database is treated as fresh: no migration, historical ownership assignment, platform store, sample records, or external Clerk reset was added. No live provisioning was executed. Existing uncommitted Phase 5A/5B work was preserved.

### Inconsistencies found before implementation

- Public store pages checked store/owner eligibility, but general catalog, details and customer product lookups primarily checked archival state.
- Products could lack a store; old mutation paths accommodated unassigned products.
- Admin archival shared the merchant publication state and could not represent an independent hold.
- Cart reads silently omitted unavailable records rather than displaying retained placeholders.
- Public image URLs served bytes regardless of product/store eligibility and were cacheable.
- Schema index declarations had no complete, explicit deployment provisioning workflow.

## B. File inventory

Relative to the Phase 5B working tree, created:

```text
app/admin/products/[id]/page.tsx
lib/server/product-eligibility.ts
lib/server/image-visibility.ts
scripts/marketplace-index-manifest.cjs
scripts/provision-marketplace.cjs
tests/helpers/eligibility-aggregate.cjs
tests/readiness.test.cjs
docs/phase-5c-marketplace-readiness.md
```

Modified in this phase (some already untracked from earlier phases):

```text
app/admin/products/page.tsx
app/api/products/route.ts
app/api/store-images/[id]/route.ts
app/merchant/products/[id]/edit/page.tsx
components/admin/AdminActions.tsx
components/admin/AdminShared.tsx
components/cart/CartClient.tsx
components/cart/CartPresentation.tsx
components/merchant/MerchantForms.tsx
components/merchant/ProductTable.tsx
lib/actions/admin.actions.ts
lib/actions/cart.actions.ts
lib/actions/product.action.ts
lib/admin-contract.ts
lib/cart-contract.ts
lib/db/models/authorization.model.ts
lib/db/models/cart.model.ts
lib/db/models/category.model.ts
lib/db/models/merchant-application.model.ts
lib/db/models/product.model.ts
lib/db/models/store-image.model.ts
lib/db/models/store.model.ts
lib/db/models/user.model.ts
lib/server/admin-mutations.ts
lib/server/admin-queries.ts
lib/server/merchant-products.ts
lib/server/product-service.ts
lib/server/public-stores.ts
lib/server/storefront-service.ts
lib/server/wishlist-service.ts
package.json
proxy.ts
tests/admin-storefront.test.cjs
tests/authorization.test.cjs
tests/cart.test.cjs
tests/customer.test.cjs
tests/helpers/marketplace-fixture.cjs
tests/merchant.test.cjs
tests/storefront.test.cjs
```

Removed files: none. The unused public-store enrichment helper was removed; all product listings use the eligibility pipeline instead.

## C. Visibility rules

A product is eligible only if all of these are true:

1. `Product.status === active` and `moderationStatus === clear`.
2. Its referenced Store exists and `Store.status === active`.
3. Product.owner equals Store.owner.
4. That User exists, `status === active`, `applicationStatus === active`, and `merchantStatus === approved`.

Missing states, missing references, mismatched owners and unknown states fail closed. Store pause/suspension or merchant/identity/account suspension hides products without rewriting product state. Restoring a store restores only products that independently meet every condition. The current store schema supports active/paused/suspended; a malformed deactivated value also fails eligibility.

The shared pipeline is used by homepage/catalog/search/category filtering, count/pagination, detail, related products, public store products, public product actions, ID API, cart hydration/add/increase/merge, wishlist reads/additions, and product-image access. Category names themselves remain public taxonomy. Public store headers use the same active-owner predicate and active-store requirement.

## D. Moderation

Publication remains `active | archived`. Moderation is independently `clear | held`, with a required numeric revision and a reason limited to 3–500 trimmed characters for decisions. New products start clear at revision zero. The model excludes the reason from ordinary selections.

Super Admin can filter holds, hold/release through a confirmation dialog, and review current reason plus audit history at `/admin/products/[id]`. The existing responsive dashboard panels, badges, dialogs, loading/error boundaries and table wrappers are reused. Ordinary merchant/customer requests cannot call this privileged mutation. Strict update schemas reject moderation fields.

Approved owners can see their held product and its explanation, edit allowed content, and archive/restore it. None of those operations clears the hold. Release does not restore an archived product or reactivate its store. Reasons shown to owners should contain an appropriate merchant-facing explanation; audit context is admin-only.

## E. Cart and wishlist

- Signed-in cart rows retain saved IDs and quantities. Ineligible products expose only a generic `Unavailable product` DTO with empty image/price and `available: false`.
- New additions and quantity increases require current server eligibility; quantity reductions and removal remain allowed. The UI disables increases and removes unavailable detail links.
- Guest cart hydration preserves local entries omitted by the public ID endpoint as placeholders; guest increases recheck that endpoint. Local storage is never checkout authority.
- Merge receipts, IDs, compare-and-swap limits and recovery remain intact. An unavailable follow-up cannot increase its prior applied contribution; it reports `PRODUCT_UNAVAILABLE` and retains the previously saved quantity unless the user explicitly reduces/removes it. Exact retries do not duplicate quantities.
- Wishlist reads retain saved IDs/count and return unavailable IDs, withholding product details. Unavailable favorites cannot be newly added and can be removed.
- No customer response includes hold reasons, merchant account state, audit details or private ownership fields. Checkout remains disabled.

## F. Database architecture

Product.owner and Product.store are required immutable references. Both creation paths derive them from the authenticated approved merchant's store and validate its image ownership. A Super Admin who wants to create a product must also have approved merchant capability and their own store. Explicit admin management of existing products remains privileged and audited; no invented platform store exists. Merchant deletion paths return `ARCHIVE_REQUIRED` for owned products, and cross-tenant operations still fail without mutation.

All marketplace schemas have `autoIndex: false` and `autoCreate: false`. Provisioning is operator-run, never imported by startup or build. MongoDB can implicitly create a collection on a write; disabling Mongoose DDL is not a deployment readiness gate. Provision before enabling application traffic.

The checked-in manifest is schema-parity tested. In addition to built-in unique `_id`:

| Collection | Declared indexes |
| --- | --- |
| users | unique clerkId; createdAt descending + _id descending; merchantStatus + createdAt descending + _id descending; status + applicationStatus + merchantStatus |
| stores | unique owner; unique slug; status + createdAt descending + _id descending; createdAt descending + _id descending |
| products | store + createdAt descending + _id descending; store + status + createdAt descending + _id descending; category + createdAt descending + _id descending; owner + createdAt descending + _id descending; status + createdAt descending + _id descending; createdAt descending + _id descending; status + moderationStatus + createdAt descending + _id descending |
| categories | unique name |
| carts | unique user |
| wishlists | owner is unique _id |
| merchantapplications | applicant is unique _id; queue lookup uses user merchantStatus |
| storeimages | store |
| authorization_controls | unique coordination _id |
| authorization_audits | at descending + _id descending; target + at descending + _id descending |

Unless marked descending, directions are ascending. Cart receipts stay embedded in the unique user cart; no TTL or receipt expiration index was added. Eligibility joins use store/user `_id` indexes. Name sorts and literal substring searches may require in-memory work; production query plans must be measured before adding speculative indexes. The unused legacy Order model is outside this phase and is not provisioned.

## G. Concurrency and audit

Marketplace mutations continue using the existing shared authorization-control write, transactional capability re-read, actor write lock, snapshot read concern, majority+journal write concern, and primary read preference. There is no non-transactional fallback.

Hold/release adds a moderation revision compare-and-swap. Exact retries at the immediately resulting revision with matching state/reason are no-ops; stale revisions conflict, including delayed requests after subsequent state changes. Competing opposite decisions cannot overwrite each other. A same-state/current-revision request is a no-op rather than a reason-only edit.

Each committed transition writes `product.hold` or `product.release` with actor, target/type, before/after state and revision, reason, success outcome and timestamp in the same transaction. Audit failure rolls back the state update. Merchant edits cannot write these fields; edit/hold and suspend/edit races preserve the independent restrictions. Existing approval, category, store and archival transaction tests remain.

Cart mutations retain their own CAS architecture; they do not acquire the global marketplace transaction lock. Eligibility is rechecked inside addition/increase CAS attempts, but suspension can still race the final cart write. Subsequent reads mark that item unavailable. A cart is a saved intention, never a reservation or purchase authorization. Count/list queries are separate reads and can differ briefly during concurrent changes. Already-rendered pages can remain stale until refreshed.

## H. Security and privacy

Public DTOs whitelist product presentation fields and optional store name/slug; owner IDs, identities, email, moderation reasons and audits are excluded. Aggregations cast validated IDs explicitly. Ownership and capability checks remain server-side, independent of UI controls.

Store images are public only when referenced by an eligible product or an eligible store's logo/banner. Other images are available to an authorized owner or Super Admin. Responses are `private, no-store`; proxy configuration supplies auth context without redirecting anonymous eligible image requests. Previously downloaded or cached images cannot be revoked, and an image reused by a different eligible product remains public by design.

Provisioning uses an explicit environment, database and repeated confirmation; it rejects system/default database names, conflicting URI/database configuration and ambiguous modes. Production-labelled targets additionally require explicit production flags. It creates missing collections/indexes only, reports conflicting uniqueness/options and numeric index errors, and leaves unrelated indexes and documents untouched. No drop/syncIndexes/migration/reset operation exists. Credentials and raw server errors are not logged. Environment labels cannot prove that a host is staging: the operator must verify the actual Atlas project/cluster and database.

## I. Verification

- Baseline: 297 passing tests before Phase 5C.
- Final suite: **342 passed, 0 failed, 0 skipped** using `node --test tests/*.test.cjs` (45 additional tests).
- `npx tsc --noEmit`: passed.
- ESLint across all 81 changed/untracked TypeScript/TSX/CJS files, including pre-existing Phase 5A/5B work: passed, zero warnings/errors.
- `git -c core.safecrlf=false diff --check`: passed.
- `npm run build`: passed, including `/admin/products/[id]`; 29 static pages generated. Build used process-local dummy Clerk/email credentials and `mongodb://127.0.0.1:1/dreamshop_phase5c?serverSelectionTimeoutMS=1000`, not a live database. Environment files were not edited.

Tests execute the real eligibility aggregation pipeline against an isolated in-memory persistence adapter. They cover sixteen ineligible states across public surfaces, DTO privacy, store reactivation, held cart/wishlist behavior, merge recovery, moderation permission/payload rejection, competing decisions, retries/replay, rollback, concurrent merchant/admin changes, image visibility, strict schema defaults, index target safety, read-only checks, idempotent provisioning, conflict/error reporting and manifest/schema parity. Existing identity, authorization, cart, customer, merchant, storefront and UI tests still run.

Deliberate obsolete assertions updated, with no tests deleted: unassigned products are no longer public or editable through a merchant fallback; merchant hard deletion is replaced by archival; Super Admin creation requires an owned merchant store; unavailable cart entries now remain placeholders rather than disappearing. Fixtures now supply valid store/owner/moderation state. Expected fixture counts and public store-link projections were updated accordingly. Tenant, privilege, receipt and synchronization protections were retained.

No genuine MongoDB transaction/index tests or browser screenshot comparison were performed. Mock concurrency tests establish application behavior, not live replica-set guarantees. The existing visual composition was extended rather than redesigned; responsive and keyboard behavior still require staging verification.

## J. Deployment and staging instructions

Do not run these against an unverified database. Provisioning was deliberately not executed during this task.

1. Verify the intended Atlas project, cluster, environment and exact database. Obtain scoped credentials through the normal secret manager. Confirm a replica set or supported transactional sharded deployment, TLS/network reachability, and matching application URI/database configuration. The CLI performs a `hello` topology check but does not replace operator verification.
2. In an isolated operator process, explicitly set `MONGODB_URI` and `MONGODB_DB_NAME` to the approved target. The URI database must agree with the flag; no environment file is automatically loaded. Never paste credentials into reports or shell history. Set `NODE_ENV` consistently. Use a database such as `dreamshop_staging`, not the implicit `test` default.
3. Run the read-only inspection:

```powershell
npm run db:provision -- --environment staging --database dreamshop_staging --confirm-database dreamshop_staging --check
```

4. Review output. Missing collections/indexes produce exit 1 in check mode. After explicit operational authorization, create only missing definitions:

```powershell
npm run db:provision -- --environment staging --database dreamshop_staging --confirm-database dreamshop_staging --apply
npm run db:provision -- --environment staging --database dreamshop_staging --confirm-database dreamshop_staging --check
```

5. Require a clean check before enabling traffic. Re-running apply must leave indexes/data unchanged. Conflicts or index-build errors produce exit 1; stop and investigate rather than dropping indexes. Apply is additive, not all-or-nothing: successful creations remain if a later index fails. Production requires `--environment production --allow-production --confirm-production EXACT_DATABASE` in addition to exact database confirmation, plus independently approved credentials/host verification. No command here authorizes production execution.
6. Restore application identities through the existing verified Clerk sync flow. A cleared local database does not imply deleted Clerk accounts; do not reset them. Use a real authorized staging operator, then the existing reviewed `scripts/bootstrap-super-admin.cjs --confirm-bootstrap` workflow if initial admin access is required. That script separately requires `MONGODB_DATABASE` (set to the same verified database), `BOOTSTRAP_CLERK_ID`, `BOOTSTRAP_OPERATOR` and `BOOTSTRAP_REASON`; it does not replace index provisioning. Do not create sample production users.
7. In authorized staging, create a category, approve a merchant, create their store, upload an image and publish a product through normal flows. Verify catalog, category/search, detail/related, store, ID API, cart and wishlist. Archive, hold, pause store, suspend merchant/account and reverse each operation independently; hidden products must remain hidden until every condition is restored. Confirm generic retained placeholders and owner/admin-only explanations.
8. Use two admin sessions to submit opposite decisions from the same moderation revision. Confirm only one transition/audit commits and the stale request conflicts. Repeat an exact decision and verify no duplicate audit. Hold while editing as merchant, and suspend while editing; verify public reads remain denied. In an isolated transaction integration harness, inject an audit failure and verify state rollback. Test unsupported transaction topology fails rather than falling back.
9. Inspect actual indexes using `getIndexes()` for each manifest collection. Verify duplicate clerkId, store owner/slug and cart user writes fail under concurrency; restore the dedicated staging fixtures afterward through reviewed means. Do not run broad cleanup against shared data. Use `explain('executionStats')` on realistic catalog/store/admin queries and record index usage, sort work and latency.
10. At desktop and narrow mobile widths, verify admin filters, hold/release confirmation, focus return, keyboard escape, error/loading feedback, history access, merchant hold explanations and unavailable cart/wishlist controls. Check image requests anonymously, as owner, as another merchant and as admin. Verify successful image responses prohibit caching.

## K. Remaining limitations

Live Atlas topology, permissions, indexes, transactions, concurrent write conflicts, image auth delivery and query plans remain unverified until the authorized staging checks above. Substring searches, cross-collection joins and the existing global mutation coordination point need load measurements. Public count/list/header snapshots are not atomic. No background availability push or cache-revocation system was added. Provisioning flags cannot identify mislabeled production infrastructure without operator verification.

Pricing remains the existing product string contract without a completed currency/commerce model. There are no stock reservations, customer orders, checkout, Stripe, payments, refunds, payouts, commissions or financial analytics in this phase.

## L. Recommended next phase

Complete the staging readiness gate, then design authoritative money/currency, inventory and order-state contracts with idempotency and transaction boundaries. A future checkout must revalidate eligibility, current price/currency and inventory on the server at the purchase boundary; neither cart contents nor a prior public response is sufficient authorization. Payment integration should follow that reviewed commerce foundation.
