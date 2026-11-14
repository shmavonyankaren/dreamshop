"use client";
import { useRef, useState } from "react";
import { Mail, Send } from "lucide-react";
import { sendContactForm } from "@/lib/actions/user.actions";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/foundation";
export default function ContactForm() {
  const [status,setStatus] = useState<'idle'|'sending'|'success'|'error'>('idle');
  const locked = useRef(false);
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if(locked.current) return;
    locked.current = true; setStatus('sending');
    const form = event.currentTarget;
    try { await sendContactForm(new FormData(form)); setStatus('success'); form.reset(); }
    catch { setStatus('error'); }
    finally { locked.current = false; }
  }
  return <section className="ds-panel contact-form"><div className="mb-5 flex items-center gap-3"><span className="marketing-icon"><Mail aria-hidden="true" /></span><div><h2>Send Us a Message</h2><p className="mt-1 text-sm text-muted-foreground">Fill out the form below to get in touch.</p></div></div>
    {status==='success' && <p role="status" className="mb-4 rounded-lg bg-ok-bg p-3 text-sm text-ok-fg">Your message has been submitted.</p>}
    {status==='error' && <p role="alert" className="mb-4 rounded-lg bg-err-bg p-3 text-sm text-err-fg">We could not submit your message. Please try again or use email.</p>}
    <form onSubmit={handleSubmit} className="contact-form-grid" aria-busy={status==='sending'}>
      <div><label htmlFor="contact-name">Name <span className="text-primary">*</span></label><Input id="contact-name" name="name" autoComplete="name" placeholder="Enter your full name" required /></div>
      <div><label htmlFor="contact-email">Email <span className="text-primary">*</span></label><Input id="contact-email" name="email" type="email" autoComplete="email" placeholder="Enter your email address" required /></div>
      <div className="sm:col-span-2"><label htmlFor="contact-subject">Subject <span className="text-primary">*</span></label><Input id="contact-subject" name="subject" placeholder="How can we help?" required /></div>
      <div className="sm:col-span-2"><label htmlFor="contact-message">Message <span className="text-primary">*</span></label><Textarea id="contact-message" name="message" placeholder="Tell us how we can help?" rows={6} required /></div>
      <Button type="submit" disabled={status==='sending'} className="sm:col-span-2"><Send aria-hidden="true" />{status==='sending'?'Submitting?':'Submit Message'}</Button>
    </form>
  </section>;
}
