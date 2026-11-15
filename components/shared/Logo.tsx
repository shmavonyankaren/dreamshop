import Link from "next/link";
import Image from "next/image";
export default function Logo() {
  return (
    <Link
      href="/"
      className="inline-flex shrink-0 items-center gap-2 rounded-lg font-bold tracking-tight"
      aria-label="Dreamshop home"
    >
      <Image src="/brand/logo.png" alt="" width={48} height={48} sizes="(min-width: 640px) 48px, 40px" className="size-10 shrink-0 object-contain sm:size-12" />
      <span className="text-xl sm:text-2xl">Dreamshop</span>
    </Link>
  );
}
