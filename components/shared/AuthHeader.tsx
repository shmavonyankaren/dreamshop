"use client";
import { Show, SignInButton, UserButton, useUser } from "@clerk/nextjs";
import { UserRound, Store, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AccountNavigation } from "@/lib/server/account-navigation";
export default function AuthHeader({ setMobileMenuOpen, navigation }: { setMobileMenuOpen?: (open: boolean) => void; navigation?: AccountNavigation | null }) {
  const { user, isLoaded, isSignedIn } = useUser();
  // Do not show a previous session's server-rendered links during account switching.
  const current = isLoaded && isSignedIn && navigation?.clerkId === user?.id ? navigation : null;
  return <div className="flex size-11 shrink-0 items-center justify-center">
    <Show when="signed-out"><SignInButton mode="modal"><Button variant="ghost" size="icon" aria-label="Sign in to your account" onClick={() => setMobileMenuOpen?.(false)} className="text-white hover:bg-white/10 hover:text-white"><UserRound aria-hidden="true" /></Button></SignInButton></Show>
    <Show when="signed-in"><UserButton appearance={{ elements: { userButtonTrigger: "size-11 justify-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral", userButtonAvatarBox: "size-8" } }}>
      <UserButton.MenuItems>
        <UserButton.Link label="My Account" labelIcon={<UserRound className="size-4" aria-hidden="true" />} href="/account" />
        {current?.adminDashboard && <UserButton.Link label="Super Admin Dashboard" labelIcon={<ShieldCheck className="size-4" aria-hidden="true" />} href="/admin" />}
        {current?.merchantDashboard && <UserButton.Link label="Merchant Dashboard" labelIcon={<Store className="size-4" aria-hidden="true" />} href="/merchant" />}
        <UserButton.Action label="manageAccount" />
        <UserButton.Action label="signOut" />
      </UserButton.MenuItems>
    </UserButton></Show>
  </div>;
}
