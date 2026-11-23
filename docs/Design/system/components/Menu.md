# Menu

The one menu for the lane: right-click on the board, a card or a link, the card ⋯ menu, and their submenus.

**Status: built** for those menus. The other menus still use their own markup; the Status page lists them.

## Anatomy

- **Shell**: `MENU_SHELL`, which is 232px wide, `p-1.5` (6px), `rounded-md` (12px), a `border-default` hairline, `bg-panel` and `shadow-2`, with `viewPanelBody` text. Its height is capped at 60% of the window, and it scrolls inside.
- **Label row** (`MenuLabel`): the card's kind marker at 10px and its heading, in `viewPanelHeading` and `text-light`, with `px-3 pb-2`.
- **Row** (`MenuItem`): `MENU_ROW`, which is `px-3 py-2.5` and `rounded-sm`, making 38px with an 18px line. It has a 14px grey icon column, then the label, which truncates to one line, then an optional trailing slot.
- **Submenu row** (`SubMenu`): a trailing `fold-chevron` at 14px. Its submenu opens to the right and overlaps the parent by 4px.
- **Separator** (`MenuSeparator`): `my-1`, a `border-default` hairline.

## States

- **Hover**: `bg-panel-hover`.
- **Focus**: a 2px inset ring in `text-header`.
- **Disabled**: `text-light` at 50%. It stays focusable and says why in its tip.
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

This preview is a static rendition, hand-written from those files at UI `9aa1b195`.
