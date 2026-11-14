# Phase 3B: authorization and marketplace security

## Inspection and trust boundaries

Before this phase, every user was a Clerk-linked MongoDB User. Product ownership was `Product.owner -> User._id`. All functions in product/category `"use server"` modules were potentially client-callable: product creation trusted the entire payload, update/delete trusted a caller-supplied `userId`, updates allowed owner replacement, bulk deletion accepted any owner ID, and category creation had no authorization. Profile synchronization already selected only identity fields but the canonical resolver had no application policy.

Repository search found no UI callers of the product/category mutation actions. The live all-products page uses `getAllProducts`; `/api/products` and cart DTOs use the existing product model and field projections. These read shapes remain compatible. There are no new dashboards, storefront layouts, Stripe calls, upload handlers or store models.

Trust boundaries now are:

1. Clerk session establishes an external identity; it does not establish marketplace permissions.
2. Canonical server identity resolution selects the current MongoDB identity and application policy. Browser IDs, roles, owner fields and Clerk metadata cannot select permissions.
3. The central capability policy authorizes operations, independently of route visibility.
4. Strict validation selects editable product/category fields. MongoDB queries additionally constrain merchant ownership.
5. Transactional services re-read permission state after acquiring a coordination write. Audit writes and privilege mutations commit together.
6. Explicit operator bootstrap is outside the HTTP/Server Action surface and is never invoked automatically.

## Identity and application policy

User gains three server-controlled fields:

- `applicationStatus`: active or suspended; defaults to active for legacy users.
- `merchantStatus`: none, pending, approved, rejected or suspended; defaults to none.
- `superAdmin`: boolean, default false.

The existing `status` continues representing Clerk active/suspended/deleted identity state. Stripe onboarding is not represented or inferred. These concepts remain separate. An approved merchant keeps customer access. Merchant-only suspension removes merchant permissions without suspending the customer's entire account. An active Super Admin's independent administrative authority is not revoked by a merchant-status change; use protected admin revocation or application suspension instead.

`InternalUserDTO` contains the application fields for server policy decisions. Public profile DTOs, product/category DTOs, cart responses and identity HTTP responses do not expose them. Clerk create/update/recovery still use their existing explicit profile allowlist, preserving these fields and deletion tombstones. They cannot clear application suspension or assign merchant/admin privileges.

The canonical resolver denies any protected operation if either Clerk status or application status is inactive. Missing mappings keep the existing 409 recovery behavior and missing authentication remains 401. Identity recovery synchronizes profile information but returns 403 for application-suspended accounts. Suspended/deleted people may still browse exactly the anonymous public storefront; they cannot perform protected account/cart/merchant/admin operations using a stale session.

## Capability matrix

All protected columns assume an active Clerk identity and active application account.

| Operation | Customer | Approved merchant | Super Admin |
|---|---|---|---|
| Public product/category reads | Yes, also anonymous | Yes | Yes |
| Own account/cart | Yes | Yes | Yes |
| Request merchant review | From none | Already approved | From none |
| Create products | No | Yes, own user ID | Yes, own user ID |
| Ordinary update/delete/bulk delete | No | Own products only | Own products only |
| Explicit administrative product management | No | No | Any product |
| Category create/update/delete | No | No | Yes |
| Merchant review | No | No | Yes |
| Application access management | No | No | Protected server service |
| Super Admin grant/revocation | No | No | Protected server service |

`authorization.ts` implements a small fixed policy using `customer:access`, `merchant:access`, product own/create/manage-any, `category:manage`, `merchant:approve` and `users:manage`. There is no user-editable capability array or generic permission engine.

`requireRouteAccess("account" | "merchant" | "admin")` is available for future server layouts/handlers. The current proxy already establishes Clerk context and protects nonpublic page paths, including these future prefixes. No placeholder routes are added. Future layouts must call the corresponding guard, and their services must still authorize independently; middleware authentication alone never grants a merchant/admin capability.

## Merchant approval foundation

`applyForMerchant` accepts no identity, role or approval payload. An active account in none may request pending review. Repeated pending requests are no-ops. Approved/rejected/suspended accounts cannot use this action to promote themselves or reset review state.

Super Admin-only `reviewMerchantApplication` uses a strict target ID, status and required reason. Allowed administrative transitions are:

| Current | Administrative destinations |
|---|---|
| none | pending |
| pending | approved, rejected, none |
| approved | suspended, none |
| rejected | pending, none |
| suspended | approved, none |

Approval requires an active identity and application account. none revokes merchant capability; suspended pauses it. Repeating the current state is a no-op, while every actual transition gets an audit record. The service provides the permission foundation only: no business eligibility, application document collection, storefront or payment onboarding is implemented. Merchant eligibility criteria, resubmission/appeal policy, review separation of duties and final customer-facing wording require product approval before a registration UI is built. The conservative transition limits do not assert that an applicant meets any commercial or legal requirements.

## Product ownership and mutation contracts

Product ownership remains `owner: User._id`, not a store ID. No historical product grants merchant access automatically. Products with missing/unknown owners remain publicly readable; ordinary merchants cannot claim or change them. Explicit admin operations can edit their nonownership fields or delete them. A future store migration must map owners and orphan records explicitly, preserving customer references and history.

Product mutation Server Actions now return `{ ok: true, data }` or `{ ok: false, error: { status, code, message } }`. Their services independently authorize. Existing public reads retain array/product DTO shapes. No current UI caller required mutation-contract adaptation.

- `createProduct(fields)`: approved merchant or Super Admin; ownership always comes from the authenticated account. Owner/userId/admin fields in the payload are rejected.
- `updateProduct({ productId, product })`: editable fields are title, description, imageUrl, price, tags and category. Empty or unknown-field patches fail validation. The actual write filters by both product ID and authenticated owner, uses `$set` and Mongoose update validators, and increments `__v`.
- `deleteProduct({ productId })`: the deletion query includes both ID and authenticated owner. Missing and other-owned records receive the same generic 404, without owner details.
- `deleteProducts({ productIds })`: at most 100 unique IDs, all must be owned and present. A mixed/missing request deletes nothing. Matching and deletion occur in one transaction, with an owner constraint on the deletion query.
- `deleteAllProductsByUser()` retains its historical export name but accepts no user ID. An empty object or omitted argument deletes only the authenticated owner's products. Old arbitrary-ID calls are rejected.
- `adminUpdateProduct`, `adminDeleteProduct`, `adminDeleteProducts`: separate actions require `product:manage:any`. Ordinary actions do not silently become cross-owner operations for admins. No action transfers ownership or accepts a permission-mode flag from the browser.

New input is bounded and strictly validated. Prices remain nonnegative decimal **strings**, with a 32-character input bound; this does not choose a currency, rounding policy, decimal precision or storage migration. Image references must be local paths or HTTP(S) URLs, with no upload/fetch introduced. Categories must exist at write time. Legacy records remain readable without forced validation/migration of their old values. Concurrent partial edits are serialized; later edits to the same field win. There is no new editor/version-conflict UI.

Product deletion remains physical, matching the existing schema and behavior. Cart item references and durable merge receipts are not deleted or rewritten. Existing cart reads skip missing products and merges report unavailable products; quantities and receipt protection are preserved. Archive/soft-delete and future order-history rules are deferred to the marketplace data-model phase. Existing account carts can retain unresolved stored references, as before.

## Category rules and transactional coordination

Public category reads return only ID/name. Category create/update/delete require Super Admin. Names are trimmed and bounded to 1–100 characters; IDs are validated. Existing case-sensitive unique-name behavior is preserved; no hierarchy or normalization migration is introduced.

A referenced category cannot be deleted (409 CATEGORY_IN_USE); products must first be reassigned through authorized updates. Product creation/category reassignment and category deletion all participate in the same transaction coordination so a concurrent mutation cannot create a dangling reference through these services. All deployments and other writers must use these paths for that guarantee.

Marketplace mutations use MongoDB transactions with snapshot reads, primary read preference and majority/journal commits. Each transaction first increments the fixed `_id: "marketplace"` record in `authorization_controls`. This shared write serializes product/category mutations and application policy changes and is retried by the driver on transaction write conflicts. Permissions are re-read inside the transaction. A write to the actor's User version also conflicts with concurrent Clerk suspension/deletion, avoiding authorization from a stale actor snapshot. Nothing calls external services inside these transaction callbacks.

The coordination document is idempotently initialized without granting any role. All marketplace writes require a replica set or sharded deployment supporting transactions. There is **no nontransactional fallback**: unsupported topology, database or audit failures return a sanitized unavailable error. Cart and identity synchronization keep their prior persistence algorithms; they do not acquire this global coordination record or require marketplace transactions.

This single coordination record is intentionally simple for the current foundation and is a write-throughput bottleneck. Before significant merchant traffic, measure it and replace it with finer-grained coordination while preserving category-reference, authorization and last-admin guarantees. Database mocks serialize transaction execution and roll back snapshots; they do not prove actual server isolation/retry semantics.

## Privilege changes, auditing and last-admin protection

`access-management.ts` is server-only and every entry point authenticates/authorizes independently. `setApplicationStatus` and `setSuperAdminAccess` have no browser Server Action or HTTP wrapper in this phase; future trusted administrative handlers must call these guarded services, not update User directly. The merchant application/review wrappers are the only new public action exports.

Actual merchant decisions, application suspensions/restorations, admin grants/revocations and initial bootstrap write append-only `authorization_audits` records with actor, target, operation, before/after state, reason and timestamp. The policy change and audit insert commit in one transaction; audit failure rolls back the grant/revocation. No audit-reading, editing or deletion endpoint is exposed. Restrict database access and set retention/backup policy before production; this database log is not tamper-proof against a database administrator. Repeated no-op requests do not add misleading change records. Clerk lifecycle events do not alter application grants; their source version/tombstone behavior remains documented in Phase 3A.

Application demotion or suspension of an admin requires another active, nonsuspended Super Admin. Concurrent application changes serialize on the control record, preventing two admins from demoting each other to leave zero. Unknown/corrupt status values are not counted as active. Clerk-side bans/deletions and manual database interventions remain authoritative external events and can remove the last usable admin; the application must not resurrect a deleted person or ignore a Clerk ban to preserve a role. Keep multiple independently recoverable admin accounts operationally. There is no unauthenticated break-glass endpoint or automatic rebootstrap.

## Initial Super Admin bootstrap — operator procedure

The bootstrap command has **not been executed**. Tests invoke its exported function only with isolated database mocks. Importing the script does not connect or mutate anything.

1. Complete the deployment/index checks below in an isolated environment first. Select an existing synchronized, active Clerk-linked User. Do not create or infer an identity by email.
2. Confirm the MongoDB database matches the application's actual URI database. Supply `MONGODB_URI` through the approved secret-management environment; do not paste it into logs, commits or command-line arguments. The command does not load `.env` automatically.
3. In a controlled PowerShell terminal, set explicit nonsecret target/audit values (replace placeholders):

```powershell
$env:MONGODB_DATABASE = "<application-database>"
$env:BOOTSTRAP_CLERK_ID = "<existing-clerk-user-id>"
$env:BOOTSTRAP_OPERATOR = "<operator-or-change-ticket>"
$env:BOOTSTRAP_REASON = "<approved-provisioning-reason>"
node scripts/bootstrap-super-admin.cjs --confirm-bootstrap
```

4. Verify the audited target using a read-only database check, then test the actual Clerk session against an authorized operation in staging. Remove the bootstrap environment values from the operator shell after use.

The command verifies a full unique Clerk-ID index, requires an active existing target, and refuses if any admin exists or the durable bootstrap-completed marker is set. It atomically sets the admin flag, writes the operator audit and marks bootstrap completed under the same coordination record. Competing invocations cannot provision two initial admins. A lost acknowledgement can mean it committed: inspect the audit/marker before retrying. A repeat never acts as a generic promotion tool. It prints no connection details or target identifiers on failure.

Subsequent grants/revocations must run through the authenticated server-only admin service in a trusted Clerk request context; there is deliberately no role-management UI or unauthenticated command to invoke them. A future operational administration surface and an audited external-account-loss recovery procedure require explicit approval; do not reset the bootstrap marker to bypass this boundary.

## Database deployment and migration safety

No production migrations, bootstrap, Clerk configuration changes or live-service mutations were performed. There are no dependency additions.

- Preserve Phase 3A's full unique `User.clerkId` index and its email/username index remediation. Schema declarations do not prove indexes exist. Audit existing records for preexisting/corrupt privilege fields before rollout; absent fields default to active customer with no merchant/admin privileges.
- New collections are `authorization_controls` (fixed string `_id`, revision, bootstrap marker) and `authorization_audits` (MongoDB `_id`, actor/target/action/change/reason/time). Their schemas disable automatic index creation. The built-in `_id` indexes are sufficient for correctness; target/time audit indexes may be added explicitly for operational querying. No audit TTL is installed.
- Pre-create and verify new collections and transaction support in staging, especially on sharded deployments where implicit cross-shard collection creation has restrictions. MongoDB standalone is unsupported for marketplace mutations. Majority/journaling configuration and the existing category unique-name index must also be verified.
- Existing products keep their owner references. Missing owners require deliberate future repair, never automatic assignment or merchant grants. No bulk backfill or customer-data deletion is performed.
- Drain old deployments/writers before enabling mutations: old product actions lack the new owner predicates and category coordination, and old authorization code ignores application suspension. All policy writers must use the controlled services and increment User versions.
- Backup user policy, coordination marker, audit records, identity tombstones and cart receipts together. Rollback must retain authorization enforcement and application status checks; rolling back to the old unrestricted actions is unsafe. Prefer disabling marketplace writes while fixing a deployment. Do not clear roles/audits/markers to make a rollback appear successful.

## Verification and remaining staging work

Focused tests execute real policy, canonical resolver, services, Server Actions, validation and bootstrap code; only auth/database/transaction boundaries are mocked. Authorization tests cover public access, denied customer and unapproved merchant actions, owned/admin mutations, strict payloads, mixed-owner bulk rejection, category references, audit rollback, concurrent demotions/bootstrap, unavailable transactions and legacy records. Identity regressions cover metadata injection and preservation of all application policy through duplicate/old events and recovery. Cart regressions cover application suspension and continued merchant/admin customer access. All previous tests remain intact.

Run `npm run test:authorization`, `npm run test:identity`, `npm run test:cart`, `node node_modules/typescript/bin/tsc --noEmit --incremental false`, modified-file ESLint with `--no-cache`, and `git diff --check`.

Final local results: 44 authorization tests, 35 identity tests and 57 cart tests passed (136 total). All prior 33 identity and 55 cart tests remain passing. TypeScript, modified-file ESLint and whitespace checks passed. The tracked diff and new files were reviewed for scope, authorization boundaries and secret exposure.

Staging checks before release:

- Real replica-set transactions, write conflicts, primary failover, lost commit acknowledgements, and audit-insert failures.
- Concurrent product-category writes/deletion and mixed-owner bulk rollback against actual MongoDB.
- Concurrent admin demotion/suspension and Clerk deletion/ban, including prevention of stale actor writes and expected external last-admin-loss behavior.
- Actual deployed unique indexes, legacy statuses/owners, collection initialization, backup/restore and bootstrap refusal paths.
- Real Clerk sessions invoking Server Actions directly with forged fields; verify controlled errors and no policy/owner leaks in serialized responses.
- Public storefront reads and existing guest/authenticated cart behavior in a browser; verify no UI redesign or privilege-dependent browsing regression.
- Review merchant eligibility, role-management operational workflow, audit retention, future store ownership, and archive/order-history decisions before building related interfaces.

No real browser, live Clerk, replica-set integration, production build/deployment or migration was performed for this phase. There is no new shared rate limiter, external immutable audit sink, store transfer, payment capability, order permission implementation, archive model or dashboard. The next redesign step should agree storefront information architecture and reusable design components against these secured read/mutation contracts; store ownership and archived-product behavior need a data-model decision before merchant interfaces.

Transaction design was checked against [Mongoose transaction guidance](https://mongoosejs.com/docs/transactions.html) and [MongoDB transaction production considerations](https://www.mongodb.com/docs/manual/core/transactions-production-consideration/).
