import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import App from "./App";
import { defaultTheme, themeStorageKey } from "./lib/theme";
import { flowboard } from "./store/store";

describe("user switcher", () => {
  beforeEach(() => {
    flowboard.getState().resetDemo();
  });

  afterEach(() => {
    localStorage.removeItem(themeStorageKey);
    document.documentElement.dataset.appearance = defaultTheme.appearance;
    document.documentElement.dataset.accent = defaultTheme.accent;
    document.documentElement.style.colorScheme = defaultTheme.appearance;
  });

  it("hides Sprint and its tasks when switching from Alice to Bob", async () => {
    const user = userEvent.setup();
    render(<App />);

    const sidebar = screen.getByRole("complementary");
    expect(within(sidebar).getByRole("button", { name: "Sprint" })).toBeInTheDocument();
    expect(within(sidebar).getByRole("button", { name: "Ideas" })).toBeInTheDocument();

    await user.click(within(sidebar).getByRole("button", { name: "Sprint" }));
    expect(screen.getByRole("heading", { name: "Sprint" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Migrate auth tokens" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /switch user/i }));
    const dialog = screen.getByRole("dialog", { name: /switch user/i });
    await user.click(within(dialog).getByRole("button", { name: /bob/i }));

    expect(within(sidebar).queryByRole("button", { name: "Sprint" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Sprint" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Migrate auth tokens" })).not.toBeInTheDocument();
    expect(within(sidebar).getByRole("button", { name: "Ideas" })).toBeInTheDocument();
    expect(within(sidebar).getByRole("button", { name: "Backlog" })).toBeInTheDocument();
  });

  it("offers Archive and Delete on a space and a list", async () => {
    const user = userEvent.setup();
    render(<App />);

    const sidebar = screen.getByRole("complementary");
    await user.click(within(sidebar).getByRole("button", { name: "More options for Engineering" }));
    expect(screen.getByRole("menuitem", { name: "Archive" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await user.click(within(sidebar).getByRole("button", { name: "More options for Sprint" }));
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeInTheDocument();
  });

  it("opens Customize from the user menu and applies a theme", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /account menu, alice/i }));
    await user.click(screen.getByRole("menuitem", { name: /themes/i }));

    expect(screen.getByRole("heading", { name: "Customize" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Dark" }));
    expect(document.documentElement.dataset.appearance).toBe("dark");
    await user.click(screen.getByRole("button", { name: "Teal" }));
    expect(document.documentElement.dataset.accent).toBe("teal");
  });
});
