import { Document, Schema, model, Types, models } from "mongoose";

export interface ICategory extends Document {
  _id: Types.ObjectId;
  name: string;
}

const CategorySchema = new Schema({
  name: { type: String, required: true, unique: true },
}, { autoIndex: false, autoCreate: false });

const Category = models.Category || model("Category", CategorySchema);

export default Category;
