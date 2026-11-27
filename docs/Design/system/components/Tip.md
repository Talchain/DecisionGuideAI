# Tip

The one hover look: a small light card that names a control or says why a control cannot act.

The [shared popup shell](Popups.md) holds the words at up to 240px wide. A tip with multiple lines gives its first line the title treatment, followed by the body.

## Behaviour

- It opens after 150ms of pointer rest or keyboard focus.
- It sits 8px to the right of its anchor, or to the left, and flips up at the foot of the window.
- It closes on leave, blur, Escape, press, scroll or resize.
- Only one tip is open at a time.
- Its position is written as `--tip-x` and `--tip-y`, never as an inline style.

## The consumer provides

The words, through `Hover`, `HoverButton`, `OkIconButton` (`words`). A disabled control with words stays focusable, so its reason can be read.

## Rules

- Never use a native `title`.
- Never use the dark `Tooltip` on lane surfaces.
- A menu’s row Tip shares the single tip slot and belongs to that menu. It shows a truncated label in full and carries the row’s tip text or disabled reason.

## Code

- `src/olumiView/look/Tip.tsx`
- `src/olumiView/look/Hover.tsx`
- `src/olumiView/look/icons.tsx` (`OkIconButton`)
