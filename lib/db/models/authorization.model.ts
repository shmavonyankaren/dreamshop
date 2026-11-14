import { Schema, model, models } from "mongoose";

// A shared write serializes policy decisions and category-reference mutations.
const ControlSchema = new Schema({
  _id: String,
  revision: { type: Number, default: 0 },
  bootstrapCompleted: { type: Boolean, default: false },
}, { autoIndex: false, autoCreate: false, collection: "authorization_controls" });
const AuditSchema = new Schema({
  actor: { type: String, required: true },
  target: { type: Schema.Types.ObjectId, required: true },
  action: { type: String, required: true },
  targetType: { type: String, enum: ["user", "store", "product", "category"], default: "user" },
  outcome: { type: String, enum: ["success"], default: "success" },
  before: Schema.Types.Mixed,
  after: Schema.Types.Mixed,
  reason: { type: String, required: true },
  at: { type: Date, required: true, default: Date.now },
}, { autoIndex: false, autoCreate: false, collection: "authorization_audits" });
AuditSchema.index({ at: -1, _id: -1 });
AuditSchema.index({ target: 1, at: -1, _id: -1 });
export const AuthorizationControl = models.AuthorizationControl || model("AuthorizationControl", ControlSchema);
export const AuthorizationAudit = models.AuthorizationAudit || model("AuthorizationAudit", AuditSchema);
