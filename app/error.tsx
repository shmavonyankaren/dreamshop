"use client";

import { useRouter } from "next/navigation";
import { startTransition } from "react";
import Link from "next/link";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  const router = useRouter();

  const errorHandler = () => {
    startTransition(() => {
      router.refresh();
      reset();
    });
  };

  return (
    <div className="flex-1 w-full flex items-center justify-center min-h-0 bg-linear-to-br from-page-from via-page-mid to-page-to transition-colors duration-300 px-4 py-8">
      <div className="max-w-2xl w-full text-center">
        {/* Error Icon */}
        <div className="mb-8 flex justify-center">
          <div className="relative">
            <div className="w-24 h-24 sm:w-32 sm:h-32 bg-linear-to-r from-red-500 to-orange-500 rounded-full flex items-center justify-center shadow-2xl">
              <svg
                className="w-12 h-12 sm:w-16 sm:h-16 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div className="absolute -inset-2 bg-red-500/20 rounded-full animate-ping"></div>
          </div>
        </div>

        {/* Message */}
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-body-primary mb-4 transition-colors duration-300">
          Oops! Something went wrong
        </h1>
        <p className="text-lg sm:text-xl text-body-secondary mb-3 transition-colors duration-300">
          We encountered an unexpected error. Don&apos;t worry, it&apos;s not
          your fault!
        </p>

        {/* Error Details */}
        <div className="mb-8 p-4 bg-err-bg border border-err-edge rounded-xl">
          <p className="text-sm text-err-fg font-mono wrap-break-word">
            {error.message || "An unknown error occurred"}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center">
          <button
            onClick={errorHandler}
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
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Try Again
          </button>
          <Link
            href="/"
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
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
