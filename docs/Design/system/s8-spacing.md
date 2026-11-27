# Spacing

This is the binding spacing standard for the Olumi look. The values below are in CSS pixels at card scale 1.

| Name | Token | Use |
|---|---|---|
| Tight | `--space-1` (4px) | Icon to its label, mark to its value, title to face |
| Stack | `--space-2` (8px) | Items inside a card face or a row, rows inside a section |
| Inset | `--space-3` (12px) | Card, menu, tip and sheet padding |
| Gutter | `--space-4` (16px) | Panel side gutter |
| Section | `--space-5` (20px) | Between sections of a panel or dialog |

Use gaps on flex and grid parents for spacing between siblings. Inside a canvas card, every padding, margin and gap is derived from `calc(var(--space-N) * var(--o-s))`. The frame supplies `--ok-gap-tight`, `--ok-gap-stack` and `--ok-gap-inset` for its face. Where a chart separator or control needs a smaller gap, derive it from the scaled token. Fixed-pixel spacing utilities are forbidden inside a card face.

## Allowed values

- Use `0`, a spacing token (`var(--space-*)`), a token calculation that includes the card scale where applicable, or a 1px hairline offset.
- Outside canvas cards, Tailwind spacing steps equivalent to tokens are allowed. The permitted steps are `0`, `1`, `1.5`, `2`, `2.5`, `3`, `4`, `5`, `6`, `8`, `10`, `12` and `16`.
- Arbitrary spacing utilities must use a spacing token. Off-scale classes ending in `-0.5`, `-px`, `-3.5`, `-7`, `-9`, `-11` and `-14` are forbidden. Use no numeric spacing in style props except zero and no pixel literals in CSS padding, margin or gap except zero and the 1px hairline.

## Board geometry

Cards sit 24 units apart across a row (`--space-6`) and 48 units apart between tiers (`--space-12`). A band label sits one stack (`--space-2`) above its row.

The served studio fixture at `b58c3c81`, measured at 1232 × 704 with card scale 1.57, had gaps of 22–24 flow units across and 40–53 between tiers. Lane A owns both layout breaches. In that same capture, quantity cards wrapped the pencil and author mark onto a separate row and card heights ranged from 127 to 177 flow units. Foot placement is covered by lane D slice 2.

The [compliance guard](s4-checks.md) ratchets new syntax violations. Rendered measurements at different card scales verify the rhythm and board geometry.
