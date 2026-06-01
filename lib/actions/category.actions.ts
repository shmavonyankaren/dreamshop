"use server";

import handleError from "../utils/handleError";
import { connectDB } from "../db/connection";
import Category from "../db/models/category.model";
import type { CreateCategoryParams } from "../types";

export const createCategory = async ({
  categoryName,
}: CreateCategoryParams) => {
  try {
    await connectDB();

    const newCategory = await Category.create({ name: categoryName });

    return JSON.parse(JSON.stringify(newCategory));
  } catch (error) {
    handleError(error);
  }
};

export const getAllCategories = async () => {
  try {
    await connectDB();

    const categories = await Category.find();

    return JSON.parse(JSON.stringify(categories));
  } catch (error) {
    handleError(error);
  }
};
