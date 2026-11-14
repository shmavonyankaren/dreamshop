import { Schema, model, models } from "mongoose";
// One application per account; approval remains exclusively on User.merchantStatus.
const schema = new Schema({
  _id: { type: Schema.Types.ObjectId, ref: "User" },
  name: String, description: String, contactEmail: String, supportingInformation: String,
}, { timestamps: true, autoIndex: false, autoCreate: false });
export default models.MerchantApplication || model("MerchantApplication", schema);
