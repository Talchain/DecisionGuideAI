# Details sheet

The one box for a card's details. Resting on a card shows it as a read-only peek, and a click pins it with its editable rows.

**Status: built.** Still to do: the value row's buttons are 28 and 32px, while the Edit form's are 44px. The Editing page records the wider editing model.

## Anatomy

- **Frame** uses the [shared popup shell](Popups.md). It is 280px wide and capped at the available height or 60% of the window.
- **Heading**: the card name in `panelHeader`, with a kind line under it in `viewPanelMeta` and a 10px marker, 8px below.
- **Close**: a 28px square.
- **Body**: Stack gaps between rows. Row labels are `viewPanelMeta`, 64px wide. "Where this comes from" folds with `py-2.5`.
- **Value row**: `grid gap-2`. The figure is the primary green "Change figure" (or "Save"), and the secondary is "Try without saving".
- **Actions**: `VIEW_CHIP_CLASS` chips plus a More icon button.

## Behaviour

- Placed by `placeBeside`: beside the card, or below or above it, never covering it, and 8px from every edge.
- Escape closes it and clears the selection. Outside press and the close control also dismiss it. A save in progress keeps it open.
- Closing a pinned sheet does not fall back to the peek.

## Code

- `src/olumiView/v12/edit/LaneInspector.tsx`
- `src/olumiView/v12/inspect/ValueRow.tsx`
- `src/olumiView/v12/edit/placeBeside.ts`
- `src/olumiView/v12/edit/inspectorStore.ts`
