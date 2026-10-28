"use client";

import { MinusIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useId } from "react";
import { MoneyInput } from "@/components/form/money-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "@/i18n";
import { useMessages } from "@/i18n/provider";
import { formatINR, rupeesToPaise } from "@/lib/money";
import { formatQty, lineTotalPaise, parseQty } from "@/lib/qty";
import { cn } from "@/lib/utils";
import type { DraftLine, Shortage } from "../data";

export type CartLineState = DraftLine & { qtyText: string; priceText: string; error?: string };

export function parseLine(line: CartLineState) {
  const qtyMilli = parseQty(line.qtyText, { allowDecimal: line.allowsDecimal });
  const pricePaise = line.priceText.trim() === "" ? null : rupeesToPaise(line.priceText);
  return { qtyMilli: qtyMilli && qtyMilli > 0 ? qtyMilli : null, pricePaise };
}

export function CartLine({
  line,
  shortage,
  flagged,
  onQuantity,
  onStep,
  onPrice,
  onUseAvailable,
  onRemove,
}: {
  line: CartLineState;
  shortage?: Shortage;
  /** Marked by the last checkout attempt (no price, archived…). */
  flagged: boolean;
  onQuantity: (text: string) => void;
  onStep: (delta: 1 | -1) => void;
  onPrice: (text: string) => void;
  onUseAvailable: () => void;
  onRemove: () => void;
}) {
  const m = useMessages();
  const id = useId();
  const unit = line.unitName;
  const { qtyMilli, pricePaise } = parseLine(line);
  const total =
    qtyMilli !== null && pricePaise !== null ? lineTotalPaise(qtyMilli, pricePaise) : null;
  const short = shortage ?? (qtyMilli !== null && qtyMilli > line.stockMilli ? true : undefined);

  const warnings: { text: string; tone: "warn" | "error" }[] = [];
  if (line.archived) warnings.push({ text: m.orders.itemArchived, tone: "error" });
  if (pricePaise === null && line.priceText.trim() === "") {
    warnings.push({ text: m.orders.noPriceYet, tone: flagged ? "error" : "warn" });
  }
  if (pricePaise !== null && line.mrpPaise !== null && pricePaise > line.mrpPaise) {
    warnings.push({
      text: format(m.orders.aboveMrp, { mrp: formatINR(line.mrpPaise) }),
      tone: "warn",
    });
  }
  if (
    pricePaise !== null &&
    line.avgCostPaise !== null &&
    line.avgCostPaise > 0 &&
    pricePaise < line.avgCostPaise
  ) {
    warnings.push({
      text: format(m.orders.belowCost, { cost: formatINR(line.avgCostPaise) }),
      tone: "warn",
    });
  }

  return (
    <li
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-card p-4",
        (shortage || flagged || line.error) && "border-destructive ring-2 ring-destructive/20",
      )}
    >
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="line-clamp-2 text-lg font-semibold break-words">
            {line.label}
            {line.archived && (
              <Badge variant="destructive" className="ml-2 align-middle">
                {m.orders.archivedTag}
              </Badge>
            )}
          </span>
          <span className="text-sm text-muted-foreground">
            {[line.packSize, line.sku].filter(Boolean).join(" · ")}
            {line.mrpPaise !== null &&
              ` · ${format(m.orders.mrpNote, { mrp: formatINR(line.mrpPaise) })}`}
          </span>
          <span
            className={cn(
              "text-sm",
              short ? "font-semibold text-destructive" : "text-muted-foreground",
            )}
          >
            {short
              ? format(m.orders.onlyInStock, { stock: `${formatQty(line.stockMilli)} ${unit}` })
              : format(m.orders.inStock, { stock: `${formatQty(line.stockMilli)} ${unit}` })}
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          aria-label={format(m.orders.remove, { name: line.label })}
        >
          <Trash2Icon aria-hidden />
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[auto_1fr]">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-qty`} className="text-sm font-medium">
            {format(m.orders.quantity, { unit })}
          </label>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => onStep(-1)}
              aria-label={format(m.orders.decrease, { name: line.label })}
            >
              <MinusIcon aria-hidden />
            </Button>
            <Input
              id={`${id}-qty`}
              value={line.qtyText}
              onChange={(e) => onQuantity(e.target.value)}
              inputMode={line.allowsDecimal ? "decimal" : "numeric"}
              autoComplete="off"
              className="w-24 text-center text-lg"
              aria-invalid={short || line.error ? true : undefined}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => onStep(1)}
              aria-label={format(m.orders.increase, { name: line.label })}
            >
              <PlusIcon aria-hidden />
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-price`} className="text-sm font-medium">
            {format(m.orders.price, { unit })}
          </label>
          <MoneyInput
            id={`${id}-price`}
            value={line.priceText}
            onChange={(e) => onPrice(e.target.value)}
            placeholder="0.00"
            aria-invalid={flagged && pricePaise === null ? true : undefined}
          />
        </div>
      </div>

      {shortage && (
        <div className="flex flex-wrap items-center gap-2" role="alert">
          <span className="text-sm font-medium text-destructive">
            {format(m.orders.shortLine, {
              name: line.label,
              wanted: `${formatQty(shortage.wantedMilli)} ${unit}`,
              available: `${formatQty(shortage.availableMilli)} ${unit}`,
            })}
          </span>
          {shortage.availableMilli > 0 && (
            <Button type="button" size="sm" variant="outline" onClick={onUseAvailable}>
              {format(m.orders.useAvailable, {
                available: `${formatQty(shortage.availableMilli)} ${unit}`,
              })}
            </Button>
          )}
        </div>
      )}
      {line.error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {line.error}
        </p>
      )}
      {warnings.map((w) => (
        <p
          key={w.text}
          className={cn(
            "rounded-md px-2 py-1 text-sm",
            w.tone === "error"
              ? "bg-destructive/10 font-medium text-destructive"
              : "bg-warning/20 text-foreground",
          )}
        >
          {w.text}
        </p>
      ))}

      <p className="text-right text-base">
        {m.orders.lineTotal}:{" "}
        <span className="text-lg font-bold">{total !== null ? formatINR(total) : "—"}</span>
      </p>
    </li>
  );
}
