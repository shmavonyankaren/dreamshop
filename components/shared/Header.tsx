"use client";

import { useState } from "react";
import Logo from "./Logo";
import NavigationMenu from "./NavigationMenu";
import AuthHeader from "./AuthHeader";
import { ModeToggle } from "./ModeToggle";
import { Dialog, DialogPanel, PopoverGroup } from "@headlessui/react";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import ShoppingCart from "../products/ShoppingCart";

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="bg-linear-to-r from-nav-from to-nav-end backdrop-blur-xl border-b border-white/30 shadow-2xl transition-all duration-300 relative before:absolute before:inset-0 before:bg-linear-to-r before:from-white/5 before:to-transparent before:pointer-events-none">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3">
        <div className="flex lg:flex-1">
          <Logo />
        </div>

        <div className="flex lg:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="-m-2 cursor-pointer inline-flex items-center justify-center rounded-md p-2 sm:p-2.5 text-white hover:bg-white/10 transition-colors"
          >
            <span className="sr-only">Open main menu</span>
            <Bars3Icon aria-hidden="true" className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        <PopoverGroup className="hidden lg:flex lg:gap-x-12">
          <NavigationMenu />
        </PopoverGroup>

        <div className="hidden lg:flex lg:flex-1 lg:justify-end lg:items-center lg:gap-4">
          <AuthHeader />
          <ShoppingCart />
          <ModeToggle />
        </div>
      </nav>

      {/* {mobileMenuOpen && (
        <div className="lg:hidden">
          <div
            className="fixed inset-0 z-50 bg-black/50"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden
          />

          <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-96 bg-[#000B25] px-5 py-3 shadow-2xl">
            <div className="flex items-center justify-between">
              <Logo />

              <div className="flex items-center gap-3">
                <ModeToggle />
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="-m-2 rounded-md p-2 text-gray-900 hover:bg-gray-100/10"
                  aria-label="Close menu"
                >
                  <svg
                    className="w-6 h-6"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden
                  >
                    <path
                      d="M6 6l12 12M6 18L18 6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </div>

            <div className="mt-6">
              <div className="space-y-6">
                <NavigationMenu onNavigate={() => setMobileMenuOpen(false)} />
                <div className="pt-4">
                  <AuthHeader />
                </div>
              </div>
            </div>
          </aside>
        </div>
      )} */}
      <Dialog
        open={mobileMenuOpen}
        onClose={setMobileMenuOpen}
        className="lg:hidden"
      >
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        <DialogPanel className="fixed inset-y-0 right-0 z-50 w-full max-w-xs sm:max-w-sm overflow-y-auto bg-linear-to-br from-nav-from via-nav-mid to-nav-end p-6 shadow-2xl transition-colors duration-300">
          {/* Logo and close button */}
          <div className="flex items-center justify-between">
            <Logo />
            <div className="flex items-center gap-3">
              <ModeToggle />
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="-m-2.5 cursor-pointer rounded-lg p-2.5 text-white hover:bg-white/10 transition-colors"
              >
                <span className="sr-only">Close menu</span>
                <XMarkIcon aria-hidden="true" className="size-6" />
              </button>
            </div>
          </div>

          <div className="mt-6 flow-root">
            <div className="-my-6 flex flex-col justify-evenly divide-y divide-white/10">
              {/* App navigation links */}
              <div className="space-y-2 py-6">
                <NavigationMenu onNavigate={() => setMobileMenuOpen(false)} />
              </div>
              <ShoppingCart />

              {/* User account section */}
              <AuthHeader />
            </div>
          </div>
        </DialogPanel>
      </Dialog>
    </header>
  );
}
