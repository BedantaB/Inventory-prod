/** Custom SQLSTATE codes raised by our triggers (see migration 0002_rules_and_security.sql). */
export const DB_ERROR = {
  stockGuard: "IV001",
  insufficientStock: "IV002",
  ledgerImmutable: "IV003",
  orderCompleted: "IV004",
  returnNeedsCancelledOrder: "IV006",
  paymentImmutable: "IV007",
  paymentOrderMismatch: "IV008",
  uniqueViolation: "23505",
  checkViolation: "23514",
  foreignKeyViolation: "23503",
} as const;

/** Postgres error code from an error thrown by Drizzle/postgres-js/PGlite (looks through `cause`). */
export function getPgErrorCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth++) {
    if (typeof current === "object" && "code" in current && typeof current.code === "string") {
      return current.code;
    }
    current = typeof current === "object" && "cause" in current ? current.cause : undefined;
  }
  return undefined;
}
