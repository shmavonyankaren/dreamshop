export default function ContactFAQCard() {
  return (
    <div className="bg-linear-to-r from-brand to-accent-ds rounded-2xl shadow-xl p-6 sm:p-8 text-white">
      <h3 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">
        Frequently Asked Questions
      </h3>
      <p className="text-brand-subtle mb-4 sm:mb-6">
        Before reaching out, you might find your answer in our FAQ section.
        Check it out for quick solutions to common questions.
      </p>
      <a
        href="/faq"
        className="bg-surface-elevated text-brand-text font-semibold py-2 sm:py-3 px-4 sm:px-6 rounded-xl hover:bg-brand-faint border border-edge hover:border-brand transition-all duration-300 inline-flex items-center gap-2"
      >
        View FAQ
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </a>
    </div>
  );
}
