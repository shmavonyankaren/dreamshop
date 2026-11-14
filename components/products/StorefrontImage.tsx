"use client";
import { useState } from "react";
import { Package } from "lucide-react";
import { safeProductImage } from "@/lib/storefront-contract";
export function StorefrontImage({ src, title, priority = false }: { src: string; title: string; priority?: boolean }) {
  const [failed, setFailed] = useState<string | null>(null);
  const url = safeProductImage(src);
  return url && failed !== url ?
    // Remote images render directly instead of using an unrestricted server proxy.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={title} loading={priority ? "eager" : "lazy"} decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(url)} className="h-full! w-full object-contain p-5 transition-transform duration-300 group-hover:scale-105" /> :
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-muted-foreground"><Package aria-hidden="true" className="size-12 opacity-50" /><span className="text-sm">Image unavailable</span></div>;
}
