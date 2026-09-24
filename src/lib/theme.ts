export type Appearance = "light" | "dark" | "auto";
export type Accent =
  | "black"
  | "purple"
  | "blue"
  | "pink"
  | "violet"
  | "indigo"
  | "orange"
  | "teal"
  | "bronze"
  | "mint";

export interface ThemePrefs {
  appearance: Appearance;
  accent: Accent;
}

export const themeStorageKey = "flowboard-theme";

export const accents: { id: Accent; label: string; swatch: string }[] = [
  { id: "black", label: "Black", swatch: "#1b2430" },
  { id: "purple", label: "Purple", swatch: "#7b68ee" },
  { id: "blue", label: "Blue", swatch: "#2f6bff" },
  { id: "pink", label: "Pink", swatch: "#e85d8e" },
  { id: "violet", label: "Violet", swatch: "#8b5cf6" },
  { id: "indigo", label: "Indigo", swatch: "#6366f1" },
  { id: "orange", label: "Orange", swatch: "#ea7e2b" },
  { id: "teal", label: "Teal", swatch: "#14b8a6" },
  { id: "bronze", label: "Bronze", swatch: "#b4825a" },
  { id: "mint", label: "Mint", swatch: "#34a884" },
];

export const defaultTheme: ThemePrefs = { appearance: "light", accent: "purple" };

export function parseThemePrefs(raw: string | null): ThemePrefs {
  if (!raw) return defaultTheme;
  try {
    const value = JSON.parse(raw) as Partial<ThemePrefs>;
    const appearance = value.appearance === "dark" || value.appearance === "auto" ? value.appearance : "light";
    const accent = accents.some((item) => item.id === value.accent) ? (value.accent as Accent) : "purple";
    return { appearance, accent };
  } catch {
    return defaultTheme;
  }
}

export function loadThemePrefs(storage: Pick<Storage, "getItem"> = localStorage): ThemePrefs {
  try {
    return parseThemePrefs(storage.getItem(themeStorageKey));
  } catch {
    return defaultTheme;
  }
}

export function saveThemePrefs(prefs: ThemePrefs, storage: Pick<Storage, "setItem"> = localStorage): void {
  try {
    storage.setItem(themeStorageKey, JSON.stringify(prefs));
  } catch {
    // Private mode can refuse localStorage writes.
  }
}

export function resolveAppearance(appearance: Appearance, darkQuery = false): "light" | "dark" {
  if (appearance === "auto") return darkQuery ? "dark" : "light";
  return appearance;
}

export function prefersDarkScheme(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
    : false;
}

export function applyTheme(prefs: ThemePrefs, root: HTMLElement = document.documentElement): "light" | "dark" {
  const resolved = resolveAppearance(prefs.appearance, prefersDarkScheme());
  root.dataset.appearance = resolved;
  root.dataset.accent = prefs.accent;
  root.style.colorScheme = resolved;
  return resolved;
}
