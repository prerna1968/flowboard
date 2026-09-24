import type { Container, Grant, Priority, SortDirection, SortKey, Status, Task, User } from "../types";
import { visibleContainers } from "./permissions";

const priorityRank: Record<Priority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
  none: 4,
};

export function childContainers(
  containers: Container[],
  parentId: string | null,
  options: { archived?: boolean } = {},
): Container[] {
  return containers
    .filter((container) => container.parentId === parentId && (options.archived || !container.archivedAt))
    .sort((a, b) => {
      const archived = Number(Boolean(a.archivedAt)) - Number(Boolean(b.archivedAt));
      if (archived !== 0) return archived;
      return a.position - b.position || a.name.localeCompare(b.name);
    });
}

export function statusesForList(statuses: Status[], listId: string): Status[] {
  return statuses.filter((status) => status.listId === listId).sort((a, b) => a.position - b.position);
}

export function topLevelTasks(tasks: Task[], listId: string): Task[] {
  return tasks
    .filter((task) => task.primaryListId === listId && !task.archivedAt && !task.parentTaskId)
    .sort((a, b) => a.position - b.position);
}

export function tasksInStatus(tasks: Task[], listId: string, statusId: string): Task[] {
  return topLevelTasks(tasks, listId)
    .filter((task) => task.statusId === statusId)
    .sort((a, b) => a.position - b.position);
}

export function archivedTasks(tasks: Task[], listId: string): Task[] {
  return tasks
    .filter((task) => task.primaryListId === listId && task.archivedAt)
    .sort((a, b) => (b.archivedAt ?? "").localeCompare(a.archivedAt ?? "") || a.title.localeCompare(b.title));
}

export function subtasksOf(tasks: Task[], parentId: string): Task[] {
  return tasks
    .filter((task) => task.parentTaskId === parentId && !task.archivedAt)
    .sort((a, b) => a.position - b.position);
}

function matches(task: Task, query: string): boolean {
  return task.title.toLowerCase().includes(query) || task.description.toLowerCase().includes(query);
}

export function filterBySearch(tasks: Task[], allTasks: Task[], search: string): Task[] {
  const query = search.trim().toLowerCase();
  if (!query) return tasks;
  return tasks.filter(
    (task) =>
      matches(task, query) ||
      allTasks.some((subtask) => subtask.parentTaskId === task.id && !subtask.archivedAt && matches(subtask, query)),
  );
}

function compareDue(a: string | null, b: string | null): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function sortTasks(tasks: Task[], key: SortKey, direction: SortDirection): Task[] {
  const factor = direction === "asc" ? 1 : -1;
  return [...tasks].sort((a, b) => {
    if (key === "dueDate") {
      const dueA = a.dueDate;
      const dueB = b.dueDate;
      if (!dueA && !dueB) return a.position - b.position;
      if (!dueA) return 1;
      if (!dueB) return -1;
      const diff = compareDue(dueA, dueB);
      if (diff !== 0) return diff * factor;
      return a.position - b.position;
    }
    const diff = priorityRank[a.priority] - priorityRank[b.priority];
    if (diff !== 0) return diff * factor;
    return a.position - b.position;
  });
}

export function ancestorChain(containers: Container[], id: string): Container[] {
  const chain: Container[] = [];
  let current = containers.find((container) => container.id === id);
  const seen = new Set<string>();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    chain.unshift(current);
    current = current.parentId ? containers.find((container) => container.id === current?.parentId) : undefined;
  }
  return chain;
}

export function isDescendantOf(containers: Container[], nodeId: string, ancestorId: string): boolean {
  return ancestorChain(containers, nodeId).some((container) => container.id === ancestorId);
}

export function subtreeIds(containers: Container[], rootId: string): Set<string> {
  return new Set(
    containers
      .filter((container) => isDescendantOf(containers, container.id, rootId))
      .map((container) => container.id),
  );
}

export function visibleLists(containers: Container[], user: User, grants: Grant[]): Container[] {
  return visibleContainers(containers, user, grants)
    .filter((container) => container.type === "list")
    .sort((a, b) => a.name.localeCompare(b.name));
}
