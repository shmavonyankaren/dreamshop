import Image from "next/image";
import type { ReactNode } from "react";
export function ElectronicsArtwork({ className = "" }: { className?: string }) {
  return (
    <Image
      src="/assets/electronics-studio.svg"
      alt="Illustration of headphones, a laptop, phone, earbuds, and smartwatch on a studio display"
      width={800}
      height={370}
      priority
      className={`h-auto w-full ${className}`}
    />
  );
}
export function MarketingHero({
  label,
  title,
  description,
  children,
}: {
  label: string;
  title: ReactNode;
  description: string;
  children?: ReactNode;
}) {
  return (
    <section className="marketing-hero ds-panel">
      <div className="marketing-hero-copy">
        <span className="marketing-eyebrow">{label}</span>
        <h1>{title}</h1>
        <p>{description}</p>
        {children}
      </div>
      <div className="marketing-hero-art">
        <ElectronicsArtwork />
      </div>
    </section>
  );
}
