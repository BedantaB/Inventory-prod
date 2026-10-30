"use client";

import {
  CheckCircle2Icon,
  CloudIcon,
  Loader2Icon,
  ShoppingCartIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/confirm-action";
import { EmptyState } from "@/components/empty-state";
import { MoneyInput } from "@/components/form/money-input";
import { SearchCombobox } from "@/components/search-combobox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PickerItem } from "@/features/items/actions";
import { searchItemsAction } from "@/features/items/actions";
import { ItemOption } from "@/features/items/components/item-picker";
import { format } from "@/i18n";
import { useMessages, useT } from "@/i18n/provider";
import { formatINR, paiseToInput, rupeesToPaise } from "@/lib/money";
import { qtyToInput, QTY_SCALE } from "@/lib/qty";
import { cn } from "@/lib/utils";
import {
  addItemAction,
  checkoutAction,
  discardOrderAction,
  removeLineAction,
  setCustomerAction,
  setDiscountAction,
  updateLineAction,
} from "../actions";
import { PAYMENT_METHODS, type PaymentMethod } from "@/features/payments/schemas";
import type { DraftLine, DraftView, Shortage } from "../data";
import { orderTotals, parsePercent, percentToInput, type DiscountKind } from "../totals";
import { CartLine, parseLine, type CartLineState } from "./cart-line";
import { CustomerSection, type CartCustomer } from "./customer-section";

const SAVE_DELAY_MS = 500;

const toState = (line: DraftLine): CartLineState => ({
  ...line,
  qtyText: qtyToInput(line.qtyMilli),
  priceText: line.unitPricePaise === null ? "" : paiseToInput(line.unitPricePaise),
});

/**
 * Changes are saved to the server in the background (a short pause after typing), so the cart
 * survives a refresh or a dropped connection. Checkout waits for every pending save first.
 */
function useBackgroundSave() {
  const pending = useRef(
    new Map<string, { timer?: ReturnType<typeof setTimeout>; run: () => Promise<void> }>(),
  );
  const inflight = useRef(new Set<Promise<void>>());
  // "Saving…" / "All changes saved" must be accurate: a change still waiting for the typing
  // pause counts as not saved yet.
  const [saving, setSaving] = useState(false);
  const refresh = useCallback(
    () => setSaving(pending.current.size > 0 || inflight.current.size > 0),
    [],
  );
  const [failed, setFailed] = useState(false);

  const start = useCallback(
    (key: string, run: () => Promise<void>) => {
      pending.current.delete(key);
      const promise = run()
        .then(() => setFailed(false))
        .catch(() => {
          // Network trouble: keep it, and try again on the next change or at checkout.
          setFailed(true);
          pending.current.set(key, { run });
        })
        .finally(() => {
          inflight.current.delete(promise);
          refresh();
        });
      inflight.current.add(promise);
      refresh();
    },
    [refresh],
  );

  const schedule = useCallback(
    (key: string, run: () => Promise<void>, delay = SAVE_DELAY_MS) => {
      const existing = pending.current.get(key);
      if (existing?.timer) clearTimeout(existing.timer);
      const timer = setTimeout(() => start(key, run), delay);
      pending.current.set(key, { timer, run });
      refresh();
    },
    [start, refresh],
  );

  const cancel = useCallback(
    (key: string) => {
      const existing = pending.current.get(key);
      if (existing?.timer) clearTimeout(existing.timer);
      pending.current.delete(key);
      refresh();
    },
    [refresh],
  );

  const flush = useCallback(async () => {
    for (const [key, { timer, run }] of [...pending.current]) {
      if (timer) clearTimeout(timer);
      start(key, run);
    }
    await Promise.allSettled([...inflight.current]);
    return pending.current.size === 0;
  }, [start]);

  const hasPending = useCallback(() => pending.current.size > 0 || inflight.current.size > 0, []);

  return { schedule, start, cancel, flush, saving, failed, hasPending };
}

export function CartEditor({ draft }: { draft: DraftView }) {
  const m = useMessages();
  const t = useT();
  const router = useRouter();
  const orderId = draft.id;

  const [customer, setCustomer] = useState<CartCustomer | null>(draft.customer);
  const [customerError, setCustomerError] = useState<string>();
  const [lines, setLinesState] = useState<CartLineState[]>(() => draft.lines.map(toState));
  const linesRef = useRef(lines);
  const setLines = (update: (prev: CartLineState[]) => CartLineState[]) => {
    const next = update(linesRef.current);
    linesRef.current = next;
    setLinesState(next);
  };
  const [discountKind, setDiscountKind] = useState<DiscountKind>(draft.discountKind);
  const [discountText, setDiscountText] = useState(() =>
    draft.discountValue === 0
      ? ""
      : draft.discountKind === "AMOUNT"
        ? paiseToInput(draft.discountValue)
        : percentToInput(draft.discountValue),
  );
  const [shortages, setShortages] = useState(new Map<string, Shortage>());
  const [flagged, setFlagged] = useState(new Set<string>());
  const [checkingOut, startCheckout] = useTransition();
  const saver = useBackgroundSave();

  // Only warn about leaving while something is still being saved.
  const { hasPending } = saver;
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (hasPending()) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasPending]);

  const patchLine = (lineId: string, patch: Partial<CartLineState>) =>
    setLines((prev) => prev.map((l) => (l.id === lineId ? { ...l, ...patch } : l)));

  const saveLine = (lineId: string) =>
    saver.schedule(`line:${lineId}`, async () => {
      const line = linesRef.current.find((l) => l.id === lineId);
      if (!line) return;
      const { qtyMilli, pricePaise } = parseLine(line);
      if (qtyMilli === null) return patchLine(lineId, { error: t("stock.invalidQuantity") });
      if (line.priceText.trim() !== "" && pricePaise === null) {
        return patchLine(lineId, { error: t("items.invalidPrice") });
      }
      const result = await updateLineAction(orderId, lineId, line.qtyText, line.priceText);
      patchLine(lineId, {
        error: result.ok || !result.message ? undefined : t(result.message.key),
      });
    });

  const editLine = (lineId: string, patch: Partial<CartLineState>) => {
    patchLine(lineId, { ...patch, error: undefined });
    setFlagged((prev) => {
      const next = new Set(prev);
      next.delete(lineId);
      return next;
    });
    if ("qtyText" in patch) {
      setShortages((prev) => {
        const next = new Map(prev);
        next.delete(lineId);
        return next;
      });
    }
    saveLine(lineId);
  };

  const step = (line: CartLineState, delta: 1 | -1) => {
    const current = parseLine(line).qtyMilli ?? 0;
    const next = Math.max(QTY_SCALE, current + delta * QTY_SCALE);
    editLine(line.id, { qtyText: qtyToInput(next) });
  };

  const addItem = async (item: PickerItem) => {
    const existing = linesRef.current.find((l) => l.itemId === item.id);
    if (existing) {
      // Already in the cart: one more, saved like any other change.
      step(existing, 1);
      toast.success(format(m.orders.addedMore, { name: item.label }), { duration: 2000 });
      return;
    }
    const result = await addItemAction(orderId, item.id);
    if (result.ok && result.data) {
      const added = result.data.line;
      setLines((prev) => [...prev, toState(added)]);
      toast.success(format(m.orders.added, { name: added.label }), { duration: 2000 });
    } else if (!result.ok && result.message) {
      toast.error(t(result.message.key));
    }
  };

  const removeLine = (lineId: string) => {
    saver.cancel(`line:${lineId}`);
    setLines((prev) => prev.filter((l) => l.id !== lineId));
    saver.start(`remove:${lineId}`, async () => {
      await removeLineAction(orderId, lineId);
    });
  };

  const chooseCustomer = (next: CartCustomer | null) => {
    setCustomer(next);
    setCustomerError(undefined);
    saver.start("customer", async () => {
      await setCustomerAction(orderId, next?.id ?? null);
    });
  };

  const discountValue =
    discountText.trim() === ""
      ? 0
      : discountKind === "AMOUNT"
        ? rupeesToPaise(discountText)
        : parsePercent(discountText);
  const discountError = discountValue === null ? m.orders.invalidDiscount : undefined;

  const changeDiscount = (kind: DiscountKind, text: string) => {
    setDiscountKind(kind);
    setDiscountText(text);
    saver.schedule("discount", async () => {
      const result = await setDiscountAction(orderId, kind, text);
      if (!result.ok && result.message) toast.error(t(result.message.key));
    });
  };

  const totals = orderTotals(
    lines.map((l) => {
      const { qtyMilli, pricePaise } = parseLine(l);
      return { qtyMilli: qtyMilli ?? 0, unitPricePaise: pricePaise };
    }),
    { kind: discountKind, value: discountValue ?? 0 },
  );

  // "Paid now" is only kept on this screen: it is recorded together with the order at checkout.
  const [paidText, setPaidText] = useState("");
  const [paidMethod, setPaidMethod] = useState<PaymentMethod>("CASH");
  const paidPaise = paidText.trim() === "" ? 0 : rupeesToPaise(paidText);
  const paidError =
    paidPaise === null
      ? m.payments.invalidAmount
      : paidPaise > totals.total
        ? m.payments.paidTooMuch
        : undefined;

  const checkout = () =>
    startCheckout(async () => {
      const allSaved = await saver.flush();
      if (!allSaved) return void toast.error(m.orders.saveFailed);
      if (!customer) {
        setCustomerError(m.orders.chooseCustomer);
        return void toast.error(m.orders.chooseCustomer);
      }
      if (linesRef.current.some((l) => l.error) || discountError || paidError)
        return void toast.error(m.orders.fixFirst);

      const result = await checkoutAction(
        orderId,
        paidPaise ? { amount: paidText, method: paidMethod } : null,
      );
      if (result.ok) {
        router.replace(`/orders/${result.id}?done=1`);
        return;
      }
      toast.error(t(result.message.key, result.message.vars));
      if (
        result.message.key === "orders.chooseCustomer" ||
        result.message.key === "orders.customerArchived"
      ) {
        setCustomerError(t(result.message.key));
      }
      if (result.shortages) {
        setShortages(new Map(result.shortages.map((s) => [s.lineId, s])));
        // The stock numbers on screen may be out of date; update them from the answer.
        setLines((prev) =>
          prev.map((l) => {
            const s = result.shortages!.find((x) => x.lineId === l.id);
            return s ? { ...l, stockMilli: s.availableMilli } : l;
          }),
        );
        document
          .getElementById("cart-alert")
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      if (result.lineIds) setFlagged(new Set(result.lineIds));
    });

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex justify-end text-sm text-muted-foreground" aria-live="polite">
        {saver.failed ? (
          <span className="flex items-center gap-1 text-destructive">
            <TriangleAlertIcon className="size-4" aria-hidden />
            {m.orders.saveFailed}
          </span>
        ) : saver.saving ? (
          <span className="flex items-center gap-1">
            <Loader2Icon className="size-4 animate-spin" aria-hidden />
            {m.orders.saving}
          </span>
        ) : (
          <span className="flex items-center gap-1">
            <CloudIcon className="size-4" aria-hidden />
            {m.orders.allSaved}
          </span>
        )}
      </div>

      <CustomerSection customer={customer} onChange={chooseCustomer} error={customerError} />

      <SearchCombobox<PickerItem>
        label={m.orders.addItems}
        placeholder={m.orders.searchToAdd}
        search={searchItemsAction}
        getKey={(item) => item.id}
        renderOption={(item) => <ItemOption item={item} />}
        onChoose={(item) => void addItem(item)}
        noMatchesText={m.stock.noMatches}
        autoFocus={Boolean(customer) && lines.length === 0}
      />

      {shortages.size > 0 && (
        <Alert variant="destructive" id="cart-alert">
          <TriangleAlertIcon aria-hidden />
          <AlertTitle className="text-base">{m.orders.shortTitle}</AlertTitle>
          <AlertDescription>{m.orders.shortBody}</AlertDescription>
        </Alert>
      )}

      {lines.length === 0 ? (
        <EmptyState
          icon={ShoppingCartIcon}
          title={m.orders.emptyCart}
          body={m.orders.emptyCartBody}
        />
      ) : (
        <ol className="flex flex-col gap-3" aria-label={m.orders.cartItems}>
          {lines.map((line) => (
            <CartLine
              key={line.id}
              line={line}
              shortage={shortages.get(line.id)}
              flagged={flagged.has(line.id)}
              onQuantity={(text) => editLine(line.id, { qtyText: text })}
              onStep={(delta) => step(line, delta)}
              onPrice={(text) => editLine(line.id, { priceText: text })}
              onUseAvailable={() => {
                const s = shortages.get(line.id);
                if (s) editLine(line.id, { qtyText: qtyToInput(s.availableMilli) });
              }}
              onRemove={() => removeLine(line.id)}
            />
          ))}
        </ol>
      )}

      <section
        aria-label={m.orders.total}
        className="flex flex-col gap-3 rounded-xl border bg-card p-4"
      >
        <div className="flex justify-between text-base">
          <span>{m.orders.subtotal}</span>
          <span className="font-semibold">{formatINR(totals.subtotal)}</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-base">{m.orders.discount}</span>
          <div className="flex gap-2">
            <div
              role="radiogroup"
              aria-label={m.orders.discountKind}
              className="flex rounded-lg border p-0.5"
            >
              {(["AMOUNT", "PERCENT"] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  role="radio"
                  aria-checked={discountKind === kind}
                  onClick={() => changeDiscount(kind, discountText)}
                  className={cn(
                    "min-h-10 min-w-11 rounded-md px-3 text-base font-semibold",
                    discountKind === kind
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {kind === "AMOUNT" ? m.orders.discountAmount : m.orders.discountPercent}
                </button>
              ))}
            </div>
            {discountKind === "AMOUNT" ? (
              <MoneyInput
                aria-label={m.orders.discount}
                value={discountText}
                onChange={(e) => changeDiscount("AMOUNT", e.target.value)}
                placeholder="0"
                className="flex-1"
                aria-invalid={discountError ? true : undefined}
              />
            ) : (
              <Input
                aria-label={m.orders.discount}
                value={discountText}
                onChange={(e) => changeDiscount("PERCENT", e.target.value)}
                placeholder="0"
                inputMode="decimal"
                className="flex-1"
                aria-invalid={discountError ? true : undefined}
              />
            )}
            <span className="flex w-24 items-center justify-end font-semibold">
              {totals.discount > 0 ? `− ${formatINR(totals.discount)}` : formatINR(0)}
            </span>
          </div>
          <p
            className={cn(
              "text-sm",
              discountError ? "font-medium text-destructive" : "text-muted-foreground",
            )}
          >
            {discountError ?? m.orders.discountHint}
          </p>
        </div>
        <div className="flex items-baseline justify-between border-t pt-3">
          <span className="text-lg font-semibold">{m.orders.total}</span>
          <span className="text-2xl font-bold" data-testid="cart-total">
            {formatINR(totals.total)}
          </span>
        </div>

        <div className="flex flex-col gap-1.5 border-t pt-3">
          <label htmlFor={`${orderId}-paid`} className="text-base">
            {m.payments.paidNow}{" "}
            <span className="text-muted-foreground">({m.common.optional})</span>
          </label>
          <div className="flex gap-2">
            <MoneyInput
              id={`${orderId}-paid`}
              value={paidText}
              onChange={(e) => setPaidText(e.target.value)}
              placeholder="0"
              className="flex-1"
              aria-invalid={paidError ? true : undefined}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => setPaidText(paiseToInput(totals.total))}
              disabled={totals.total === 0}
            >
              {m.payments.payFull}
            </Button>
          </div>
          <div role="radiogroup" aria-label={m.payments.method} className="flex flex-wrap gap-2">
            {PAYMENT_METHODS.map((method) => (
              <button
                key={method}
                type="button"
                role="radio"
                aria-checked={paidMethod === method}
                onClick={() => setPaidMethod(method)}
                className={cn(
                  "min-h-11 rounded-lg border px-3 text-base font-semibold",
                  paidMethod === method
                    ? "border-primary bg-primary text-primary-foreground"
                    : "text-muted-foreground",
                )}
              >
                {m.payments[`method${method}`]}
              </button>
            ))}
          </div>
          <p
            className={cn(
              "text-sm",
              paidError ? "font-medium text-destructive" : "text-muted-foreground",
            )}
          >
            {paidError ??
              (paidPaise
                ? format(m.payments.balanceAfter, {
                    balance: formatINR(Math.max(0, totals.total - paidPaise)),
                  })
                : m.payments.paidNowHint)}
          </p>
        </div>
      </section>

      <div className="sticky bottom-20 z-10 flex items-center justify-between gap-3 rounded-xl border bg-background p-3 shadow-md md:bottom-4">
        <div className="flex flex-col">
          <span className="text-sm text-muted-foreground">
            {format(m.orders.linesCount, { count: lines.length })}
          </span>
          <span className="text-xl font-bold">{formatINR(totals.total)}</span>
        </div>
        <Button
          size="lg"
          onClick={checkout}
          disabled={checkingOut || lines.length === 0}
          aria-busy={checkingOut}
        >
          {checkingOut ? (
            <Loader2Icon className="animate-spin" aria-hidden />
          ) : (
            <CheckCircle2Icon aria-hidden />
          )}
          {checkingOut ? m.orders.checkingOut : m.orders.checkout}
        </Button>
      </div>

      <div>
        <ConfirmAction
          trigger={
            <Button variant="ghost" className="text-destructive">
              <Trash2Icon aria-hidden />
              {m.orders.discard}
            </Button>
          }
          title={m.orders.discardTitle}
          body={m.orders.discardBody}
          confirmLabel={m.orders.discard}
          action={() => discardOrderAction(orderId)}
          onDone={() => router.push("/orders/new")}
        />
      </div>
    </div>
  );
}
