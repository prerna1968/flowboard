import { describe, expect, it } from "vitest";
import type { Container } from "../types";
import { ids, seed } from "../fixtures/seed";
import { canViewContainer, indexById, sidebarContainers, visibleContainers } from "./permissions";

function listNames(userId: string, containers = seed.containers, grants = seed.grants): string[] {
  const user = seed.users.find((item) => item.id === userId);
  if (!user) throw new Error("missing user");
  return visibleContainers(containers, user, grants)
    .filter((container) => container.type === "list")
    .map((container) => container.name)
    .sort();
}

function treeNames(userId: string, containers = seed.containers, grants = seed.grants): string[] {
  const user = seed.users.find((item) => item.id === userId);
  if (!user) throw new Error("missing user");
  return sidebarContainers(containers, user, grants).map((container) => container.name);
}

describe("permission filtering", () => {
  it("lets Alice see every list", () => {
    expect(listNames(ids.alice)).toEqual(["Backlog", "Ideas", "Sprint"]);
  });

  it("filters Bob's sidebar tree by deny and private grants", () => {
    const names = treeNames(ids.bob);
    expect(names).toContain("Engineering");
    expect(names).toContain("Backlog");
    expect(names).toContain("Design");
    expect(names).toContain("Ideas");
    expect(names).not.toContain("Sprint");
  });

  it("keeps Sprint on Carol's tree and hides the private Design space", () => {
    const names = treeNames(ids.carol);
    expect(names).toContain("Sprint");
    expect(names).toContain("Backlog");
    expect(names).not.toContain("Design");
    expect(names).not.toContain("Ideas");
  });

  it("hides Sprint from Bob and shows the private Design list", () => {
    const names = listNames(ids.bob);
    expect(names).toContain("Backlog");
    expect(names).toContain("Ideas");
    expect(names).not.toContain("Sprint");
  });

  it("shows Sprint to Carol and hides the private Design space", () => {
    const names = listNames(ids.carol);
    expect(names).toContain("Backlog");
    expect(names).toContain("Sprint");
    expect(names).not.toContain("Ideas");
    const carol = seed.users.find((user) => user.id === ids.carol)!;
    const design = seed.containers.find((container) => container.id === ids.design)!;
    expect(canViewContainer(design, carol, seed.grants, indexById(seed.containers))).toBe(false);
  });

  it("lets a deny grant hide a public list", () => {
    const sprint = seed.containers.find((container) => container.id === ids.sprint)!;
    expect(sprint.visibility).toBe("public");
    const bob = seed.users.find((user) => user.id === ids.bob)!;
    expect(canViewContainer(sprint, bob, seed.grants, indexById(seed.containers))).toBe(false);
  });

  it("hides a private container without an allow grant", () => {
    const design = seed.containers.find((container) => container.id === ids.design)!;
    const carol = seed.users.find((user) => user.id === ids.carol)!;
    expect(canViewContainer(design, carol, seed.grants, indexById(seed.containers))).toBe(false);
  });

  it("does not cascade an allow onto a private child", () => {
    const secret: Container = {
      id: "list-secret",
      name: "Secret",
      type: "list",
      parentId: ids.brand,
      position: 1,
      visibility: "private",
      archivedAt: null,
    };
    const containers = [...seed.containers, secret];
    const bob = seed.users.find((user) => user.id === ids.bob)!;
    const byId = indexById(containers);
    expect(canViewContainer(secret, bob, seed.grants, byId)).toBe(false);
    const ideas = containers.find((container) => container.id === ids.ideas)!;
    expect(canViewContainer(ideas, bob, seed.grants, byId)).toBe(true);
  });

  it("keeps an archived list in the sidebar for admins but not members", () => {
    const containers = seed.containers.map((container) =>
      container.id === ids.sprint ? { ...container, archivedAt: "2026-09-24T00:00:00.000Z" } : container,
    );
    const alice = seed.users.find((user) => user.id === ids.alice)!;
    const bob = seed.users.find((user) => user.id === ids.bob)!;
    const adminTree = sidebarContainers(containers, alice, seed.grants).map((container) => container.name);
    const memberTree = sidebarContainers(containers, bob, seed.grants).map((container) => container.name);
    expect(adminTree).toContain("Sprint");
    expect(memberTree).not.toContain("Sprint");
    expect(visibleContainers(containers, alice, seed.grants).some((container) => container.id === ids.sprint)).toBe(false);
  });
});
