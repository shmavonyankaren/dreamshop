"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";

type LinkType = {
  name: string;
  href: string;
  requiresAuth?: boolean;
};

const navLinks: LinkType[] = [
  { name: "Home", href: "/" },
  { name: "All Products", href: "/all-products" },
  { name: "Favourites", href: "/favourites", requiresAuth: true },
  { name: "Contact", href: "/contact" },
];

type NavigationProps = {
  onNavigate?: () => void;
};

export default function Navigation({ onNavigate }: NavigationProps) {
  const pathname = usePathname();
  const { user } = useUser();

  return (
    <div>
      <ul className="flex flex-col lg:flex-row md:gap-6 lg:gap-8 gap-3">
        {navLinks.map((link) => {
          // Skip links that require auth if user is not logged in
          if (link.requiresAuth && !user) return null;

          const isActive =
            link.href === "/"
              ? pathname === "/"
              : pathname.startsWith(link.href);

          return (
            <li key={link.name}>
              <Link
                href={link.href}
                onClick={onNavigate}
                className={`cursor-pointer text-xs sm:text-sm md:text-base font-medium transition-all ${
                  isActive
                    ? "text-nav-active font-bold underline underline-offset-4"
                    : "text-brand-subtle hover:text-white"
                }`}
              >
                {link.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
