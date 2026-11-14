"use client";
import { useId, type ComponentProps, type ReactNode } from "react";
import { Dialog as Primitive, Tabs as TabPrimitive, Switch as SwitchPrimitive, Tooltip as Tip } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconButton } from "./foundation";

export function Dialog({ trigger, title, description, children, open, onOpenChange, drawer = false }: { trigger: ReactNode; title: string; description?: string; children: ReactNode; open?: boolean; onOpenChange?: (open: boolean) => void; drawer?: boolean }) {
  const descriptionId = useId();
  return <Primitive.Root open={open} onOpenChange={onOpenChange}><Primitive.Trigger asChild>{trigger}</Primitive.Trigger><Primitive.Portal>
    <Primitive.Overlay className="fixed inset-0 z-60 bg-black/60 backdrop-blur-sm" />
    <Primitive.Content aria-describedby={description ? descriptionId : undefined} className={cn("fixed z-70 overflow-y-auto bg-card p-6 text-card-foreground shadow-panel", drawer ? "inset-y-0 right-0 w-[min(90vw,22rem)] border-l border-border" : "left-1/2 top-1/2 max-h-[85dvh] w-[min(92vw,32rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border")}>
      <div className="mb-6 flex items-start justify-between gap-4"><div><Primitive.Title className="text-xl font-bold">{title}</Primitive.Title>{description && <Primitive.Description id={descriptionId} className="mt-2 text-sm text-muted-foreground">{description}</Primitive.Description>}</div><Primitive.Close asChild><IconButton label="Close dialog"><X aria-hidden="true" /></IconButton></Primitive.Close></div>{children}
    </Primitive.Content></Primitive.Portal></Primitive.Root>;
}
export function Drawer(props: Omit<ComponentProps<typeof Dialog>, "drawer">) { return <Dialog {...props} drawer />; }
export function Switch({ label, ...props }: ComponentProps<typeof SwitchPrimitive.Root> & { label: string }) { return <SwitchPrimitive.Root aria-label={label} className="inline-flex h-7 w-12 shrink-0 items-center rounded-full bg-input p-1 data-[state=checked]:bg-primary disabled:opacity-50" {...props}><SwitchPrimitive.Thumb className="size-5 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-5" /></SwitchPrimitive.Root>; }
export function Tooltip({ label, children }: { label: string; children: ReactNode }) { return <Tip.Provider delayDuration={300}><Tip.Root><Tip.Trigger asChild>{children}</Tip.Trigger><Tip.Portal><Tip.Content sideOffset={8} className="z-80 max-w-64 rounded-lg bg-sidebar px-3 py-2 text-sm text-sidebar-foreground shadow-panel">{label}<Tip.Arrow className="fill-sidebar" /></Tip.Content></Tip.Portal></Tip.Root></Tip.Provider>; }
export const Tabs = TabPrimitive.Root;
export function TabsList({ className, ...props }: ComponentProps<typeof TabPrimitive.List>) { return <TabPrimitive.List className={cn("flex max-w-full gap-1 overflow-x-auto rounded-xl bg-muted p-1 text-muted-foreground", className)} {...props} />; }
export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabPrimitive.Trigger>) { return <TabPrimitive.Trigger className={cn("min-h-11 shrink-0 rounded-lg px-4 text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-white", className)} {...props} />; }
export function TabsContent({ className, ...props }: ComponentProps<typeof TabPrimitive.Content>) { return <TabPrimitive.Content className={cn("mt-4", className)} {...props} />; }
