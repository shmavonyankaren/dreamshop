import { Schema, model, models } from "mongoose";

const StoreSchema = new Schema({
  owner: { type: Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
  name: { type: String, required: true },
  slug: { type: String, required: true, immutable: true },
  description: { type: String, required: true },
  contactEmail: { type: String, required: true },
  logo: { type: String, default: "" }, banner: { type: String, default: "" },
  status: { type: String, enum: ["active", "paused", "suspended"], default: "active" },
}, { timestamps: true, autoIndex: false, autoCreate: false });
StoreSchema.index({ owner: 1 }, { unique: true });
StoreSchema.index({ slug: 1 }, { unique: true });
StoreSchema.index({ status: 1, createdAt: -1, _id: -1 });
StoreSchema.index({ createdAt: -1, _id: -1 });
export default models.Store || model("Store", StoreSchema);
