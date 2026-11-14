import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
export function MarketingCard({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return <section className="ds-panel marketing-card"><span className="marketing-icon"><Icon aria-hidden="true" /></span><div className="min-w-0"><h2>{title}</h2><div className="mt-1 text-sm text-muted-foreground">{children}</div></div></section>;
}
