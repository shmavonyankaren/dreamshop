"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

export default function Logo() {
  const router = useRouter();
  return (
    <div
      className="flex items-center gap-3 cursor-pointer"
      onClick={() => router.push("/")}
    >
      <Image
        src="/assets/logo.svg"
        alt="DreamShop logo"
        width={44}
        height={44}
      />

      <div className="flex flex-col leading-none">
        <span className="text-2xl font-extrabold tracking-tight text-white">
          Dream<span className="text-accent-text">Shop</span>
        </span>

        <span className="mt-1 text-xs font-medium tracking-wide text-nav-text-muted">
          Modern shopping experience
        </span>
      </div>
    </div>
  );
}
