"use client";
import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import { UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
export default function AuthHeader({ setMobileMenuOpen }: { setMobileMenuOpen?: (open: boolean) => void }) {
  return <div className="flex size-11 shrink-0 items-center justify-center">
    <Show when="signed-out"><SignInButton mode="modal"><Button variant="ghost" size="icon" aria-label="Sign in to your account" onClick={() => setMobileMenuOpen?.(false)} className="text-white hover:bg-white/10 hover:text-white"><UserRound aria-hidden="true" /></Button></SignInButton></Show>
    <Show when="signed-in"><UserButton appearance={{ elements: { userButtonTrigger: "size-11 justify-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral", userButtonAvatarBox: "size-8" } }}>
      <UserButton.MenuItems>
        <UserButton.Link label="My account" labelIcon={<UserRound className="size-4" aria-hidden="true" />} href="/account" />
        <UserButton.Action label="manageAccount" />
        <UserButton.Action label="signOut" />
      </UserButton.MenuItems>
    </UserButton></Show>
  </div>;
}
