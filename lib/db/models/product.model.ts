import { Document, Schema, model, models, Types } from "mongoose";
import "./category.model";
import "./user.model";

export interface IProduct extends Document {
  _id: Types.ObjectId;
  title: string;
  description: string;
  tags?: string[];
  createdAt: Date;
  imageUrl: string;
  price: string;
  category: Types.ObjectId;
  owner: Types.ObjectId;
  store: Types.ObjectId;
  status?: "active" | "archived";
  moderationStatus: "clear" | "held";
}

const ProductSchema = new Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  tags: { type: Array },
  createdAt: { type: Date, default: Date.now },
  imageUrl: { type: String, required: true },
  price: { type: String, required: true },
  category: { type: Schema.Types.ObjectId, ref: "Category" },
  owner: { type: Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
  store: { type: Schema.Types.ObjectId, ref: "Store", required: true, immutable: true },
  status: { type: String, enum: ["active", "archived"], default: "active" },
  moderationStatus: { type: String, enum: ["clear", "held"], default: "clear", required: true },
  moderationReason: { type: String, default: "", maxlength: 500, select: false },
  moderationRevision: { type: Number, default: 0, required: true },
}, { autoIndex: false, autoCreate: false });
ProductSchema.index({ store: 1, createdAt: -1, _id: -1 });
ProductSchema.index({ store: 1, status: 1, createdAt: -1, _id: -1 });
ProductSchema.index({ category: 1, createdAt: -1, _id: -1 });
ProductSchema.index({ owner: 1, createdAt: -1, _id: -1 });
ProductSchema.index({ status: 1, createdAt: -1, _id: -1 });
ProductSchema.index({ createdAt: -1, _id: -1 });
ProductSchema.index({ status: 1, moderationStatus: 1, createdAt: -1, _id: -1 });

const Product = models.Product || model("Product", ProductSchema);
export default Product;
