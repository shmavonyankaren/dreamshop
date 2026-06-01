export type ProductType = {
  _id?: string;
  id?: string | number;
  title: string;
  category: string | { _id?: string; name?: string } | null;
  price: string;
  image?: string;
  imageUrl?: string;
  description: string;
  tags: string[];
  quantity?: number;
};

export type CreateCategoryParams = {
  categoryName: string;
};

export type CreateUserParams = {
  clerkId: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  photo: string;
};

export type UpdateUserParams = {
  firstName: string;
  lastName: string;
  username: string;
  photo: string;
};

export type User = {
  clerkId: string;
  email: string;
  username: string;
  firstName: string | null;
  lastName?: string | null;
  photo?: string | null;
};
