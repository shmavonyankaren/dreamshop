import { valuesSectionList } from "./constants";
import ValueItem from "./ValueItem";

export default function ValuesSection() {
  return (
    <div className="bg-surface rounded-2xl shadow-xl p-6 sm:p-8 md:p-12 mb-8 sm:mb-12 border border-edge transition-colors duration-300">
      <h2 className="text-2xl sm:text-3xl font-bold text-body-primary mb-6 sm:mb-8 text-center transition-colors duration-300">
        Our Core Values
      </h2>
      <div className="grid sm:grid-cols-2 gap-6 sm:gap-8">
        {valuesSectionList.map((value) => (
          <ValueItem
            key={value.title}
            emoji={value.emoji}
            title={value.title}
            description={value.description}
            bgColor={value.bgColor}
          />
        ))}
      </div>
    </div>
  );
}
