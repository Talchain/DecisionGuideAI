# Card face

A card on the board: one record of the model, with its kind, title, figure and state.

**Status: built.** Still to do: some face rules rely on `!important` in `olumiLook.css`.

## Anatomy (Simple)

- **Frame**:
  - 248px wide (Simple grows to 296 at most), `radius-md` (12px, a literal in the lane CSS);
  - a 1px border in the kind's colour, `bg-panel` and 12px padding;
  - no shadow.
- **Kind marker**: 19.2px, on the top edge.
- **Title**: `viewTitle` (14/500), at most two lines.
- **Figure**: `viewValue` (14/500), with tabular numerals.
- **Range bar**: 16px. An unknown is an empty dashed track.
- **Chance**: `viewHeadline` (18/500), with a gauge in the option colour.
- **Bound**: a pill (`2px 8px`, `radius-pill`, `border-default`).
- **Gaps inside the face**: 8px.
- **Foot**: state marks first, then the author last. At most three marks, then "+N".
- At rest the face carries no sentences: each state is a value or a mark, words on the hover (s7-faces-and-charts.md, FACE rows).
- **Detailed**: the same frame, at least 208px wide and fit to its content, with a fuller foot.

## States

| State | How it looks |
|---|---|
| Hover | `bg-panel-hover` fill |
| Selected | A 2px ring in `focus-color` |
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
