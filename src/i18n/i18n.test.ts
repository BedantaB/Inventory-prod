import { describe, expect, it } from "vitest";
import { format, getMessages, translate } from "./index";

describe("i18n", () => {
  const messages = getMessages();

  it("translates dotted keys and fills placeholders", () => {
    expect(translate(messages, "home.greeting", { name: "Ramesh" })).toBe("Namaste, Ramesh");
  });

  it("returns unknown keys unchanged so mistakes are visible", () => {
    expect(translate(messages, "nope.missing")).toBe("nope.missing");
    expect(translate(messages, "auth")).toBe("auth");
  });

  it("leaves unknown placeholders alone", () => {
    expect(format("{a} and {b}", { a: 1 })).toBe("1 and {b}");
  });
});
