import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import { formatDueCompact, priorityLabel } from "../lib/format";
import type { Priority, User } from "../types";
import { focusRing } from "./classes";
import { AssigneePicker, DueDatePicker, PriorityPicker } from "./pickers";
import { PriorityFlag } from "./TaskMeta";

export function TaskEditMenu({
  name,
  users,
  currentUserId,
  assigneeIds,
  dueDate,
  priority,
  overdue = false,
  alwaysVisible = false,
  onAssignees,
  onDue,
  onPriority,
}: {
  name: string;
  users: User[];
  currentUserId: string;
  assigneeIds: string[];
  dueDate: string | null;
  priority: Priority;
  overdue?: boolean;
  alwaysVisible?: boolean;
  onAssignees: (assigneeIds: string[]) => void;
  onDue: (dueDate: string | null) => void;
  onPriority: (priority: Priority) => void;
}) {
  const selected = users.filter((user) => assigneeIds.includes(user.id));
  const assigneeLabel =
    selected.length === 0
      ? "Assignees"
      : selected.map((user) => (user.id === currentUserId ? "Me" : user.name)).join(", ");
  const dueLabel = formatDueCompact(dueDate) || "Set Due Date";
  const priorityText = priority === "none" ? "Set Priority" : priorityLabel[priority];

  return (
    <div className="relative shrink-0">
      <Popover>
        <PopoverButton
          type="button"
          aria-label={`Edit ${name}`}
          className={`${
            alwaysVisible ? "flex" : "hidden max-md:flex group-hover:flex group-focus-within:flex"
          } h-7 w-7 items-center justify-center rounded-full text-ink-faint hover:bg-surface-sunken hover:text-ink data-[open]:flex data-[open]:bg-surface-sunken data-[open]:text-ink ${focusRing}`}
        >
          <DotsIcon />
        </PopoverButton>
        <PopoverPanel className="absolute right-0 bottom-full z-50 mb-1 w-64 overflow-visible rounded-xl bg-surface-raised p-1.5 shadow-pop ring-1 ring-line">
          <p className="px-2.5 pb-1 pt-1.5 text-xs font-medium text-ink-faint">Edit</p>
          <AssigneePicker
            users={users}
            assigneeIds={assigneeIds}
            currentUserId={currentUserId}
            portal={false}
            onChange={onAssignees}
          >
            <PersonIcon />
            <span className="min-w-0 flex-1 truncate">{assigneeLabel}</span>
            <ChevronIcon />
          </AssigneePicker>
          <DueDatePicker value={dueDate} overdue={overdue} portal={false} onChange={onDue}>
            <CalendarPlusIcon />
            <span className={`min-w-0 flex-1 ${overdue ? "text-danger" : ""}`}>{dueLabel}</span>
            <ChevronIcon />
          </DueDatePicker>
          <PriorityPicker value={priority} portal={false} onChange={onPriority}>
            {priority === "none" ? <FlagIcon /> : <PriorityFlag priority={priority} decorative />}
            <span className="min-w-0 flex-1">{priorityText}</span>
            <ChevronIcon />
          </PriorityPicker>
        </PopoverPanel>
      </Popover>
    </div>
  );
}

function DotsIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4">
      <path
        fill="currentColor"
        d="M10 6.4a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6zm0 4.9a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6zm0 4.9a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6z"
      />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-muted">
      <circle cx="10" cy="7" r="2.3" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M5.4 15.2c.7-2.3 2.4-3.4 4.6-3.4s3.9 1.1 4.6 3.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CalendarPlusIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-muted">
      <rect x="3" y="4.5" width="14" height="12" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3 8h14M7 3.5v3M13 3.5v3M10 11v4M8 13h4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-faint">
      <path
        d="M8 5.5 12.5 10 8 14.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FlagIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-muted">
      <path
        d="M5 16.5V4.5h7.2l-.8 2.6H15L13.8 11H5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}
