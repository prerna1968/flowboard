import { describe, expect, it } from "vitest";
import { ids } from "../fixtures/seed";
import { isError } from "../types";
import { visibleContainers } from "./permissions";
import { subtasksOf, topLevelTasks } from "./selectors";
import { createFlowboardStore } from "./store";

function listNames(store: ReturnType<typeof createFlowboardStore>, userId = store.getState().currentUserId): string[] {
  const state = store.getState();
  const user = state.users.find((item) => item.id === userId);
  if (!user) throw new Error("missing user");
  return visibleContainers(state.containers, user, state.grants)
    .filter((container) => container.type === "list")
    .map((container) => container.name);
}

describe("task access", () => {
  it("seeds at least 15 tasks", () => {
    const store = createFlowboardStore({ persist: false, delayMs: 0 });
    expect(store.getState().tasks.length).toBeGreaterThanOrEqual(15);
  });

  it("rejects an empty title", () => {
    const store = createFlowboardStore({ persist: false, delayMs: 0 });
    const result = store.getState().createTask({ title: "   ", primaryListId: ids.backlog });
    expect(result).toEqual({ error: { code: "VALIDATION", message: "Title is required." } });
  });

  it("rejects titles over 500 characters", () => {
    const store = createFlowboardStore({ persist: false, delayMs: 0 });
    const result = store.getState().createTask({ title: "a".repeat(501), primaryListId: ids.backlog });
    expect(result).toEqual({
      error: { code: "VALIDATION", message: "Title must be 500 characters or fewer." },
    });
  });

  it("accepts a 500 character title", () => {
    const store = createFlowboardStore({ persist: false, delayMs: 0 });
    const result = store.getState().createTask({ title: "a".repeat(500), primaryListId: ids.backlog });
    expect(isError(result)).toBe(false);
  });

  it("lets Alice read and update a Sprint task", () => {
    const store = createFlowboardStore({ persist: false, delayMs: 0 });
    const read = store.getState().readTask("task-tokens");
    expect(isError(read)).toBe(false);
    const update = store.getState().updateTask("task-tokens", { title: "Migrate auth tokens" });
    expect(isError(update)).toBe(false);
  });

  it("returns FORBIDDEN when Bob reads or updates a Sprint task", () => {
    const store = createFlowboardStore({ persist: false, delayMs: 0 });
    store.getState().setCurrentUser(ids.bob);
    const before = store.getState().tasks.find((task) => task.id === "task-tokens")?.title;
    const read = store.getState().readTask("task-tokens");
    const update = store.getState().updateTask("task-tokens", { title: "Nope" });
    expect(isError(read) && read.error.code).toBe("FORBIDDEN");
    expect(isError(update) && update.error.code).toBe("FORBIDDEN");
    expect(store.getState().tasks.find((task) => task.id === "task-tokens")?.title).toBe(before);
  });

  it("rejects a status from another list", () => {
    const store = createFlowboardStore({ persist: false, delayMs: 0 });
    const result = store.getState().updateTask("task-okrs", { statusId: `${ids.sprint}-todo` });
    expect(isError(result) && result.error.code).toBe("VALIDATION");
  });

  it("creates a list directly inside a space", () => {
    const store = createFlowboardStore({ persist: false, delayMs: 0 });
    const result = store.getState().createContainer({
      name: "Loose ends",
      type: "list",
      parentId: ids.engineering,
    });
    expect(isError(result)).toBe(false);
    if (isError(result)) return;
    expect(result.data.parentId).toBe(ids.engineering);
    expect(store.getState().statuses.filter((status) => status.listId === result.data.id)).toHaveLength(3);
  });

  it("still rejects a folder inside a folder", () => {
    const store = createFlowboardStore({ persist: false, delayMs: 0 });
    const result = store.getState().createContainer({ name: "Nested", type: "folder", parentId: ids.q2 });
    expect(result).toEqual({ error: { code: "VALIDATION", message: "Folders belong inside a space." } });
  });

  it("lets a view-only space block task writes for members but not reads", () => {
    const store = createFlowboardStore({ persist: false, delayMs: 0 });
    const space = store.getState().createContainer({
      name: "Read only",
      type: "space",
      parentId: ids.workspace,
      defaultPermission: "view",
    });
    if (isError(space)) throw new Error("space not created");
    const list = store.getState().createContainer({ name: "Notes", type: "list", parentId: space.data.id });
    if (isError(list)) throw new Error("list not created");
    const seeded = store.getState().createTask({ title: "By an admin", primaryListId: list.data.id });
    expect(isError(seeded)).toBe(false);

    store.getState().setCurrentUser(ids.bob);
    expect(isError(store.getState().selectList(list.data.id))).toBe(false);
    const create = store.getState().createTask({ title: "Not allowed", primaryListId: list.data.id });
    expect(create).toEqual({ error: { code: "FORBIDDEN", message: "This space is view only." } });
  });

  it("forbids members from changing containers", () => {
    const store = createFlowboardStore({ persist: false, delayMs: 0 });
    store.getState().setCurrentUser(ids.bob);
    const result = store.getState().createContainer({
      name: "Nope",
      type: "folder",
      parentId: ids.engineering,
    });
    expect(isError(result) && result.error.code).toBe("FORBIDDEN");
  });

  it("hides archived containers from work views until they are restored", () => {
    const store = createFlowboardStore({ persist: false, delayMs: 0 });
    store.getState().archiveContainer(ids.q2);
    expect(listNames(store, ids.alice)).not.toContain("Backlog");
    const restored = store.getState().unarchiveContainer(ids.q2);
    expect(isError(restored)).toBe(false);
    expect(listNames(store, ids.alice)).toContain("Backlog");
    expect(listNames(store, ids.alice)).toContain("Sprint");
  });

  it("forbids members from restoring a container", () => {
    const store = createFlowboardStore({ persist: false, delayMs: 0 });
    store.getState().archiveContainer(ids.sprint);
    store.getState().setCurrentUser(ids.bob);
    const result = store.getState().unarchiveContainer(ids.sprint);
    expect(isError(result) && result.error.code).toBe("FORBIDDEN");
  });

  it("clears a list the new user cannot see", () => {
    const store = createFlowboardStore({ persist: false, delayMs: 0 });
    store.getState().selectList(ids.sprint);
    const result = store.getState().setCurrentUser(ids.bob);
    expect(isError(result) && result.error.code).toBe("FORBIDDEN");
    expect(store.getState().selectedListId).toBeNull();
  });

  it("rolls back a move onto a list the user cannot access", () => {
    const store = createFlowboardStore({ persist: false, delayMs: 0 });
    store.getState().setCurrentUser(ids.bob);
    const task = store.getState().tasks.find((item) => item.id === "task-okrs");
    if (!task) throw new Error("missing task");
    const destination = store
      .getState()
      .tasks.filter(
        (item) =>
          item.primaryListId === ids.sprint &&
          item.statusId === `${ids.sprint}-todo` &&
          !item.archivedAt &&
          !item.parentTaskId,
      )
      .sort((a, b) => a.position - b.position)
      .map((item) => item.id);
    const snapshots: string[] = [];
    const unsubscribe = store.subscribe((state) => {
      snapshots.push(state.tasks.find((item) => item.id === task.id)?.primaryListId ?? "missing");
    });
    const result = store.getState().moveTask({
      taskId: task.id,
      toListId: ids.sprint,
      toStatusId: `${ids.sprint}-todo`,
      orderedIds: [task.id, ...destination],
    });
    unsubscribe();
    expect(isError(result) && result.error.code).toBe("FORBIDDEN");
    expect(snapshots[0]).toBe(ids.sprint);
    expect(snapshots.at(-1)).toBe(ids.backlog);
    expect(store.getState().tasks.find((item) => item.id === task.id)?.primaryListId).toBe(ids.backlog);
    expect(store.getState().tasks.find((item) => item.id === task.id)?.statusId).toBe(task.statusId);
  });

  it("restores an archived task and its subtasks to the end of the column", () => {
    const store = createFlowboardStore({ persist: false, delayMs: 0 });
    const column = () =>
      topLevelTasks(store.getState().tasks, ids.backlog)
        .filter((task) => task.statusId === `${ids.backlog}-todo`)
        .map((task) => task.id);
    const before = column();
    store.getState().archiveTask("task-okrs");
    expect(column()).not.toContain("task-okrs");
    expect(subtasksOf(store.getState().tasks, "task-okrs")).toHaveLength(0);

    const result = store.getState().unarchiveTask("task-okrs");
    expect(isError(result)).toBe(false);
    expect(column()).toEqual([...before.filter((id) => id !== "task-okrs"), "task-okrs"]);
    expect(subtasksOf(store.getState().tasks, "task-okrs").map((task) => task.id)).toEqual(["task-okrs-inputs"]);
  });

  it("brings the parent back when a subtask is restored on its own", () => {
    const store = createFlowboardStore({ persist: false, delayMs: 0 });
    store.getState().archiveTask("task-okrs-inputs");
    store.getState().archiveTask("task-okrs");
    store.getState().unarchiveTask("task-okrs-inputs");
    const tasks = store.getState().tasks;
    expect(tasks.find((task) => task.id === "task-okrs")?.archivedAt).toBeNull();
    expect(tasks.find((task) => task.id === "task-okrs-inputs")?.archivedAt).toBeNull();
  });

  it("forbids restoring a task on a list the user cannot access", () => {
    const store = createFlowboardStore({ persist: false, delayMs: 0 });
    store.getState().archiveTask("task-tokens");
    store.getState().setCurrentUser(ids.bob);
    const result = store.getState().unarchiveTask("task-tokens");
    expect(isError(result) && result.error.code).toBe("FORBIDDEN");
    expect(store.getState().tasks.find((task) => task.id === "task-tokens")?.archivedAt).not.toBeNull();
  });

  it("permanently deletes a space and everything under it", () => {
    const store = createFlowboardStore({ persist: false, delayMs: 0 });
    const space = store.getState().createContainer({
      name: "Throwaway",
      type: "space",
      parentId: ids.workspace,
    });
    if (isError(space)) throw new Error("space not created");
    const list = store.getState().createContainer({ name: "Temp list", type: "list", parentId: space.data.id });
    if (isError(list)) throw new Error("list not created");
    const task = store.getState().createTask({ title: "Temp task", primaryListId: list.data.id });
    expect(isError(task)).toBe(false);

    const result = store.getState().deleteContainer(space.data.id);
    expect(isError(result)).toBe(false);
    expect(store.getState().containers.some((container) => container.id === space.data.id)).toBe(false);
    expect(store.getState().containers.some((container) => container.id === list.data.id)).toBe(false);
    expect(store.getState().statuses.some((status) => status.listId === list.data.id)).toBe(false);
    expect(store.getState().tasks.some((item) => item.primaryListId === list.data.id)).toBe(false);
  });

  it("deletes a list and its tasks, and clears the selection", () => {
    const store = createFlowboardStore({ persist: false, delayMs: 0 });
    store.getState().selectList(ids.sprint);
    store.getState().openTask("task-tokens");
    const result = store.getState().deleteContainer(ids.sprint);
    expect(isError(result)).toBe(false);
    expect(store.getState().containers.some((container) => container.id === ids.sprint)).toBe(false);
    expect(store.getState().tasks.some((task) => task.primaryListId === ids.sprint)).toBe(false);
    expect(store.getState().selectedListId).toBeNull();
    expect(store.getState().selectedTaskId).toBeNull();
  });

  it("forbids members from deleting a container", () => {
    const store = createFlowboardStore({ persist: false, delayMs: 0 });
    store.getState().setCurrentUser(ids.bob);
    const result = store.getState().deleteContainer(ids.sprint);
    expect(isError(result) && result.error.code).toBe("FORBIDDEN");
    expect(store.getState().containers.some((container) => container.id === ids.sprint)).toBe(true);
  });

  it("rejects deleting the workspace", () => {
    const store = createFlowboardStore({ persist: false, delayMs: 0 });
    const result = store.getState().deleteContainer(ids.workspace);
    expect(result).toEqual({ error: { code: "VALIDATION", message: "The workspace can't be deleted." } });
  });

  it("deletes a task and its subtasks", () => {
    const store = createFlowboardStore({ persist: false, delayMs: 0 });
    const result = store.getState().deleteTask("task-okrs");
    expect(isError(result)).toBe(false);
    expect(store.getState().tasks.some((task) => task.id === "task-okrs")).toBe(false);
    expect(store.getState().tasks.some((task) => task.id === "task-okrs-inputs")).toBe(false);
  });

  it("deletes an archived task", () => {
    const store = createFlowboardStore({ persist: false, delayMs: 0 });
    store.getState().archiveTask("task-okrs");
    const result = store.getState().deleteTask("task-okrs");
    expect(isError(result)).toBe(false);
    expect(store.getState().tasks.some((task) => task.id === "task-okrs")).toBe(false);
  });

  it("forbids deleting a task on a list the user cannot access", () => {
    const store = createFlowboardStore({ persist: false, delayMs: 0 });
    store.getState().setCurrentUser(ids.bob);
    const result = store.getState().deleteTask("task-tokens");
    expect(isError(result) && result.error.code).toBe("FORBIDDEN");
    expect(store.getState().tasks.some((task) => task.id === "task-tokens")).toBe(true);
  });

  it("rejects a subtask of a subtask", () => {
    const store = createFlowboardStore({ persist: false, delayMs: 0 });
    const result = store.getState().createTask({
      title: "Too deep",
      primaryListId: ids.backlog,
      parentTaskId: "task-okrs-inputs",
    });
    expect(result).toEqual({ error: { code: "VALIDATION", message: "Subtasks can't contain subtasks." } });
  });
});
