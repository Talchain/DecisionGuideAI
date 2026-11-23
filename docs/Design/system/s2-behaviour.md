# Behaviour

These rules cover anything that floats over the board or the panel: menus, tips, the details sheet, forms, trays and dialogs.

## One thing open at a time

- Open at most one menu at a time. Opening a menu closes the one before it, and pressing the same opener again closes its own menu. This is built into `Menu` through `menuArbiter.ts`.
- Hold at most one editing surface at a time. The sheet store, `inspectorStore.ts`, holds a single slot: details, menu, form, editor or add. A new surface replaces the open one, except while that one is saving.
- Show one tip at a time. A new tip closes the last one.
- Never show a hover preview while a menu or editing surface is open.
- Still to do: chrome menus use a second mechanism, `MENU_EXCLUSIVE_EVENT`, and the Add and Ask Olumi menus join neither mechanism. Moving them onto `Menu` makes the rule hold everywhere.

## Focus and Escape

- **Focus in.** Opening a menu moves focus to its first row. Opening a form focuses and selects its first field.
- **Roving focus.** Inside a menu:
  - ↑ and ↓ move between rows and wrap, and Home and End jump to the first and last row;
  - Enter or Space chooses the focused row;
  - typing a letter jumps to the matching row;
  - → opens a submenu and ← returns to the parent row.
- **Escape.**
  - Escape closes the newest surface only, once, through the shared stack in `escapeLayers.ts`.
  - A component that handles Escape itself marks the press as handled.
  - In a submenu, Escape goes back one level first.
- **Focus out.**
  - After Escape, Tab or a second press on the opener, focus returns to the opener.
  - After choosing a row, focus is restored only if nothing else took it.
- **Modals.** Follow `ViewSummary.tsx`: focus in, trap Tab, close with the shared Escape, return focus to the trigger.
- **Disabled controls** stay focusable with `aria-disabled`, and the light Tip says why.

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
- **Tips open after 150ms** of pointer rest, or straight away on keyboard focus. Pressing the control closes its tip.
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
