# Phase 2: durable cart synchronization

## Design and scope

Phase 1 authentication, strict Zod validation, DTO projections, request-size limits and version-checked ordinary cart writes remain in place. Only the merge endpoint protocol, cart receipt storage and guest synchronization lifecycle change. Product/category models, Clerk webhooks and payment behavior are unchanged.

No replica-set or transaction support is established by repository configuration: connection.ts only provides a URI. No live database was inspected. Instead of a separate receipt collection requiring a cross-document transaction, receipts are embedded in the existing Cart document. MongoDB single-document atomicity commits quantities, receipt and incremented version together. No processing lease or unfinished server receipt is necessary. See https://www.mongodb.com/docs/manual/core/write-operations-atomicity/.

## Merge lifecycle

1. The CartProvider observes sign-in. Catalog/cart components only read data; they no longer independently initiate merges.
2. A short same-origin Web Lock protects local read/modify/write. A format-2 envelope in dreamshop_cart stores current guest intent, an immutable pending snapshot, operation UUID and SHA-256 fingerprint of the intended Clerk identity. The operation is persisted before any request.
3. The network request runs outside the lock. A second tab can retry the identical saved operation without waiting for the first tab. There is no polling. Requests time out after 15 seconds; timeout does not imply the server failed to commit.
4. The server resolves the actual authenticated Clerk-to-MongoDB user, validates the actor fingerprint against the session, and validates the request. The hash is an account-change guard, never authorization. Omitted identity fields cannot select another user's cart.
5. The server reads the cart with majority read concern. A stored receipt returns its immutable reconciliation outcome; a reused UUID with different canonical contents returns 409 OPERATION_REUSED.
6. Otherwise reconciliation runs against the latest cart. The expected __v condition, replacement items and new receipt commit in one write with majority/journal acknowledgement. Creation races use the existing unique user index. Up to five retries resolve contention; exhaustion returns a recoverable 409.
7. Only an acknowledged matching operation is finalized locally, under the same short lock. A stale tab response cannot clear a newer operation. Unchanged fully acknowledged guest items are cleared. Unresolved items and original malformed data remain saved.
8. If guest intent changed during the network request, a new UUID references the prior receipt. The immutable old operation is never rewritten. Up to three successive snapshots are processed per attempt; further edits stay saved for explicit retry.

The response contains current safe cart/count plus an immutable reconciliation outcome. Replays can therefore show a newer account cart, but requested/applied/before/after quantities and conflict reasons for the original operation do not change. Receipt fingerprints and internal database versions are not exposed.

## In-flight edits and concurrent account changes

Application guest add/update/remove callers use mutateGuestCart and Web Locks. Synchronous helpers remain for existing isolated tests and are only called through that wrapper in application code. Network requests never hold the local lock.

Follow-ups describe the entire current guest contribution, not another additive copy. Example: an account has 10 units and the guest snapshot has 3. After a successful merge there are 13. Changing the guest quantity to 5 during flight creates a follow-up that results in 15, not 18. Removing that guest item restores 10, not zero. New products are new contributions.

Changing an already-applied contribution requires the account cart version and quantity to still match its parent receipt. Otherwise ACCOUNT_CHANGED preserves the account cart and records the unresolved intent. This is deliberately conservative: even an unrelated account edit can require review. Unchanged contributions are never reapplied. Zeroed contributions are not carried indefinitely through follow-ups; more than 200 active/relevant reconciliation entries fails closed.

Sign-out stops local acknowledgement and additional sends. An already-sent operation may commit to the original account. Its pending ID remains recoverable on the next sign-in to that account. A different account cannot silently consume it. The server also checks the actor fingerprint to protect cookie/account switches between request preparation and authentication.

## Reconciliation policy

- Same product in both carts: add the guest contribution once.
- Deleted product: skip with PRODUCT_UNAVAILABLE; process other valid entries.
- Availability currently means document existence: this product model has no availability/inventory status. No new product semantics are invented.
- Combined quantity over 99: add only the available quantity allowance; report QUANTITY_LIMIT and requested/applied amounts.
- More than 100 distinct account items: preserve existing items, skip new entries that do not fit with ITEM_LIMIT. Deterministic processing uses requested quantity then product ID, with removals first.
- Invalid IDs, duplicate payload entries, negative/fractional/nonfinite/out-of-range quantities, malformed JSON, more than 100 submitted items, and bodies over 16 KiB remain rejected. An empty snapshot is allowed only as a follow-up removing prior contributions; no zero-quantity cart entries are introduced.
- Legacy local arrays are normalized. Invalid/overflow entries are reported and their original raw data retained in recoveryRaw. An unreadable format-2 operation is never overwritten or automatically regenerated.
- Partial outcomes are not automatically retried as a new additive merge. The full saved intent and receipt remain visible for review. The customer can adjust their account cart and explicitly choose to discard unresolved guest items. Replaying a completed operation intentionally does not change its outcome.

Small status messages report synchronization, acknowledged success, conflicts and retryable failure. Reconciliation details show product ID, requested contribution, included contribution and reason. No success message is emitted merely because an ordinary guest edit occurred.

## Cross-tab coordination and recovery

Web Locks serialize local-storage writes among current application tabs. Storage events refresh views and counts; same-tab custom events perform equivalent refreshes. Notification handlers do not send merges. The server receipt remains the authoritative duplicate protection even when tabs issue identical requests concurrently.

Web Locks requires a supporting browser and secure context. Unsupported clients fail safely with preserved storage; no unsafe local-storage lease fallback is used. See https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API.

- Failure before persistence: no request is sent.
- Failure before database commit: no receipt exists; retry the same ID.
- Failure/HTTP loss after commit: the receipt returns the committed outcome without another increment.
- Browser closes before acknowledgement: another tab or refreshed tab resumes the saved ID.
- Local quota error after commit: pending storage remains; retry reads the server receipt.
- Newer local edits before acknowledgement: current intent survives and gets a child operation.
- Storage corruption: display recovery status and preserve the operation rather than guessing whether it committed.

All tabs must run the updated bundle. Old Phase 1 JavaScript writes unversioned arrays and does not participate in Web Locks. Reload old tabs during rollout. Clearing site storage manually removes browser recovery information; it does not delete server receipts.

## Persistence, indexes and deployment

Required existing index: Cart.user unique (the schema declares user: 1, unique: true). This is essential for concurrent first-cart creation. Embedded UUID uniqueness is enforced by the version compare-and-swap inside the same document; a multikey unique receipt index would not enforce intra-document uniqueness and is not added.

No new production index or migration was run. Before deployment, inspect actual collection indexes in staging/production through the normal approved deployment procedure; resolve duplicates before installing a missing unique user index. The isolated test verifies the real Mongoose schema declaration/casting, not an actual database index build. No local mongod executable was available for a real isolated MongoDB test.

Receipts never expire automatically. Clear/delete operations retain receipt-bearing cart documents as empty tombstones. Deleting or pruning these documents/receipts outside the application would invalidate replay protection. Keep receipts in backups and restoration procedures. Older documents without mergeReceipts are supported.

To bound BSON growth, each cart retains at most 256 receipts and each reconciliation at most 200 relevant entries. At capacity, new merges return a controlled error and preserve guest data; old receipts continue to replay. There is no silent eviction. A future receipt archival design must preserve durable deduplication and atomicity before lifting this bound.

Merge writes request majority acknowledgement and journaling; deployment must support those concerns. This does not require multi-document transactions. Account-cart writes still use the existing version checks. Staging must validate actual driver and server behavior, journal configuration, primary failover and write-concern timeouts.

Legacy Phase 1 requests without a UUID remain supported using a server-derived ID from the canonical snapshot. They keep strict all-or-nothing overflow behavior and cannot replay identical contents additively. New clients always use random persisted UUIDs, so independent identical baskets remain independent. This compatibility path preserves all original Phase 1 tests without reintroducing non-idempotent merges.

## Verification and limitations

Local verification completed: all 53 cart tests passed (the original 27 plus 26 Phase 2 tests), TypeScript passed, modified-file ESLint passed, and git diff --check passed. The complete change was reviewed for unintended scope changes.

Run npm run test:cart, TypeScript with --noEmit --incremental false, modified-file ESLint with --no-cache, and git diff --check. The test harness transpiles source in memory and mocks only browser primitives/auth/database boundaries. Original Phase 1 assertions remain; its fixture now models embedded receipts, majority reads, Web Locks, asynchronous crypto and acknowledgement fields. The original timing test waits for request creation before releasing its mocked response.

The suite exercises the real coordinator and persistence algorithm with shared two-tab storage, shared locking and a shared mock database, plus real Mongoose schema casting. It does not replace real-browser or real-database integration testing. No production database, external service or Clerk settings were changed.

Remaining limitations: receipt capacity requires a future archival strategy; conflict resolution is conservative; unrecoverable browser storage needs manual assistance; unsupported Web Locks clients cannot safely edit/synchronize guests; ordinary account-cart UI responses can still arrive out of order; the product model cannot express stock/availability; product/user/category authorization findings from the audit remain separate work.

## Staging checklist

- Confirm unique user index, server journaling/majority support and existing-document compatibility.
- Confirm simultaneous first-cart creation creates one cart and one receipt per operation.
- Drop the HTTP response after commit, reload and verify no second increment.
- Kill a tab mid-request; resume from another tab and verify the same ID.
- Edit/add/remove guest items in a second tab during a paused merge; verify contributions and conflict reporting.
- Test sign-out/account switching before send, after commit and before local acknowledgement.
- Test two tabs after acknowledgement, stale storage events and simultaneous new guest mutations.
- Test partial item/quantity/deletion conflicts, malformed legacy storage, quota failures and explicit dismissal.
- Test keyboard/screen-reader status messages and real Clerk middleware/session handling.
- Exercise contention, majority write timeouts and primary failover against isolated MongoDB.
- Confirm non-cart functionality, styling and public browsing remain unchanged.
