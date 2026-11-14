import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, LoaderCircle, PackageOpen, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export function Input({ className, ...props }: ComponentProps<"input">) { return <input className={cn("ds-control", className)} {...props} />; }
export function Textarea({ className, ...props }: ComponentProps<"textarea">) { return <textarea className={cn("ds-control min-h-32 resize-y", className)} {...props} />; }
export function Select({ className, ...props }: ComponentProps<"select">) { return <select className={cn("ds-control", className)} {...props} />; }
export function Checkbox({ className, ...props }: Omit<ComponentProps<"input">, "type">) { return <input type="checkbox" className={cn("size-5 shrink-0 accent-primary", className)} {...props} />; }
export function FormField({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: ReactNode }) {
  return <div className="space-y-2"><label htmlFor={id} className="block text-sm font-semibold">{label}</label>{children}
    {hint && <p id={`${id}-hint`} className="text-sm text-muted-foreground">{hint}</p>}
    {error && <p id={`${id}-error`} role="alert" className="text-sm text-destructive">{error}</p>}</div>;
}
export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "brand" | "success" | "warning" | "error"; className?: string }) {
  const tones = { neutral: "bg-secondary text-secondary-foreground", brand: "bg-accent text-accent-foreground", success: "bg-ok-bg text-ok-fg", warning: "bg-warning-bg text-warning", error: "bg-err-bg text-err-fg" };
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold", tones[tone], className)}>{children}</span>;
}
export function IconButton({ label, ...props }: ComponentProps<typeof Button> & { label: string }) { return <Button size="icon" variant="ghost" aria-label={label} {...props} />; }
export function Skeleton({ className, ...props }: ComponentProps<"div">) { return <div aria-hidden="true" className={cn("animate-pulse rounded-lg bg-muted", className)} {...props} />; }
export function LoadingIndicator({ label = "Loading…" }: { label?: string }) { return <div role="status" className="flex items-center justify-center gap-3 p-8"><LoaderCircle aria-hidden="true" className="size-5 animate-spin" /><span>{label}</span></div>; }
export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <section className="ds-panel mx-auto w-full max-w-xl px-6 py-12 text-center"><PackageOpen className="mx-auto mb-5 size-10 text-primary" aria-hidden="true" /><h2>{title}</h2><p className="mx-auto mt-3 max-w-md text-muted-foreground">{description}</p>{action && <div className="mt-6 flex flex-wrap justify-center gap-3">{action}</div>}</section>;
}
export function ErrorFeedback({ title = "Something went wrong", children, action }: { title?: string; children: ReactNode; action?: ReactNode }) {
  return <section className="ds-panel space-y-4 p-6" role="alert"><AlertCircle aria-hidden="true" className="size-6 text-destructive" /><h2 className="text-xl">{title}</h2><div className="text-sm text-muted-foreground">{children}</div>{action}</section>;
}
export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) { return <nav aria-label="Breadcrumb"><ol className="flex flex-wrap items-center gap-2 text-sm">{items.map((item, index) => <li key={`${item.label}-${index}`} className="flex items-center gap-2">{index > 0 && <ChevronRight className="size-4 opacity-60" aria-hidden="true" />}{item.href ? <Link href={item.href} className="underline-offset-4 hover:underline">{item.label}</Link> : <span aria-current="page">{item.label}</span>}</li>)}</ol></nav>; }
export function Table({ caption, children }: { caption: string; children: ReactNode }) { return <div className="max-w-full overflow-x-auto rounded-xl border border-border" role="region" aria-label={caption} tabIndex={0}><table className="w-full min-w-lg border-collapse text-left text-sm [&_th]:bg-muted [&_th]:px-4 [&_th]:py-3 [&_th]:font-semibold [&_td]:border-t [&_td]:border-border [&_td]:px-4 [&_td]:py-4"><caption className="sr-only">{caption}</caption>{children}</table></div>; }
export function Pagination({ page, totalPages, hrefForPage }: { page: number; totalPages: number; hrefForPage: (page: number) => string }) {
  return <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 text-sm">{page > 1 ? <Button asChild variant="outline"><Link href={hrefForPage(page - 1)}>Previous</Link></Button> : <Button variant="outline" disabled>Previous</Button>}<span>Page {page} of {Math.max(1, totalPages)}</span>{page < totalPages ? <Button asChild variant="outline"><Link href={hrefForPage(page + 1)}>Next</Link></Button> : <Button variant="outline" disabled>Next</Button>}</nav>;
}
