import { describe, expect, it } from "vitest";
import { paidNowSchema, paymentSchema } from "./schemas";

describe("paymentSchema", () => {
  it("reads the amount in paise", () => {
    expect(paymentSchema.parse({ amount: "1,250.50", method: "UPI" })).toEqual({
      amount: 125_050,
      method: "UPI",
      receivedOn: "",
      reference: null,
      note: null,
    });
  });

  it("needs an amount above zero and a known method", () => {
    expect(paymentSchema.safeParse({ amount: "0", method: "CASH" }).success).toBe(false);
    expect(paymentSchema.safeParse({ amount: "", method: "CASH" }).success).toBe(false);
    expect(paymentSchema.safeParse({ amount: "100", method: "CARD" }).success).toBe(false);
  });
});

describe("paidNowSchema", () => {
  it("is nothing when left empty", () => {
    expect(paidNowSchema.parse({})).toBeNull();
    expect(paidNowSchema.parse({ paidNow: " ", paidMethod: "CASH" })).toBeNull();
  });

  it("reads amount and method", () => {
    expect(paidNowSchema.parse({ paidNow: "500", paidMethod: "CHEQUE" })).toEqual({
      amountPaise: 50_000,
      method: "CHEQUE",
    });
  });

  it("explains what is wrong", () => {
    expect(
      paidNowSchema.safeParse({ paidNow: "-5", paidMethod: "CASH" }).error?.issues[0].message,
    ).toBe("payments.invalidAmount");
    expect(paidNowSchema.safeParse({ paidNow: "5", paidMethod: "" }).error?.issues[0].message).toBe(
      "payments.chooseMethod",
    );
  });
});
