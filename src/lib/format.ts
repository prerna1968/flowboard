import type { Priority, Role, StatusCategory } from "../types";

export function formatDue(iso: string | null): string {
  if (!iso) return "No date";
  const date = parseDue(iso);
  if (!date) return "No date";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function formatDueCompact(iso: string | null): string {
  const date = parseDue(iso);
  if (!date) return "";
  const today = localTodayUtc();
  if (sameUtcDay(date, today)) return "Today";
  if (sameUtcDay(date, addUtcDays(today, 1))) return "Tomorrow";
  const year = String(date.getUTCFullYear()).slice(2);
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}/${year}`;
}

export function localTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

export function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function sameUtcDay(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate();
}

export function parseDue(iso: string | null): Date | null {
  if (!iso) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

export function toDueIso(date: Date): string {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}-${day}T00:00:00.000Z`;
}

export function duePresetHint(date: Date, today: Date): string {
  const diff = Math.round((date.getTime() - today.getTime()) / 86_400_000);
  if (diff >= 0 && diff < 7) {
    return date.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function isOverdue(iso: string | null, category: StatusCategory | null): boolean {
  if (!iso || category === "done") return false;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date.getTime() < today.getTime();
}

export function toDateInput(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function fromDateInput(value: string): string | null {
  if (!value) return null;
  return `${value}T00:00:00.000Z`;
}

export function roleLabel(role: Role): string {
  return role === "admin" ? "Admin" : "Member";
}

export const priorityLabel: Record<Priority, string> = {
  urgent: "Urgent",
  high: "High",
  normal: "Normal",
  low: "Low",
  none: "None",
};

export const statusDotClass: Record<string, string> = {
  todo: "bg-status-todo",
  in_progress: "bg-status-progress",
  done: "bg-status-done",
};

export const statusTextClass: Record<string, string> = {
  todo: "text-status-todo",
  in_progress: "text-accent",
  done: "text-status-done",
};

export const statusPillClass: Record<string, string> = {
  todo: "bg-surface-sunken text-ink-muted",
  in_progress: "bg-accent-soft text-accent",
  done: "bg-status-doneSoft text-status-done",
};

export const priorityBadgeClass: Record<Priority, string> = {
  urgent: "bg-priority-urgentSoft text-priority-urgent",
  high: "bg-priority-highSoft text-priority-high",
  normal: "bg-priority-normalSoft text-priority-normal",
  low: "bg-priority-lowSoft text-priority-low",
  none: "bg-priority-noneSoft text-priority-none",
};
