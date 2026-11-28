# Link line

A link between two cards on the board. Its colour says which way the link pushes, and its end says the link's role.

**Status: built.**

## Anatomy

- **Stroke**: 2px, non-scaling. A lit path is 3px.
- **Tone** (`--link-tone`):
  - `edge-positive` raises;
  - `edge-negative` lowers;
  - `edge-neutral` has no sign yet;
  - `goal` measures or targets a goal;
  - `text-header` is a driver link.
- **Ends**: an 8 by 8 arrow for an effect or a target. A 2.5 dot for an input. No end for measures or size.
- **Dashes**:
  - in doubt: `5 4`;
  - a reason link: dotted, `0.1 6` round;
  - a leader: `2 3` at 1px.
- **Halos** (35% opacity):
  - alert: orange, 10px;
  - proposed by Olumi: `info`, 8px.
- **Words**: `viewLabel` (12) in `text-light`, on a `bg-canvas` fill. They show on selection, on focus or when an end card is hovered, together with the strength and the remove control.

## Rules

- A link's stroke does not change when it is selected.
- Never paint an unset link `goal` yellow.

## Code

- `src/canvas/edges/ViewLinkEdge.tsx`
- `src/olumiView/v12/links/styles.ts`
- `src/olumiView/v12/links/LinkEnds.tsx`
- `src/olumiView/look/olumiLook.css`

The previews in the Olumi Design System artifact are captures of the real build at UI `b58c3c81` (zero calls, fixture boards); each line style's row is in `s7-faces-and-charts.md`.
