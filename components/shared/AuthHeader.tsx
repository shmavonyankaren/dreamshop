"use client";

import {
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
  useUser,
} from "@clerk/nextjs";

type AuthHeaderProps = {
  setMobileMenuOpen?: (open: boolean) => void;
};

export default function AuthHeader({ setMobileMenuOpen }: AuthHeaderProps) {
  const { user } = useUser();

  const closeMobileMenu = () => {
    setMobileMenuOpen?.(false);
  };

  return (
    <div className="py-5 lg:py-0">
      <Show when="signed-out">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
          <SignInButton>
            <button
              onClick={closeMobileMenu}
              className="cursor-pointer w-full lg:w-auto px-4 sm:px-5 md:px-6 py-2.5 sm:py-3 lg:py-2.5 text-sm sm:text-base lg:text-base bg-surface/90 backdrop-blur-sm text-brand-dim font-semibold rounded-full border border-brand-subtle/50 shadow-lg hover:shadow-xl hover:bg-surface hover:scale-105 transition-all duration-300"
            >
              Sign In
            </button>
          </SignInButton>

          <SignUpButton>
            <button
              onClick={closeMobileMenu}
              className="cursor-pointer w-full lg:w-auto px-4 sm:px-5 md:px-6 py-2.5 sm:py-3 lg:py-2.5 text-sm sm:text-base lg:text-base bg-linear-to-r from-brand to-accent-ds text-white font-semibold rounded-full shadow-lg hover:shadow-xl hover:from-brand-hover hover:to-accent-ds-hover hover:scale-105 transition-all duration-300"
            >
              Sign Up
            </button>
          </SignUpButton>
        </div>
      </Show>

      <Show when="signed-in">
        <div className="flex flex-row-reverse lg:flex-row justify-end lg:justify-start items-center gap-2 sm:gap-3 text-white">
          <span className="text-xs sm:text-sm font-medium text-white">
            {user?.username
              ? user.username
              : user?.firstName + " " + user?.lastName}
          </span>
          <UserButton />
        </div>
      </Show>
    </div>
  );
}
