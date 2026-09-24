import { describe, expect, it } from "vitest";
import { applyTheme, parseThemePrefs, resolveAppearance } from "./theme";

describe("theme prefs", () => {
  it("falls back to light purple when storage is empty or invalid", () => {
    expect(parseThemePrefs(null)).toEqual({ appearance: "light", accent: "purple" });
    expect(parseThemePrefs("{")).toEqual({ appearance: "light", accent: "purple" });
    expect(parseThemePrefs(JSON.stringify({ appearance: "neon", accent: "gold" }))).toEqual({
      appearance: "light",
      accent: "purple",
    });
  });

  it("keeps a saved dark teal theme", () => {
    expect(parseThemePrefs(JSON.stringify({ appearance: "dark", accent: "teal" }))).toEqual({
      appearance: "dark",
      accent: "teal",
    });
  });

  it("resolves auto from the system query", () => {
    expect(resolveAppearance("auto", true)).toBe("dark");
    expect(resolveAppearance("auto", false)).toBe("light");
    expect(resolveAppearance("dark", false)).toBe("dark");
  });

  it("writes appearance and accent onto the document root", () => {
    const root = document.createElement("html");
    applyTheme({ appearance: "dark", accent: "teal" }, root);
    expect(root.dataset.appearance).toBe("dark");
    expect(root.dataset.accent).toBe("teal");
    expect(root.style.colorScheme).toBe("dark");
  });
});
