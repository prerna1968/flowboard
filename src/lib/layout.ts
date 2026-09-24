export const desktopQuery = "(min-width: 768px)";

export function isDesktopLayout(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(desktopQuery).matches
    : true;
}
