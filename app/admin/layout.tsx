import type { ReactNode } from "react";
import { ProtectedWorkspace } from "@/components/layout/ProtectedWorkspace";
export default function AdminLayout({ children }: { children: ReactNode }) { return <ProtectedWorkspace area="admin">{children}</ProtectedWorkspace>; }
