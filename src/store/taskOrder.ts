import { fail, ok, type Status, type StoreResult, type Task } from "../types";

export interface TaskMoveInput {
  taskId: string;
  toListId: string;
  toStatusId: string;
  orderedIds: string[];
}

export function applyTaskMove(
  tasks: Task[],
  statuses: Status[],
  input: TaskMoveInput,
  now: string,
): StoreResult<Task[]> {
  const task = tasks.find((item) => item.id === input.taskId && !item.archivedAt);
  if (!task) return fail("NOT_FOUND", "Task not found.");
  if (task.parentTaskId) return fail("VALIDATION", "Reorder a subtask from the task drawer.");

  const status = statuses.find((item) => item.id === input.toStatusId);
  if (!status || status.listId !== input.toListId) {
    return fail("VALIDATION", "Status is not on this list.");
  }

  const destination = tasks
    .filter(
      (item) =>
        item.primaryListId === input.toListId &&
        item.statusId === input.toStatusId &&
        !item.archivedAt &&
        !item.parentTaskId &&
        item.id !== task.id,
    )
    .sort((a, b) => a.position - b.position);

  const expected = new Set([...destination.map((item) => item.id), task.id]);
  if (input.orderedIds.length !== expected.size || input.orderedIds.some((id) => !expected.has(id))) {
    return fail("VALIDATION", "Task order is out of date. Try again.");
  }

  const position = new Map(input.orderedIds.map((id, index) => [id, index]));
  const leavingColumn = task.primaryListId !== input.toListId || task.statusId !== input.toStatusId;
  const source = leavingColumn
    ? tasks
        .filter(
          (item) =>
            item.primaryListId === task.primaryListId &&
            item.statusId === task.statusId &&
            !item.archivedAt &&
            !item.parentTaskId &&
            item.id !== task.id,
        )
        .sort((a, b) => a.position - b.position)
    : [];
  const sourcePosition = new Map(source.map((item, index) => [item.id, index]));

  const next = tasks.map((item) => {
    if (item.id === task.id) {
      return {
        ...item,
        primaryListId: input.toListId,
        statusId: input.toStatusId,
        position: position.get(item.id) ?? 0,
        updatedAt: now,
      };
    }
    if (item.parentTaskId === task.id && input.toListId !== task.primaryListId) {
      const current = statuses.find((entry) => entry.id === item.statusId);
      const mapped = statuses.find(
        (entry) => entry.listId === input.toListId && entry.category === current?.category,
      );
      return {
        ...item,
        primaryListId: input.toListId,
        statusId: mapped?.id ?? input.toStatusId,
        updatedAt: now,
      };
    }
    if (position.has(item.id)) return { ...item, position: position.get(item.id) ?? item.position };
    if (sourcePosition.has(item.id)) {
      return { ...item, position: sourcePosition.get(item.id) ?? item.position };
    }
    return item;
  });

  return ok(next);
}
