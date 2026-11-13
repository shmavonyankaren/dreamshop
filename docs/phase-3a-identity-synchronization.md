# Phase 3A: Clerk identity synchronization

## Inspection and previous lifecycle

Registration previously delivered a signed Clerk webhook to `app/api/webhooks/clerk/route.ts`. The route called unrestricted exports in the `"use server"` user action module, inserted a MongoDB user, then wrote its ID into Clerk public metadata. Duplicate events could fail unique indexes; metadata failure after insert caused the same problem on retry. All profile fields were required, email came from the first array element, usernames fell back to email prefixes, updates omitted email changes, and deletion physically removed the mapping. An update before creation did not recover the missing record. Raw documents and error messages were returned by the webhook.

Phase 1 already removed cart reliance on public metadata. Inspection found no remaining consumer of that metadata or the old user lookup/mutation action exports except the webhook itself. Those exports and their unused input types are now removed; the contact action remains. Existing Clerk metadata is neither deleted nor modified.

The root ClerkProvider and Clerk SignIn/SignUp routes remain unchanged. The proxy establishes Clerk context for pages and cart APIs and now also for `/api/identity/sync`. The webhook stays outside session middleware and authenticates using Svix. MongoDB user references are `Cart.user`, `Product.owner`, and `Order.buyer`; none are rewritten. Existing product action authorization issues are outside this phase.

## Revised lifecycle and recovery

1. Clerk emits `user.created` or `user.updated`. The route reads at most 256 KiB of raw body and verifies the actual Svix signature, including its delivery timestamp, before processing data.
2. The server-only identity service validates a complete Clerk snapshot, selects profile fields explicitly, and finds by Clerk ID. Client metadata is never spread into a record.
3. A new identity is inserted, or an existing identity is updated with a version predicate. Profile state, Clerk source version, and fingerprint commit together with majority/journal write concern.
4. The webhook returns only `{ received: true }` after processing succeeds. It performs no Clerk metadata write or other downstream side effect. Unknown signed event types are acknowledged without a mutation.
5. On sign-in, CartProvider calls authenticated `POST /api/identity/sync` before initiating guest merge. The endpoint takes no profile, MongoDB ID, Clerk ID, or query parameters: it gets the caller from Clerk `auth()` and fetches that same user's current profile through the Clerk Backend API. This recovers a delayed/missed webhook or the old insert-then-metadata failure. The same service performs persistence.
6. The existing synchronization retry button also retries identity recovery. Recovery is coalesced while in flight within a tab and times out client-side after 15 seconds. There is no automatic retry loop. A timeout can occur after a server commit; the next attempt is safe. Views refresh after recovery, including an empty guest cart.
7. Cart services resolve the authenticated Clerk ID to the same MongoDB ID. Missing mapping remains `409 USER_SYNC_PENDING`; no session is `401`; deleted/suspended accounts are `403 ACCOUNT_INACTIVE`. Recovery failures retain guest state and receipt IDs.

The recovery endpoint requires a same-origin POST and rejects bodies and query strings. Reverse-proxy deployments must verify that the browser Origin and Next Request URL origin agree; do not weaken the check to arbitrary forwarded headers. Server-only callers needing repair can use the service with an explicitly trusted Clerk ID, never with an unauthenticated request parameter.

## Canonical model and DTOs

Clerk ID is the authoritative unique external identity key. MongoDB `_id` remains the stable internal ownership key. `InternalUserDTO` contains internal ID, Clerk ID, display name, nullable verified-primary email, nullable username/avatar, account status, and nullable local creation/update timestamps. `PublicUserDTO` exposes only display name and avatar. Neither HTTP route returns an internal user document or DTO.

First/last name, username, email, and photo are nullable. Display name uses supplied name parts, then a supplied username, then null. No personal data or username is fabricated. Username is a descriptive optional profile value, not a routing/authorization identifier; this application does not require a globally unique public handle. Email is also descriptive, never used to link accounts. Only a syntactically usable, verified email matching `primary_email_address_id` is stored. Missing, removed, invalid, or unverified primary email yields null even if another verified email exists. A subsequent snapshot can safely replace or remove it.

`status` is active, suspended, or deleted. Suspended reflects Clerk's trusted `banned` or `locked` fields. A strictly newer trusted profile can clear that status. This phase does not implement an independent local suspension workflow, roles, capabilities, merchant flags, or administrator grants. Future local policy should have separate server-controlled fields; it must not be sourced from profile metadata. Legacy records with no status are treated as active. New local `createdAt`/`updatedAt` timestamps describe MongoDB persistence, while `clerkCreatedAt`/`clerkUpdatedAt` preserve source times. Legacy local timestamps may be null until populated; no historical timestamps are invented.

## Ordering, duplicate handling, and concurrency

The source ordering key is Clerk user `updated_at`, not webhook arrival time, Svix delivery time, or event ID. Every supported profile event must contain source creation/update timestamps, email-list/primary-ID fields and boolean banned/locked flags. Optional profile values may be absent. Invalid required fields return 400 rather than silently activating or erasing security state.

The service hashes the selected normalized profile fields. Matching source version and fingerprint is a no-op; an older source version is ignored. Update-before-create inserts normally. Changed email array order or irrelevant metadata does not affect the fingerprint. No unbounded event receipt collection is required because these are complete state snapshots rather than additive operations.

Different profiles with the same source timestamp are ambiguous: webhook processing fails closed with `409 IDENTITY_VERSION_CONFLICT`, preserving stored data. Authenticated recovery can resolve a tie using a current server-fetched Clerk snapshot. Historical conflicting same-version webhooks continue to return 409 rather than reversing that repair; operators should inspect persistent delivery failures. Correct causal ordering between differing Backend API snapshots sharing a timestamp cannot be inferred, so live same-millisecond behavior must be verified in staging.

Writes use `_id`, Clerk ID, expected `__v`, and a not-deleted predicate, then increment `__v`. Up to five retries handle contention. Concurrent creation requires the deployed unique Clerk-ID index; duplicate errors for that key alone are retried. Email/username index errors are not treated as identity matches. Reads use majority concern. One document contains profile and replay metadata, so no replica-set transaction is assumed. Majority/journaling support still needs verification in the actual deployment.

Failures before commit leave no new source version. Lost acknowledgements after commit are recovered by reading the already committed version/fingerprint. Database or Clerk API outages produce sanitized 503 responses. Unexpected failures log only their error name/code server-side; responses never include database details, raw webhook profiles, credentials, or internal IDs. Known signature/validation failures return 400; oversize bodies return 413. Signature verification is performed by the real Svix library.

## Deletion and data retention

A verified `user.deleted` with an ID, `deleted: true`, and event timestamp creates or updates a permanent tombstone in the same User document. Deletion wins regardless of prior profile timestamp. It is absorbing: repeated deletion is a no-op, and no later create/update/recovery can reactivate that Clerk ID. A new registration with a different Clerk ID is a separate identity even if it reuses an email or username.

Existing user profile/customer data, `_id`, cart, cart merge receipts, products and orders are retained. There is no physical deletion, cascade, or anonymization in this phase. A deletion arriving before creation produces a minimal tombstone. Tombstones have no TTL; backups and recovery must preserve them. Hard-deleting them would permit historical events to recreate identities. Retention/anonymization is a separate future policy decision.

Users physically deleted by the old implementation before rollout have no tombstone to consult. Reconcile Clerk deletion history against existing references during rollout where that history is available; this implementation cannot reconstruct missing historical deletion records automatically. Do not merge accounts or transfer cart ownership by email. Clerk account merging (`user.merged`) is not implemented here and needs a separate ownership-transfer design.

Clerk sessions and webhooks are eventually consistent. A newly banned/deleted account is denied once its local state is synchronized (or Clerk rejects its session). This phase does not add a live Clerk lookup to every cart operation, revoke requests already authorized before deletion, or guarantee instantaneous ban propagation. Signing in/retrying recovery fetches the current profile. A Backend API 404 fails recovery; it is not interpreted as permission to recreate the user or erase data.

## Index and migration deployment plan

No database, Clerk setting, or production index was changed during implementation. User schema auto-indexing is disabled to prevent automatic index mutation. Schema declarations are not evidence of deployed indexes. The intended unique constraint is **User.clerkId only**. Email and username must not have legacy unique indexes: those indexes can prevent missing-profile users, deletion-first tombstones, email changes, and separate users sharing descriptive values.

Use an isolated staging clone first, then the normal approved deployment process:

1. Back up User records, indexes, referenced customer data, and cart receipts. Record existing index names/options using the actual collection's index listing.
2. Audit missing/invalid/duplicate Clerk IDs. If duplicates exist, pause rollout and reconcile references deliberately. Do not automatically delete records, choose a winner, or assign ownership using email. Preserve every customer/cart reference and receipt.
3. Confirm or explicitly create the unique Clerk-ID index after conflicts are resolved. The application must not receive concurrent creation traffic without it.
4. Explicitly retire only the legacy unique email and username indexes after checking for any deployment-specific consumers. This is required even though the new schema no longer declares them. No `syncIndexes()` or destructive migration runs from application code.
5. Deploy all identity writers together; drain the old webhook/action deployment so it cannot physically delete users or write profiles without the new version rules. Existing profile data and IDs need no bulk destructive rewrite. Metadata/status is added lazily on synchronization; legacy records have no trustworthy source version until their first new synchronization. Consider an authenticated Backend API reconciliation before replaying old deliveries.
6. Replay failed deliveries or invoke trusted recovery; confirm IDs and cart ownership remain stable, including previously inserted users whose Clerk metadata update failed.

Rollback must preserve tombstones and version checks. Do not roll back to the old unrestricted actions or physical-deletion webhook. Prefer disabling identity writes temporarily or shipping a compatibility fix. Restoring unique email/username indexes may fail after valid null/duplicate values exist; inspect data rather than deleting it to satisfy an old schema. Restoring a backup that loses tombstones/version state weakens replay protection and requires reconciliation before reopening writes.

## Authorization boundaries and cart compatibility

`lib/actions/user.actions.ts` exports only the existing public contact action. Arbitrary create/update/delete/read identity Server Actions are removed. `identity-service.ts`, its HTTP helpers and authenticated resolver import `server-only`. Public APIs use projections; private identity state is never serialized by the webhook/recovery endpoints.

All six cart endpoints continue using server-side Clerk-to-MongoDB resolution. The merge algorithm, ownership IDs, request validation, browser operation IDs, and durable receipt model are unchanged. Added cart regressions confirm suspended/deleted mappings cannot read or mutate carts and that denying access leaves cart receipts untouched. There are no privileged roles to grant or revoke in this phase. Product/category authorization remains a known separate task.

## Verification and staging checklist

Automated tests execute the actual service, routes, resolver, validation, DTOs and client recovery logic; only database, Clerk Backend API, auth context and browser transport boundaries are mocked. Webhook tests sign and verify with real Svix using an ephemeral test key. A real Mongoose schema test checks nullable fields, disabled auto-indexing and the declared Clerk-ID index. Existing cart tests are preserved, with two additional inactive-account regressions.

Required local commands: `npm run test:identity`, `npm run test:cart`, `node node_modules/typescript/bin/tsc --noEmit --incremental false`, modified-file ESLint with `--no-cache`, and `git diff --check`.

Local results: 33 identity tests passed; 55 cart tests passed (all 53 existing tests plus two inactive-account regressions). TypeScript, modified-file ESLint and whitespace checks passed. The complete tracked diff and new files were reviewed; no secrets or unrelated dependencies were added. No local `mongod` executable was available, so actual index builds and MongoDB failover remain unverified.

Before production rollout:

- Verify real deployed indexes, legacy duplicate cases and existing documents in an isolated MongoDB environment.
- Exercise simultaneous first writes, version conflicts, majority timeouts and primary failover with real MongoDB; mocks do not prove driver/server behavior.
- Send actual Clerk test-instance user events, including missing optional fields, primary-email removal/change, ban/lock/unlock, update-before-create, deletion-first and replay after deletion.
- Check actual Clerk payload versions and same-timestamp behavior against installed SDK assumptions; future payload changes should fail visibly rather than silently mutate identities.
- Simulate a lost MongoDB/HTTP acknowledgement and retry; verify stable `_id` and one identity.
- Test recovery after a missed webhook, Clerk rate limits/outages, same-origin proxy behavior, two tabs, refresh, and sign-out/account switching in a real browser.
- Confirm retry feedback remains visible when cart loading reports a missing mapping, and successful recovery refreshes an empty guest cart.
- Verify Clerk middleware/session rejection and the absence of old user Server Actions from deployed builds; mocked tests do not replace a deployed authorization check.
- Preserve customer records/receipts on deletion; assess historical deletions and retention separately.

Recovery makes a Clerk Backend API request on sign-in and explicit retry. There is no shared rate limiter, durable repair queue, periodic reconciliation job, or automatic deletion-history import. Rate-limit failures remain retryable; deploy appropriate service-level limits and monitoring. No browser, production Clerk, live MongoDB or index-build integration test was performed here.

Reference behavior was checked against [Clerk webhook ordering guidance](https://clerk.com/docs/guides/development/webhooks/overview), [Clerk synchronization guidance](https://clerk.com/docs/guides/development/webhooks/syncing), the installed Backend SDK type declarations, and [MongoDB single-document atomicity](https://www.mongodb.com/docs/manual/core/write-operations-atomicity/).
