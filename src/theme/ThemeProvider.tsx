import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  applyTheme,
  loadThemePrefs,
  saveThemePrefs,
  type Accent,
  type Appearance,
  type ThemePrefs,
} from "../lib/theme";

const ThemeContext = createContext<{
  prefs: ThemePrefs;
  setAppearance: (appearance: Appearance) => void;
  setAccent: (accent: Accent) => void;
} | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<ThemePrefs>(() => loadThemePrefs());

  useEffect(() => {
    applyTheme(prefs);
    saveThemePrefs(prefs);
    if (prefs.appearance !== "auto" || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => applyTheme(prefs);
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [prefs]);

  const value = useMemo(
    () => ({
      prefs,
      setAppearance: (appearance: Appearance) => setPrefs((current) => ({ ...current, appearance })),
      setAccent: (accent: Accent) => setPrefs((current) => ({ ...current, accent })),
    }),
    [prefs],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme needs a ThemeProvider.");
  return value;
}
