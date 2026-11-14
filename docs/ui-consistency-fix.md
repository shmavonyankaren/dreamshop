# FAQ, header account control, and theme selector correction

## Findings

The header rendered a standalone `/account` link with a UserRound icon immediately beside AuthHeader, which rendered Clerk's UserButton for signed-in users or a separate sign-in control for guests. PublicShell mounts the header once; WorkspaceShell was not responsible for this duplication. The standalone header account icon is removed. Clerk's single avatar menu now includes My account (`/account`), its native Manage account action, and its native Sign out action. Signed-out visitors retain one Clerk modal sign-in entry. The same AuthHeader instance serves desktop and mobile.

The theme popup used a pale `bg-popover`, but Dark/System option labels used `text-body-tertiary`, whose dark-mode value is intended for navy surfaces. The trigger also mixed `size="sm"`, 40px dimensions, and the button primitive's 44px minimum height, with a separate accent background/border. There was no selected-option indicator.

The FAQ retained an independent purple/indigo theme, oversized permanently expanded answer cards, and claims about implemented payments, orders, shipping, returns, discounts, and reviews that were not supported by the current application.

## Changes

- FAQ uses the existing page gradient, pale panels, coral accents, a compact hero, topic navigation, and 12 native `details`/`summary` accordions grouped under Browsing & shopping, Cart & wishlist, and Account & help. Each topic's accordions share a native `name` for exclusive opening in supporting browsers; older browsers can still expand questions independently. There is a real Contact CTA and no duplicate footer.
- Answers describe actual browsing/search/sort, guest-cart synchronization, authenticated wishlists, unavailable currency totals, Clerk profile management, and theme selection. Checkout, payments, completed orders, tracking, returns, exchanges, saved payment methods, discounts, reviews, and unsupported account sections are explicitly unavailable/planned. No delivery, return, payment, or support guarantees are invented.
- AuthHeader is the only header account entry. The supported Clerk MenuItems/Link/Action API preserves profile/security management and sign-out alongside the Dreamshop account overview.
- ModeToggle uses a 44px ghost icon button with a stable accessible label. Existing Radix dropdown primitives are extended with RadioGroup/RadioItem wrappers and a check indicator. All options use `text-popover-foreground`; highlighted states use the accent token pair. The portal uses z-80, end alignment, collision padding, a viewport-constrained width, rounded corners, and the shared panel shadow.
- Selection delegates to the existing next-themes provider. Light, Dark, and System are allowlisted; existing `theme` storage and system-preference behavior are preserved. The trigger's sun/moon appearance is CSS-driven, so its server/client label and markup do not depend on an unhydrated theme value. The root theme provider and pre-hydration script are unchanged.
- Header mobile gaps were tightened without shrinking touch targets. Search remains on its own row below xl. The theme button is in the header at sm and above; below sm it is in the drawer. It is not displayed in both locations at the same breakpoint. Wishlist, cart, and its existing count badge are preserved. Search's maximum input length now matches the 100-character catalog contract.

No backend services, database schemas, roles, identity synchronization, cart/wishlist persistence, or theme-provider configuration were changed.

## Reference and browser limits

The original approved Dreamshop references remain available in the conversation and supply the common design language. The three issue-specific screenshots mentioned by the brief were not included in this message, so they were not claimed as inspected; the defects were confirmed by tracing source and theme tokens.

There is no available browser tool. The earlier blocked browser launch was not retried and no dev process/lock was touched. No rendered viewport, real Clerk popup, native accordion interaction, keyboard traversal, or visual theme-flash test is claimed.

Manual checks at 375, 640, 768, 1024, and 1440px:

1. Signed out: confirm one sign-in control and working Clerk modal. Signed in: confirm one avatar; open it and test My account, Manage account, and Sign out.
2. Open the mobile drawer; follow navigation and verify it closes. Check wishlist/cart links and count updates. Check no horizontal overflow at 375px.
3. Open theme menu with keyboard; verify arrows, Enter/Space selection, Escape, focus return, selected checkmark, and contrast in both themes. Check popup placement inside the mobile drawer and near viewport edges.
4. Select each theme and reload. For System, change the OS preference. Watch the first paint for theme flash; exercise blocked browser storage and cross-tab theme changes.
5. Tab to FAQ summaries and expand/collapse with keyboard. Verify indicator rotation, content reading order, topic anchors, contact link, and reduced-motion behavior.

## Automated verification

All suites were run together:

```powershell
node --test tests/authorization.test.cjs tests/identity.test.cjs tests/cart.test.cjs tests/storefront.test.cjs tests/customer.test.cjs tests/connection.test.cjs tests/ui-consistency.test.cjs
npx tsc --noEmit --incremental false
git diff --check
npm run build
```

The new suite is also available as `npm run test:ui`.

Test results: **207 passed** — 47 authorization, 35 identity, 58 cart, 20 storefront, 26 customer, 8 connection, and 13 UI consistency tests. Existing assertions were retained.

UI tests render the real header/account/FAQ components with Clerk and portal adapters, invoke navigation/theme callbacks, and execute the installed next-themes provider's real persistence and system-resolution logic against hook/storage adapters. They verify counts, links, theme persistence/selection, accessible contracts, native disclosure markup, and accurate FAQ content. They do not replace real browser or Clerk integration testing. Radix keyboard handling is delegated to the installed primitive and checked at the wiring boundary, not simulated as a browser test.

Modified-file ESLint collects changed/untracked `.ts`, `.tsx`, and `.cjs` files with Git and runs `ESLint.lintText(contents, { filePath })` against literal paths, avoiding Clerk route bracket glob issues. Production builds use process-local dummy Clerk/Resend credentials and an unreachable loopback MongoDB URI. No live database writes or email sends are part of verification.

Final results: TypeScript passed; ESLint passed for all 7 changed/new source files with no warnings or errors; production build passed; `git diff --check` passed. Existing route URLs are preserved.

## File inventory

Modified: `app/(root)/faq/page.tsx`, `components/shared/Header.tsx`, `components/shared/AuthHeader.tsx`, `components/shared/ModeToggle.tsx`, `components/ui/dropdown-menu.tsx`, `package.json`.

Created: `lib/faq-content.ts`, `tests/ui-consistency.test.cjs`, `docs/ui-consistency-fix.md`.

Deleted: none. Merchant Workspace development has not started.
