import { Document, Schema, model, Types, models } from "mongoose";

export interface ICartItem {
  product: Types.ObjectId;
  quantity: number;
}

export interface ICart extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  items: ICartItem[];
  createdAt: Date;
  updatedAt: Date;
}

const CartItemSchema = new Schema(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
  },
  { _id: false },
);

const CartSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    items: [CartItemSchema],
    // Kept with the cart so quantities and receipts commit in one atomic write.
    // No TTL: deleting receipts would allow old operations to be replayed.
    mergeReceipts: { type: [new Schema({
      operationId: { type: String, required: true },
      fingerprint: { type: String, required: true },
      version: { type: Number, required: true },
      outcome: { type: Schema.Types.Mixed, required: true },
    }, { _id: false })], default: [] },
  },
  { timestamps: true, autoIndex: false, autoCreate: false },
);

const Cart = models.Cart || model("Cart", CartSchema);

export default Cart;
