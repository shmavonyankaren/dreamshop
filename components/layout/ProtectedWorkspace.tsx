import "server-only";
import type { ReactNode } from "react";
import { requireRouteAccess } from "@/lib/server/authorization";
import { WorkspaceShell, type WorkspaceArea } from "./WorkspaceShell";

export async function ProtectedWorkspace({ area, children }: { area: WorkspaceArea; children: ReactNode }) {
  await requireRouteAccess(area);
  // Do not serialize the internal user/permission DTO into the client shell.
  return <WorkspaceShell area={area}>{children}</WorkspaceShell>;
}
