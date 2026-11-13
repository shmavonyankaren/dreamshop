export type AccountStatus = "active" | "suspended" | "deleted";

// Safe profile projection; never contains an email, identity key or sync metadata.
export type PublicUserDTO = { displayName: string | null; avatar: string | null };
export type InternalUserDTO = PublicUserDTO & {
  id: string;
  clerkId: string;
  email: string | null;
  username: string | null;
  status: AccountStatus;
  createdAt: string | null;
  updatedAt: string | null;
};

export class IdentityError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}
