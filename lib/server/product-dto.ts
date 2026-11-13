import "server-only";
import type { ProductDTO } from "../cart-contract";

export const PRODUCT_FIELDS = "_id title description imageUrl price tags category";
export type ProductRecord = {
  _id: { toString(): string };
  title: string;
  description: string;
  imageUrl: string;
  price: string;
  tags?: unknown[];
  category?: { _id?: { toString(): string }; name?: string } | null;
};

export function toProductDTO(product: ProductRecord): ProductDTO {
  return {
    _id: product._id.toString(), title: product.title, description: product.description,
    imageUrl: product.imageUrl, price: product.price,
    tags: (product.tags ?? []).filter((tag): tag is string => typeof tag === "string"),
    category: product.category?._id && typeof product.category.name === "string"
      ? { _id: product.category._id.toString(), name: product.category.name } : null,
  };
}
