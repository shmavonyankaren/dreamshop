"use client";
import { ErrorFeedback } from "@/components/ui/foundation";
import { Button } from "@/components/ui/button";
export default function StoreError({ reset }: { reset: () => void }) { return <div className="ds-container py-8"><ErrorFeedback title="Unable to load this store" action={<Button onClick={reset}>Try again</Button>}>Please check your connection and try again.</ErrorFeedback></div>; }
