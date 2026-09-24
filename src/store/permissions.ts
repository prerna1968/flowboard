import type { Container, Grant, User } from "../types";

export function indexById<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

export function canViewContainer(
  container: Container,
  user: User,
  grants: Grant[],
  byId: Map<string, Container>,
  options: { allowArchived?: boolean } = {},
): boolean {
  let current: Container | undefined = container;
  const seen = new Set<string>();

  while (current) {
    if (seen.has(current.id)) return false;
    seen.add(current.id);
    if (current.archivedAt && !options.allowArchived) return false;

    if (user.role !== "admin") {
      const grant = grants.find((item) => item.resourceId === current!.id && item.userId === user.id);
      if (grant?.mode === "deny") return false;
      if (current.visibility === "private" && grant?.mode !== "allow") return false;
    }

    if (!current.parentId) return true;
    const parent = byId.get(current.parentId);
    if (!parent) return user.role === "admin";
    current = parent;
  }

  return false;
}

export function visibleContainers(containers: Container[], user: User, grants: Grant[]): Container[] {
  const byId = indexById(containers);
  return containers.filter((container) => canViewContainer(container, user, grants, byId));
}

export function hasArchivedAncestor(container: Container, byId: Map<string, Container>): boolean {
  let current = container.parentId ? byId.get(container.parentId) : undefined;
  const seen = new Set<string>();

  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    if (current.archivedAt) return true;
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }

  return false;
}

export function sidebarContainers(containers: Container[], user: User, grants: Grant[]): Container[] {
  const byId = indexById(containers);
  return containers.filter((container) => {
    if (hasArchivedAncestor(container, byId)) return false;
    if (container.archivedAt && user.role !== "admin") return false;
    return canViewContainer(container, user, grants, byId, { allowArchived: true });
  });
}

export function isViewOnly(container: Container, user: User, byId: Map<string, Container>): boolean {
  if (user.role === "admin") return false;
  let current: Container | undefined = container;
  const seen = new Set<string>();

  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    if (current.defaultPermission === "view") return true;
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }

  return false;
}

export function canEditTasksOnList(
  list: Container,
  user: User,
  grants: Grant[],
  byId: Map<string, Container>,
): boolean {
  return list.type === "list" && canViewContainer(list, user, grants, byId);
}
