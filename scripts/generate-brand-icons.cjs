/* eslint-disable @typescript-eslint/no-require-imports */
/* Generate deterministic icon sizes from the approved original; no cropping or recoloring. */
const fs = require("node:fs/promises");
const path = require("node:path");
const sharp = require("sharp");
const root = path.resolve(__dirname, "..");
const source = path.join(root, "assets/brand/dreamshop-original.png");
const png = size => sharp(source).resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: "lanczos3" }).png({ compressionLevel: 9 }).toBuffer();
async function main() {
  await fs.mkdir(path.join(root, "public/brand"), { recursive: true });
  for (const [file, size] of [["public/brand/logo.png", 192], ["public/brand/icon-512.png", 512], ["app/icon.png", 48], ["app/apple-icon.png", 180]]) {
    await fs.writeFile(path.join(root, file), await png(size));
  }
  const sizes = [16, 32, 48, 256];
  const images = await Promise.all(sizes.map(png));
  const header = Buffer.alloc(6 + sizes.length * 16);
  header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  images.forEach((image, index) => {
    const entry = 6 + index * 16;
    header[entry] = header[entry + 1] = sizes[index] === 256 ? 0 : sizes[index];
    header.writeUInt16LE(1, entry + 4); header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(image.length, entry + 8); header.writeUInt32LE(offset, entry + 12);
    offset += image.length;
  });
  await fs.writeFile(path.join(root, "app/favicon.ico"), Buffer.concat([header, ...images]));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
