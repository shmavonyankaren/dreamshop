# Phase 4C — Customer account, wishlist, and cart

## Existing foundations and scope

Before this phase, `/account` had a guarded layout but no page; `/favourites` rendered a placeholder. The cart already supported authenticated and guest persistence, optimistic updates, durable merges, reconciliation, and cross-tab events. Those cart services and Clerk identity synchronization remain unchanged.

This phase adds a real account overview, authenticated wishlist persistence, favorite controls, and cart presentation. It does not implement payments, checkout, orders, addresses, merchant/admin dashboards, or new application roles. Prior uncommitted work is preserved.

## Account architecture

`app/account/page.tsx` uses the existing ProtectedWorkspace layout and separately obtains an allowlisted self-profile through `getCustomerProfile`. The service resolves the Clerk identity on the server, enforces active identity/application status, and returns only display name, email, avatar, username, and joined date. It accepts no user ID. Internal identity keys, moderation fields, roles, and synchronization metadata are not serialized into the overview.

The overview uses the signed-in Clerk user for current profile display and Clerk's `openUserProfile()` for supported profile and security management. The sidebar uses Clerk's actual avatar/profile control. There is no second password or authentication-method store. Available security options depend on Clerk configuration.

Account navigation enables Overview, Personal Information and Security anchors, and Wishlist. Addresses, Payment Methods, Orders, Notifications, and Preferences are visibly Planned. The existing workspace mobile drawer and desktop sidebar are reused; account navigation closes the drawer on selection. Merchant/admin shell behavior is retained.

The only numerical summaries are saved wishlist references and the existing CartProvider item count. There are no fabricated orders, payment cards, addresses, financial totals, or completion percentages.

## Wishlist storage and ownership

`Wishlist` is a new MongoDB collection/model with:

- `_id`: the internal Dreamshop user ObjectId, derived exclusively from server authentication.
- `products`: an ordered array of Product ObjectIds, limited to 500 entries by atomic write predicates.

MongoDB's built-in unique `_id` index guarantees one wishlist per user without an additional index migration. The schema sets `autoIndex: false` and `autoCreate: false`. No production migrations, explicit collection creation, or user-data writes were run during implementation. The first authorized runtime upsert creates a wishlist document/collection if the database user's privileges permit it. Future named collections would require a separately designed extension.

Every read and mutation calls `requireAuthenticatedUser`, including missing-mapping (409), unsigned (401), and inactive-account (403) checks. The client supplies only a validated product ID and explicit `add`/`remove` action. The strict schema rejects user IDs, owner fields, extra properties, and Mongo operator objects. GET rejects query parameters. POST applies an origin check and the existing bounded JSON reader. Responses are `private, no-store`, with controlled public errors.

Adding checks product existence, creates the owned document if necessary, then uses `$addToSet` with a capacity predicate on the same document write. An existing favorite can be added again even at capacity. A concurrent first-upsert duplicate-key conflict is safely followed by the owned atomic update. Removing uses `$pull` and is idempotent, including for deleted products or a nonexistent wishlist. Concurrent add/remove requests have document-write ordering; no ordering across tabs is promised beyond atomic operations and eventual refresh.

Reads select only stored product IDs, retrieve at most 500 public product DTOs, and populate only category `_id/name`. Private merchant/customer documents are never populated. Deleted products are returned as unavailable IDs rather than stale product details. They remain removable and count toward saved references/capacity until removed. Displayed count therefore means saved entries, not available inventory. Successful additions appear first; duplicate adds do not reorder an entry.

## Favorite-state integration

WishlistProvider is mounted once inside CartProvider. It fetches the server-owned list only for authenticated sessions, and the provider instance is keyed by Clerk user ID so switching accounts clears the old state. Queued work for an unmounted session is skipped, and completed old requests do not populate the new session's UI.

Requests are serialized within the tab, use a 15-second timeout, and update from server responses rather than a separate local favorites database. The same state powers homepage/catalog/related-product cards, product details, wishlist removal, and account count. Guests see a Clerk sign-in prompt; no guest wishlist is silently created.

After a successful mutation, a browser storage event marker prompts other tabs to refetch. The marker contains no product or user data. Window focus and cart/identity refresh events also trigger revalidation. If storage is disabled, database persistence still succeeds and other tabs refresh when focused. This is event-based refresh, not real-time server push; simultaneous changes in other devices appear after focus/manual refresh. Failed requests show retry feedback without pretending a mutation succeeded.

`/favourites` is protected by the existing middleware and a server-side account capability check. Its category filter operates on the bounded saved-product list. There are no fake collections, price-drop alerts, availability badges, personalized recommendations, or bulk cart actions. Existing StorefrontPurchase handles wishlist-to-cart additions.

## Cart presentation and prices

CartClient retains its load/mutation functions, ownership APIs, optimistic state, guest storage calls, and reconciliation component. CartPresentation replaces the old ProductList rendering with pale item rows, product links/images, listed prices, 1–99 quantity controls, removal buttons, empty/error/loading states, and a right-side summary. Controls are disabled while a transition is pending. Existing mutations, durable merge receipts, cross-tab refresh, and retry flow are unchanged.

Prices are strings, and the schema has no currency field. `cartPriceSummary` recognizes plain nonnegative decimal formats but deliberately does not sum them: even parseable numbers do not establish a shared currency. Listed strings are rendered as escaped React text without adding an invented symbol or conversion. The summary shows real item count, explains why subtotal is unavailable, and displays a disabled “Checkout — coming later” control. It explicitly says that no order will be placed. There is no fake shipping/tax calculation or payment flow.

## Design references and responsiveness

The earlier attached My Account and Favorites/Wishlist screenshots remain accessible and were inspected directly. No `design-references/` directory is assumed. Account follows the reference's dark profile sidebar, pale greeting hero, real summary cards, and profile/security panels. Wishlist follows its dark summary/navigation sidebar, pale hero, category selector, saved-product cards, heart/removal controls, and cart actions. Cart follows the pale item/summary panel treatment visible in the approved product-detail reference; no separate approved cart-page screenshot was supplied.

Existing Phase 4A tokens, MarketingHero, cards, buttons, loading/empty/error primitives, product image/price/cart components, and shared header/footer are reused. The previously created electronics SVG remains an illustrative substitute for missing isolated photorealistic reference assets; this phase does not claim an exact image match.

At small widths the account navigation uses the existing drawer, wishlist sidebar sits above content, product cards adapt from one to multiple columns, and cart summary stacks below items. At lg, sidebars and cart summary sit beside the main content. At sm, wishlist gains two columns; at xl three and 2xl four. Quantity controls have 44px targets, favorite buttons have labels and pressed state, status/errors have live semantics, and images retain aspect ratios. Native selectors and Clerk controls retain keyboard behavior. Existing reduced-motion styles apply.

## Verification and its limits

Commands:

```powershell
npm run test:authorization
npm run test:identity
npm run test:cart
npm run test:storefront
npm run test:customer
node --test tests/connection.test.cjs
npx tsc --noEmit --incremental false
git diff --check
npm run build
```

Results: 47 authorization, 35 identity, 58 cart, 20 storefront, 26 customer, and 8 connection tests passed (**194 total**). All prior assertions were preserved. New coverage includes authentication, self-profile projection, ownership, input validation, deletion handling, count/state consistency, idempotency, concurrent additions/removals and capacity, API error safety, sign-in prompts, rendered favorite/cart controls, empty cart, and price presentation.

The customer suite uses real service/validation/DTO code with mocked auth/persistence boundaries and renders selected components with ReactDOMServer. Concurrency tests exercise the intended atomic write contract in a mock database; real MongoDB concurrency, full React browser interactions, and cross-tab event execution still require staging verification. Product-detail integration is checked at the source boundary. Existing cart suites exercise persistence and merge behavior behind their test adapters.

Modified-file ESLint uses the Node ESLint API: collect changed/untracked `.ts`, `.tsx`, `.cjs` paths using `git diff --name-only --diff-filter=ACMR` and `git ls-files --others --exclude-standard`, then `lintText(contents, { filePath })` on each literal path. This avoids treating Clerk catch-all route brackets as globs. The full check includes earlier-phase work; recently changed components/tests receive a subsequent targeted lint check.

TypeScript passed. Full modified-file ESLint passed on 90 source files; targeted checks after the final layout/provider changes also passed. Production build and `git diff --check` passed. Exact additional lint commands were `npx eslint components/customer/AccountNavigation.tsx components/customer/WishlistPage.tsx components/customer/WishlistProvider.tsx components/layout/WorkspaceShell.tsx tests/customer.test.cjs` and, after the last layout adjustment, `npx eslint components/customer/AccountNavigation.tsx components/customer/WishlistPage.tsx`.

Production builds use process-local dummy Clerk/Resend credentials and an unreachable loopback Mongo URI, not live user sessions or production data. `/account`, `/favourites`, and `/api/wishlist` are dynamic routes. No database migration is part of the build.

No browser tool is available. No screenshots or 375/640/768/1024/1440px visual inspections were performed, and the prior blocked browser launch was not retried. The existing dev server/lock was not touched.

## Staging checklist

1. Confirm the staging database user can read/write the new `wishlists` collection and that its built-in `_id` index exists. Do not run index synchronization against production automatically.
2. Use two distinct customer accounts. Confirm each sees only its own profile and wishlist, including after signing out/in and browser back/forward. Confirm suspended accounts and missing mappings fail safely.
3. Save the same product in two tabs concurrently; verify one entry. Add different products concurrently; verify both remain. Remove concurrently with an add, then refresh both tabs to verify convergence. Test the capacity boundary with staging fixtures.
4. Delete a saved product in staging and confirm an unavailable saved entry appears with a working Remove action. Verify counts include that reference until removed.
5. Test favorite controls on home, catalog, related cards, product details, and wishlist. Test guests, initial loading, failed requests, retry, account switching, disabled browser storage, focus refresh, and cross-tab changes.
6. Test cart quantity/removal as guest and authenticated user, then sign in with a guest cart. Verify durable merge/reconciliation and retry behavior. Confirm no checkout/payment operation exists.
7. At 375/640/768/1024/1440px in both themes, compare account/wishlist against the attached screenshots. Check narrow headers, drawer closure/focus, long names/emails/titles, card wrapping, product images, quantity buttons, and summary stacking. Check keyboard navigation and screen-reader announcements.
8. Open Clerk profile/security management and verify supported edits update the account display and normal identity synchronization. No authorization fields should be editable through this UI.

## Files changed in this phase

Created:

- `app/account/page.tsx`, `app/account/loading.tsx`, `app/api/wishlist/route.ts`
- `components/customer/AccountNavigation.tsx`, `AccountOverview.tsx`, `FavoriteButton.tsx`, `WishlistPage.tsx`, `WishlistProvider.tsx`
- `components/cart/CartPresentation.tsx`
- `lib/customer-pricing.ts`, `lib/wishlist-contract.ts`, `lib/db/models/wishlist.model.ts`
- `lib/server/customer-service.ts`, `lib/server/wishlist-service.ts`
- `tests/customer.test.cjs`, `docs/phase-4c-customer-experience.md`

Modified:

- `app/layout.tsx`, `app/page.tsx`, `app/(root)/cart/page.tsx`, `app/(root)/favourites/page.tsx`, `app/(root)/all-products/[productId]/page.tsx`
- `components/layout/WorkspaceShell.tsx`, `components/products/StorefrontProducts.tsx`, `components/shared/Header.tsx`, `components/cart/CartClient.tsx`
- `proxy.ts`, `package.json`

Deleted: none.

## Deferred work and next phase

Addresses, orders, payment methods, notifications/preferences, wishlist collections/sharing, price alerts, inventory, reviews, currency modeling, and checkout remain deferred. Wishlist reads are bounded at 500 entries rather than independently paginated; introduce pagination before raising that limit. Clerk profile/security capabilities depend on project configuration. Exact artwork fidelity and browser/live-database verification remain outstanding.

Next recommended marketplace task: an approved-merchant product-management workspace built on existing ownership checks, preceded by the staging customer checks above. A dedicated price/currency contract is needed before financial totals or Stripe work.
