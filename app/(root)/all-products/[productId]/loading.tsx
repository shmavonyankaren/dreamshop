import { Skeleton } from "@/components/ui/foundation";
export default function LoadingProduct() {
  return (
    <div className="ds-container space-y-6 py-8" role="status">
      <span className="sr-only">Loading product details</span>
      <Skeleton className="h-5 w-48" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="aspect-square" />
        <div className="ds-panel space-y-6 p-8">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-32" />
          <Skeleton className="h-12" />
        </div>
      </div>
    </div>
  );
}
