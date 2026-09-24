# AI usage

Tool: Cursor, with the model implementing the app from the take-home brief and an approved plan.

## Where it helped

- Scaffolded the Vite + React + TypeScript app and wired Tailwind, Zustand, dnd-kit, Headless UI, and Vitest.
- Drafted the typed seed, the permission walk, the store mutations, and the board, list, and drawer UI.
- Wrote the first pass of the permission and user-switcher tests.

## What was corrected

- The app stays a separate repo. It was not folded into an existing product codebase.
- Permission checks live in `src/store/permissions.ts` and are called by selectors and mutations. Hiding a sidebar row is not the check.
- `src/index.css` is only the three Tailwind directives. Colors, type, radius, and shadow are Tailwind theme tokens. The only inline styles are the dnd-kit `transform`/`transition`, the sidebar width, and the edge tooltip's vertical position.
- The user-switcher test needed a `ResizeObserver` stub because Headless UI's menu reads it and jsdom does not provide it. "Backlog" also renders in the breadcrumb, so the assertion is scoped to the sidebar.
- A drag onto a forbidden list is applied and then restored. The unit test records both store snapshots so the rollback is real, not only a guard that never writes.

## What was rejected

- A custom CSS file, CSS modules, or a component library that brings its own styles.
- Cascading grants. An allow on a space does not unlock a private child.
- Status editing, pagination, activity, and bulk actions in this pass. The README lists them as follow-up work.
