import "server-only";
import { Types, type PipelineStage } from "mongoose";
import Product from "../db/models/product.model";
import { connectDB } from "../db/connection";
import { toProductDTO, type ProductRecord } from "./product-dto";
import { productIdSchema, type ProductDTO } from "../cart-contract";

export const activeOwnerFilter = { status: "active", applicationStatus: "active", merchantStatus: "approved" };
export const objectId = (id: string) => new Types.ObjectId(productIdSchema.parse(id));
export type EligibleRecord = ProductRecord & { publicStore: { name: string; slug: string } };
// One database-side policy, used for discovery, direct reads and customer writes.
export function eligibilityPipeline(filter: Record<string, unknown> = {}): PipelineStage[] {
  return [
    { $match: { $and: [filter, { status: "active", moderationStatus: "clear" }] } },
    { $lookup: { from: "stores", localField: "store", foreignField: "_id", as: "eligibleStore" } },
    { $unwind: "$eligibleStore" },
    { $match: { "eligibleStore.status": "active", $expr: { $eq: ["$owner", "$eligibleStore.owner"] } } },
    { $lookup: { from: "users", localField: "eligibleStore.owner", foreignField: "_id", as: "eligibleOwner" } },
    { $unwind: "$eligibleOwner" },
    { $match: Object.fromEntries(Object.entries(activeOwnerFilter).map(([key, value]) => [`eligibleOwner.${key}`, value])) },
  ];
}
const publicProjection: PipelineStage[] = [
  { $lookup: { from: "categories", localField: "category", foreignField: "_id", as: "eligibleCategory" } },
  { $project: { _id: 1, title: 1, description: 1, imageUrl: 1, price: 1, priceCents: 1, currency: 1, tags: 1, category: { $arrayElemAt: ["$eligibleCategory", 0] }, publicStore: { name: "$eligibleStore.name", slug: "$eligibleStore.slug" } } },
];
export async function countEligibleProducts(filter: Record<string, unknown> = {}) {
  await connectDB();
  const rows = await Product.aggregate([...eligibilityPipeline(filter), { $count: "total" }]).option({ maxTimeMS: 5000 });
  return rows[0]?.total ?? 0;
}
export async function eligibleProductRecords(filter: Record<string, unknown> = {}, options: { sort?: Record<string, 1 | -1>; skip?: number; limit?: number } = {}): Promise<EligibleRecord[]> {
  await connectDB();
  return Product.aggregate([...eligibilityPipeline(filter), { $sort: options.sort ?? { createdAt: -1, _id: -1 } }, { $skip: Math.max(0, options.skip ?? 0) }, { $limit: Math.max(1, Math.min(500, options.limit ?? 48)) }, ...publicProjection]).option({ maxTimeMS: 5000 });
}
export async function eligibleProductsByIds(ids: string[]): Promise<ProductDTO[]> {
  if (!ids.length) return [];
  const unique = [...new Set(ids)].slice(0, 500).map(objectId);
  return (await eligibleProductRecords({ _id: { $in: unique } }, { limit: unique.length })).map(toProductDTO);
}
export function toPublicListing(record: EligibleRecord) { return { ...toProductDTO(record), publicStore: { name: record.publicStore.name, slug: record.publicStore.slug } }; }
