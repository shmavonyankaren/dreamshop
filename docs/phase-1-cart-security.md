# Phase 1: cart security

## Boundaries and limits

Account-cart services resolve Clerk identity to User.clerkId on every entry point. Browser-supplied MongoDB IDs are never used. POST payloads reject unknown fields; legacy GET userId parameters are ignored. Cart persistence helpers are private, and cart.actions.ts is now server-only rather than a remotely exposed Server Action module. The HTTP routes retain their existing URLs.

Errors use { code, message }: 401 UNAUTHORIZED, 409 USER_SYNC_PENDING, 400 INVALID_INPUT/INVALID_JSON, 413 PAYLOAD_TOO_LARGE, 404 missing product/cart/item, 409 CART_CONFLICT, and sanitized 500 INTERNAL_ERROR. Responses are private/no-store.

Limits: 99 units per product, 100 distinct products, 16 KiB streamed JSON bodies. IDs must be 24 hexadecimal characters; quantities must be finite positive integers. Duplicate merge entries (including differently cased IDs) are rejected. Add/update/merge check product existence. Removal deliberately permits deleting stale references. Aggregate validation and version-checked writes prevent concurrent updates from bypassing limits; initial cart races rely on the existing unique user index. No schema or index migrations were performed.

Product responses use an explicit DTO with ID, title, description, image URL, price, string tags, and category ID/name. Owner documents, email, Clerk identifiers, cart owner and version fields are excluded. Public catalog reads and guest product lookup use the same DTO.

## Client behavior

Guests retain local storage and quantity controls. Invalid/corrupt storage is read defensively. Authenticated operations no longer depend on publicMetadata.userId and never fall back to writing a guest cart when account synchronization fails. The cart page loads through the controlled API and displays recoverable errors. Cart counts sum quantities.

Existing provider/page merge callers share one in-flight promise per Clerk identity in a tab. Guest storage is cleared only after successful merge and only if unchanged during the request. This is not durable idempotency. Browser/network retries after a lost response, multiple tabs, and edits during merging can still replay quantities. Limits reject an entire overflowing merge; guest storage remains intact. A deleted product in a guest merge also requires future reconciliation UX.

## Verification

- npm run test:cart ? isolated Node test runner; TypeScript transpiled in memory using the existing compiler. Clerk and database models mocked; real routes, resolver, services, schemas, DTOs, local storage utilities and transport exercised. No production data or external services used.
- node node_modules/typescript/bin/tsc --noEmit --incremental false
- Modified-file ESLint with --no-cache
- git diff --check

Live Clerk session middleware behavior, actual MongoDB index/concurrency semantics, Next production compilation, and browser interactions still need staging smoke tests. No production build or external writes were run.

Suggested staging smoke: guest add/update/remove/reload; sign in and confirm a single merge; signed-in mutation/reload; sign out and switch accounts; missing user mapping recovery; anonymous and forged-ID API requests; public catalog/detail browsing; Clerk webhook accessibility.

## Deferred work

Durable merge IDs/receipts, cross-tab coordination, stale-response ordering, rate limiting, Clerk webhook synchronization repair, and recovery for legacy carts outside the new limits remain separate work. User/category/product mutation authorization defects identified in the audit remain outside this cart phase. Product DTO changes do not secure those mutations or unrelated user lookup actions. Catalog pagination and schema modernization are unchanged.
