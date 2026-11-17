# Show in the workspace: the two entry patches (unapplied)

Everything else of this feature is new files in this folder. These two patches are the only lines it needs in files other lanes own.
Neither is applied by this lane. Each was checked with `git apply --cached --check` in a throwaway index, never in a worktree.

## ENTRY-canvas.patch — for the UI builder (`ViewCanvas.tsx`)

1. Registers the camera port once while the canvas is on the page (`registerShowCameraPort(makeShowCameraPort({...}))`), next to `registerRevealReturnCamera`.
2. The board's framing loop WAITS while `showHolds()` is true, then goes on as if it had just begun; a resize does not refit while it is true. Nothing is dropped: when the hold ends the board frames itself unless the camera is held.
3. Checked against `51409d1109a0a32d46f2fb8e66bb5a182cb0dcec` (and `edbd5fda`, and the panel head below). `:280`'s reset of `userMoved` is untouched on purpose.

## ENTRY-chat.patch — for sx-panel (`ViewChat.tsx`)

1. One import and one line, `<ShowInWorkspace turn={t.id} next={t.answer.next} />`, directly after `<AboutChips cards={aboutCards} />` in `Turn`.
2. The control draws nothing with no canvas on the page, or when nothing the reply names is in the reader's View; where it sits is the panel owner's call.
3. Checked against `bd7a5898b878ab8c831baedd93a9ea18064ce484` (wip/sx-panel).

## What the canvas owner should know

- Names this folder takes from files it does not own are all in `deps.ts`, one adapter. A rename there breaks one file.
- `canvasSide.ts` needs of the canvas only: `getViewport`, `setViewport`, `getInternalNode`, the `userMoved` ref, `hand`, `fit`. A new port object discards a kept "where you were", so the registration effect must not re-run on every render (its deps are the stable React Flow calls and `fit`).
- After a Return that changed the board (`openBadgesKeyOf` differs: the show had opened a badge), the camera put back is kept as the person's, exactly as `registerRevealReturnCamera` keeps it: the board does not refit under it until the next board change or Fit. With the board unchanged, `userMoved` is as it was before the show.
- The hold covers the board's own framing and the resize refit. It does NOT cover `useCardClearOfRegions`, `BelowCue`, or a new reply's own pan (`useReplyInView`) that arrives while a show is on its way; `hand()` stands down pans already pending.
- If `camera.ts` or the framing loop changes shape, the rule to keep is the second line above; the lines themselves are yours to place.
