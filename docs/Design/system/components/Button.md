# Button

The lane's buttons and chips. There is one green filled action per screen; everything else is plain text that tints on hover.

**Status: built.** Still to do: the lane recipe's focus ring is still blue (`focus-visible:ring-info`, `chipClass.ts`). This card shows the rule, a `text-header` ring. The older look keeps its blue `CHIP_PRIMARY_CLASS`, off the lane only.

## Recipes

All are 28px high (`min-h-7`), `radius-control` (6px), with no border.

| Recipe | Classes | Use |
|---|---|---|
| `VIEW_CHIP_PRIMARY_CLASS` | `px-2.5`, `viewPanelHeading`, `controls.actColours`: `bg-success` with `text-header`, a darker green on hover and press, and grey fill with `text-light` when disabled | The one next step: Approve, Save, Review |
| `VIEW_CHIP_CLASS` | `gap-1 px-2`, `viewPanelHeading`, transparent `text-body`, `bg-panel-hover` on hover | Every other action |
| `VIEW_CHIP_OUTLINE_CLASS` | As above, plus a `border-field` outline, in `viewPanelMeta` | A row of ways to go on that must read as pressable |
| `VIEW_ICON_BUTTON_PRIMARY_CLASS` / `VIEW_ICON_BUTTON_CLASS` | A 28px square, solid green or ghost | Icon-only actions, with a light Tip |
| `CHIP_DISMISS_LINK_CLASS` | Underlined `text-light` text | Dismiss or Not now |

## Rules

- One filled button per screen.
- Never use black or ink fills.
- Never use a blue action.
- A disabled control reads as disabled by token, not by opacity, and says why in its tip.

## Code

- `src/v5/blocks/chipClass.ts`
- `src/styles/controls.ts` (`actColours`, `act`)

This preview is a static rendition at UI `9aa1b195`.
