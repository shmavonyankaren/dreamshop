"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/interactive";
import { Button } from "@/components/ui/button";
import { FormField, Input, Textarea } from "@/components/ui/foundation";
import { reviewMerchantApplication } from "@/lib/actions/merchant.actions";
import {
  changeAccountStatus,
  changeStoreStatus,
  changeAdminProductStatus,
  changeProductModeration,
} from "@/lib/actions/admin.actions";
import {
  createCategory,
  updateCategory,
  deleteCategory,
} from "@/lib/actions/category.actions";
export function ConfirmAdminAction({
  kind,
  id,
  status,
  expectedStatus,
  expectedRevision,
  label,
  description,
}: {
  kind:
    | "merchant"
    | "account"
    | "store"
    | "product"
    | "moderation"
    | "category-delete";
  id: string;
  status?: string;
  expectedStatus?: string;
  expectedRevision?: number;
  label: string;
  description: string;
}) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const router = useRouter();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const reason = String(new FormData(e.currentTarget).get("reason"));
    setBusy(true);
    setMessage("");
    try {
      const payload = { id, status, expectedStatus, reason };
      const result =
        kind === "merchant"
          ? await reviewMerchantApplication({
              userId: id,
              status,
              expectedStatus,
              reason,
            })
          : kind === "account"
            ? await changeAccountStatus({
                userId: id,
                status,
                expectedStatus,
                reason,
              })
            : kind === "store"
              ? await changeStoreStatus(payload)
              : kind === "moderation"
                ? await changeProductModeration({
                    id,
                    status,
                    expectedRevision,
                    reason,
                  })
                : kind === "product"
                  ? await changeAdminProductStatus(payload)
                  : await deleteCategory({ categoryId: id });
      if (!result.ok) {
        setMessage(result.error.message);
        return;
      }
      setMessage("Saved successfully.");
      setOpen(false);
      router.refresh();
    } catch {
      setMessage("Unable to complete this operation. Please retry.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!busy) setOpen(value);
        }}
        title={label}
        description={description}
        trigger={
          <Button variant="outline" onClick={() => setMessage("")}>
            {label}
          </Button>
        }
      >
        <form onSubmit={submit} className="space-y-4">
          {kind !== "category-delete" && (
            <FormField
              id={`${kind}-${id}-${status}-reason`}
              label="Reason for this change"
              hint="Recorded in the administrative audit. Do not include sensitive personal information."
            >
              <Textarea
                id={`${kind}-${id}-${status}-reason`}
                name="reason"
                required
                minLength={3}
                maxLength={500}
                disabled={busy}
              />
            </FormField>
          )}
          <p role="alert" className="text-sm text-destructive">
            {message}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Confirm change"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Dialog>
      {!open && (
        <p role="status" className="text-xs">
          {message}
        </p>
      )}
    </div>
  );
}
export function CategoryEditor({
  category,
}: {
  category?: { id: string; name: string };
}) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const router = useRouter();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const categoryName = String(new FormData(e.currentTarget).get("name"));
    setBusy(true);
    setMessage("");
    try {
      const result = category
        ? await updateCategory({ categoryId: category.id, categoryName })
        : await createCategory({ categoryName });
      if (!result.ok) {
        setMessage(result.error.message);
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setMessage("Unable to save category. Please retry.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) {
          setOpen(value);
          setMessage("");
        }
      }}
      title={category ? "Edit category" : "Create category"}
      description="Categories organize products across the marketplace."
      trigger={
        <Button variant={category ? "outline" : "default"}>
          {category ? "Edit" : "+ Create category"}
        </Button>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <FormField
          id={`category-${category?.id ?? "new"}`}
          label="Category name"
        >
          <Input
            id={`category-${category?.id ?? "new"}`}
            name="name"
            required
            maxLength={100}
            defaultValue={category?.name}
            disabled={busy}
          />
        </FormField>
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
        <Button disabled={busy}>{busy ? "Saving…" : "Save category"}</Button>
      </form>
    </Dialog>
  );
}
