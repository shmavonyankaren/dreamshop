import Link from "next/link";
import { EmptyState } from "@/components/ui/foundation";
import { Button } from "@/components/ui/button";
export default function ProductNotFound() {
  return (
    <div className="ds-container ds-section">
      <EmptyState
        title="Product not found"
        description="This product may have been removed or the link may be incorrect."
        action={
          <Button asChild>
            <Link href="/all-products">Explore the catalog</Link>
          </Button>
        }
      />
    </div>
  );
}
