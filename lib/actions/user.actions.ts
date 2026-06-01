"use server";

import { revalidatePath } from "next/cache";
import handleError from "../utils/handleError";
import sendEmail from "../utils/sendEmail";
import type {
  CreateUserParams,
  UpdateUserParams,
  User as UserType,
} from "../types";
import { connectDB } from "../db/connection";
import User from "../db/models/user.model";
import Product from "../db/models/product.model";
import Order from "../db/models/order.model";

export async function sendContactForm(form: FormData) {
  try {
    const name = form.get("name");
    const email = form.get("email");
    const subject = form.get("subject");
    const message = form.get("message");

    sendEmail(
      name as string,
      email as string,
      subject as string,
      message as string,
    );
  } catch (error) {
    handleError(error);
  }
}

export async function createUser(user: UserType) {
  await connectDB();

  const newUser = await User.create({
    clerkId: user.clerkId,
    email: user.email,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    photo: user.photo,
  });

  return newUser;
}

// Update a user in the database when a user is updated in Clerk

export async function updateUser(
  clerkId: string,
  user: {
    firstName: string | null;
    lastName: string | null;
    username: string;
    photo: string;
  },
) {
  await connectDB();

  const updatedUser = await User.findOneAndUpdate(
    { clerkId },
    {
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      photo: user.photo,
    },
    { new: true },
  );

  return updatedUser;
}

// Delete a user in the database when a user is deleted in Clerk

export async function deleteUser(clerkId: string) {
  await connectDB();

  const deletedUser = await User.findOneAndDelete({ clerkId });
  return deletedUser;
}

//Get a user from the database by their Clerk ID

export async function getUserByClerkId(clerkId: string) {
  await connectDB();

  const user = await User.findOne({ clerkId });
  return user;
}

export async function getUserById(userId: string) {
  await connectDB();

  const user = await User.findById(userId);
  return user;
}
