import { SignUp } from "@clerk/nextjs";
import LogoName from "@/components/shared/Logo";

export default function SignUpPage() {
  return (
    <div className="grow bg-linear-to-br from-page-from via-page-mid to-page-to flex items-center justify-center py-8 sm:py-12 px-4 transition-colors duration-300">
      <div className="w-full max-w-md flex justify-center items-center flex-col">
        <div className="mb-6 sm:mb-8 text-center">
          <div className="flex items-center justify-center mb-4 sm:mb-6">
            <LogoName />
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-body-primary mb-2">
            Join our community
          </h1>
          <p className="text-xs sm:text-sm text-body-secondary">
            Create an account to start sharing your stories
          </p>
        </div>

        <SignUp
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "bg-surface shadow-xl border border-edge rounded-2xl p-6",
              headerTitle: "text-body-primary font-bold text-lg",
              headerSubtitle: "text-body-secondary",
              socialButtonsBlockButton:
                "bg-surface border-2 border-edge-strong hover:bg-surface-muted text-body-tertiary font-medium transition-all",
              socialButtonsBlockButtonText: "font-medium",
              formButtonPrimary:
                "bg-linear-to-r from-brand to-accent-ds hover:from-brand-hover hover:to-accent-ds-hover text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all",
              formFieldInput:
                "bg-surface text-body-primary border border-edge-strong rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand",
              formFieldLabel: "text-body-tertiary font-medium",
              footerActionLink:
                "text-brand-text hover:text-brand-hover font-medium",
              identityPreviewText: "text-body-tertiary",
              identityPreviewEditButton:
                "text-brand-text hover:text-brand-hover",
              formResendCodeLink: "text-brand-text hover:text-brand-hover",
              otpCodeFieldInput:
                "bg-surface border border-edge-strong rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand",
            },
          }}
        />
      </div>
    </div>
  );
}
