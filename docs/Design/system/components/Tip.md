# Tip

The one hover look: a small light card that names a control or says why a control cannot act.

**Status: built.** Still to do: the dark `Tooltip` and native `title` attributes remain on the rails, the top bar and some trays, and each should move to this Tip.

## Anatomy

- **Shape**: `rounded-sm` (8px), a `border-default` hairline, `bg-panel` and `shadow-1`, with text in `viewPanelMeta` and `text-body`. It is at most 240px wide and sits on layer 5013.
- **Plain**: one line, `px-2 py-1`.
- **Stacked**: used when the words have a body. The first line is the title, at 500 in `text-header`, followed by the body. It uses `p-3`, with `gap-2` for a list and `gap-3` for a peek.

## Behaviour

- It opens after 150ms of pointer rest, or straight away on keyboard focus.
- It sits 8px to the right of its anchor, or to the left, and flips up at the foot of the window.
- It closes on leave, blur, Escape, press, scroll or resize.
- Only one tip is open at a time.
- Its position is written as `--tip-x` and `--tip-y`, never as an inline style.

## The consumer provides

The words, through `Hover`, `HoverButton`, `OkIconButton` (`words`) or `MenuItem` (`tip`, `disabledReason`). A disabled control with words stays focusable, so its reason can be read.

## Rules

- Never use a native `title`.
- Never use the dark `Tooltip` on lane surfaces.
- A truncated row label shows in full in its tip.

## Code

- `src/olumiView/look/Tip.tsx`
- `src/olumiView/look/Hover.tsx`
- `src/olumiView/look/icons.tsx` (`OkIconButton`)

This preview is a static rendition, hand-written from those files at UI `9aa1b195`.
