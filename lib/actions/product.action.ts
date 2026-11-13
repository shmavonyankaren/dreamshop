// lib/actions/product.actions.ts
"use server";

import { Types } from "mongoose";
import handleError from "../utils/handleError";
import { connectDB } from "../db/connection";
import Product from "../db/models/product.model";
import { PRODUCT_FIELDS, toProductDTO, type ProductRecord } from "../server/product-dto";

export type CreateProductParams = {
  title: string;
  description: string;
  tags?: string[];
  imageUrl: string;
  price: string;
  category: string;
  owner: string;
};

export type UpdateProductParams = {
  productId: string;
  userId: string;
  product: Partial<CreateProductParams>;
};

const serialize = (data: unknown) => JSON.parse(JSON.stringify(data));

const isValidObjectId = (id: string) => Types.ObjectId.isValid(id);

export const createProduct = async (product: CreateProductParams) => {
  try {
    await connectDB();

    const newProduct = await Product.create(product);

    return toProductDTO(newProduct);
  } catch (error) {
    handleError(error);
  }
};

export const getAllProducts = async () => {
  try {
    await connectDB();

    const products = await Product.find()
      .select(PRODUCT_FIELDS)
      .populate({ path: "category", select: "_id name" })
      .sort({ createdAt: -1 });
    return products.map((product: ProductRecord) => toProductDTO(product));
  } catch (error) {
    handleError(error);
  }
};

export const getProductById = async (productId: string) => {
  try {
    await connectDB();

    if (!isValidObjectId(productId)) {
      throw new Error("Invalid product ID");
    }

    const product = await Product.findById(productId)
      .select(PRODUCT_FIELDS)
      .populate({ path: "category", select: "_id name" });

    if (!product) {
      throw new Error("Product not found");
    }

    return toProductDTO(product);
  } catch (error) {
    handleError(error);
  }
};

export const getProductsByUser = async (userId: string) => {
  try {
    await connectDB();

    if (!isValidObjectId(userId)) {
      throw new Error("Invalid user ID");
    }

    const products = await Product.find({ owner: userId })
      .select(PRODUCT_FIELDS)
      .populate({ path: "category", select: "_id name" })
      .sort({ createdAt: -1 });

    return products.map((product: ProductRecord) => toProductDTO(product));
  } catch (error) {
    handleError(error);
  }
};

export const updateProduct = async ({
  productId,
  userId,
  product,
}: UpdateProductParams) => {
  try {
    await connectDB();

    if (!isValidObjectId(productId) || !isValidObjectId(userId)) {
      throw new Error("Invalid ID");
    }

    const productToUpdate = await Product.findById(productId);

    if (!productToUpdate) {
      throw new Error("Product not found");
    }

    if (productToUpdate.owner.toString() !== userId) {
      throw new Error("Unauthorized: You are not the owner");
    }

    const updatedProduct = await Product.findByIdAndUpdate(productId, product, {
      new: true,
    })
      .select(PRODUCT_FIELDS)
      .populate({ path: "category", select: "_id name" });

    return updatedProduct ? toProductDTO(updatedProduct) : null;
  } catch (error) {
    handleError(error);
  }
};

export const deleteProduct = async ({
  productId,
  userId,
}: {
  productId: string;
  userId: string;
}) => {
  try {
    await connectDB();

    if (!isValidObjectId(productId) || !isValidObjectId(userId)) {
      throw new Error("Invalid ID");
    }

    const product = await Product.findById(productId);

    if (!product) {
      throw new Error("Product not found");
    }

    if (product.owner.toString() !== userId) {
      throw new Error("Unauthorized: You are not the owner");
    }

    const deletedProduct = await Product.findByIdAndDelete(productId);

    return deletedProduct ? toProductDTO(deletedProduct) : null;
  } catch (error) {
    handleError(error);
  }
};

export const deleteAllProductsByUser = async (userId: string) => {
  try {
    await connectDB();

    if (!isValidObjectId(userId)) {
      throw new Error("Invalid user ID");
    }

    const result = await Product.deleteMany({ owner: userId });

    return serialize(result);
  } catch (error) {
    handleError(error);
  }
};
