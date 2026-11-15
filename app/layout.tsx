import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { ClerkProvider } from "@clerk/nextjs";
import { CartProvider } from "@/components/CartContext";
import { PublicShell } from "@/components/layout/PublicShell";
import { WishlistProvider } from "@/components/customer/WishlistProvider";
import { Toaster } from "@/components/ui/sonner";
export const metadata: Metadata = {
  title: { default: "Dreamshop", template: "%s | Dreamshop" },
  description: "Discover products and explore Dreamshop.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex min-h-dvh min-w-0 flex-col">
        <ClerkProvider>
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
            <CartProvider>
              <WishlistProvider>
                <PublicShell>{children}</PublicShell>
                <Toaster position="bottom-right" closeButton />
              </WishlistProvider>
            </CartProvider>
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
