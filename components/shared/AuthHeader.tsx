"use client";
import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import { UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
export default function AuthHeader({ setMobileMenuOpen }: { setMobileMenuOpen?: (open: boolean) => void }) {
  return <div className="flex min-h-11 min-w-11 items-center justify-center"><Show when="signed-out"><SignInButton mode="modal"><Button variant="ghost" size="icon" aria-label="Sign in to your account" onClick={() => setMobileMenuOpen?.(false)} className="text-white hover:bg-white/10 hover:text-white"><UserRound aria-hidden="true" /></Button></SignInButton></Show><Show when="signed-in"><UserButton /></Show></div>;
}
