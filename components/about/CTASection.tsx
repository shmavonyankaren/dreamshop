import Link from "next/link";

export default function CTASection() {
  return (
    <div className="bg-linear-to-r from-brand to-accent-ds rounded-2xl shadow-2xl p-6 sm:p-8 md:p-12 text-center text-white">
      <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4">
        Join DreamShop Today
      </h2>
      <p className="text-lg sm:text-xl text-brand-subtle mb-6 sm:mb-8 max-w-2xl mx-auto">
        Discover amazing products, explore trending collections, and enjoy a
        modern shopping experience built around your needs.
      </p>
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Link
          href="/sign-up"
          className="px-8 py-4 bg-surface-elevated text-brand-text font-semibold rounded-xl hover:bg-brand-faint border border-edge hover:border-brand transition-all duration-300 shadow-lg hover:shadow-xl inline-block"
        >
          Start Shopping
        </Link>
        <Link
          href="/all-products"
          className="px-8 py-4 bg-indigo-700 text-white font-semibold rounded-xl hover:bg-indigo-800 transition-all shadow-lg hover:shadow-xl border-2 border-indigo-400 inline-block"
        >
          Explore Products
        </Link>
      </div>
    </div>
  );
}
