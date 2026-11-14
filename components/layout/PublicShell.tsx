import { Suspense, type ReactNode } from "react";
import Header from "@/components/shared/Header";
import Footer from "@/components/shared/Footer";
import AuthHeader from "@/components/shared/AuthHeader";
import { WorkspaceAccountMenu } from "@/components/shared/WorkspaceAccountMenu";

export function PublicShell({ children }: { children: ReactNode }) {
  return <><a href="#main-content" className="skip-link">Skip to content</a><Header accountControl={<Suspense fallback={<AuthHeader />}><WorkspaceAccountMenu /></Suspense>} /><main id="main-content" tabIndex={-1} className="flex min-w-0 flex-1 flex-col outline-none">{children}</main><Footer /></>;
}
