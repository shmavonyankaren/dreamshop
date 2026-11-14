# Phase 4A: Dreamshop visual foundation

## Scope and references

This phase supplies tokens, shared primitives, navigation, and protected workspace shells. It does not implement the full marketplace pages or new business workflows. Existing cart synchronization, identity recovery, webhooks, capability policies, schemas, and API routes are preserved. No dependencies were added.

There is no `design-references/` directory in this checkout. All ten screenshots attached to the request were used: homepage, product details, customer account, wishlist, merchant dashboard, Super Admin dashboard, category management, Users & Access, About Us, and Contact Us. No local reference filenames are claimed.

The common visual language is a navy-to-slate canvas, pale panels, coral actions, restrained borders and shadows, rounded corners, and compact sans-serif typography. The public references inform the header/footer and cards; account and wishlist inform sidebar navigation; merchant/admin/category/users references inform shared workspace, metric, chart, and table containers; About/Contact inform readable panels and forms. Mockup people, balances, statistics, support details, and business claims were not imported.

## Tokens and typography

Tokens live in `app/globals.css`, exposed through Tailwind 4 `@theme inline`.

| Purpose | Value/convention |
| --- | --- |
| Dark canvas gradient | `#06071f`, `#142342`, `#315370` |
| Light canvas gradient | `#f5f5fb`, `#e8edf7`, `#dbe5f1` |
| Card surface | Light `#ffffff`; dark `#f0f2f9` |
| Card text | Light `#11152c`; dark `#10142c` |
| Page text | Light `#11152c`; dark `#f6f7fc` |
| Primary action / hover | `#d92338` / `#b7182e`, white labels |
| Decorative coral | `#ff4053` (not the small white-label button background) |
| Accent | `#ffe4e8` background, `#a80f28` text |
| Supporting panel text | `#525c76` |
| Borders / inputs | `#c9cede` / `#9ba5bd` |
| Success | `#dcf5e8` background, `#12603b` text |
| Warning | `#fff0d5` background, `#8b4a08` text |
| Error | `#ffe4e8` background, `#a31931` text |
| Focus | 3px primary outline with 4px offset |
| Radius sm/md/lg/xl/2xl | 8 / 12 / 16 / 20 / 24px |
| Panel shadow | Light `0 8px 30px rgb(6 12 35 / 12%)`; dark `0 12px 40px rgb(0 0 20 / 22%)` |
| Spacing | Tailwind default 4px scale; usual gaps 12/16/24px; panels 24px |

Dark mode is the default; saved next-themes preferences and light/system choices remain supported. New pale panels pair `bg-card` with `text-card-foreground`. Legacy `surface`/`body-*` aliases remain available and use dark surfaces with light text in dark mode, so existing pages do not require wholesale rewrites. Use `text-muted-foreground` on pale panels, and `text-body-secondary` on legacy dark surfaces. Chart and sidebar aliases are retained.

The font stack is Segoe UI, Helvetica Neue, Arial, sans-serif. There is no external font fetch and no reference to unloaded Geist variables. Body text is 16px with 1.6 line height. Display h1 scales 32–56px; page titles 28–40px; section h2 24–32px; card h3 18px. Supporting text, labels, tables, and buttons generally use 14px; captions/badges use 12px. Headings use tight tracking and 1.15 line height. Financial/count values may use tabular numerals.

## Components and conventions

- Existing CVA/Slot Button and Card components are adapted; the duplicate `button copy.tsx` re-exports the canonical button for compatibility. `lib/utils/index.ts` re-exports the canonical `cn`.
- `components/ui/foundation.tsx`: Input, Textarea, native Select, Checkbox, FormField, Badge, IconButton, Skeleton, LoadingIndicator, EmptyState, ErrorFeedback, Breadcrumbs, Table, Pagination.
- `components/ui/interactive.tsx`: Radix Dialog, Drawer, Switch, Tooltip, Tabs and styled tab parts. Dialogs require a title; optional descriptions have explicitly associated IDs. Radix supplies focus management, Escape dismissal, and modal semantics.
- Existing Radix dropdown infrastructure remains in use by the theme selector. The existing Sonner Toaster is now mounted once at the root.
- `MetricCard` and `ChartPanel` accept caller-provided content. They do not generate analytics, load privileged data, or imply financial balances. The Table wrapper supplies horizontal scrolling, a caption, and a keyboard-focusable region; callers supply semantic header/body cells.

Use FormField with an input having the same `id`; associate `${id}-hint` and `${id}-error` with `aria-describedby` when present, and set `aria-invalid` when invalid. Wrap a Checkbox in a label or supply `htmlFor`; Switch and IconButton require accessible labels. Put pale-panel form labels inside a Card/ds-panel. ErrorFeedback must receive safe public text, never raw server exceptions. Pagination's URL callback must point only to implemented routes. Use Button `asChild` for links instead of nesting controls.

## Layout and routes

`app/layout.tsx` preserves ClerkProvider, ThemeProvider, and CartProvider, and mounts PublicShell and Toaster. PublicShell owns the skip link, shared header, one main landmark, and footer. Existing URLs, API endpoints, and Clerk catch-all paths are unchanged.

The header exposes Home, Shop, About, Help, a real product search, cart count, Clerk account/sign-in control, and theme selection. Search submits `q` to `/all-products`; the existing client filter consumes the bounded initial query. Categories, merchant browsing, deals, and the unfinished favorites feature are omitted from navigation until implemented. The footer links only to existing information/catalog pages; it invents no support details, social accounts, or apps.

`app/account/layout.tsx`, `app/merchant/layout.tsx`, and `app/admin/layout.tsx` use the server-only ProtectedWorkspace. It calls the existing `requireRouteAccess` before rendering WorkspaceShell. The client shell receives only area and children, not the internal user DTO. Customer, merchant, and Super Admin capability checks remain server controlled. Future page data/actions must continue to enforce authorization independently; layouts do not replace service checks.

There are deliberately no new dashboard `page.tsx` files. These directories prepare future route layouts, but do not expose working `/account`, `/merchant`, or `/admin` pages today. All planned sidebar sections are explicitly disabled and labeled Planned; Back to shop is the real navigation link. Existing files were not moved into new route groups.

WorkspaceShell shares responsive sidebar, top breadcrumb area, and content container across all three areas. Account has profile/address/order/security sections; merchant has product/order/inventory/payout sections; admin has marketplace/category/approval/access sections. No mutation interface, payment storage, analytics implementation, or fabricated user profile is included.

## Responsive and accessibility principles

Containers cap at 90rem and use 16px mobile / 24px larger-screen side gutters. Content uses min-width zero and wrapping flex/grid layouts. At lg, workspaces show a collapsible sidebar; smaller screens use a labeled Radix drawer. Public navigation similarly switches to a drawer, and search occupies a separate row below xl. Tables scroll inside their own region. Images retain intrinsic proportions. Heading sizes and section spacing use clamp rather than desktop-only dimensions.

New buttons and navigation controls generally have 44px minimum targets. Native checkbox and switch controls retain compact geometry and require clear labels. Shared controls have visible focus, forms have explicit labels, the cart link announces quantity, breadcrumbs use navigation semantics, and decorative icons are hidden from assistive technology. Loading/error states use status/alert semantics. Reduced-motion preferences disable nonessential transitions and animations. The root error boundary does not render internal exception messages. Cart synchronization and retry/dismiss behavior are preserved, with shared visual styling only.

## Verification and limitations

Verification commands:

```powershell
npx tsc --noEmit --incremental false
npm run test:authorization
npm run test:identity
npm run test:cart
git diff --check
npm run build
```

TypeScript, all tests, diff whitespace checks, and the final production build passed. Modified-file ESLint passed on 50 changed/untracked source files, including the existing Phase 3B work. A PowerShell array invocation initially joined paths into one argument, so ESLint was rerun successfully through its API with literal file contents (also avoids interpreting Clerk route brackets as globs):

```powershell
@'
const {execFileSync}=require('node:child_process');
const {ESLint}=require('eslint');
(async()=>{
const files=[...new Set([...execFileSync('git',['diff','--name-only','--diff-filter=ACMR'],{encoding:'utf8'}).split(/\r?\n/),...execFileSync('git',['ls-files','--others','--exclude-standard'],{encoding:'utf8'}).split(/\r?\n/)].filter(f=>/\.(ts|tsx|cjs)$/.test(f)))];
const eslint=new ESLint(); const results=[];
for(const file of files) results.push(...await eslint.lintText(require('node:fs').readFileSync(file,'utf8'),{filePath:file}));
console.log((await eslint.loadFormatter('stylish')).format(results));
console.log(`Checked ${files.length} modified/untracked source files`);
process.exitCode=results.some(r=>r.errorCount||r.warningCount)?1:0;
})();
'@ | node
```

Authorization: 47 tests; identity: 35; cart: 57 (139 total). Three added authorization tests exercise the actual protected-shell wrapper with the existing authorization fixture, covering denial, appropriate capability access, suspension, and the client boundary. The original security tests were retained.

The production build uses process-local dummy Clerk/Resend credentials and a deliberately unreachable loopback MongoDB URI; it does not validate live integrations or run migrations. The catalog remains dynamic; no live catalog was required for build verification. No secrets are written to files.

Browser verification is outstanding: automatic approval review rejected the isolated headless Chrome launch with only “blocked by policy.” The attempted isolated Next dev server also encountered an existing dev lock, which was left untouched. No browser tool was available. Therefore 375, 640, 768, 1024, and 1440px layouts, interactive keyboard behavior, rendered contrast, and screenshot similarity have NOT been browser-verified. Responsive classes and accessibility semantics were reviewed in source; this is not a substitute for browser validation.

## Remaining work and next phase

The homepage is a deliberately minimal catalog entry state. Catalog, product details, cart contents, favorites, informational pages, Clerk forms, and all workspace content still need page-level redesign. Existing legacy page components are retained, so not every old form/panel is migrated yet. Financial, order, merchant, and administration workflows remain later phases.

Next: implement the approved homepage and public catalog against real product/category data, reuse these tokens/primitives, add validated image assets, and verify all five requested viewport widths plus keyboard navigation in an available browser. Then proceed to product detail and account/workspace pages without weakening service-level authorization.
