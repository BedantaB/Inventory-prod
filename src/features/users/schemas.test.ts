import { describe, expect, it } from "vitest";
import { createUserSchema } from "./schemas";

describe("createUserSchema", () => {
  it("normalises the username to lower case", () => {
    const result = createUserSchema.parse({
      fullName: " Ramesh Kumar ",
      username: " Ramesh ",
      role: "STAFF",
      password: "staff-pass-123",
    });
    expect(result).toEqual({
      fullName: "Ramesh Kumar",
      username: "ramesh",
      role: "STAFF",
      password: "staff-pass-123",
    });
  });

  it("rejects bad usernames and roles with friendly keys", () => {
    const result = createUserSchema.safeParse({
      fullName: "X",
      username: "ra mesh",
      role: "BOSS",
      password: "staff-pass-123",
    });
    expect(result.success).toBe(false);
    const messages = result.error!.issues.map((i) => [i.path[0], i.message]);
    expect(messages).toEqual([
      ["username", "validation.usernameFormat"],
      ["role", "validation.invalidChoice"],
    ]);
  });
});
