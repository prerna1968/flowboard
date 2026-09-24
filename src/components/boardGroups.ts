import { addUtcDays, localTodayUtc, parseDue, sameUtcDay, toDueIso } from "../lib/format";
import type { Priority, Status, Task, User } from "../types";

export type BoardGroupBy = "status" | "assignee" | "priority" | "tags" | "due" | "type";
export type BoardDirection = "asc" | "desc";

export const boardGroupOptions: { id: BoardGroupBy; label: string }[] = [
  { id: "status", label: "Status" },
  { id: "assignee", label: "Assignee" },
  { id: "priority", label: "Priority" },
  { id: "tags", label: "Tags" },
  { id: "due", label: "Due date" },
  { id: "type", label: "Task Type" },
];

export interface BoardColumnModel {
  id: string;
  label: string;
  tasks: Task[];
  statusId?: string;
  statusColor?: string;
  priority?: Priority;
  assigneeIds?: string[];
  dueDate?: string | null;
}

const priorityOrder: Priority[] = ["urgent", "high", "normal", "low", "none"];
const priorityName: Record<Priority, string> = {
  urgent: "Urgent",
  high: "High",
  normal: "Normal",
  low: "Low",
  none: "No priority",
};

export function boardColumns(
  groupBy: BoardGroupBy,
  direction: BoardDirection,
  tasks: Task[],
  statuses: Status[],
  users: User[],
): BoardColumnModel[] {
  const columns = columnsFor(groupBy, tasks, statuses, users);
  return direction === "desc" ? [...columns].reverse() : columns;
}

function columnsFor(groupBy: BoardGroupBy, tasks: Task[], statuses: Status[], users: User[]): BoardColumnModel[] {
  if (groupBy === "status") {
    return [...statuses]
      .sort((a, b) => a.position - b.position)
      .map((status) => ({
        id: status.id,
        label: status.name,
        statusId: status.id,
        statusColor: status.color,
        tasks: tasks.filter((task) => task.statusId === status.id),
      }));
  }
  if (groupBy === "assignee") {
    const people = [...users].sort((a, b) => a.name.localeCompare(b.name));
    return [
      ...people.map((user) => ({
        id: user.id,
        label: user.name,
        assigneeIds: [user.id],
        tasks: tasks.filter((task) => task.assigneeIds[0] === user.id),
      })),
      {
        id: "unassigned",
        label: "Unassigned",
        assigneeIds: [],
        tasks: tasks.filter((task) => task.assigneeIds.length === 0 || !people.some((user) => user.id === task.assigneeIds[0])),
      },
    ];
  }
  if (groupBy === "priority") {
    return priorityOrder.map((priority) => ({
      id: priority,
      label: priorityName[priority],
      priority,
      tasks: tasks.filter((task) => task.priority === priority),
    }));
  }
  if (groupBy === "due") {
    return dueColumns(tasks);
  }
  return [
    {
      id: "none",
      label: groupBy === "tags" ? "No tags" : "No type",
      tasks,
    },
  ];
}

function dueColumns(tasks: Task[]): BoardColumnModel[] {
  const today = localTodayUtc();
  const buckets: { id: string; label: string; dueDate: string | null; match: (task: Task) => boolean }[] = [
    { id: "overdue", label: "Overdue", dueDate: toDueIso(addUtcDays(today, -1)), match: (task) => bucketOf(task, today) === "overdue" },
    { id: "today", label: "Today", dueDate: toDueIso(today), match: (task) => bucketOf(task, today) === "today" },
    { id: "tomorrow", label: "Tomorrow", dueDate: toDueIso(addUtcDays(today, 1)), match: (task) => bucketOf(task, today) === "tomorrow" },
    { id: "week", label: "This week", dueDate: toDueIso(endOfWeek(today)), match: (task) => bucketOf(task, today) === "week" },
    { id: "later", label: "Later", dueDate: toDueIso(addUtcDays(today, 14)), match: (task) => bucketOf(task, today) === "later" },
    { id: "none", label: "No date", dueDate: null, match: (task) => bucketOf(task, today) === "none" },
  ];
  return buckets.map((bucket) => ({
    id: bucket.id,
    label: bucket.label,
    dueDate: bucket.dueDate,
    tasks: tasks.filter(bucket.match),
  }));
}

function bucketOf(task: Task, today: Date): string {
  const date = parseDue(task.dueDate);
  if (!date) return "none";
  if (date.getTime() < today.getTime()) return "overdue";
  if (sameUtcDay(date, today)) return "today";
  if (sameUtcDay(date, addUtcDays(today, 1))) return "tomorrow";
  if (date.getTime() <= endOfWeek(today).getTime()) return "week";
  return "later";
}

function endOfWeek(today: Date): Date {
  const dow = today.getUTCDay();
  return addUtcDays(today, dow === 0 ? 0 : 7 - dow);
}
