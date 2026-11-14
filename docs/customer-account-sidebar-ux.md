# Customer account navigation correction

## Root causes

- My Favorites duplicated the header heart and account Wishlist destinations inside the avatar menu.
- The profile and security sections had IDs, but navigation compared `usePathname()` with URLs containing hashes. The selected item could not follow section navigation. There was no explicit focus handling for anchors, deep links or browser history.
- The security button already opened Clerk's real account manager. The surrounding navigation and explanation did not make that relationship clear.
- WorkspaceShell applied its generic collapsed mode to customers. That mode removes the entire navigation and substitutes a generic dashboard icon, leaving an unhelpful narrow customer panel.
- The mobile drawer's normal focus restoration returns focus to its trigger, which needs a targeted exception when navigating to a page section.

## Resulting behavior

The header avatar menu contains My Account, authorized Super Admin Dashboard and/or Merchant Dashboard links, and native Clerk Manage Account/Sign Out actions. Favorites was removed only from this menu. The global heart and sidebar Wishlist still lead to `/favourites`. Capability resolution, authentication and protected routes/actions are unchanged.

Account navigation now groups Overview, Personal Information and Security under **On this page**. They are native anchors, enhanced on the current account page to update browser history, scroll to the target and focus it. Selection uses `aria-current="location"` and tracks hash/history changes. Modified clicks retain normal browser behavior. Target sections are labeled, programmatically focusable and use nine rem of sticky-header clearance. Security also offers a return-to-overview anchor.

Clerk remains responsible for available sign-in/security methods. Both existing profile/security buttons call `openUserProfile()`. The text directs users to Security inside Clerk's account manager, where the configured options are shown. No custom password form, fabricated authentication option or secret exposure was added.

The customer sidebar is always expanded on desktop. WorkspaceShell has a scoped `collapsibleSidebar` option, defaulting off for customers and on for Merchant/Super Admin; the account guard also prevents a customer sidebar from entering the collapsed state. Other workspaces retain their existing collapse behavior. Mobile retains the drawer. Selecting an account section closes it, then transfers focus to that section through Radix's close-auto-focus callback. Ordinary close/Escape retains the default trigger-focus behavior.

Addresses, Payment Methods, Orders, Notifications and Preferences remain noninteractive, accessible **Planned** placeholders under Coming later. No backing features were introduced.

## Files changed

```text
app/globals.css
components/shared/AuthHeader.tsx
components/customer/AccountNavigation.tsx
components/customer/AccountOverview.tsx
components/layout/WorkspaceShell.tsx
components/ui/interactive.tsx
lib/utils/accountSections.ts (new)
tests/account-navigation.test.cjs (new)
tests/ui-consistency.test.cjs
package.json
docs/customer-account-sidebar-ux.md (new)
```

The shared Dialog/Drawer change only forwards the optional Radix close-auto-focus handler. Existing callers keep their default behavior. The UI test script now includes the account navigation suite.

## Verification

- Full regression suite: **376 passed, zero failures or skips**.
- TypeScript: passed.
- ESLint on changed TS/TSX/CJS files: passed.
- Production build: passed using dummy credentials and an unreachable local MongoDB target; no live data changes.
- `git diff --check`: passed.

Tests exercise section selection/focus/scroll, deep links and browser history, Clerk callback wiring, wishlist preservation, planned placeholders, customer expansion, Merchant/Admin collapse toggles, mobile close/focus transfer, modified anchor clicks and existing role-aware navigation/authorization protections. Browser/Clerk behavior is represented through test adapters; these results do not claim real browser validation.

## Manual browser checklist and limitations

The supplied attachment directory contained the text brief only, not the four referenced screenshots. No browser tool was available. Existing Dreamshop styling and the inspected components guided these targeted changes; no screenshot comparison is claimed.

1. On desktop, open `/account`: confirm the full sidebar, no customer collapse button, balanced spacing, and one account control in the global header. Open its menu: one My Account entry, no Favorites entry, correct role links and working Clerk actions.
2. Use Personal Information and Security with mouse and keyboard. Confirm each target is visible below the sticky header, receives focus, and its sidebar entry turns coral. Test direct `/account#security`, Back/Forward and the return-to-overview link. The two panels remain side-by-side on wide screens, so focus/selection may be more noticeable than scrolling there.
3. On a narrow mobile viewport, open workspace navigation and select each section. Confirm the drawer closes and focus remains on the intended content. Close via Escape/close button instead and confirm focus returns to the drawer trigger. Check the nine-rem clearance at supported viewport widths and zoom levels.
4. Open Clerk account/security management with a Google account. Confirm configured account methods appear and closing Clerk returns predictably to the account page; no unsupported password controls should be supplied by Dreamshop.
5. Follow both the header heart and sidebar Wishlist links. Confirm the five Planned placeholders are not links or tab stops.
6. Verify Merchant and Super Admin desktop collapse/expand controls and mobile drawers remain unchanged. Recheck unauthorized direct workspace access is still rejected.

This correction is local and has not been deployed. It changes no database schema, identity synchronization, permissions, cart synchronization or wishlist service.
