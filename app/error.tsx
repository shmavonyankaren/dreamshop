"use client";
import { useRouter } from "next/navigation";
import { startTransition } from "react";
import { ErrorFeedback } from "@/components/ui/foundation";
import { Button } from "@/components/ui/button";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  return (
    <div className="ds-container ds-section max-w-xl">
      <ErrorFeedback
        title="We couldn't load this page"
        action={
          <Button
            onClick={() =>
              startTransition(() => {
                router.refresh();
                reset();
              })
            }
          >
            Try again
          </Button>
        }
      >
        Please try again. If the problem continues, return to the shop and try
        again later.
      </ErrorFeedback>
    </div>
  );
}
