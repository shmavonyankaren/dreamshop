import { z } from "zod";
export const applicationSchema = z.object({
  name: z.string().trim().min(2).max(100), description: z.string().trim().min(10).max(3000),
  contactEmail: z.string().trim().email().max(254), supportingInformation: z.string().trim().max(1000).default(""),
}).strict();
export const storeSetupSchema = applicationSchema.omit({ supportingInformation: true }).extend({
  slug: z.string().min(3).max(60).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
}).strict();
const image = z.union([z.literal(""), z.string().regex(/^\/api\/store-images\/[a-f0-9]{24}$/)]);
export const storeSettingsSchema = applicationSchema.omit({ supportingInformation: true }).extend({
  logo: image, banner: image,
}).strict();
export type StoreDTO = { id: string; name: string; slug: string; description: string; contactEmail: string; logo: string; banner: string; status: string };
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export function validateImage(bytes: Uint8Array, mime: string) {
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new Error("Choose an image up to 2 MB.");
  const hex = Array.from(bytes.slice(0, 12), b => b.toString(16).padStart(2, "0")).join("");
  const valid = mime === "image/png" ? hex.startsWith("89504e470d0a1a0a") : mime === "image/jpeg" ? hex.startsWith("ffd8ff") : mime === "image/webp" ? hex.startsWith("52494646") && hex.slice(16) === "57454250" : false;
  if (!valid) throw new Error("Choose a PNG, JPEG, or WebP image with a matching file type.");
}
