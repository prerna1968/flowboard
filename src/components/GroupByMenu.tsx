import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import { boardGroupOptions, type BoardDirection, type BoardGroupBy } from "./boardGroups";
import { focusRing } from "./classes";
import { SelectMenu, type SelectOption } from "./SelectMenu";

const directionOptions: SelectOption<BoardDirection>[] = [
  { value: "asc", label: "Ascending" },
  { value: "desc", label: "Descending" },
];

function groupOptions(options: { id: BoardGroupBy; label: string }[]): SelectOption<BoardGroupBy>[] {
  return options.map((option) => ({
    value: option.id,
    label: option.label,
    icon: <GroupIcon name={option.id} />,
  }));
}

export function GroupByMenu({
  groupBy,
  subgroup,
  direction,
  subgroupDirection,
  onGroupBy,
  onSubgroup,
  onDirection,
  onSubgroupDirection,
  onReset,
}: {
  groupBy: BoardGroupBy;
  subgroup: BoardGroupBy | null;
  direction: BoardDirection;
  subgroupDirection: BoardDirection;
  onGroupBy: (value: BoardGroupBy) => void;
  onSubgroup: (value: BoardGroupBy | null) => void;
  onDirection: (value: BoardDirection) => void;
  onSubgroupDirection: (value: BoardDirection) => void;
  onReset: () => void;
}) {
  const current = boardGroupOptions.find((option) => option.id === groupBy) ?? boardGroupOptions[0];
  return (
    <Popover className="relative">
      <PopoverButton className={`inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1.5 text-sm font-medium text-accent ${focusRing}`}>
        <LayersIcon />
        Group: {current.label}
      </PopoverButton>
      <PopoverPanel anchor="bottom start" className="z-30 w-[min(420px,calc(100vw-2rem))] !overflow-visible rounded-2xl bg-surface-raised p-4 shadow-pop ring-1 ring-line [--anchor-gap:8px]">
        <p className="text-sm text-ink-muted">Group by</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <SelectMenu
            ariaLabel="Group by"
            value={groupBy}
            options={groupOptions(boardGroupOptions)}
            portal={false}
            menuWidth="button"
            className="min-w-0 flex-1"
            onChange={(value) => {
              onGroupBy(value);
              if (value === subgroup) onSubgroup(null);
            }}
          />
          <SelectMenu
            ariaLabel="Group direction"
            value={direction}
            options={directionOptions}
            portal={false}
            menuWidth="button"
            className="w-36 shrink-0"
            onChange={onDirection}
          />
          <button
            type="button"
            aria-label={subgroup ? "Remove grouping" : "Clear grouping"}
            className={`rounded-lg p-2 text-ink-muted hover:bg-surface ${focusRing}`}
            onClick={() => {
              if (subgroup) {
                onGroupBy(subgroup);
                onDirection(subgroupDirection);
                onSubgroup(null);
                onSubgroupDirection("asc");
                return;
              }
              onReset();
            }}
          >
            <TrashIcon />
          </button>
        </div>
        <div className="mt-2">
          {subgroup ? (
            <div className="flex flex-wrap items-center gap-2">
              <SelectMenu
                ariaLabel="Subgroup"
                value={subgroup}
                options={groupOptions(boardGroupOptions.filter((option) => option.id !== groupBy))}
                portal={false}
                menuWidth="button"
                className="min-w-0 flex-1"
                onChange={onSubgroup}
              />
              <SelectMenu
                ariaLabel="Subgroup direction"
                value={subgroupDirection}
                options={directionOptions}
                portal={false}
                menuWidth="button"
                className="w-36 shrink-0"
                onChange={onSubgroupDirection}
              />
              <button
                type="button"
                aria-label="Remove subgroup"
                className={`rounded-lg p-2 text-ink-muted hover:bg-surface ${focusRing}`}
                onClick={() => {
                  onSubgroup(null);
                  onSubgroupDirection("asc");
                }}
              >
                <TrashIcon />
              </button>
            </div>
          ) : (
            <SelectMenu
              ariaLabel="Add subgroup"
              value={null}
              placeholder="Add subgroup"
              options={groupOptions(boardGroupOptions.filter((option) => option.id !== groupBy))}
              portal={false}
              menuWidth="button"
              onChange={onSubgroup}
            />
          )}
        </div>
      </PopoverPanel>
    </Popover>
  );
}

function LayersIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4">
      <path d="M10 3.2 3.2 6.6 10 10l6.8-3.4L10 3.2zM3.2 9.6 10 13l6.8-3.4M3.2 12.6 10 16l6.8-3.4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function GroupIcon({ name }: { name: BoardGroupBy }) {
  const path = {
    status: "M10 4.2a5.8 5.8 0 1 0 0 11.6 5.8 5.8 0 0 0 0-11.6zM10 8.3a1.7 1.7 0 1 0 .01 0z",
    assignee: "M10 9.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4zM5.2 15.2c.7-2 2.4-3 4.8-3s4.1 1 4.8 3",
    priority: "M5 3.5h1.1v13H5v-13zm1.1 1.1h7.6L12 7.2l1.7 2.6H6.1V4.6z",
    due: "M4 5.5h12v9H4v-9zm0 3h12M7 4v2.5M13 4v2.5",
  }[name];
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-muted">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4">
      <path d="M5 6.5h10M8 6.4V5h4v1.4M7.2 6.5l.5 8h4.6l.5-8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
