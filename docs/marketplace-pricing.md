# Marketplace pricing

EUR and USD are enabled initially, with EUR as the default. Super Admins manage
currencies at `/admin/currencies`, including enabling additional ISO currencies,
disabling currencies, and choosing an enabled default. Currency codes and decimal
precision come from the runtime's ISO/ICU currency catalog, not administrator-entered
conversion factors. The default affects new forms only.

Configuration is persisted in `authorization_controls.marketplace.currencySettings`.
Updates require the server-derived `currency:manage` capability and use the existing
shared authorization transaction, with audit records and revision conflict checks.
Price writes validate enabled currencies within that same transaction, so a concurrent
disable cannot bypass validation. No additional collection or index is required.

## Price contract

Product writes supply an explicit ISO `currency` and a decimal `price` string.
The server converts the string to integer minor units without rounding and rejects
negative amounts, exponents, excess precision, unsupported/disabled currencies,
and client-supplied minor units. The maximum is 999,999,999 minor units.
Partial price updates must include both price and currency.

The existing `priceCents` field is retained for storage compatibility; it holds ISO
minor units, which are cents for EUR/USD, whole yen for JPY, and thousandths for KWD.
`priceCents` plus `currency` are authoritative. The decimal `price` string is a
compatibility mirror derived from minor units. Currency has no product schema default.

The shared formatter is used by merchant/admin lists, storefront/detail pages,
cart and wishlist. Single-currency cart subtotals use integer arithmetic. Mixed
currencies have no combined subtotal. There is no exchange-rate conversion,
checkout, shipping calculation, tax calculation, or payment integration.

## Disabled and legacy currencies

Disabling a currency never changes existing products or their display. Unchanged
prices can be retained when editing other fields. Repricing requires an enabled
currency. The merchant form shows a disabled saved currency as a non-selectable
option and the saved amount as read-only. Selecting another currency clears the
amount and requires explicit entry rather than interpreting it as a conversion.

Existing records without currency/minor units remain browsable and usable in
carts/wishlists, labeled “currency unspecified” and excluded from subtotals.
Their edit forms require a newly entered amount. No bulk migration or inferred EUR
assignment is included. Records affected by earlier lost pricing fields must also
be repriced explicitly.

## Cached model correction and creation

A retained Mongoose model compiled before the pricing fields existed silently
stripped those fields during casting. The model now updates its pricing schema and
recompiles property accessors when reused. Regression tests exercise both new and
cached Mongoose models, serialized documents, hydration and public DTOs.

Creation retains the synchronous submission lock, global success toast, product-list
invalidation and redirect. Failed submissions remain editable. Editing retains its
existing navigation behavior. The lock prevents repeated clicks in one form; it is
not a database idempotency key for ambiguous network retries.
