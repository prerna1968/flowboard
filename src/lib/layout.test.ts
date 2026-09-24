import { describe, expect, it } from "vitest";
import { isDesktopLayout } from "./layout";

describe("layout", () => {
  it("treats a missing matchMedia as desktop so tests keep the sidebar open", () => {
    expect(isDesktopLayout()).toBe(true);
  });
});
