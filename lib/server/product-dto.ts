import "server-only";
import { hasPrice, priceInput } from "../money";
import type { ProductDTO } from "../cart-contract";

export const PRODUCT_FIELDS = "_id title description imageUrl price priceCents currency tags category";
export type ProductRecord = {
  _id: { toString(): string };
  title: string;
  description: string;
  imageUrl: string;
  price: string;
  priceCents?: number;
  currency?: string;
  tags?: unknown[];
  category?: { _id?: { toString(): string }; name?: string } | null;
};

export function toProductDTO(product: ProductRecord): ProductDTO {
  return {
    _id: product._id.toString(), title: product.title, description: product.description,
    imageUrl: product.imageUrl, price: hasPrice(product) ? priceInput(product.priceCents, product.currency) : (product.price ?? ""),
    ...(product.currency !== undefined ? { currency: product.currency } : {}),
    ...(product.priceCents !== undefined ? { priceCents: product.priceCents } : {}),
    tags: (product.tags ?? []).filter((tag): tag is string => typeof tag === "string"),
    category: product.category?._id && typeof product.category.name === "string"
      ? { _id: product.category._id.toString(), name: product.category.name } : null,
  };
}
