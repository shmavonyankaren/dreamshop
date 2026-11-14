import "server-only";
import { requireAuthenticatedUser } from "./authenticated-user";
export async function getCustomerProfile() {
  const user = await requireAuthenticatedUser();
  return { displayName: user.displayName, email: user.email, avatar: user.avatar, username: user.username, joined: user.createdAt };
}
