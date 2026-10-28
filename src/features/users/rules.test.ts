import { describe, expect, it } from "vitest";
import { selfChangeProblem, suggestUsername } from "./rules";

describe("selfChangeProblem", () => {
  it("allows changing other people", () => {
    expect(
      selfChangeProblem({ actorId: "a", targetId: "b", currentRole: "ADMIN", newRole: "STAFF" }),
    ).toBeNull();
    expect(
      selfChangeProblem({ actorId: "a", targetId: "b", currentRole: "ADMIN", deactivate: true }),
    ).toBeNull();
  });

  it("blocks turning off or demoting yourself", () => {
    expect(
      selfChangeProblem({ actorId: "a", targetId: "a", currentRole: "ADMIN", deactivate: true }),
    ).toBe("users.cannotChangeSelf");
    expect(
      selfChangeProblem({ actorId: "a", targetId: "a", currentRole: "ADMIN", newRole: "STAFF" }),
    ).toBe("users.cannotChangeSelf");
  });

  it("allows editing your own name", () => {
    expect(
      selfChangeProblem({ actorId: "a", targetId: "a", currentRole: "ADMIN", newRole: "ADMIN" }),
    ).toBeNull();
  });
});

describe("suggestUsername", () => {
  it("adds the first free number", () => {
    expect(suggestUsername("ramesh", new Set(["ramesh", "ramesh2"]))).toBe("ramesh3");
    expect(suggestUsername("ramesh2", new Set(["ramesh", "ramesh2"]))).toBe("ramesh3");
  });
  it("stays within 30 characters", () => {
    expect(suggestUsername("a".repeat(30), new Set()).length).toBeLessThanOrEqual(30);
  });
});
