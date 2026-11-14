import { Schema, model, models } from "mongoose";
// The user ID is the document key: MongoDB's built-in unique _id index
// prevents duplicate wishlists, including concurrent first additions.
const WishlistSchema = new Schema({
  _id: { type: Schema.Types.ObjectId, ref: "User", required: true },
  products: [{ type: Schema.Types.ObjectId, ref: "Product" }],
}, { versionKey: false, autoIndex: false, autoCreate: false });
export default models.Wishlist || model("Wishlist", WishlistSchema);
