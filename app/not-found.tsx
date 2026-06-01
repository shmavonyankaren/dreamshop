import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div className="flex-1 w-full flex items-center justify-center min-h-0 bg-linear-to-br from-page-from via-page-mid to-page-to transition-colors duration-300 px-4 py-8">
      <div className="max-w-2xl w-full text-center">
        {/* 404 Graphic */}
        <div className="mb-8 relative">
          <div className="text-[120px] sm:text-[180px] md:text-[220px] font-bold bg-linear-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent leading-none">
            404
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <svg
              className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 text-brand-subtle animate-pulse"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        </div>

        {/* Message */}
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-body-primary mb-4 transition-colors duration-300">
          Page Not Found
        </h1>
        <p className="text-lg sm:text-xl text-body-secondary mb-8 transition-colors duration-300">
          Sorry, the page you&apos;re looking for doesn&apos;t exist or has been
          moved.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-4 bg-linear-to-r from-brand to-accent-ds text-white font-semibold rounded-xl hover:from-brand-hover hover:to-accent-ds-hover transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
            Go Home
          </Link>
          <Link
            href="/all-products"
            className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-4 bg-surface-elevated text-brand-text font-semibold rounded-xl hover:bg-brand-faint transition-all duration-300 shadow-md hover:shadow-lg border border-edge-strong"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
              />
            </svg>
            Browse Blogs
          </Link>
        </div>
      </div>
    </div>
  );
}
