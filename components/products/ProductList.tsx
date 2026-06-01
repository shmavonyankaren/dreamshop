import { ProductType } from "@/lib/types";
import ProductCard from "./ProductCard";

type ProductListProps = {
  products: ProductType[];
  cartItems?: Record<string, number>;
  isCartView?: boolean;
  onAdd?: (productId: string | number) => void;
  onQuantityChange?: (productId: string | number, quantity: number) => void;
  onRemove?: (productId: string | number) => void;
};

export default function ProductList({
  products,
  cartItems = {},
  isCartView = false,
  onAdd,
  onQuantityChange,
  onRemove,
}: ProductListProps) {
  return (
    <div className="grid gap-8 px-4 py-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product: ProductType) => {
        const {
          title,
          category,
          description,
          _id,
          id,
          imageUrl,
          image,
          price,
          tags,
          quantity,
        } = product;
        const productId = _id ?? id;
        const imageSrc = imageUrl ?? image ?? "";
        const idString = String(productId ?? "");
        const cartQuantity = cartItems[idString] ?? quantity ?? 0;
        const isCartItem = isCartView || cartQuantity > 0;

        return (
          <ProductCard
            key={productId}
            id={productId ?? "unknown"}
            title={title}
            category={category}
            price={price}
            image={imageSrc}
            description={description}
            tags={tags}
            quantity={cartQuantity || 1}
            isCartItem={isCartItem}
            onAdd={onAdd}
            onQuantityChange={onQuantityChange}
            onRemove={onRemove}
          />
        );
      })}
    </div>
  );
}
