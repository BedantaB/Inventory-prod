"use client";

import { useRouter } from "next/navigation";
import type { CustomerView } from "../data";
import { CustomerForm } from "./customer-form";

/** Customer form as a full page: goes to the customer's page after saving. */
export function CustomerEditor({ customer }: { customer?: CustomerView }) {
  const router = useRouter();
  return (
    <CustomerForm customer={customer} onSaved={(saved) => router.push(`/customers/${saved.id}`)} />
  );
}
