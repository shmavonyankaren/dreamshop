import { memo } from "react";
import { FeatureCardProps } from "./types";

function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <div className="bg-surface rounded-2xl shadow-lg p-6 sm:p-8 hover:shadow-xl border border-edge hover:border-brand-text transition-all duration-300">
      <div className="bg-linear-to-r from-brand to-accent-ds p-3 sm:p-4 rounded-xl inline-block mb-4 sm:mb-6">
        {icon}
      </div>
      <h3 className="text-xl sm:text-2xl font-bold text-body-primary mb-3 sm:mb-4 transition-colors duration-300">
        {title}
      </h3>
      <p className="text-sm sm:text-base text-body-secondary leading-relaxed transition-colors duration-300">
        {description}
      </p>
    </div>
  );
}

export default memo(FeatureCard);
