"use client";

import { useState, useEffect } from "react";
import { sendContactForm } from "@/lib/actions/user.actions";

export default function ContactForm() {
  const [status, setStatus] = useState<
    null | "idle" | "sending" | "success" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [bannerVisible, setBannerVisible] = useState(false);

  useEffect(() => {
    // Fade banner out then clear status when success
    if (status === "success") {
      const fadeTimer = setTimeout(() => setBannerVisible(false), 4500);
      const clearTimer = setTimeout(() => setStatus("idle"), 5000);
      return () => {
        clearTimeout(fadeTimer);
        clearTimeout(clearTimer);
      };
    }
    return;
  }, [status]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg(null);

    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      // Use server action directly (no API route)
      await sendContactForm(formData);
      setStatus("success");
      setBannerVisible(true);
      form.reset();
    } catch (err) {
      console.error(err);
      setStatus("error");
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg || "Unable to send message.");
    }
  }

  return (
    <div className="bg-surface rounded-2xl shadow-xl p-6 sm:p-8 md:p-10 border border-edge transition-colors duration-300">
      <h2 className="text-2xl sm:text-3xl font-bold text-body-primary mb-4 sm:mb-6 transition-colors duration-300">
        Send us a Message
      </h2>
      {status === "success" && (
        <div
          role="status"
          className={`mb-4 p-3 rounded-lg bg-ok-bg border border-ok-edge text-ok-fg transition-all duration-500 ${
            bannerVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 -translate-y-2"
          }`}
        >
          Your message has been sent — we will get back to you shortly.
        </div>
      )}
      {status === "error" && (
        <div
          role="alert"
          className="mb-4 p-3 rounded-lg bg-err-bg border border-err-edge text-err-fg"
        >
          {errorMsg || "Failed to send message. Please try again."}
        </div>
      )}

      <form className="space-y-6" onSubmit={handleSubmit}>
        {/* Name Field */}
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-semibold text-body-tertiary mb-2 transition-colors duration-300"
          >
            Full Name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            className="w-full px-4 py-3 border border-edge-strong rounded-xl bg-surface text-body-primary placeholder-body-secondary focus:ring-2 focus:ring-brand focus:border-brand transition-colors duration-300"
            placeholder="John Doe"
            required
          />
        </div>

        {/* Email Field */}
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-semibold text-body-tertiary mb-2 transition-colors duration-300"
          >
            Email Address
          </label>
          <input
            type="email"
            id="email"
            name="email"
            className="w-full px-4 py-3 border border-edge-strong rounded-xl bg-surface text-body-primary placeholder-body-secondary focus:ring-2 focus:ring-brand focus:border-brand transition-colors duration-300"
            placeholder="john@example.com"
            required
          />
        </div>

        {/* Subject Field */}
        <div>
          <label
            htmlFor="subject"
            className="block text-sm font-semibold text-body-tertiary mb-2 transition-colors duration-300"
          >
            Subject
          </label>
          <input
            type="text"
            id="subject"
            name="subject"
            className="w-full px-4 py-3 border border-edge-strong rounded-xl bg-surface text-body-primary placeholder-body-secondary focus:ring-2 focus:ring-brand focus:border-brand transition-colors duration-300"
            placeholder="How can we help?"
            required
          />
        </div>

        {/* Message Field */}
        <div>
          <label
            htmlFor="message"
            className="block text-sm font-semibold text-body-tertiary mb-2 transition-colors duration-300"
          >
            Message
          </label>
          <textarea
            id="message"
            name="message"
            rows={6}
            className="w-full px-4 py-3 border border-edge-strong rounded-xl bg-surface text-body-primary placeholder-body-secondary focus:ring-2 focus:ring-brand focus:border-brand transition-colors duration-300 resize-none"
            placeholder="Tell us more about your inquiry..."
            required
          ></textarea>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className=" cursor-pointer w-full bg-linear-to-r from-brand to-accent-ds text-white font-semibold py-3 sm:py-4 px-4 sm:px-6 rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 group"
        >
          Send Message
          <svg
            className="w-5 h-5 group-hover:translate-x-1 transition-transform"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M14 5l7 7m0 0l-7 7m7-7H3"
            />
          </svg>
        </button>
      </form>
    </div>
  );
}
