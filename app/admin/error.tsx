"use client";
import { ErrorFeedback } from "@/components/ui/foundation";
import { Button } from "@/components/ui/button";
export default function AdminError({ reset }: { reset: () => void }) {
  return (
    <ErrorFeedback
      title="Marketplace operations unavailable"
      action={<Button onClick={reset}>Try again</Button>}
    >
      Check your administrative access and connection, then retry.
    </ErrorFeedback>
  );
}
