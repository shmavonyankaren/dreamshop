import type { ReactNode } from "react";
import { ProtectedWorkspace } from "@/components/layout/ProtectedWorkspace";
export default function AccountLayout({ children }: { children: ReactNode }) {
  return <ProtectedWorkspace area="account">{children}</ProtectedWorkspace>;
}
