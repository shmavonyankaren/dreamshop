import { formatPrice } from "@/lib/money";
import Image from "next/image";
import { Minus, Plus, Trash2 } from "lucide-react";
import AddCartButton from "./AddCartButton";

type ProductCardProps = {
  id: string | number;
  title: string;
  category: string | { _id?: string; name?: string } | null;
  price: string;
  priceCents?: number;
  currency?: string;
  description: string;
  image: string;
  tags: string[];
  quantity?: number;
  isCartItem?: boolean;
  onAdd?: (productId: string | number) => void | Promise<void>;
  onQuantityChange?: (productId: string | number, quantity: number) => void;
  onRemove?: (productId: string | number) => void;
  accentColor?: string;
  tagColor?: string;
};

export default function ProductCard({
  id,
  title,
  category,
  price,
  priceCents,
  currency,
  description,
  image,
  tags,
  quantity = 1,
  isCartItem = false,
  onAdd,
  onQuantityChange,
  onRemove,
}: ProductCardProps) {
  const categoryLabel =
    typeof category === "string"
      ? category
      : (category?.name ?? String(category?._id ?? "Unknown"));
  const handleDecrease = () => {
    if (!onQuantityChange) return;
    if (quantity > 1) {
      onQuantityChange(id, quantity - 1);
    }
  };

  const handleIncrease = () => {
    if (!onQuantityChange) return;
    onQuantityChange(id, quantity + 1);
  };

  const handleRemove = () => {
    if (!onRemove) return;
    onRemove(id);
  };

  return (
    <section className="group w-full max-w-92 rounded-[2.5rem] border border-edge bg-surface p-4 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
      <div className="cursor-pointer relative">
        <div className="overflow-hidden rounded-[1.75rem]">
          <Image
            src={image}
            alt={title}
            width={400}
            height={400}
            className="aspect-square w-full object-cover grayscale brightness-75 transition-all duration-500 group-hover:grayscale-0 group-hover:brightness-100"
          />
        </div>

        <span className="absolute left-0 top-0 rounded-br-2xl bg-surface px-6 py-4 text-sm font-medium text-body-tertiary shadow-md">
          {categoryLabel}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-[1fr_auto] items-center gap-4">
        <h2 className="text-xl font-extrabold text-body-primary">{title}</h2>
        <p className="rounded-full bg-badge-accent-bg px-4 py-1 text-sm font-bold text-badge-accent-fg">
          {formatPrice({ price, priceCents, currency })}
        </p>
      </div>
      <p className="mt-3 line-clamp-3 text-[15px] leading-7 text-body-tertiary">
        {description}
      </p>
      <ul className="mt-5 flex flex-wrap gap-2">
        {tags.map((tag) => (
          <li
            key={tag}
            className="rounded-full bg-badge-brand-bg px-3 py-1 text-xs font-medium text-badge-brand-fg"
          >
            {tag}
          </li>
        ))}
      </ul>

      {isCartItem ? (
        <div className="mt-6 h-12 flex gap-3 ">
          <div className="flex w-4/5 items-center justify-between rounded-3xl border border-edge bg-surface-muted px-4 py-3 text-sm text-body-tertiary dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <span className="font-medium">Quantity</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDecrease}
                disabled={quantity <= 1}
                className="cursor-pointer inline-flex h-9 w-9 items-center justify-center rounded-full border border-edge-strong bg-surface text-body-primary transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="min-w-8 text-center text-lg font-semibold">
                {quantity}
              </span>
              <button
                type="button"
                onClick={handleIncrease}
                className="cursor-pointer inline-flex h-9 w-9 items-center justify-center rounded-full border border-edge-strong bg-surface text-body-primary transition hover:bg-surface-muted dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="inline-flex  items-center aspect-square cursor-pointer justify-center gap-2 rounded-3xl bg-err-bg text-sm font-semibold text-err-fg transition hover:bg-err-edge"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <AddCartButton productId={id} onAdd={onAdd} />
      )}
    </section>
  );
}
