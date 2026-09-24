export type ContainerType = "workspace" | "space" | "folder" | "list";
export type Visibility = "public" | "private";
export type Priority = "urgent" | "high" | "normal" | "low" | "none";
export type StatusCategory = "todo" | "in_progress" | "done";
export type Role = "admin" | "member";
export type GrantMode = "allow" | "deny";
export type Permission = "edit" | "view";
export type ViewMode = "board" | "list";
export type SortKey = "dueDate" | "priority";
export type SortDirection = "asc" | "desc";

export interface Container {
  id: string;
  name: string;
  type: ContainerType;
  parentId: string | null;
  position: number;
  visibility: Visibility;
  archivedAt: string | null;
  description?: string | null;
  // Absent means "edit", so seeded and persisted containers stay editable.
  defaultPermission?: Permission;
}

export interface Status {
  id: string;
  listId: string;
  name: string;
  category: StatusCategory;
  color: string;
  position: number;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  primaryListId: string;
  statusId: string;
  priority: Priority;
  assigneeIds: string[];
  dueDate: string | null;
  position: number;
  parentTaskId: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface User {
  id: string;
  name: string;
  role: Role;
  initials: string;
}

export interface Grant {
  id: string;
  resourceId: string;
  userId: string;
  mode: GrantMode;
}

export interface StoreError {
  code: "FORBIDDEN" | "NOT_FOUND" | "VALIDATION";
  message: string;
}

export type StoreResult<T> = { data: T } | { error: StoreError };

export function ok<T>(data: T): StoreResult<T> {
  return { data };
}

export function fail(code: StoreError["code"], message: string): StoreResult<never> {
  return { error: { code, message } };
}

export function isError<T>(result: StoreResult<T>): result is { error: StoreError } {
  return "error" in result;
}

export interface SeedData {
  containers: Container[];
  statuses: Status[];
  tasks: Task[];
  users: User[];
  grants: Grant[];
}

export interface Toast {
  id: string;
  message: string;
}
