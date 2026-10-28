"use client";

import { useRouter } from "next/navigation";
import { FreshForm } from "@/components/form/fresh-form";
import type { CustomerView } from "../data";
import { CustomerForm } from "./customer-form";

/** Customer form as a full page: goes to the customer's page after saving. */
export function CustomerEditor({ customer }: { customer?: CustomerView }) {
  const router = useRouter();
  if (customer) {
    return (
      <CustomerForm
        customer={customer}
        onSaved={(saved) => router.push(`/customers/${saved.id}`)}
      />
    );
  }
  return (
    <FreshForm>
      {(onSaved) => (
        <CustomerForm
          onSaved={(saved) => {
            router.push(`/customers/${saved.id}`);
            onSaved();
          }}
        />
      )}
    </FreshForm>
  );
}
