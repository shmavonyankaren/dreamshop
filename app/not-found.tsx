import Link from "next/link";
import { EmptyState } from "@/components/ui/foundation";
import { Button } from "@/components/ui/button";
export default function NotFoundPage() { return <div className="ds-container ds-section"><EmptyState title="Page not found" description="This page is unavailable. You can return home or explore the shop." action={<><Button asChild><Link href="/">Go home</Link></Button><Button asChild variant="outline"><Link href="/all-products">Browse products</Link></Button></>} /></div>; }
