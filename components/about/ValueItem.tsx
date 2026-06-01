import type { ValueItemProps } from "./types";

export default function ValueItem({
  emoji,
  title,
  description,
  bgColor,
}: ValueItemProps) {
  const bgClass =
    bgColor === "indigo" ? "bg-badge-brand-bg" : "bg-badge-accent-bg";

  return (
    <div className="flex gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl bg-surface-muted border border-edge hover:border-brand-text transition-all duration-300">
      <div className="shrink-0">
        <div
          className={`w-10 h-10 sm:w-12 sm:h-12 ${bgClass} rounded-lg flex items-center justify-center`}
        >
          <span className="text-xl sm:text-2xl">{emoji}</span>
        </div>
      </div>
      <div>
        <h3 className="text-lg sm:text-xl font-bold text-body-primary mb-1.5 sm:mb-2 transition-colors duration-300">
          {title}
        </h3>
        <p className="text-sm sm:text-base text-body-secondary transition-colors duration-300">
          {description}
        </p>
      </div>
    </div>
  );
}
