"use client";
import Link from "next/link";
import { ErrorFeedback } from "@/components/ui/foundation";
import { Button } from "@/components/ui/button";
export default function MerchantError({ reset }: { reset: () => void }) { return <ErrorFeedback title="Unable to load your workspace" action={<div className="flex flex-wrap gap-3"><Button onClick={reset}>Try again</Button><Button asChild variant="outline"><Link href="/sell">Check application or store setup</Link></Button></div>}>Check your application status and store setup, or retry if your connection was interrupted.</ErrorFeedback>; }
