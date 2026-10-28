import { FilterSelect } from "@/components/filter-select";
import type { Messages } from "@/i18n";

/** Category, stock level and sort dropdowns above the item list. */
export function ItemFilters({
  categories,
  canSeeArchived,
  m,
}: {
  categories: { id: string; name: string }[];
  canSeeArchived: boolean;
  m: Messages;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <div className="col-span-2 sm:col-span-1">
        <FilterSelect
          param="category"
          label={m.items.filterCategory}
          defaultValue=""
          options={[
            { value: "", label: m.items.allCategories },
            ...categories.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
      </div>
      <FilterSelect
        param="stock"
        label={m.items.filterStock}
        defaultValue="all"
        options={[
          { value: "all", label: m.items.stockAll },
          { value: "low", label: m.items.stockLow },
          { value: "out", label: m.items.stockOut },
          { value: "in", label: m.items.stockIn },
          ...(canSeeArchived ? [{ value: "archived", label: m.items.showArchived }] : []),
        ]}
      />
      <FilterSelect
        param="sort"
        label={m.list.sortBy}
        defaultValue="name"
        options={[
          { value: "name", label: m.items.sortName },
          { value: "stock-asc", label: m.items.sortStockLow },
          { value: "stock-desc", label: m.items.sortStockHigh },
          { value: "recent", label: m.items.sortRecent },
        ]}
      />
    </div>
  );
}
