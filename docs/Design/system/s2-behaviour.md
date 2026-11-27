# Behaviour

[Popups](components/Popups.md) is the binding standard for popup kinds, precedence, dismissal, focus, and the shared surface recipe.

## Keyboard navigation

- A menu takes focus on its first row. A form focuses its first field, selecting the value when appropriate.
- Within a menu, ↑ and ↓ move between rows, Home and End jump to the first and last row, Enter or Space selects the row, and letters jump to a matching row. → opens a submenu and ← returns to the parent row.
- Follow `ViewSummary.tsx` for dialogs. Put initial focus inside, keep Tab in the dialog and return focus to the trigger when it closes.
- Keep menu rows to one line and truncate long labels. Hover or keyboard focus shows the full truncated label, tip text or disabled reason in the row’s light Tip. Disabled rows stay focusable with `aria-disabled`.
- A row tip belongs to its menu. The one-tip rule applies across surfaces, including menu row tips and card peeks. An open menu blocks standalone tips.

## Placement

- **Measure placement; never guess it.**
  - Menus use Floating UI with a `fixed` strategy.
  - Each update is measured on an animation frame.
  - Menus flip and shift 8px inside a boundary that excludes the dock, the rails, the top bar and the foot controls.
  - A menu's height is capped at 60% of the window.
- **Submenus** open to the right of their row, flip left near the dock, and overlap their parent by 4px.
- **The details sheet** uses `placeBeside`. It goes beside the card, or below or above it, without covering the card or its neighbours, and keeps 8px from every edge.
- **Tips** sit 8px to the right of their anchor, or to the left. They flip up at the foot of the window and close on scroll or resize.
- Write positions as CSS custom properties, as `Tip.tsx` does with `--tip-x` and `--tip-y`, never as an inline `style`.

## Hover and pinned

- **A card's hover is a peek.** Resting on a card for 400ms opens the same box that a click pins. The peek is read-only.
- **A click pins it.** Pinned, the box holds its editable rows. Closing a pinned box does not fall back to the peek.
- **Tips open after 150ms** of pointer rest or keyboard focus. Pressing the control closes its tip.
- **Use only the light Tip** (`Hover`, `HoverButton`, `OkIconButton`). Never use a native `title`, and never the dark `Tooltip` on lane surfaces.

## Reduced motion

- Every duration token falls to 0.01ms under `prefers-reduced-motion: reduce`.
- Guard keyframes with `@media (prefers-reduced-motion: no-preference)`.
- The answering shape stops on the first kind under reduced motion, and the light pass does not run.

## Sizes to check

Check every change at three sizes, on a freshly drawn first model and on an approved board:

- 2000 by 1205;
- 1232 by 704;
- 1128 by 680 at 1.33 scale.

At each size, nothing may cover the reply, the composer, the tabs or the approve button.
