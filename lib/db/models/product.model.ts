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
}

const ProductSchema = new Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  tags: { type: Array },
  createdAt: { type: Date, default: Date.now },
  imageUrl: { type: String, required: true },
  price: { type: String, required: true },
  category: { type: Schema.Types.ObjectId, ref: "Category" },
  owner: { type: Schema.Types.ObjectId, ref: "User" },
});

const Product = models.Product || model("Product", ProductSchema);
export default Product;
