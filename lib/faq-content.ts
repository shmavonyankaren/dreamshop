export const faqGroups = [
  { id: "shopping", title: "Browsing & shopping", items: [
    { question: "How do I find products?", answer: "Use the header search or open Shop. The catalog searches product titles, descriptions, and tags. You can filter by category and sort by name or date added." },
    { question: "Can I place an order or pay now?", answer: "Not yet. You can browse products and add them to your cart, but checkout, payments, and completed orders are not available. Adding to your cart does not place an order." },
    { question: "Are shipment tracking, returns, or exchanges available?", answer: "Not yet. Dreamshop does not currently process orders, shipments, returns, or exchanges. No delivery estimates or return policy are offered at this stage." },
    { question: "Are there discounts or product reviews?", answer: "Discount campaigns, reviews, and ratings are not currently implemented. Product prices are displayed as listed, without invented sale prices or ratings." },
  ] },
  { id: "cart-wishlist", title: "Cart & wishlist", items: [
    { question: "Do I need an account to browse or use the cart?", answer: "You can browse and use a guest cart without signing in. Guest items are stored in this browser. When you sign in, Dreamshop synchronizes them with your account cart; any synchronization issues are shown for review." },
    { question: "How do I save a product to my wishlist?", answer: "Sign in and select a product’s heart button. Your wishlist is saved to your account and can hold up to 500 saved entries. You can remove items or add available products to your cart from the wishlist page." },
    { question: "Why is the cart subtotal unavailable?", answer: "Products currently have listed prices but no shared currency definition. Dreamshop does not calculate a payable subtotal until pricing and currency support are established. Checkout remains unavailable." },
    { question: "What if a saved product disappears?", answer: "A product removed from the catalog is shown as unavailable in your wishlist. You can remove that saved entry. Cart synchronization feedback explains items that need attention; review it before dismissing saved reconciliation details." },
  ] },
  { id: "account-help", title: "Account & help", items: [
    { question: "How do I edit my profile or security settings?", answer: "Open your avatar menu and choose My account for your Dreamshop overview, or Manage account for Clerk’s supported profile and security settings. Available sign-in methods depend on the account configuration." },
    { question: "Can I save addresses or payment methods?", answer: "Addresses, saved payment methods, order history, and notification preferences are planned and are not currently available. Their account navigation entries are marked Planned." },
    { question: "How do I change the color theme?", answer: "Choose Light, Dark, or System from the theme menu. System follows your device’s preference. The selection is saved in this browser when browser storage is available. On small screens, the theme control is inside the navigation menu." },
    { question: "How can I contact Dreamshop?", answer: "Open Contact to use the message form or the published contact details. Live chat and fixed support hours are not currently available, and no response-time guarantee is offered." },
  ] },
];
