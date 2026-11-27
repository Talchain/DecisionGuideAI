# Card face

A card on the board: one record of the model, with its kind, title, figure and state.

**Status: built.** Still to do: some face rules rely on `!important` in `olumiLook.css`.

## Anatomy (Simple)

- **Frame**:
  - 248px wide (Simple grows to 296 at most), `radius-md` (12px, a literal in the lane CSS);
  - a 1px border in the kind's colour, `bg-panel` and scaled inset padding (12px at scale 1);
  - no shadow.
- **Kind marker**: 19.2px, on the top edge.
- **Title**: `viewTitle` (14/500), at most two lines. The corner slot takes no title width.
- **Figure**: `viewValue` (14/500), with tabular numerals.
- **Range bar**: 16px. An unknown is an empty dashed track.
- **Chance**: `viewHeadline` (18/500), with a gauge in the option colour.
- **Bound**: a pill (`2px 8px`, `radius-pill`, `border-default`).
- **Spacing** follows the [binding spacing standard](../s8-spacing.md). Title to face uses tight (4px at scale 1) and items in the face use stack (8px at scale 1). Both scale with the card.
- **Corner slot** (Olumi look): an overlay in the top-right corner with the figure edit cue and the person mark on person-authored cards. The overlay uses the `--bg-panel` surface and a `--ok-gap-tight` inset around its controls. Showing it leaves the card layout fixed.
- **Foot**: state and count marks first, then the author mark when Olumi is an author, including mixed authorship. At most three state marks, then "+N". An empty foot takes no row.
- At rest the face carries no sentences: each state is a value or a mark, words on the hover (s7-faces-and-charts.md, FACE rows).
- **Detailed**: the same frame, at least 208px wide and fit to its content, with a fuller foot.

## States

| State | How it looks |
|---|---|
| Rest | The corner slot is transparent and ignores pointer input. Its controls stay in the tab order. |
| Hover | `bg-panel-hover` fill. The corner slot appears. |
| Keyboard focus within the card | The corner slot appears. |
| Selected | A 2px ring in `focus-color`. The corner slot appears, including on touch devices. |
| Proposed by Olumi | A `border-info` frame |
| Challenged | An `olumi-mark-orange` frame |
| Doubt | A dashed frame |
| Driver | A `text-header` ring at a 4px offset |
| On a lit path | A 2px outline |

## Layout

Cards sit 24px apart across and 48px between tiers, with at most five to a row.

## Code

- `src/olumiView/previous/CoreCard.tsx`
- `src/olumiView/v12/SimpleFace.tsx`
- `src/olumiView/look/olumiLook.css`
- `src/olumiView/layout.ts`

The previews in the Olumi Design System artifact are captures of the real build at UI `b58c3c81` (zero calls, fixture data); each face state's row is in `s7-faces-and-charts.md`.
