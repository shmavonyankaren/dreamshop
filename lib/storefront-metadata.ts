import type { Metadata } from "next";
export function storefrontMetadata(title: string, description: string, path: string): Metadata {
  let canonical: string | undefined;
  try { const origin = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? ""); if (["https:", "http:"].includes(origin.protocol)) canonical = new URL(path, origin.origin).href; } catch { /* No configured public origin. */ }
  return { title, description, ...(canonical ? { alternates: { canonical } } : {}), openGraph: { title, description, type: "website", ...(canonical ? { url: canonical } : {}) } };
}
