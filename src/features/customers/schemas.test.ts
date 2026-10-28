import { describe, expect, it } from "vitest";
import { customerSchema } from "./schemas";

describe("customerSchema", () => {
  it("cleans up what people type", () => {
    expect(
      customerSchema.parse({
        businessName: " Sharma Kirana Store ",
        contactPerson: "",
        phone: "098290 12345",
        email: " Rajesh@Example.com ",
        address: "",
        city: "Jaipur",
        notes: "",
      }),
    ).toEqual({
      businessName: "Sharma Kirana Store",
      contactPerson: null,
      phone: "+919829012345",
      email: "rajesh@example.com",
      address: null,
      city: "Jaipur",
      notes: null,
    });
  });

  it("explains a bad phone or email", () => {
    const result = customerSchema.safeParse({ businessName: "X", phone: "12345", email: "x@" });
    expect(result.success).toBe(false);
    expect(result.error!.issues.map((i) => [i.path[0], i.message])).toEqual([
      ["phone", "customers.invalidPhone"],
      ["email", "validation.email"],
    ]);
  });

  it("needs a name and a phone", () => {
    const result = customerSchema.safeParse({});
    expect(result.error!.issues.map((i) => [i.path[0], i.message])).toEqual([
      ["businessName", "validation.required"],
      ["phone", "validation.required"],
    ]);
  });
});
