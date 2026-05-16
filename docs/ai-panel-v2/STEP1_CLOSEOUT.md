# AI panel v2 — Step 1 close-out

**Status:** Step 1 complete (skeleton split, FF-gated).
**Branch:** `claude/stoic-jang-052395` (off `origin/staging` HEAD).
**Flag:** `FF_AI_PANEL_V2` (default `false`, env `VITE_FEATURE_AI_PANEL_V2`, storage `feature.aiPanelV2`).

---

## What shipped

1. New flag `FF_AI_PANEL_V2` in [src/flags.ts](../../src/flags.ts).
2. New folder `src/canvas/ai-panel-v2/`:
   - [`AIPanelV2Layout.tsx`](../../src/canvas/ai-panel-v2/AIPanelV2Layout.tsx) — bottom-right fixed-position AI scaffold.
   - [`RightPanelMount.tsx`](../../src/canvas/ai-panel-v2/RightPanelMount.tsx) — single export point for the FF branching, imported by `ReactFlowGraph`.
   - [`constants.ts`](../../src/canvas/ai-panel-v2/constants.ts) — only constants consumed today.
3. Two CSS-variable coordination points:
   - `--olumi-ai-panel-bottom` — height the dock reserves below itself.
   - `--olumi-ai-panel-dock-width` — flag-specific width override that takes precedence over the dock's persisted `--dock-right-expanded`.
4. One-line, FF-off-compatible change to [`OutputsDock.tsx`](../../src/canvas/components/OutputsDock.tsx): width and bottom calc now read the two vars above with `0px` / fallback to the dock's existing variable, respectively.

## What did NOT ship (deliberate divergence from the brief's flag-on contract)

The brief's flag-on contract is:
> Bottom bar hidden. Existing conversation mounted in the right-panel AI zone.

Step 1 ships only the first half (panel scaffold). DraftChat stays mounted in **both** flag states. This is a temporary divergence to preserve a working AI surface during the rollout. Specifically:

- Context-menu "Ask AI" (`src/canvas/contextMenu/actions.ts:718`) calls `setShowDraftChat(true)` and polls for the legacy registered sender. Hiding DraftChat now would silently break it.
- The toolbar "AI" button (`src/canvas/CanvasToolbar.tsx:310`) is the existing entry point.
- The AI panel v2 zone is intentionally empty in step 1 — `ChatThread` / `AIInputBar` / new sender registration land in steps 3/4.

The visual state (FF on → both surfaces visible) is **not the target**. It's a scaffold checkpoint.

## Removal checkpoint (do not skip)

DraftChat must remain mounted under FF on until **all** of the following pass — per the approved plan's correction #9:

1. `useConversation()` is called exactly once in the AI zone (verified by inspection).
2. Send one message via the in-panel input. Confirm **exactly one** network request fires.
3. **Exactly one** assistant response appears in the thread.
4. No duplicate message IDs in the conversation store.
5. Context-menu "Ask AI" and the toolbar "AI" button both route to the new in-panel sender (or are removed in the same change).

Until all five pass, no PR that hides `<DraftChat />` may merge. The gating tests in [`FlagGating.spec.tsx`](../../src/canvas/ai-panel-v2/__tests__/FlagGating.spec.tsx) currently assert `stub-draft-chat` is present under FF on; that assertion must be updated **together with** the gate flip in `RightPanelMount`, in the same commit. If the test still expects DraftChat after a step-2/3 PR, the contract divergence has not been resolved.

## Tests added

- [`AIPanelV2Layout.spec.tsx`](../../src/canvas/ai-panel-v2/__tests__/AIPanelV2Layout.spec.tsx) — component skeleton, CSS variables, height clamp, flag default.
- [`FlagGating.spec.tsx`](../../src/canvas/ai-panel-v2/__tests__/FlagGating.spec.tsx) — renders the real `RightPanelMount` with stubbed heavy children; both flag states; plus a source-grep sanity check that `ReactFlowGraph` still mounts `<RightPanelMount />`.
- [`OutputsDockBottomVar.spec.tsx`](../../src/canvas/ai-panel-v2/__tests__/OutputsDockBottomVar.spec.tsx) — regression test for the dock's bottom calc with and without the flag-specific variable.

## Known follow-ups (out of step 1 scope)

| Follow-up | Why deferred |
|---|---|
| Mount `ChatThread` + `AIInputBar` in the AI zone | Requires the singleton checkpoint (step 2). |
| Hide `DraftChat` under FF on | Requires the checkpoint above. |
| Pull-tab + Compact/Conversation/Focus modes | Step 5+ in the approved plan. |
| Playwright adjacency check (dock-bottom vs panel-top, common viewport heights) | No Playwright wiring in this surface today. Add when a wider Playwright surface lands; manual browser verification covers it for now. |

## Smoke evidence

- `npm run typecheck` — clean
- `npx vitest run src/canvas/ai-panel-v2` — 12/12 pass (3 files)
- `npx eslint` on touched files — 0 errors
- Browser FF off: DraftChat present, no AI v2, no CSS vars set on `:root`.
- Browser FF on: AI v2 panel + DraftChat both mounted, `--dock-right-expanded` untouched, no console errors.

## Files changed (relative to `origin/staging`)

```
src/canvas/CanvasToolbar.tsx          — toolbar button left unconditional in step 1
src/canvas/ReactFlowGraph.tsx         — replaced inline mounts with <RightPanelMount />
src/canvas/components/OutputsDock.tsx — width + bottom calc read flag-specific vars
src/flags.ts                          — added FF_AI_PANEL_V2
src/canvas/ai-panel-v2/               — new folder (component + mount + tests + constants)
docs/ai-panel-v2/STEP1_CLOSEOUT.md    — this file
```

Nothing pushed. Commit lands locally on `claude/stoic-jang-052395`.
