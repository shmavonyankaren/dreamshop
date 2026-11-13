import { Schema, model, models } from "mongoose";

const UserSchema = new Schema({
  clerkId: { type: String, required: true, unique: true },
  email: { type: String, default: null },
  username: { type: String, default: null },
  firstName: { type: String, default: null },
  lastName: { type: String, default: null },
  photo: { type: String, default: null },
  status: { type: String, enum: ["active", "suspended", "deleted"], default: "active" },
  clerkCreatedAt: Number,
  clerkUpdatedAt: Number,
  syncFingerprint: String,
  deletedAt: Date,
}, { timestamps: true, autoIndex: false });

const User = models.User || model("User", UserSchema);

export default User;
