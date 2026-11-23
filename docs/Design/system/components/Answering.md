# Answering state

What the panel shows while Olumi is answering: one line in Olumi's voice, with one shape that steps through the kinds on the board.

**Status: built.**

## Anatomy

- **Shape**: one 14px kind marker, to the left of the words.
  - It steps to the next kind every 900ms, and enters over `duration-fast` from 85% scale.
  - The kinds come from the board, in order (`boardKindsOf`). With no board, all six show: factor, option, goal, risk, outcome and question.
  - It needs at least two kinds to step.
- **Words**: "Olumi is answering" in `info`, with a light pass across them every 2.4s.
- **Seconds**: after 5s, in `viewPanelMeta` and `text-light`.
- There is no skeleton and no composer line.

## Reduced motion

The shape stays on the first kind, and the light pass does not run.

## Code

- `src/canvas/conversation/zones/ThinkingIndicator.tsx`
- `src/olumiView/boardKindsOf.ts`
- `src/olumiView/ViewChat.tsx` (`TurnInFlight`)
- `src/olumiView/look/olumiLook.css` (`ok-thinking-words`)

This preview runs the 900ms step itself. It does not run the light pass.
