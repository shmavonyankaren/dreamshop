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
