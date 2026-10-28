"use client";

import { PhoneIcon, PlusIcon, StoreIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { SearchCombobox } from "@/components/search-combobox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CustomerForm } from "@/features/customers/components/customer-form";
import { useMessages } from "@/i18n/provider";
import { formatPhone } from "@/lib/phone";
import { searchCustomersAction } from "../actions";

export type CartCustomer = { id: string; businessName: string; phone: string; city: string | null };

/** Who the order is for: search existing customers, or add a new one without leaving the cart. */
export function CustomerSection({
  customer,
  onChange,
  error,
}: {
  customer: CartCustomer | null;
  onChange: (customer: CartCustomer | null) => void;
  error?: string;
}) {
  const m = useMessages();
  const [adding, setAdding] = useState(false);

  if (customer) {
    return (
      <section aria-label={m.orders.customer} className="flex flex-col gap-1.5">
        <span className="text-base font-medium">{m.orders.customer}</span>
        <div className="flex items-center gap-3 rounded-lg border bg-secondary/50 p-3">
          <StoreIcon className="size-6 shrink-0 text-primary" aria-hidden />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="line-clamp-2 text-lg font-semibold">{customer.businessName}</span>
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <PhoneIcon className="size-3.5" aria-hidden />
              {[formatPhone(customer.phone), customer.city].filter(Boolean).join(" · ")}
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onChange(null)}
            aria-label={m.orders.changeCustomer}
          >
            <XIcon aria-hidden />
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section aria-label={m.orders.customer} className="flex flex-col gap-2">
      <SearchCombobox<CartCustomer>
        label={m.orders.customer}
        placeholder={m.orders.searchCustomer}
        search={searchCustomersAction}
        getKey={(c) => c.id}
        renderOption={(c) => (
          <span className="flex min-w-0 flex-col">
            <span className="line-clamp-2 font-medium">{c.businessName}</span>
            <span className="text-sm text-muted-foreground">
              {[formatPhone(c.phone), c.city].filter(Boolean).join(" · ")}
            </span>
          </span>
        )}
        onChoose={onChange}
        noMatchesText={m.orders.noCustomerMatches}
        error={error}
      />
      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogTrigger asChild>
          <Button type="button" variant="outline" className="w-fit">
            <PlusIcon aria-hidden />
            {m.orders.newCustomer}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">{m.orders.newCustomerTitle}</DialogTitle>
          </DialogHeader>
          <CustomerForm
            compact
            onSaved={(saved) => {
              setAdding(false);
              onChange({
                id: saved.id,
                businessName: saved.businessName,
                phone: saved.phone,
                city: saved.city,
              });
            }}
          />
        </DialogContent>
      </Dialog>
    </section>
  );
}
