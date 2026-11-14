import Link from "next/link";
import { ArrowRight, ChevronDown, CircleHelp, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { faqGroups } from "@/lib/faq-content";
import { storefrontMetadata } from "@/lib/storefront-metadata";
export const metadata = storefrontMetadata("Help & frequently asked questions", "Answers about Dreamshop accounts, product browsing, wishlists, and carts, including features still in development.", "/faq");
export default function FAQPage() {
  return <div className="ds-container max-w-5xl space-y-6 py-6 sm:py-8">
    <section className="ds-panel p-6 sm:p-8"><span className="marketing-eyebrow"><CircleHelp className="mr-2 size-4" aria-hidden="true" />Help & Support</span><h1 className="ds-page-title mt-4">Frequently Asked <span className="text-primary">Questions</span></h1><p className="mt-3 max-w-2xl text-muted-foreground">A little clarity for your next discovery. Find out how to browse, save products, and manage your Dreamshop account.</p></section>
    <nav aria-label="FAQ topics" className="flex flex-wrap gap-2">{faqGroups.map(group => <Button key={group.id} asChild variant="outline"><Link href={'#'+group.id}>{group.title}</Link></Button>)}</nav>
    {faqGroups.map(group => <section key={group.id} id={group.id} aria-labelledby={group.id+'-title'}><h2 id={group.id+'-title'} className="mb-3 text-xl">{group.title}</h2><div className="ds-panel divide-y divide-border overflow-hidden">{group.items.map((item,index) => <details key={item.question} name={'faq-'+group.id} className="group"><summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-semibold transition-colors hover:bg-accent focus-visible:-outline-offset-4 group-open:text-primary [&::-webkit-details-marker]:hidden"><span>{item.question}</span><ChevronDown className="size-5 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" /></summary><div id={group.id+'-answer-'+index} className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground">{item.answer}</div></details>)}</div></section>)}
    <section className="ds-panel flex flex-wrap items-center justify-between gap-5 p-6"><div className="flex items-center gap-4"><span className="marketing-icon"><MessageCircle aria-hidden="true" /></span><div><h2 className="text-xl">Still have a question?</h2><p className="mt-1 text-sm text-muted-foreground">Find our contact form and available contact details.</p></div></div><Button asChild><Link href="/contact">Contact Us<ArrowRight aria-hidden="true" /></Link></Button></section>
  </div>;
}
