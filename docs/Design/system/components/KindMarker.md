# Kind marker

The shape that says what a card is. It sits on the card's top edge, in lists, in menus and in the answering state.

**Status: built.**

## Shapes

All shapes are drawn in a 12-unit box, from `NodeShapeIndicator`.

| Kind | Shape | Fill |
|---|---|---|
| Factor | Circle, r 5 | `factor` |
| Option | Square, rx 1 | `option` |
| Goal | Diamond | `goal` |
| Question | Flat-top hexagon | `text-light` (blue is Olumi's) |
| Risk | Downward triangle | `danger` |
| Outcome | Upward triangle | `success` |
| Limit | Outlined square, 1.5 stroke, panel fill | `text-light` |
| Assumption | The kind's shape, outlined and dashed `2 1.5` | the kind's colour |

## Sizes

- 19.2px on a card's top edge (`KIND_GLYPH_PX`), with a 0.6 stroke in `bg-panel`.
- 14px in rows and in the answering state.
- 10px in a menu label or a sheet's kind line.

## The consumer provides

`nodeKind`, plus optionally `size`, `dashedOutline`, `stroke` and `strokeWidth`.

## Code

- `src/canvas/nodes/NodeShapeIndicator.tsx`

The preview uses the component's exact polygon geometry.
