"use server";

import { Types } from "mongoose";
import handleError from "../utils/handleError";
import { connectDB } from "../db/connection";
import Cart from "../db/models/cart.model";
import Product from "../db/models/product.model";

const serialize = (data: unknown) => JSON.parse(JSON.stringify(data));

const isValidObjectId = (id: string) => Types.ObjectId.isValid(id);

export const getCartByUser = async (userId: string) => {
  try {
    await connectDB();

    if (!isValidObjectId(userId)) {
      throw new Error("Invalid user ID");
    }

    const cart = await Cart.findOne({ user: userId }).populate({
      path: "items.product",
      model: Product,
      populate: [
        { path: "category", model: "Category" },
        { path: "owner", model: "User" },
      ],
    });

    return serialize(cart);
  } catch (error) {
    handleError(error);
  }
};

export const addToCart = async ({
  userId,
  productId,
  quantity = 1,
}: {
  userId: string;
  productId: string;
  quantity?: number;
}) => {
  try {
    await connectDB();

    if (!isValidObjectId(userId) || !isValidObjectId(productId)) {
      throw new Error("Invalid ID");
    }

    if (quantity < 1) {
      throw new Error("Quantity must be at least 1");
    }

    const productExists = await Product.findById(productId);

    if (!productExists) {
      throw new Error("Product not found");
    }

    let cart = await Cart.findOne({ user: userId });

    if (!cart) {
      cart = await Cart.create({
        user: userId,
        items: [{ product: productId, quantity }],
      });

      return serialize(cart);
    }

    const existingItem = cart.items.find(
      (item: any) => item.product.toString() === productId,
    );

    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      cart.items.push({ product: productId, quantity });
    }

    await cart.save();

    return serialize(cart);
  } catch (error) {
    handleError(error);
  }
};

export const mergeLocalCartToUserCart = async ({
  userId,
  items,
}: {
  userId: string;
  items: { productId: string; quantity: number }[];
}) => {
  try {
    await connectDB();

    if (!isValidObjectId(userId)) {
      throw new Error("Invalid user ID");
    }

    const normalizedItems = items
      .map((item) => ({
        productId: String(item.productId),
        quantity: Math.max(1, item.quantity ?? 1),
      }))
      .filter((item) => isValidObjectId(item.productId));

    const cart = await Cart.findOne({ user: userId });

    if (!normalizedItems.length) {
      const populated = await Cart.findOne({ user: userId }).populate({
        path: "items.product",
        model: Product,
        populate: [
          { path: "category", model: "Category" },
          { path: "owner", model: "User" },
        ],
      });
      return serialize(populated);
    }

    let updatedCart = cart;

    if (!updatedCart) {
      updatedCart = await Cart.create({
        user: userId,
        items: normalizedItems.map((item) => ({
          product: item.productId,
          quantity: item.quantity,
        })),
      });
    } else {
      normalizedItems.forEach((item) => {
        const existingItem = updatedCart?.items.find(
          (cartItem: any) => cartItem.product.toString() === item.productId,
        );

        if (existingItem) {
          existingItem.quantity += item.quantity;
        } else {
          updatedCart?.items.push({
            product: item.productId,
            quantity: item.quantity,
          });
        }
      });

      await updatedCart.save();
    }

    const populated = await Cart.findById(updatedCart._id).populate({
      path: "items.product",
      model: Product,
      populate: [
        { path: "category", model: "Category" },
        { path: "owner", model: "User" },
      ],
    });

    return serialize(populated);
  } catch (error) {
    handleError(error);
  }
};

export const updateCartItemQuantity = async ({
  userId,
  productId,
  quantity,
}: {
  userId: string;
  productId: string;
  quantity: number;
}) => {
  try {
    await connectDB();

    if (!isValidObjectId(userId) || !isValidObjectId(productId)) {
      throw new Error("Invalid ID");
    }

    if (quantity < 1) {
      throw new Error("Quantity must be at least 1");
    }

    const cart = await Cart.findOne({ user: userId });

    if (!cart) {
      throw new Error("Cart not found");
    }

    const item = cart.items.find(
      (item: any) => item.product.toString() === productId,
    );

    if (!item) {
      throw new Error("Product not found in cart");
    }

    item.quantity = quantity;

    await cart.save();

    const populated = await Cart.findById(cart._id).populate({
      path: "items.product",
      model: Product,
      populate: [
        { path: "category", model: "Category" },
        { path: "owner", model: "User" },
      ],
    });

    return serialize(populated);
  } catch (error) {
    handleError(error);
  }
};

export const removeFromCart = async ({
  userId,
  productId,
}: {
  userId: string;
  productId: string;
}) => {
  try {
    await connectDB();

    if (!isValidObjectId(userId) || !isValidObjectId(productId)) {
      throw new Error("Invalid ID");
    }

    const cart = await Cart.findOne({ user: userId });

    if (!cart) {
      throw new Error("Cart not found");
    }

    cart.items = cart.items.filter(
      (item: any) => item.product.toString() !== productId,
    );

    await cart.save();

    const populated = await Cart.findById(cart._id).populate({
      path: "items.product",
      model: Product,
      populate: [
        { path: "category", model: "Category" },
        { path: "owner", model: "User" },
      ],
    });

    return serialize(populated);
  } catch (error) {
    handleError(error);
  }
};

export const clearCart = async (userId: string) => {
  try {
    await connectDB();

    if (!isValidObjectId(userId)) {
      throw new Error("Invalid user ID");
    }

    const cart = await Cart.findOneAndUpdate(
      { user: userId },
      { items: [] },
      { new: true },
    );

    return serialize(cart);
  } catch (error) {
    handleError(error);
  }
};

export const deleteCart = async (userId: string) => {
  try {
    await connectDB();

    if (!isValidObjectId(userId)) {
      throw new Error("Invalid user ID");
    }

    const deletedCart = await Cart.findOneAndDelete({ user: userId });

    return serialize(deletedCart);
  } catch (error) {
    handleError(error);
  }
};

export const getCartItemsCount = async (userId: string) => {
  try {
    await connectDB();

    if (!isValidObjectId(userId)) {
      throw new Error("Invalid user ID");
    }

    const cart = await Cart.findOne({ user: userId });

    if (!cart) return 0;

    const count = cart.items.reduce(
      (total: number, item: any) => total + item.quantity,
      0,
    );

    return count;
  } catch (error) {
    handleError(error);
  }
};
