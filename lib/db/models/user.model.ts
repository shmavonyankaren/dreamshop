import { Model, Schema, model, models } from "mongoose";

export interface IUser {
  clerkId: string;
  email: string;
  username: string;
  firstName?: string | null;
  lastName?: string | null;
  photo?: string | null;
}

const userSchema = new Schema<IUser>(
  {
    clerkId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, index: true },
    username: { type: String, required: true },
    firstName: { type: String, default: null },
    lastName: { type: String, default: null },
    photo: { type: String, default: null },
  },
  { timestamps: true },
);

const UserModel =
  (models.User as Model<IUser>) || model<IUser>("User", userSchema);

export default UserModel;
