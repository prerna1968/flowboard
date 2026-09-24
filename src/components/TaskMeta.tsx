import type { Priority, User } from "../types";
import { priorityBadgeClass, priorityLabel, statusChipClass } from "../lib/format";

export function Avatar({ user, size = "sm" }: { user: User; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-xs";
  return (
    <span
      title={user.name}
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent ring-2 ring-surface-raised ${dim}`}
    >
      {user.initials}
    </span>
  );
}

export function AvatarStack({ users }: { users: User[] }) {
  if (users.length === 0) {
    return <span className="text-xs text-ink-faint">Unassigned</span>;
  }
  return (
    <span className="flex -space-x-1">
      {users.map((user) => (
        <Avatar key={user.id} user={user} />
      ))}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${priorityBadgeClass[priority]}`}>
      {priorityLabel[priority]}
    </span>
  );
}

export function PriorityFlag({ priority, decorative = false }: { priority: Priority; decorative?: boolean }) {
  const color = priorityBadgeClass[priority].split(" ").find((item) => item.startsWith("text-")) ?? "text-ink-faint";
  return (
    <svg viewBox="0 0 20 20" aria-hidden={decorative || undefined} aria-label={decorative ? undefined : priorityLabel[priority]} className={`h-4 w-4 shrink-0 ${color}`}>
      <path
        fill={priority === "none" ? "none" : "currentColor"}
        stroke={priority === "none" ? "currentColor" : "none"}
        strokeWidth="1.4"
        d="M4.5 2.5h1.2v15H4.5v-15zm1.2 1.2h8.4l-1.7 2.8 1.7 2.8H5.7V3.7z"
      />
    </svg>
  );
}

export function StatusMark({ color, onChip = false }: { color: string; onChip?: boolean }) {
  if (color === "done") {
    if (onChip) {
      return <span className="inline-flex h-3.5 w-3.5 items-center justify-center text-[10px] font-bold text-white">✓</span>;
    }
    return (
      <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-status-done text-[9px] font-bold text-white">
        ✓
      </span>
    );
  }
  if (color === "in_progress") {
    return (
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full border-2 ${
          onChip ? "border-white" : "border-accent bg-accent-soft"
        }`}
      />
    );
  }
  return (
    <span
      className={`inline-block h-3.5 w-3.5 rounded-full border-2 ${
        onChip ? "border-dashed border-status-todo" : "border-status-todo"
      }`}
    />
  );
}

export function StatusChip({ color, label }: { color: string; label: string }) {
  const chip = statusChipClass[color] ?? statusChipClass.todo;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-bold uppercase tracking-wide ${chip}`}>
      <StatusMark color={color} onChip />
      {label}
    </span>
  );
}
