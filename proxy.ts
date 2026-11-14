import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/cart",
  "/about-us",
  "/contact",
  "/faq",
  "/all-products(.*)",
  "/creator-page/(.*)",
  "/product/(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  // Do not protect public routes
  if (isPublicRoute(req)) return;

  // Skip protecting API routes and internal requests to avoid interfering with server-side
  // fetches (like fetch from server-components or internal HTTP calls).
  // This prevents the middleware from rewriting/redirecting server-to-server calls.
  const pathname = req.nextUrl?.pathname || "";
  if (pathname.startsWith("/api") || pathname.startsWith("/trpc")) return;

  // Otherwise enforce authentication
  await auth.protect();
});

// Run Clerk for pages, account-cart APIs and identity recovery; webhooks verify Svix independently.
export const config = {
  matcher: [
    "/api/cart(.*)",
    "/api/wishlist",
    "/api/identity/sync",
    // Establish API auth context; services enforce access.
    "/((?!_next|api|trpc|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  ],
};
