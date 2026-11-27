# Menu

The right-click, card, chrome and composer menus use the same [popup standard](Popups.md).

## Anatomy

- **Shell** uses the shared popup recipe. It is 232px wide with a measured viewport cap and scrolls inside its height limit.
- **Label row** (`MenuLabel`) identifies a group in 12px type.
- **Row** (`MenuItem`) truncates plain labels when needed. It can also carry a 14px icon, caller-supplied inline description and trailing value. Its light Tip shows a truncated label and any tip text or disabled reason on hover and keyboard focus.
- **Submenu row** (`SubMenu`) shows a 14px chevron. Its submenu overlaps the parent by 4px.
- **Separator** (`MenuSeparator`) is a hairline between groups.

## States

- **Hover**: `bg-panel-hover`.
- **Focus**: a 2px inset ring in `text-header`.
- **Disabled**: `text-light` at 50%. It stays focusable and gives the reason in its row Tip.
- **Danger**: `danger` text.
- Never use blue.

## The consumer provides

- `anchor`: an element, a point or a virtual element.
- `label`: the menu's accessible name.
- `onClose(reason)`.
- Optionally, `opener`, `boundary`, `placement` (default `bottom-start`) and `look` (`lane` or `older`).
- Rows as `MenuItem` children, each with an `id`, a registry `icon`, a `label` and `onSelect`. A row may also take `disabledReason` and `tip`.

## Rules

- Only one menu is open at a time (`menuArbiter.ts`), and pressing the opener again closes its menu.
- Focus moves to the first row. Rows use a roving tabindex: ↑ ↓ Home End move between them, letters jump to a row, → opens a submenu and ← goes back.
- Escape goes through the shared stack and returns focus to the opener.
- Placement is measured by Floating UI: flip and shift by 8px, inside the free board.
- Use `look="older"` only off the lane. It keeps the older box (`py-2`, 36px rows, `px-4`).

## Code

- `src/olumiView/look/Menu.tsx`
- `src/olumiView/look/menu.ts`
- `src/olumiView/look/menu.css`
- `src/olumiView/look/menuArbiter.ts`
