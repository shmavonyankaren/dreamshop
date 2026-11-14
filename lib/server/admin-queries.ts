import "server-only";
import User from "../db/models/user.model";
import Store from "../db/models/store.model";
import Product from "../db/models/product.model";
import Category from "../db/models/category.model";
import Application from "../db/models/merchant-application.model";
import { AuthorizationAudit } from "../db/models/authorization.model";
import { requireCapability } from "./authorization";
import { parseAdminQuery, literalSearch, type AdminUser, type AdminStore, type AdminAudit } from "../admin-contract";
import type { SearchParams } from "../storefront-contract";
import { productIdSchema } from "../cart-contract";
import { PRODUCT_FIELDS, toProductDTO, type ProductRecord } from "./product-dto";

type Id = { toString(): string };
type UserRecord = { _id: Id; firstName?: string; lastName?: string; username?: string; email?: string; status?: string; applicationStatus?: string; merchantStatus?: string; superAdmin?: boolean; createdAt?: Date };
const userFields = "_id firstName lastName username email status applicationStatus merchantStatus superAdmin createdAt";
const date = (value?: Date) => value?.toISOString() ?? null;
function userDTO(u: UserRecord): AdminUser { return { id: String(u._id), name: [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || "Unnamed account", email: u.email ?? null, status: u.status ?? "active", applicationStatus: u.applicationStatus ?? "active", merchantStatus: u.merchantStatus ?? "none", superAdmin: u.superAdmin === true, createdAt: date(u.createdAt) }; }
const active = { status: { $in: ["active", null] }, applicationStatus: { $in: ["active", null] } };
const sortFor = (sort: string, name = "name"): Record<string, 1 | -1> => sort === "name-asc" ? { [name]: 1, _id: 1 } : sort === "name-desc" ? { [name]: -1, _id: -1 } : { createdAt: sort === "oldest" ? 1 : -1, _id: sort === "oldest" ? 1 : -1 };
function paging(total: number, query: ReturnType<typeof parseAdminQuery>) { const totalPages = Math.max(1, Math.ceil(total / query.pageSize)); return { total, totalPages, query: { ...query, page: Math.min(query.page, totalPages) } }; }
export async function adminUsers(input: SearchParams = {}, mode: "users" | "merchants" | "applications" = "users") {
  await requireCapability("users:manage");
  const query = parseAdminQuery(input), filter: Record<string, unknown> = {};
  if (mode !== "users") filter.merchantStatus = { $in: ["pending", "approved", "rejected", "suspended"] };
  if (query.q) filter.$or = ["firstName", "lastName", "username", "email"].map(key => ({ [key]: literalSearch(query.q) }));
  if (mode !== "users" && ["pending", "approved", "rejected", "suspended"].includes(query.status)) filter.merchantStatus = query.status;
  if (mode === "users") {
    if (query.status === "active") Object.assign(filter, active);
    if (query.status === "deleted") filter.status = "deleted";
    if (query.status === "suspended") filter.$and = [{ status: { $ne: "deleted" } }, { $or: [{ status: "suspended" }, { applicationStatus: "suspended" }] }];
    if (query.role === "merchant") filter.merchantStatus = "approved";
    if (query.role === "admin") filter.superAdmin = true;
    if (query.role === "customer") { filter.superAdmin = { $ne: true }; filter.merchantStatus = { $ne: "approved" }; }
  }
  const result = paging(await User.countDocuments(filter).maxTimeMS(5000), query);
  const records = await User.find(filter).select(userFields).sort(sortFor(query.sort, "firstName")).skip((result.query.page - 1) * query.pageSize).limit(query.pageSize).maxTimeMS(5000);
  const rows = await Promise.all(records.map(async (record: UserRecord) => {
    const user = userDTO(record);
    const [store, application] = await Promise.all([Store.findOne({ owner: user.id }).select("_id owner name slug status createdAt").maxTimeMS(5000), mode === "applications" ? Application.findById(user.id).select("name description contactEmail supportingInformation createdAt").maxTimeMS(5000) : null]);
    return { ...user, store: store ? { id: String(store._id), owner: user.id, name: store.name, slug: store.slug, status: store.status, createdAt: date(store.createdAt), productCount: await Product.countDocuments({ store: store._id }).maxTimeMS(5000) } as AdminStore : null,
      application: application ? { name: application.name, description: application.description, contactEmail: application.contactEmail, supportingInformation: application.supportingInformation ?? "", createdAt: date(application.createdAt) } : null };
  }));
  return { ...result, rows };
}
export async function adminAudit(target?: string) : Promise<AdminAudit[]> {
  await requireCapability("users:manage");
  const records = await AuthorizationAudit.find(target ? { target: productIdSchema.parse(target) } : {}).select("actor target targetType action before after reason at outcome").sort({ at: -1, _id: -1 }).limit(20).maxTimeMS(5000);
  return records.map((r: { _id: Id; actor: string; target: Id; targetType?: string; action: string; before: unknown; after: unknown; reason: string; at?: Date; outcome?: string }) => ({ id: String(r._id), actor: r.actor, target: String(r.target), targetType: r.targetType ?? "user", action: r.action, before: JSON.stringify(r.before ?? null), after: JSON.stringify(r.after ?? null), reason: r.reason, at: date(r.at), outcome: r.outcome ?? "success" }));
}
export async function adminUserDetail(id: string) {
  await requireCapability("users:manage"); productIdSchema.parse(id);
  const record = await User.findById(id).select(userFields).maxTimeMS(5000);
  if (!record) return null;
  const [store, application, audit] = await Promise.all([Store.findOne({ owner: id }).select("_id owner name slug status createdAt").maxTimeMS(5000), Application.findById(id).select("name description contactEmail supportingInformation createdAt").maxTimeMS(5000), adminAudit(id)]);
  return { user: userDTO(record), store: store ? { id: String(store._id), owner: id, name: store.name, slug: store.slug, status: store.status, createdAt: date(store.createdAt), productCount: await Product.countDocuments({ store: store._id }).maxTimeMS(5000) } as AdminStore : null,
    application: application ? { name: application.name, description: application.description, contactEmail: application.contactEmail, supportingInformation: application.supportingInformation ?? "", createdAt: date(application.createdAt) } : null, audit, storeAudit: store ? await adminAudit(String(store._id)) : [] };
}
export async function adminCategories(input: SearchParams = {}) {
  await requireCapability("category:manage"); const query = parseAdminQuery(input), filter = query.q ? { name: literalSearch(query.q) } : {};
  const result = paging(await Category.countDocuments(filter).maxTimeMS(5000), query);
  const records = await Category.find(filter).select("_id name").sort({ name: query.sort === "name-desc" ? -1 : 1, _id: 1 }).skip((result.query.page - 1) * query.pageSize).limit(query.pageSize).maxTimeMS(5000);
  const rows = await Promise.all(records.map(async (c: { _id: Id; name: string }) => ({ id: String(c._id), name: c.name, productCount: await Product.countDocuments({ category: c._id }).maxTimeMS(5000) })));
  return { ...result, rows };
}
export async function adminProducts(input: SearchParams = {}) {
  await requireCapability("product:manage:any"); const query = parseAdminQuery(input), filter: Record<string, unknown> = {};
  if (query.q) filter.title = literalSearch(query.q);
  if (query.category) filter.category = query.category;
  if (["clear", "held"].includes(query.moderation)) filter.moderationStatus = query.moderation;
  if (query.merchant) filter.owner = query.merchant;
  if (query.store) filter.store = query.store;
  if (query.status === "archived") filter.status = "archived";
  if (query.status === "active") filter.status = { $in: ["active", null] };
  const result = paging(await Product.countDocuments(filter).maxTimeMS(5000), query);
  const records = await Product.find(filter).select(PRODUCT_FIELDS + " owner store status moderationStatus moderationRevision +moderationReason createdAt").populate({ path: "category", select: "_id name" }).sort(sortFor(query.sort, "title")).skip((result.query.page - 1) * query.pageSize).limit(query.pageSize).maxTimeMS(5000);
  const rows = await Promise.all(records.map(async (p: ProductRecord & { store?: Id; owner?: Id; status?: string; moderationStatus: string; moderationReason: string; moderationRevision: number; createdAt?: Date }) => {
    const store = p.store ? await Store.findById(p.store).select("name slug").maxTimeMS(5000) : null;
    return { ...toProductDTO(p), owner: p.owner ? String(p.owner) : null, store: store ? { id: String(p.store), name: store.name, slug: store.slug } : null, status: p.status ?? "active", moderationStatus: p.moderationStatus, moderationReason: p.moderationReason, moderationRevision: p.moderationRevision, createdAt: date(p.createdAt) };
  }));
  return { ...result, rows };
}
export async function adminDashboard() {
  await requireCapability("users:manage");
  const [users, activeCustomers, merchants, pending, stores, activeStores, products, archived, categories, applications, recentProducts, categoryPreview, audit, recentStores] = await Promise.all([
    User.countDocuments({}).maxTimeMS(5000), User.countDocuments(active).maxTimeMS(5000), User.countDocuments({ ...active, merchantStatus: "approved" }).maxTimeMS(5000), User.countDocuments({ status: { $ne: "deleted" }, merchantStatus: "pending" }).maxTimeMS(5000),
    Store.countDocuments({}).maxTimeMS(5000), Store.countDocuments({ status: "active" }).maxTimeMS(5000), Product.countDocuments({}).maxTimeMS(5000), Product.countDocuments({ status: "archived" }).maxTimeMS(5000), Category.countDocuments({}).maxTimeMS(5000),
    adminUsers({ status: "pending", pageSize: "4" }, "applications"), adminProducts({ pageSize: "4" }), adminCategories({ pageSize: "4" }), adminAudit(), Store.find({}).select("_id owner name slug status createdAt").sort({ createdAt: -1, _id: -1 }).limit(4).maxTimeMS(5000),
  ]);
  return { metrics: { users, activeCustomers, merchants, pending, stores, activeStores, products, archived, categories }, applications: applications.rows, products: recentProducts.rows, categories: categoryPreview.rows, audit: audit.slice(0, 6), stores: recentStores.map((s: { _id: Id; owner: Id; name: string; slug: string; status: string; createdAt?: Date }) => ({ id: String(s._id), owner: String(s.owner), name: s.name, slug: s.slug, status: s.status, createdAt: date(s.createdAt) })) };
}
export async function adminProductFilterOptions() {
  await requireCapability("product:manage:any");
  const [users, categories] = await Promise.all([User.find({ merchantStatus: "approved" }).select("_id firstName lastName username").sort({ createdAt: -1, _id: -1 }).limit(100).maxTimeMS(5000), Category.find({}).select("_id name").sort({ name: 1, _id: 1 }).limit(200).maxTimeMS(5000)]);
  return { merchants: users.map((u: UserRecord) => ({ id: String(u._id), name: userDTO(u).name })), categories: categories.map((c: { _id: Id; name: string }) => ({ id: String(c._id), name: c.name })) };
}

export async function adminProductDetail(id: string) {
  await requireCapability("product:manage:any"); productIdSchema.parse(id);
  const product = await Product.findById(id).select("title status moderationStatus moderationRevision +moderationReason").maxTimeMS(5000);
  if (!product) return null;
  return { id: String(product._id), title: product.title, status: product.status, moderationStatus: product.moderationStatus, moderationRevision: product.moderationRevision, moderationReason: product.moderationReason, audit: await adminAudit(id) };
}
