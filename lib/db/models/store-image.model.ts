import { Schema, model, models } from "mongoose";
const schema = new Schema({
  store: { type: Schema.Types.ObjectId, ref: "Store", required: true, index: true },
  data: { type: Buffer, required: true, select: false },
  mime: { type: String, required: true },
}, { timestamps: true, autoIndex: false, autoCreate: false });
export default models.StoreImage || model("StoreImage", schema);
