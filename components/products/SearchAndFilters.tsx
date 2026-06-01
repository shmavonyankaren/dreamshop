import { Dispatch, SetStateAction } from "react";

type SearchAndFiltersProps = {
  searchQuery: string;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  category: string;
  setCategory: Dispatch<SetStateAction<string>>;
};

export default function SearchAndFilters({
  searchQuery,
  setSearchQuery,
  category,
  setCategory,
}: SearchAndFiltersProps) {
  return (
    <div className="mb-8 flex flex-col gap-4 rounded-2xl border border-edge bg-surface/80 p-4 shadow-sm backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
      <input
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search products..."
        className="w-full rounded-xl border border-accent-subtle bg-accent-faint px-4 py-3 text-sm font-medium text-body-primary outline-none transition-all placeholder:text-body-secondary focus:border-accent-ds focus:bg-surface focus:ring-2 focus:ring-accent-subtle sm:max-w-md"
      />

      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="w-full cursor-pointer rounded-xl border border-accent-subtle bg-accent-faint px-4 py-3 text-sm font-semibold text-body-tertiary outline-none transition-all focus:border-accent-ds focus:bg-surface focus:ring-2 focus:ring-accent-subtle sm:w-56"
      >
        <option value="all">All</option>
        <option value="clothes">Clothes</option>
        <option value="electronics">Electronics</option>
      </select>
    </div>
  );
}
