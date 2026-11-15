import { LoadingIndicator, Skeleton } from "@/components/ui/foundation";
export default function LoadingPage() {
  return (
    <div className="ds-container ds-section">
      <LoadingIndicator label="Loading Dreamshop?" />
      <div
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        aria-hidden="true"
      >
        {[1, 2, 3].map((id) => (
          <Skeleton key={id} className="h-52" />
        ))}
      </div>
    </div>
  );
}
