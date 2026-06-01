import ProductsClient from "@/components/products/ProductsClient";
import { getAllProducts } from "@/lib/actions/product.action";

export default async function AllProducts() {
  const products = await getAllProducts();

  return (
    <div className="grow flex justify-center items-center p-12">
      <ProductsClient products={products || []} />
    </div>
  );
}
