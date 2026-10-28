"use client";

import { PackagePlusIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FormField } from "@/components/form/form-field";
import { FreshForm } from "@/components/form/fresh-form";
import { MoneyInput } from "@/components/form/money-input";
import { SubmitButton } from "@/components/form/submit-button";
import { useServerForm } from "@/components/form/use-server-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { PickerItem } from "@/features/items/actions";
import { ItemPicker } from "@/features/items/components/item-picker";
import { format } from "@/i18n";
import { useMessages } from "@/i18n/provider";
import { formatINR, paiseToInput, rupeesToPaise } from "@/lib/money";
import { lineTotalPaise, parseQty } from "@/lib/qty";
import { createStockEntryAction } from "../actions";
import { stockEntrySchema } from "../schemas";

type Line = { key: number; item: PickerItem | null; quantity: string; unitCost: string };

let nextKey = 1;
const emptyLine = (): Line => ({ key: nextKey++, item: null, quantity: "", unitCost: "" });

/** Value of one line, or null while it's incomplete. */
function lineValue(line: Line): number | null {
  if (!line.item) return null;
  const qty = parseQty(line.quantity, { allowDecimal: line.item.allowsDecimal });
  const cost = rupeesToPaise(line.unitCost);
  return qty !== null && cost !== null ? lineTotalPaise(qty, cost) : null;
}

export function StockInForm() {
  return <FreshForm>{(onSaved) => <StockInFormBody onSaved={onSaved} />}</FreshForm>;
}

function StockInFormBody({ onSaved }: { onSaved: () => void }) {
  const m = useMessages();
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>(() => [emptyLine()]);
  const [focusLine, setFocusLine] = useState<number | null>(null);
  const saved = useRef(false);
  const qtyRefs = useRef(new Map<number, HTMLInputElement>());

  const { pending, errorFor, clearErrors, formProps } = useServerForm<{ id: string } | undefined>(
    createStockEntryAction,
    {
      schema: stockEntrySchema,
      onSuccess: (result) => {
        saved.current = true;
        router.push(result.data ? `/stock/${result.data.id}` : "/items");
        onSaved();
      },
    },
  );

  // Warn before closing the tab with unsaved lines (people get interrupted in the godown).
  const dirty = lines.some((l) => l.item);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      if (!saved.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const update = (key: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const pick = (index: number, line: Line, item: PickerItem | null) => {
    clearErrors((name) => name === `lines.${index}.itemId`);
    const patch: Partial<Line> = { item };
    // The owner gets the last cost pre-filled; staff type it from the bill.
    if (item && !line.unitCost && item.lastCostPaise != null)
      patch.unitCost = paiseToInput(item.lastCostPaise);
    update(line.key, patch);
    // Move on to the quantity box, unless the person already tapped somewhere else.
    if (item) {
      requestAnimationFrame(() => {
        const active = document.activeElement;
        if (!active || active === document.body) qtyRefs.current.get(line.key)?.focus();
      });
    }
  };

  const addLine = () => {
    const line = emptyLine();
    setLines((prev) => [...prev, line]);
    setFocusLine(line.key);
  };

  const removeLine = (key: number) => {
    // Line numbers shift, so old line errors no longer point at the right row.
    clearErrors((name) => name.startsWith("lines."));
    setLines((prev) => prev.filter((l) => l.key !== key));
  };

  const filled = lines.filter((l) => l.item);
  const total = lines.reduce((sum, l) => sum + (lineValue(l) ?? 0), 0);
  const payload = JSON.stringify(
    lines.map((l) => ({ itemId: l.item?.id ?? "", quantity: l.quantity, unitCost: l.unitCost })),
  );

  return (
    <form {...formProps} className="flex max-w-3xl flex-col gap-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          name="reference"
          label={m.stock.reference}
          optionalLabel={m.common.optional}
          error={errorFor("reference")}
        >
          {(p) => <Input {...p} placeholder={m.stock.referencePlaceholder} autoComplete="off" />}
        </FormField>
        <FormField
          name="note"
          label={m.stock.note}
          optionalLabel={m.common.optional}
          error={errorFor("note")}
        >
          {(p) => (
            <Textarea {...p} placeholder={m.stock.notePlaceholder} rows={1} className="min-h-11" />
          )}
        </FormField>
      </div>

      <section aria-labelledby="lines-heading" className="flex flex-col gap-3">
        <h2 id="lines-heading" className="text-xl font-bold">
          {m.stock.lines}
        </h2>
        {errorFor("lines") && (
          <p role="alert" className="font-medium text-destructive">
            {errorFor("lines")}
          </p>
        )}
        <ol className="flex flex-col gap-3">
          {lines.map((line, index) => {
            const value = lineValue(line);
            const unit = line.item?.unitName ?? "";
            return (
              <li key={line.key} className="rounded-xl border bg-card p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-muted-foreground">
                    {format(m.stock.lineNumber, { n: index + 1 })}
                  </span>
                  {lines.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeLine(line.key)}
                      aria-label={`${m.stock.removeLine} (${format(m.stock.lineNumber, { n: index + 1 })})`}
                    >
                      <Trash2Icon aria-hidden />
                    </Button>
                  )}
                </div>
                <div className="flex flex-col gap-4">
                  <ItemPicker
                    label={m.stock.item}
                    value={line.item}
                    onChange={(item) => pick(index, line, item)}
                    error={errorFor(`lines.${index}.itemId`)}
                    autoFocus={focusLine === line.key || (index === 0 && lines.length === 1)}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      name={`lines.${index}.quantity`}
                      label={unit ? `${m.stock.quantity} (${unit})` : m.stock.quantity}
                      error={errorFor(`lines.${index}.quantity`)}
                    >
                      {(p) => (
                        <Input
                          {...p}
                          ref={(el) => {
                            if (el) qtyRefs.current.set(line.key, el);
                            else qtyRefs.current.delete(line.key);
                          }}
                          value={line.quantity}
                          onChange={(e) => update(line.key, { quantity: e.target.value })}
                          inputMode={line.item?.allowsDecimal ? "decimal" : "numeric"}
                          autoComplete="off"
                        />
                      )}
                    </FormField>
                    <FormField
                      name={`lines.${index}.unitCost`}
                      label={unit ? format(m.stock.unitCost, { unit }) : m.stock.unitCostShort}
                      error={errorFor(`lines.${index}.unitCost`)}
                    >
                      {(p) => (
                        <MoneyInput
                          {...p}
                          value={line.unitCost}
                          onChange={(e) => update(line.key, { unitCost: e.target.value })}
                          onKeyDown={(e) => {
                            // Desktop data entry: Enter on the last line starts a new line.
                            if (e.key === "Enter" && index === lines.length - 1) {
                              e.preventDefault();
                              e.stopPropagation();
                              addLine();
                            }
                          }}
                          placeholder="0.00"
                        />
                      )}
                    </FormField>
                  </div>
                  {value !== null && (
                    <p className="text-right text-sm text-muted-foreground">
                      {m.stock.lineTotal}:{" "}
                      <span className="font-semibold text-foreground">{formatINR(value)}</span>
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={addLine}
          className="w-full sm:w-fit"
        >
          <PlusIcon aria-hidden />
          {m.stock.addLine}
        </Button>
      </section>

      <input type="hidden" name="lines" value={payload} />

      <div className="sticky bottom-20 z-10 flex flex-col gap-3 rounded-xl border bg-background p-4 shadow-md sm:flex-row sm:items-center sm:justify-between md:bottom-4">
        <p className="text-base" aria-live="polite">
          {format(m.stock.totals, { count: filled.length, total: formatINR(total) })}
        </p>
        <SubmitButton
          pending={pending}
          label={m.stock.save}
          pendingLabel={m.stock.saving}
          icon={<PackagePlusIcon aria-hidden />}
          className="w-full sm:w-auto"
        />
      </div>
    </form>
  );
}
