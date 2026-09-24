import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import { useState } from "react";
import {
  addUtcDays,
  duePresetHint,
  formatDueCompact,
  localTodayUtc,
  parseDue,
  priorityLabel,
  sameUtcDay,
  toDueIso,
} from "../lib/format";
import type { Priority, User } from "../types";
import { focusRing } from "./classes";
import { Avatar, AvatarStack, PriorityFlag } from "./TaskMeta";

export function DueDatePicker({
  value,
  overdue = false,
  onChange,
}: {
  value: string | null;
  overdue?: boolean;
  onChange: (iso: string | null) => void;
}) {
  const today = localTodayUtc();
  const selected = parseDue(value);
  const [cursor, setCursor] = useState(() => selected ?? today);
  const presets = duePresets(today);
  const label = formatDueCompact(value);

  return (
    <Popover className="relative">
      <PopoverButton
        aria-label={label ? `Due date, ${label}` : "Due date"}
        className={`rounded-control px-1 py-0.5 text-xs hover:bg-surface-sunken ${focusRing} ${
          overdue ? "font-medium text-danger" : label ? "text-ink" : "text-ink-faint"
        }`}
      >
        {label || <CalendarIcon />}
      </PopoverButton>
      <PopoverPanel
        anchor="bottom end"
        className="z-50 flex w-[400px] max-w-[calc(100vw-16px)] flex-col rounded-card bg-surface-raised p-3 shadow-pop ring-1 ring-line [--anchor-gap:8px]"
      >
        {({ close }) => (
          <>
            <div className="mb-3 flex items-center gap-2">
              <span className="flex min-w-0 flex-1 items-center gap-2 rounded-control border border-line px-2 py-1.5 text-sm">
                <CalendarIcon />
                <span className={label ? "text-ink" : "text-ink-faint"}>{label || "No date"}</span>
              </span>
              {value ? (
                <button
                  type="button"
                  aria-label="Clear due date"
                  className={`rounded-control px-2 py-1 text-sm text-ink-muted hover:bg-surface-sunken ${focusRing}`}
                  onClick={() => {
                    onChange(null);
                    close();
                  }}
                >
                  ×
                </button>
              ) : null}
            </div>
            <div className="flex gap-3">
              <div className="flex w-40 shrink-0 flex-col">
                {presets.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    className="flex items-center justify-between rounded-control px-2 py-1.5 text-left text-sm hover:bg-surface-sunken"
                    onClick={() => {
                      onChange(preset.date ? toDueIso(preset.date) : null);
                      close();
                    }}
                  >
                    <span>{preset.label}</span>
                    <span className="text-xs text-ink-faint">{preset.hint}</span>
                  </button>
                ))}
              </div>
              <MonthCalendar
                cursor={cursor}
                selected={selected}
                today={today}
                onCursor={setCursor}
                onPick={(date) => {
                  onChange(toDueIso(date));
                  close();
                }}
              />
            </div>
          </>
        )}
      </PopoverPanel>
    </Popover>
  );
}

export function AssigneePicker({
  users,
  assigneeIds,
  currentUserId,
  onChange,
}: {
  users: User[];
  assigneeIds: string[];
  currentUserId: string;
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const selected = users.filter((user) => assigneeIds.includes(user.id));
  const needle = query.trim().toLowerCase();
  const matches = users.filter((user) => user.name.toLowerCase().includes(needle));
  const ordered = [...matches].sort((a, b) => Number(b.id === currentUserId) - Number(a.id === currentUserId));

  return (
    <Popover className="relative">
      <PopoverButton
        aria-label={selected.length ? `Assignees, ${selected.map((user) => user.name).join(", ")}` : "Assignee"}
        className={`rounded-control p-0.5 hover:bg-surface-sunken ${focusRing}`}
      >
        {selected.length > 0 ? <AvatarStack users={selected} /> : <EmptyAssignee />}
      </PopoverButton>
      <PopoverPanel
        anchor="bottom end"
        className="z-50 w-72 rounded-card bg-surface-raised p-2 shadow-pop ring-1 ring-line [--anchor-gap:8px]"
      >
        <input
          autoFocus
          aria-label="Search assignees"
          className={`mb-2 w-full rounded-control border border-line px-3 py-2 text-sm placeholder:text-ink-faint ${focusRing}`}
          placeholder="Search or enter email..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <p className="px-2 py-1 text-xs font-medium text-ink-faint">Assignees</p>
        {ordered.length === 0 ? (
          <p className="px-2 py-2 text-sm text-ink-muted">No people match that search.</p>
        ) : (
          <ul>
            {ordered.map((user) => {
              const active = assigneeIds.includes(user.id);
              return (
                <li key={user.id}>
                  <button
                    type="button"
                    aria-pressed={active}
                    className={`flex w-full items-center gap-2 rounded-control px-2 py-1.5 text-left text-sm hover:bg-surface ${
                      active ? "bg-accent-soft" : ""
                    }`}
                    onClick={() =>
                      onChange(active ? assigneeIds.filter((id) => id !== user.id) : [...assigneeIds, user.id])
                    }
                  >
                    <Avatar user={user} />
                    <span className="min-w-0 flex-1 truncate">{user.id === currentUserId ? "Me" : user.name}</span>
                    {active ? <span className="text-xs text-accent">✓</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverPanel>
    </Popover>
  );
}

function MonthCalendar({
  cursor,
  selected,
  today,
  onCursor,
  onPick,
}: {
  cursor: Date;
  selected: Date | null;
  today: Date;
  onCursor: (date: Date) => void;
  onPick: (date: Date) => void;
}) {
  const year = cursor.getUTCFullYear();
  const month = cursor.getUTCMonth();
  const first = new Date(Date.UTC(year, month, 1));
  const start = addUtcDays(first, -first.getUTCDay());
  const days = Array.from({ length: 42 }, (_, index) => addUtcDays(start, index));
  const title = first.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div className="min-w-0 flex-1">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" aria-label="Previous month" className={`rounded-control px-2 py-1 text-sm ${focusRing}`} onClick={() => onCursor(new Date(Date.UTC(year, month - 1, 1)))}>
          ‹
        </button>
        <p className="text-sm font-medium">{title}</p>
        <button type="button" aria-label="Next month" className={`rounded-control px-2 py-1 text-sm ${focusRing}`} onClick={() => onCursor(new Date(Date.UTC(year, month + 1, 1)))}>
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] text-ink-faint">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
          <span key={day} className="py-1">
            {day}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const inMonth = day.getUTCMonth() === month;
          const isSelected = selected ? sameUtcDay(day, selected) : false;
          const isToday = sameUtcDay(day, today);
          return (
            <button
              key={day.toISOString()}
              type="button"
              aria-label={day.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}
              aria-pressed={isSelected}
              className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm ${
                isSelected ? "bg-accent text-on" : isToday ? "ring-1 ring-accent text-accent" : inMonth ? "text-ink hover:bg-surface-sunken" : "text-ink-faint hover:bg-surface-sunken"
              }`}
              onClick={() => onPick(day)}
            >
              {day.getUTCDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function duePresets(today: Date): { label: string; date: Date | null; hint: string }[] {
  const dow = today.getUTCDay();
  const thisWeek = addUtcDays(today, dow === 0 ? 0 : 7 - dow);
  const nextWeek = addUtcDays(today, dow === 0 ? 1 : 8 - dow);
  const untilSaturday = 6 - dow;
  const nextWeekend = dow === 0 ? addUtcDays(today, 6) : dow === 6 ? addUtcDays(today, 7) : addUtcDays(today, untilSaturday + 7);
  return [
    { label: "Today", date: today, hint: duePresetHint(today, today) },
    { label: "Later", date: null, hint: "" },
    { label: "Tomorrow", date: addUtcDays(today, 1), hint: duePresetHint(addUtcDays(today, 1), today) },
    { label: "This week", date: thisWeek, hint: duePresetHint(thisWeek, today) },
    { label: "Next week", date: nextWeek, hint: duePresetHint(nextWeek, today) },
    { label: "Next weekend", date: nextWeekend, hint: duePresetHint(nextWeekend, today) },
    { label: "2 weeks", date: addUtcDays(today, 14), hint: duePresetHint(addUtcDays(today, 14), today) },
    { label: "4 weeks", date: addUtcDays(today, 28), hint: duePresetHint(addUtcDays(today, 28), today) },
  ];
}

const priorityChoices: Priority[] = ["urgent", "high", "normal", "low"];

export function PriorityPicker({ value, onChange }: { value: Priority; onChange: (priority: Priority) => void }) {
  return (
    <Popover className="relative">
      <PopoverButton
        aria-label={`Priority, ${priorityLabel[value]}`}
        className={`inline-flex items-center gap-1 rounded-md border border-transparent px-1 py-0.5 text-xs text-ink hover:border-line ${focusRing}`}
      >
        <PriorityFlag priority={value} decorative />
        {value === "none" ? null : <span>{priorityLabel[value]}</span>}
      </PopoverButton>
      <PopoverPanel
        anchor="bottom end"
        className="z-50 w-52 rounded-card bg-surface-raised py-1 shadow-pop ring-1 ring-line [--anchor-gap:8px]"
      >
        {({ close }) => (
          <>
            <p className="px-3 py-1.5 text-sm font-medium text-ink">Priority</p>
            {priorityChoices.map((priority) => {
              const selected = value === priority;
              return (
                <button
                  key={priority}
                  type="button"
                  aria-pressed={selected}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-surface"
                  onClick={() => {
                    onChange(priority);
                    close();
                  }}
                >
                  <PriorityFlag priority={priority} decorative />
                  <span className="flex-1">{priorityLabel[priority]}</span>
                  {selected ? <span className="text-ink-muted">✓</span> : null}
                </button>
              );
            })}
            <div className="my-1 border-t border-line" />
            <button
              type="button"
              className="flex w-full px-3 py-1.5 text-left text-sm hover:bg-surface"
              onClick={() => {
                onChange("none");
                close();
              }}
            >
              Clear
            </button>
          </>
        )}
      </PopoverPanel>
    </Popover>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 text-ink-faint">
      <rect x="3" y="4.5" width="14" height="12" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3 8h14M7 3.5v3M13 3.5v3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function EmptyAssignee() {
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-ink-faint text-ink-faint">
      <svg viewBox="0 0 20 20" aria-hidden="true" className="h-3.5 w-3.5">
        <circle cx="10" cy="7" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d="M5.5 15.5c.6-2.2 2.3-3.3 4.5-3.3s3.9 1.1 4.5 3.3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    </span>
  );
}
