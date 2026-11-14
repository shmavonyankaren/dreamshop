import "server-only";
import { resolveAccountNavigation } from "@/lib/server/account-navigation";
import AuthHeader from "./AuthHeader";

export async function WorkspaceAccountMenu() {
  return <AuthHeader navigation={await resolveAccountNavigation()} />;
}
