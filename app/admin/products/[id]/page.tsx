import { notFound } from "next/navigation";
import { adminProductDetail } from "@/lib/server/admin-queries";
import { productIdSchema } from "@/lib/cart-contract";
import {
  AdminHero,
  AuditHistory,
  StatusBadge,
} from "@/components/admin/AdminShared";
import { ConfirmAdminAction } from "@/components/admin/AdminActions";
export default async function ModerationDetails({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!productIdSchema.safeParse(id).success) notFound();
  const product = await adminProductDetail(id);
  if (!product) notFound();
  return (
    <>
      <AdminHero
        title={product.title}
        description="Publication and moderation are independent. Only Super Admins can place or release administrative holds."
      />
      <section className="ds-panel space-y-4 p-5">
        <StatusBadge status={product.status} />
        <h2 className="text-xl">Moderation: {product.moderationStatus}</h2>
        <p className="whitespace-pre-wrap break-words">
          {product.moderationReason || "No moderation decision recorded."}
        </p>
        <ConfirmAdminAction
          kind="moderation"
          id={id}
          expectedRevision={product.moderationRevision}
          status={product.moderationStatus === "held" ? "clear" : "held"}
          label={
            product.moderationStatus === "held"
              ? "Release hold"
              : "Place on hold"
          }
          description="The reason is visible to the merchant. Releasing a hold does not restore archived publication or bypass store/owner restrictions."
        />
      </section>
      <AuditHistory rows={product.audit} />
    </>
  );
}
