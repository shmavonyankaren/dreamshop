export default function MissionSection() {
  return (
    <div className="bg-surface rounded-2xl shadow-xl p-6 sm:p-8 md:p-12 mb-8 sm:mb-12 border border-edge transition-colors duration-300">
      <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
        <div className="bg-linear-to-r from-brand to-accent-ds p-2 sm:p-3 rounded-xl">
          <svg
            className="w-5 h-5 sm:w-6 sm:h-6 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-body-primary transition-colors duration-300">
          Our Mission
        </h2>
      </div>
      <p className="text-base sm:text-lg text-body-tertiary leading-relaxed mb-3 sm:mb-4 transition-colors duration-300">
        At DreamShop, our mission is to make online shopping simple, enjoyable,
        and accessible. We focus on offering carefully selected products, fast
        browsing, and a customer-first experience that makes every purchase feel
        effortless.
      </p>
      <p className="text-base sm:text-lg text-body-tertiary leading-relaxed transition-colors duration-300">
        We are committed to delivering quality, reliability, and convenience
        while creating a shopping platform customers can trust.
      </p>
    </div>
  );
}
