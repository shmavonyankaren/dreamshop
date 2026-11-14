import type { ReactNode } from "react";
import { ProtectedWorkspace } from "@/components/layout/ProtectedWorkspace";
export default function MerchantLayout({ children }: { children: ReactNode }) { return <ProtectedWorkspace area="merchant">{children}</ProtectedWorkspace>; }
