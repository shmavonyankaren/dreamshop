import { Skeleton } from "@/components/ui/foundation";
export default function LoadingAccount() {
  return (
    <div role="status" className="space-y-5">
      <span className="sr-only">Loading account</span>
      <Skeleton className="h-56" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    </div>
  );
}
