import { Schema, model, models } from "mongoose";

const UserSchema = new Schema({
  clerkId: { type: String, required: true, unique: true },
  email: { type: String, default: null },
  username: { type: String, default: null },
  firstName: { type: String, default: null },
  lastName: { type: String, default: null },
  photo: { type: String, default: null },
  status: { type: String, enum: ["active", "suspended", "deleted"], default: "active" },
  // Application policy is never sourced from Clerk profile metadata.
  applicationStatus: { type: String, enum: ["active", "suspended"], default: "active" },
  merchantStatus: { type: String, enum: ["none", "pending", "approved", "rejected", "suspended"], default: "none" },
  superAdmin: { type: Boolean, default: false },
  clerkCreatedAt: Number,
  clerkUpdatedAt: Number,
  syncFingerprint: String,
  deletedAt: Date,
}, { timestamps: true, autoIndex: false, autoCreate: false });
UserSchema.index({ createdAt: -1, _id: -1 });
UserSchema.index({ merchantStatus: 1, createdAt: -1, _id: -1 });
UserSchema.index({ status: 1, applicationStatus: 1, merchantStatus: 1 });

const User = models.User || model("User", UserSchema);

export default User;
