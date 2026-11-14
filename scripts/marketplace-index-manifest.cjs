// Only indexes used by current lookup, sort and uniqueness contracts.
const index = (key, unique = false) => ({ key, ...(unique ? { unique: true } : {}) });
module.exports = {
  users: [index({ clerkId: 1 }, true), index({ createdAt: -1, _id: -1 }), index({ merchantStatus: 1, createdAt: -1, _id: -1 }), index({ status: 1, applicationStatus: 1, merchantStatus: 1 })],
  stores: [index({ owner: 1 }, true), index({ slug: 1 }, true), index({ status: 1, createdAt: -1, _id: -1 }), index({ createdAt: -1, _id: -1 })],
  products: [index({ store: 1, createdAt: -1, _id: -1 }), index({ store: 1, status: 1, createdAt: -1, _id: -1 }), index({ category: 1, createdAt: -1, _id: -1 }), index({ owner: 1, createdAt: -1, _id: -1 }), index({ status: 1, createdAt: -1, _id: -1 }), index({ createdAt: -1, _id: -1 }), index({ status: 1, moderationStatus: 1, createdAt: -1, _id: -1 })],
  categories: [index({ name: 1 }, true)], carts: [index({ user: 1 }, true)],
  // Built-in unique _id implements wishlist/application ownership and control key.
  wishlists: [], merchantapplications: [], authorization_controls: [],
  storeimages: [index({ store: 1 })],
  authorization_audits: [index({ at: -1, _id: -1 }), index({ target: 1, at: -1, _id: -1 })],
};
