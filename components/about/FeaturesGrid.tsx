import FeatureCard from "./FeatureCard";
import { featuresGridList } from "./constants";

export default function FeaturesGrid() {
  return (
    <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8 mb-8 sm:mb-12">
      {featuresGridList.map((feature) => (
        <FeatureCard
          key={feature.title}
          title={feature.title}
          description={feature.description}
          icon={
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {feature.iconPaths.map((path) => (
                <path
                  key={path}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={path}
                />
              ))}
            </svg>
          }
        />
      ))}
    </div>
  );
}
