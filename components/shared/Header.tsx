import { Button } from "../ui/button";
import Logo from "./Logo";
import NavBar from "./NavBar";

import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

export default function Header() {
  return (
    <header className="w-full flex justify-between items-center p-3">
      <div className="flex gap-5 items-center text-2xl font-bold">
        <Logo />
      </div>
      <NavBar />
      <Show when="signed-out">
        <div className="flex gap-1">
          <SignInButton>
            <Button variant="outline" size="sm">
              Sign In
            </Button>
          </SignInButton>
          <SignUpButton>
            <Button variant="outline" size="sm">
              Sign Up
            </Button>
          </SignUpButton>
        </div>
      </Show>

      <Show when="signed-in">
        <UserButton />
      </Show>
    </header>
  );
}
