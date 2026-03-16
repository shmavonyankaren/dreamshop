"use server";

import { User } from "@/types";
import { connectDB } from "../db";
import UserModel from "../db/models/user.model";

// Create a user in the database when a user is created in Clerk

export async function createUser(user: User) {
  await connectDB();

  const newUser = await UserModel.create({
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

  const updatedUser = await UserModel.findOneAndUpdate(
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

  const deletedUser = await UserModel.findOneAndDelete({ clerkId });
  return deletedUser;
}

//Get a user from the database by their Clerk ID

export async function getUserByClerkId(clerkId: string) {
  await connectDB();

  const user = await UserModel.findOne({ clerkId });
  return user;
}

export async function getUserById(userId: string) {
  await connectDB();

  const user = await UserModel.findById(userId);
  return user;
}
