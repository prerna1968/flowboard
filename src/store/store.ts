import { createStore, useStore, type StoreApi } from "zustand";
import { cloneSeed, ids } from "../fixtures/seed";
import type {
  Container,
  ContainerType,
  Grant,
  Permission,
  Priority,
  SortDirection,
  SortKey,
  Status,
  StoreResult,
  Task,
  Toast,
  User,
  ViewMode,
} from "../types";
import { fail, isError, ok } from "../types";
import { canEditTasksOnList, canViewContainer, hasArchivedAncestor, indexById, isViewOnly } from "./permissions";
import { isDescendantOf, statusesForList, subtreeIds } from "./selectors";
import { applyTaskMove, type TaskMoveInput } from "./taskOrder";

const storageKey = "flowboard-v1";

export interface CreateContainerInput {
  name: string;
  type: Exclude<ContainerType, "workspace">;
  parentId: string;
  visibility?: "public" | "private";
  description?: string;
  defaultPermission?: Permission;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  primaryListId: string;
  statusId?: string;
  priority?: Priority;
  assigneeIds?: string[];
  dueDate?: string | null;
  parentTaskId?: string | null;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  statusId?: string;
  priority?: Priority;
  assigneeIds?: string[];
  dueDate?: string | null;
  primaryListId?: string;
}

export interface FlowboardState {
  containers: Container[];
  statuses: Status[];
  tasks: Task[];
  users: User[];
  grants: Grant[];
  currentUserId: string;
  selectedListId: string | null;
  selectedTaskId: string | null;
  view: ViewMode;
  search: string;
  sortKey: SortKey;
  sortDirection: SortDirection;
  booting: boolean;
  listLoading: boolean;
  toasts: Toast[];
  loadToken: number;
  composeTaskListId: string | null;
  composeTaskAt: number;
  setCurrentUser: (userId: string) => StoreResult<User>;
  selectList: (listId: string) => StoreResult<string>;
  requestComposeTask: (listId: string) => StoreResult<string>;
  clearComposeTask: () => void;
  setView: (view: ViewMode) => void;
  setSearch: (search: string) => void;
  toggleSort: (key: SortKey) => void;
  openTask: (taskId: string) => StoreResult<Task>;
  closeTask: () => void;
  dismissToast: (id: string) => void;
  readTask: (taskId: string) => StoreResult<Task>;
  createContainer: (input: CreateContainerInput) => StoreResult<Container>;
  renameContainer: (id: string, name: string) => StoreResult<Container>;
  archiveContainer: (id: string) => StoreResult<Container>;
  unarchiveContainer: (id: string) => StoreResult<Container>;
  deleteContainer: (id: string) => StoreResult<Container>;
  reorderContainers: (parentId: string, orderedIds: string[]) => StoreResult<Container[]>;
  createTask: (input: CreateTaskInput) => StoreResult<Task>;
  updateTask: (id: string, patch: UpdateTaskInput) => StoreResult<Task>;
  archiveTask: (id: string) => StoreResult<Task>;
  unarchiveTask: (id: string) => StoreResult<Task>;
  deleteTask: (id: string) => StoreResult<Task>;
  moveTask: (input: TaskMoveInput) => StoreResult<Task>;
  resetDemo: () => void;
}

interface PersistedShape {
  containers: Container[];
  statuses: Status[];
  tasks: Task[];
  currentUserId: string;
  selectedListId: string | null;
  view: ViewMode;
}

export interface StoreOptions {
  delayMs?: number;
  persist?: boolean;
  storage?: Storage;
  now?: () => string;
}

const parentTypes: Record<Exclude<ContainerType, "workspace">, ContainerType[]> = {
  space: ["workspace"],
  folder: ["space"],
  list: ["space", "folder"],
};

const parentError: Record<Exclude<ContainerType, "workspace">, string> = {
  space: "Spaces belong inside the workspace.",
  folder: "Folders belong inside a space.",
  list: "Lists belong inside a space or folder.",
};

function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function validateName(name: string, label: string, max: number): StoreResult<string> {
  const trimmed = name.trim();
  if (!trimmed) return fail("VALIDATION", `${label} is required.`);
  if (trimmed.length > max) return fail("VALIDATION", `${label} must be ${max} characters or fewer.`);
  return ok(trimmed);
}

function validateTitle(title: string): StoreResult<string> {
  const trimmed = title.trim();
  if (!trimmed) return fail("VALIDATION", "Title is required.");
  if (trimmed.length > 500) return fail("VALIDATION", "Title must be 500 characters or fewer.");
  return ok(trimmed);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function loadPersisted(storage: Storage): PersistedShape | null {
  try {
    const raw = storage.getItem(storageKey);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    if (!Array.isArray(parsed.containers) || !Array.isArray(parsed.statuses) || !Array.isArray(parsed.tasks)) {
      return null;
    }
    if (typeof parsed.currentUserId !== "string") return null;
    if (parsed.view !== "board" && parsed.view !== "list") return null;
    return {
      containers: parsed.containers as Container[],
      statuses: parsed.statuses as Status[],
      tasks: parsed.tasks as Task[],
      currentUserId: parsed.currentUserId,
      selectedListId: typeof parsed.selectedListId === "string" ? parsed.selectedListId : null,
      view: parsed.view,
    };
  } catch {
    return null;
  }
}

function nextPosition(items: { position: number }[]): number {
  if (items.length === 0) return 0;
  return Math.max(...items.map((item) => item.position)) + 1;
}

function reindexColumn(tasks: Task[], listId: string, statusId: string): Task[] {
  const column = tasks
    .filter(
      (task) => task.primaryListId === listId && task.statusId === statusId && !task.archivedAt && !task.parentTaskId,
    )
    .sort((a, b) => a.position - b.position);
  const positions = new Map(column.map((task, index) => [task.id, index]));
  return tasks.map((task) => (positions.has(task.id) ? { ...task, position: positions.get(task.id) ?? task.position } : task));
}

function currentUser(state: FlowboardState): StoreResult<User> {
  const user = state.users.find((item) => item.id === state.currentUserId);
  if (!user) return fail("NOT_FOUND", "User not found.");
  return ok(user);
}

function listAccess(state: FlowboardState, listId: string, mode: "read" | "write" = "read"): StoreResult<Container> {
  const user = currentUser(state);
  if (isError(user)) return user;
  const byId = indexById(state.containers);
  const list = byId.get(listId);
  if (!list || list.type !== "list") return fail("NOT_FOUND", "List not found.");
  if (!canEditTasksOnList(list, user.data, state.grants, byId)) {
    return fail("FORBIDDEN", "You don't have access to this list.");
  }
  if (mode === "write" && isViewOnly(list, user.data, byId)) {
    return fail("FORBIDDEN", "This space is view only.");
  }
  return ok(list);
}

function statusesForNewList(listId: string): Status[] {
  return [
    { id: `${listId}-todo`, listId, name: "To do", category: "todo", color: "todo", position: 0 },
    { id: `${listId}-in_progress`, listId, name: "In progress", category: "in_progress", color: "in_progress", position: 1 },
    { id: `${listId}-done`, listId, name: "Done", category: "done", color: "done", position: 2 },
  ];
}

export function createFlowboardStore(options: StoreOptions = {}): StoreApi<FlowboardState> {
  const delayMs = options.delayMs ?? 280;
  const persist = options.persist ?? true;
  const storage = options.storage ?? (typeof localStorage === "undefined" ? undefined : localStorage);
  const now = options.now ?? (() => new Date().toISOString());
  const fresh = cloneSeed();
  const saved = persist && storage ? loadPersisted(storage) : null;
  const knownUser = fresh.users.some((user) => user.id === saved?.currentUserId)
    ? saved?.currentUserId ?? ids.alice
    : ids.alice;
  const user = fresh.users.find((item) => item.id === knownUser) ?? fresh.users[0];
  let selectedListId = saved ? saved.selectedListId : ids.backlog;
  if (selectedListId) {
    const containers = saved?.containers ?? fresh.containers;
    const list = containers.find((container) => container.id === selectedListId);
    const byId = indexById(containers);
    if (!list || !canViewContainer(list, user, fresh.grants, byId)) selectedListId = ids.backlog;
    const fallback = containers.find((container) => container.id === selectedListId);
    if (!fallback || !canViewContainer(fallback, user, fresh.grants, byId)) selectedListId = null;
  }

  const store = createStore<FlowboardState>((set, get) => {
    const toast = (message: string) => {
      const id = createId("toast");
      set((state) => ({ toasts: [...state.toasts, { id, message }].slice(-4) }));
      if (delayMs > 0) {
        window.setTimeout(() => {
          set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) }));
        }, 4000);
      }
    };

    const reject = <T,>(result: StoreResult<T>): StoreResult<T> => {
      if (isError(result)) toast(result.error.message);
      return result;
    };

    return {
      containers: saved?.containers ?? fresh.containers,
      statuses: saved?.statuses ?? fresh.statuses,
      tasks: saved?.tasks ?? fresh.tasks,
      users: fresh.users,
      grants: fresh.grants,
      currentUserId: user.id,
      selectedListId,
      selectedTaskId: null,
      view: saved?.view ?? "list",
      search: "",
      sortKey: "dueDate",
      sortDirection: "asc",
      booting: delayMs > 0,
      listLoading: false,
      toasts: [],
      loadToken: 0,
      composeTaskListId: null,
      composeTaskAt: 0,

      setCurrentUser: (userId) => {
        const next = get().users.find((item) => item.id === userId);
        if (!next) return reject(fail("NOT_FOUND", "User not found."));
        const state = get();
        const byId = indexById(state.containers);
        let nextList = state.selectedListId;
        let nextTask = state.selectedTaskId;
        let denied = false;
        if (nextList) {
          const list = byId.get(nextList);
          if (!list || !canViewContainer(list, next, state.grants, byId)) {
            nextList = null;
            nextTask = null;
            denied = true;
          }
        }
        if (nextTask) {
          const task = state.tasks.find((item) => item.id === nextTask);
          const list = task ? byId.get(task.primaryListId) : undefined;
          if (!task || !list || !canViewContainer(list, next, state.grants, byId)) nextTask = null;
        }
        set({ currentUserId: next.id, selectedListId: nextList, selectedTaskId: nextTask });
        if (denied) return reject(fail("FORBIDDEN", "You don't have access to this list."));
        return ok(next);
      },

      selectList: (listId) => {
        const access = listAccess(get(), listId);
        if (isError(access)) return reject(access);
        if (get().selectedListId === listId && !get().listLoading) return ok(listId);
        const token = get().loadToken + 1;
        set({
          selectedListId: listId,
          selectedTaskId: null,
          search: "",
          listLoading: delayMs > 0,
          loadToken: token,
        });
        if (delayMs > 0) {
          window.setTimeout(() => {
            if (get().loadToken === token) set({ listLoading: false });
          }, delayMs);
        }
        return ok(listId);
      },

      requestComposeTask: (listId) => {
        const access = listAccess(get(), listId);
        if (isError(access)) return reject(access);
        const same = get().selectedListId === listId && !get().listLoading;
        const token = get().loadToken + 1;
        set({
          selectedListId: listId,
          selectedTaskId: null,
          search: "",
          listLoading: !same && delayMs > 0,
          loadToken: same ? get().loadToken : token,
          composeTaskListId: listId,
          composeTaskAt: get().composeTaskAt + 1,
        });
        if (!same && delayMs > 0) {
          window.setTimeout(() => {
            if (get().loadToken === token) set({ listLoading: false });
          }, delayMs);
        }
        return ok(listId);
      },
      clearComposeTask: () => set({ composeTaskListId: null }),

      setView: (view) => set({ view }),
      setSearch: (search) => set({ search }),
      toggleSort: (key) => {
        const state = get();
        if (state.sortKey !== key) {
          set({ sortKey: key, sortDirection: "asc" });
          return;
        }
        set({ sortDirection: state.sortDirection === "asc" ? "desc" : "asc" });
      },

      readTask: (taskId) => {
        const state = get();
        const task = state.tasks.find((item) => item.id === taskId && !item.archivedAt);
        if (!task) return fail("NOT_FOUND", "Task not found.");
        const access = listAccess(state, task.primaryListId);
        if (isError(access)) return access;
        return ok(task);
      },

      openTask: (taskId) => {
        const result = get().readTask(taskId);
        if (isError(result)) return reject(result);
        set({ selectedTaskId: taskId });
        return result;
      },

      closeTask: () => set({ selectedTaskId: null }),
      dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) })),

      createContainer: (input) => {
        const state = get();
        const userResult = currentUser(state);
        if (isError(userResult)) return reject(userResult);
        if (userResult.data.role !== "admin") {
          return reject(fail("FORBIDDEN", "Only admins can change the workspace structure."));
        }
        const name = validateName(input.name, "Name", 120);
        if (isError(name)) return reject(name);
        const parent = state.containers.find((container) => container.id === input.parentId && !container.archivedAt);
        if (!parent || !parentTypes[input.type].includes(parent.type)) {
          return reject(fail("VALIDATION", parentError[input.type]));
        }
        const byId = indexById(state.containers);
        if (!canViewContainer(parent, userResult.data, state.grants, byId)) {
          return reject(fail("FORBIDDEN", "You don't have access to this list."));
        }
        const siblings = state.containers.filter((container) => container.parentId === parent.id && !container.archivedAt);
        const container: Container = {
          id: createId(input.type),
          name: name.data,
          type: input.type,
          parentId: parent.id,
          position: nextPosition(siblings),
          visibility: input.visibility ?? "public",
          archivedAt: null,
          description: input.description?.trim() ? input.description.trim() : null,
          defaultPermission: input.defaultPermission ?? "edit",
        };
        const statuses = input.type === "list" ? [...state.statuses, ...statusesForNewList(container.id)] : state.statuses;
        set({ containers: [...state.containers, container], statuses });
        return ok(container);
      },

      renameContainer: (id, name) => {
        const state = get();
        const userResult = currentUser(state);
        if (isError(userResult)) return reject(userResult);
        if (userResult.data.role !== "admin") {
          return reject(fail("FORBIDDEN", "Only admins can change the workspace structure."));
        }
        const trimmed = validateName(name, "Name", 120);
        if (isError(trimmed)) return reject(trimmed);
        const container = state.containers.find((item) => item.id === id && !item.archivedAt);
        if (!container) return reject(fail("NOT_FOUND", "Container not found."));
        const next = { ...container, name: trimmed.data };
        set({ containers: state.containers.map((item) => (item.id === id ? next : item)) });
        return ok(next);
      },

      archiveContainer: (id) => {
        const state = get();
        const userResult = currentUser(state);
        if (isError(userResult)) return reject(userResult);
        if (userResult.data.role !== "admin") {
          return reject(fail("FORBIDDEN", "Only admins can change the workspace structure."));
        }
        const container = state.containers.find((item) => item.id === id && !item.archivedAt);
        if (!container) return reject(fail("NOT_FOUND", "Container not found."));
        if (container.type === "workspace") return reject(fail("VALIDATION", "The workspace can't be archived."));
        const archivedAt = now();
        const next = { ...container, archivedAt };
        const selectedGone =
          state.selectedListId !== null && isDescendantOf(state.containers, state.selectedListId, id);
        set({
          containers: state.containers.map((item) => (item.id === id ? next : item)),
          selectedListId: selectedGone ? null : state.selectedListId,
          selectedTaskId: selectedGone ? null : state.selectedTaskId,
        });
        toast(`Archived ${container.name}.`);
        return ok(next);
      },

      unarchiveContainer: (id) => {
        const state = get();
        const userResult = currentUser(state);
        if (isError(userResult)) return reject(userResult);
        if (userResult.data.role !== "admin") {
          return reject(fail("FORBIDDEN", "Only admins can change the workspace structure."));
        }
        const container = state.containers.find((item) => item.id === id && item.archivedAt);
        if (!container) return reject(fail("NOT_FOUND", "Archived item not found."));
        if (hasArchivedAncestor(container, indexById(state.containers))) {
          return reject(fail("VALIDATION", "Restore the parent first."));
        }
        const next = { ...container, archivedAt: null };
        set({ containers: state.containers.map((item) => (item.id === id ? next : item)) });
        toast(`Restored ${container.name}.`);
        return ok(next);
      },

      deleteContainer: (id) => {
        const state = get();
        const userResult = currentUser(state);
        if (isError(userResult)) return reject(userResult);
        if (userResult.data.role !== "admin") {
          return reject(fail("FORBIDDEN", "Only admins can change the workspace structure."));
        }
        const container = state.containers.find((item) => item.id === id);
        if (!container) return reject(fail("NOT_FOUND", "Container not found."));
        if (container.type === "workspace") return reject(fail("VALIDATION", "The workspace can't be deleted."));
        const removed = subtreeIds(state.containers, id);
        const selectedGone =
          state.selectedListId !== null && isDescendantOf(state.containers, state.selectedListId, id);
        const selectedTask = state.tasks.find((task) => task.id === state.selectedTaskId);
        const taskGone = Boolean(selectedTask && removed.has(selectedTask.primaryListId));
        set({
          containers: state.containers.filter((item) => !removed.has(item.id)),
          statuses: state.statuses.filter((status) => !removed.has(status.listId)),
          tasks: state.tasks.filter((task) => !removed.has(task.primaryListId)),
          grants: state.grants.filter((grant) => !removed.has(grant.resourceId)),
          selectedListId: selectedGone ? null : state.selectedListId,
          selectedTaskId: selectedGone || taskGone ? null : state.selectedTaskId,
        });
        toast(`Deleted ${container.name}.`);
        return ok(container);
      },

      reorderContainers: (parentId, orderedIds) => {
        const state = get();
        const userResult = currentUser(state);
        if (isError(userResult)) return reject(userResult);
        if (userResult.data.role !== "admin") {
          return reject(fail("FORBIDDEN", "Only admins can change the workspace structure."));
        }
        const siblings = state.containers.filter((container) => container.parentId === parentId && !container.archivedAt);
        const expected = new Set(siblings.map((container) => container.id));
        if (orderedIds.length !== expected.size || orderedIds.some((id) => !expected.has(id))) {
          return reject(fail("VALIDATION", "Those items can't be reordered together."));
        }
        const rank = new Map(orderedIds.map((id, index) => [id, index]));
        const containers = state.containers.map((container) =>
          rank.has(container.id) ? { ...container, position: rank.get(container.id) ?? container.position } : container,
        );
        set({ containers });
        return ok(containers.filter((container) => rank.has(container.id)));
      },

      createTask: (input) => {
        const state = get();
        const access = listAccess(state, input.primaryListId, "write");
        if (isError(access)) return reject(access);
        const title = validateTitle(input.title);
        if (isError(title)) return reject(title);
        const listStatuses = statusesForList(state.statuses, input.primaryListId);
        const status =
          listStatuses.find((item) => item.id === input.statusId) ??
          listStatuses.find((item) => item.category === "todo") ??
          listStatuses[0];
        if (!status) return reject(fail("VALIDATION", "Status is not on this list."));
        if (input.statusId && !listStatuses.some((item) => item.id === input.statusId)) {
          return reject(fail("VALIDATION", "Status is not on this list."));
        }
        if (input.parentTaskId) {
          const parent = state.tasks.find((task) => task.id === input.parentTaskId && !task.archivedAt);
          if (!parent || parent.primaryListId !== input.primaryListId) {
            return reject(fail("VALIDATION", "Subtasks stay on the parent task's list."));
          }
          if (parent.parentTaskId) return reject(fail("VALIDATION", "Subtasks can't contain subtasks."));
        }
        const assignees = validateAssignees(state.users, input.assigneeIds ?? []);
        if (isError(assignees)) return reject(assignees);
        const column = state.tasks.filter(
          (task) =>
            task.primaryListId === input.primaryListId &&
            task.statusId === status.id &&
            task.parentTaskId === (input.parentTaskId ?? null) &&
            !task.archivedAt,
        );
        const timestamp = now();
        const task: Task = {
          id: createId("task"),
          title: title.data,
          description: input.description?.trim() ?? "",
          primaryListId: input.primaryListId,
          statusId: status.id,
          priority: input.priority ?? "none",
          assigneeIds: assignees.data,
          dueDate: input.dueDate ?? null,
          position: nextPosition(column),
          parentTaskId: input.parentTaskId ?? null,
          createdAt: timestamp,
          updatedAt: timestamp,
          archivedAt: null,
        };
        set({ tasks: [...state.tasks, task] });
        return ok(task);
      },

      updateTask: (id, patch) => {
        const state = get();
        const existing = state.tasks.find((task) => task.id === id && !task.archivedAt);
        if (!existing) return reject(fail("NOT_FOUND", "Task not found."));
        const source = listAccess(state, existing.primaryListId, "write");
        if (isError(source)) return reject(source);
        const nextListId = patch.primaryListId ?? existing.primaryListId;
        if (nextListId !== existing.primaryListId) {
          const destination = listAccess(state, nextListId, "write");
          if (isError(destination)) return reject(destination);
        }
        let title = existing.title;
        if (patch.title !== undefined) {
          const validated = validateTitle(patch.title);
          if (isError(validated)) return reject(validated);
          title = validated.data;
        }
        let assignees = existing.assigneeIds;
        if (patch.assigneeIds) {
          const validated = validateAssignees(state.users, patch.assigneeIds);
          if (isError(validated)) return reject(validated);
          assignees = validated.data;
        }
        const listStatuses = statusesForList(state.statuses, nextListId);
        let statusId = existing.statusId;
        if (nextListId !== existing.primaryListId) {
          const current = state.statuses.find((status) => status.id === existing.statusId);
          const mapped =
            listStatuses.find((status) => status.id === patch.statusId) ??
            listStatuses.find((status) => status.category === current?.category) ??
            listStatuses[0];
          if (!mapped) return reject(fail("VALIDATION", "Status is not on this list."));
          statusId = mapped.id;
        } else if (patch.statusId) {
          if (!listStatuses.some((status) => status.id === patch.statusId)) {
            return reject(fail("VALIDATION", "Status is not on this list."));
          }
          statusId = patch.statusId;
        }
        const timestamp = now();
        let tasks = state.tasks.map((task) => {
          if (task.id === id) {
            return {
              ...task,
              title,
              description: patch.description !== undefined ? patch.description.trim() : task.description,
              priority: patch.priority ?? task.priority,
              assigneeIds: assignees,
              dueDate: patch.dueDate !== undefined ? patch.dueDate : task.dueDate,
              primaryListId: nextListId,
              statusId,
              position: statusId === existing.statusId && nextListId === existing.primaryListId ? task.position : 10_000,
              updatedAt: timestamp,
            };
          }
          if (task.parentTaskId === id && nextListId !== existing.primaryListId) {
            const current = state.statuses.find((status) => status.id === task.statusId);
            const mapped = listStatuses.find((status) => status.category === current?.category) ?? listStatuses[0];
            return {
              ...task,
              primaryListId: nextListId,
              statusId: mapped?.id ?? statusId,
              updatedAt: timestamp,
            };
          }
          return task;
        });
        if (existing.statusId !== statusId || existing.primaryListId !== nextListId) {
          tasks = reindexColumn(tasks, existing.primaryListId, existing.statusId);
          tasks = reindexColumn(tasks, nextListId, statusId);
        }
        set({ tasks });
        const updated = tasks.find((task) => task.id === id);
        if (!updated) return reject(fail("NOT_FOUND", "Task not found."));
        return ok(updated);
      },

      archiveTask: (id) => {
        const state = get();
        const existing = state.tasks.find((task) => task.id === id && !task.archivedAt);
        if (!existing) return reject(fail("NOT_FOUND", "Task not found."));
        const access = listAccess(state, existing.primaryListId, "write");
        if (isError(access)) return reject(access);
        const archivedAt = now();
        const tasks = state.tasks.map((task) =>
          task.id === id || task.parentTaskId === id ? { ...task, archivedAt, updatedAt: archivedAt } : task,
        );
        const selectedIsChild = state.tasks.some(
          (task) => task.id === state.selectedTaskId && task.parentTaskId === id,
        );
        set({
          tasks,
          selectedTaskId: state.selectedTaskId === id || selectedIsChild ? null : state.selectedTaskId,
        });
        toast(`Archived ${existing.title}.`);
        return ok(tasks.find((task) => task.id === id)!);
      },

      unarchiveTask: (id) => {
        const state = get();
        const existing = state.tasks.find((task) => task.id === id && task.archivedAt);
        if (!existing) return reject(fail("NOT_FOUND", "Archived task not found."));
        const access = listAccess(state, existing.primaryListId, "write");
        if (isError(access)) return reject(access);
        const restored = new Set<string>([id]);
        for (const task of state.tasks) {
          if (task.parentTaskId === id && task.archivedAt === existing.archivedAt) restored.add(task.id);
        }
        // A subtask is only reachable once its parent is back on the list.
        if (existing.parentTaskId) {
          const parent = state.tasks.find((task) => task.id === existing.parentTaskId);
          if (parent?.archivedAt) restored.add(parent.id);
        }
        const timestamp = now();
        let tasks = state.tasks.map((task) =>
          restored.has(task.id) ? { ...task, archivedAt: null, updatedAt: timestamp } : task,
        );
        const columns = new Map<string, { listId: string; statusId: string }>();
        for (const taskId of restored) {
          const task = tasks.find((item) => item.id === taskId);
          if (!task || task.parentTaskId) continue;
          const siblings = tasks.filter(
            (item) =>
              item.id !== task.id &&
              item.primaryListId === task.primaryListId &&
              item.statusId === task.statusId &&
              !item.parentTaskId &&
              !item.archivedAt,
          );
          const position = nextPosition(siblings);
          tasks = tasks.map((item) => (item.id === task.id ? { ...item, position } : item));
          columns.set(`${task.primaryListId}::${task.statusId}`, {
            listId: task.primaryListId,
            statusId: task.statusId,
          });
        }
        for (const column of columns.values()) {
          tasks = reindexColumn(tasks, column.listId, column.statusId);
        }
        set({ tasks });
        toast(`Restored ${existing.title}.`);
        return ok(tasks.find((task) => task.id === id)!);
      },

      deleteTask: (id) => {
        const state = get();
        const existing = state.tasks.find((task) => task.id === id);
        if (!existing) return reject(fail("NOT_FOUND", "Task not found."));
        const access = listAccess(state, existing.primaryListId, "write");
        if (isError(access)) return reject(access);
        const removed = new Set<string>([id]);
        for (const task of state.tasks) {
          if (task.parentTaskId === id) removed.add(task.id);
        }
        let tasks = state.tasks.filter((task) => !removed.has(task.id));
        if (!existing.parentTaskId && !existing.archivedAt) {
          tasks = reindexColumn(tasks, existing.primaryListId, existing.statusId);
        }
        set({
          tasks,
          selectedTaskId: state.selectedTaskId && removed.has(state.selectedTaskId) ? null : state.selectedTaskId,
        });
        toast(`Deleted ${existing.title}.`);
        return ok(existing);
      },

      moveTask: (input) => {
        const state = get();
        const userResult = currentUser(state);
        if (isError(userResult)) return reject(userResult);
        const applied = applyTaskMove(state.tasks, state.statuses, input, now());
        if (isError(applied)) return reject(applied);
        const task = state.tasks.find((item) => item.id === input.taskId);
        const byId = indexById(state.containers);
        const source = task ? byId.get(task.primaryListId) : undefined;
        const destination = byId.get(input.toListId);
        set({ tasks: applied.data });
        const allowed =
          source &&
          destination &&
          canEditTasksOnList(source, userResult.data, state.grants, byId) &&
          canEditTasksOnList(destination, userResult.data, state.grants, byId) &&
          !isViewOnly(source, userResult.data, byId) &&
          !isViewOnly(destination, userResult.data, byId);
        if (!allowed) {
          set({ tasks: state.tasks });
          return reject(fail("FORBIDDEN", "You don't have access to this list."));
        }
        return ok(applied.data.find((item) => item.id === input.taskId)!);
      },

      resetDemo: () => {
        const next = cloneSeed();
        set({
          containers: next.containers,
          statuses: next.statuses,
          tasks: next.tasks,
          users: next.users,
          grants: next.grants,
          currentUserId: ids.alice,
          selectedListId: ids.backlog,
          selectedTaskId: null,
          view: "list",
          search: "",
          sortKey: "dueDate",
          sortDirection: "asc",
          booting: false,
          listLoading: false,
          toasts: [],
          loadToken: get().loadToken + 1,
          composeTaskListId: null,
          composeTaskAt: 0,
        });
        toast("Demo data reset.");
      },
    };
  });

  if (delayMs > 0) {
    window.setTimeout(() => store.setState({ booting: false }), delayMs);
  }

  if (persist && storage) {
    store.subscribe((state) => {
      const payload: PersistedShape = {
        containers: state.containers,
        statuses: state.statuses,
        tasks: state.tasks,
        currentUserId: state.currentUserId,
        selectedListId: state.selectedListId,
        view: state.view,
      };
      storage.setItem(storageKey, JSON.stringify(payload));
    });
  }

  return store;
}

function validateAssignees(users: User[], assigneeIds: string[]): StoreResult<string[]> {
  const unique = [...new Set(assigneeIds)];
  if (unique.some((id) => !users.some((user) => user.id === id))) {
    return fail("VALIDATION", "Unknown assignee.");
  }
  return ok(unique);
}

const testMode = import.meta.env.MODE === "test";

export const flowboard = createFlowboardStore({
  delayMs: testMode ? 0 : 280,
  persist: !testMode,
});

export function useFlowboard<T>(selector: (state: FlowboardState) => T): T {
  return useStore(flowboard, selector);
}
