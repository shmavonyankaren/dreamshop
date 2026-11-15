"use client";
import { useId, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MAX_QUANTITY } from "@/lib/cart-contract";
export function QuantityControl({
  quantity,
  title,
  disabled = false,
  pending = false,
  unavailable = false,
  onStep,
  onCommit,
}: {
  quantity: number;
  title: string;
  disabled?: boolean;
  pending?: boolean;
  unavailable?: boolean;
  onStep: (delta: -1 | 1) => void;
  onCommit: (quantity: number, expectedQuantity: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null),
    [error, setError] = useState("");
  const editing = useRef<{ text: string; baseline: number } | null>(null);
  const messageId = useId();
  function commit() {
    const edit = editing.current;
    if (!edit) return;
    editing.current = null;
    setDraft(null);
    if (disabled) return;
    if (!/^[1-9][0-9]?$/.test(edit.text)) {
      setError("Enter a whole quantity from 1 to 99.");
      return;
    }
    const next = Number(edit.text);
    if (unavailable && next > quantity) {
      setError(
        "This item is unavailable. You can reduce its quantity or remove it.",
      );
      return;
    }
    setError("");
    if (next !== edit.baseline) onCommit(next, edit.baseline);
  }
  const buttonClass =
    "select-none touch-manipulation disabled:pointer-events-auto disabled:cursor-not-allowed  disabled:opacity-50 disabled:hover:bg-transparent";
  return (
    <div className="space-y-2">
      <div
        role="group"
        aria-label={`Cart quantity for ${title}`}
        aria-busy={pending || disabled}
        className="inline-flex select-none items-center rounded-xl border border-input bg-card"
      >
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className={buttonClass}
          disabled={disabled || quantity <= 1}
          aria-label={`Decrease quantity of ${title}`}
          onClick={() => {
            editing.current = null;
            setDraft(null);
            setError("");
            onStep(-1);
          }}
        >
          <Minus aria-hidden="true" />
        </Button>
        <input
          type="text"
          inputMode="numeric"
          pattern="[1-9][0-9]?"
          maxLength={3}
          aria-label={`Quantity of ${title}`}
          aria-invalid={!!error}
          aria-describedby={error ? messageId : undefined}
          value={draft ?? String(quantity)}
          disabled={disabled}
          onFocus={() => {
            editing.current = { text: String(quantity), baseline: quantity };
          }}
          onChange={(event) => {
            const edit = editing.current ?? {
              text: String(quantity),
              baseline: quantity,
            };
            editing.current = { ...edit, text: event.target.value };
            setDraft(event.target.value);
            setError("");
          }}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
            }
            if (event.key === "Escape") {
              editing.current = null;
              setDraft(null);
              setError("");
            }
          }}
          className="min-h-11 w-12 select-text rounded-md bg-transparent text-center tabular-nums outline-none disabled:cursor-default"
        />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className={buttonClass}
          disabled={disabled || unavailable || quantity >= MAX_QUANTITY}
          aria-label={`Increase quantity of ${title}`}
          onClick={() => {
            editing.current = null;
            setDraft(null);
            setError("");
            onStep(1);
          }}
        >
          <Plus aria-hidden="true" />
        </Button>
      </div>
      {error && (
        <p id={messageId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
