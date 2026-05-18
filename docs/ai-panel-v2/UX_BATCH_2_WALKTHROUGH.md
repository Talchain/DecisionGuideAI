# AI panel v2 — UX batch 2 walkthrough

**Date:** 2026-05-18
**Branch:** `claude/stoic-jang-052395`
**Origin staging at start of batch:** `dfa60477` (last batch-1 push)
**Status:** **Local-only per the brief** ("Commit locally only. Do not push.")

This batch is the state-led UX reset on top of Batch 1's technical
foundations (singleton conversation, embedded OutputsDock, FF gating,
tests). Layout is now driven by canvas + analysis state plus an
explicit minimise/float toggle, not by user-managed Compact/Conv/Focus
tabs.

## Local commits ahead of `origin/staging` (verbatim)

```
$ git log --oneline origin/staging..HEAD
ea817bec fix(ai-panel-v2): batch 2 review P1s — full draft + scroll + focus preservation
30b06082 feat(ai-panel-v2): batch 2 — state-led layout, minimise/float controls, simplified settings menu
```

A follow-up commit lands on top of this doc edit and captures the
post-review-round-2 tightening:

- Scroll preservation rewritten to the canonical React lifecycle —
  capture in the layout-effect CLEANUP (DOM still valid), restore in
  the layout-effect BODY (new container mounted), clear
  `savedScrollTopRef` after each restore so a later unrelated render
  doesn't reapply a stale value. Replaces the earlier "mutate refs
  during render" approach.
- New `ScrollPreservation.spec.tsx` (3 tests) drives the layout
  through docked → minimised → docked and docked → floating → docked
  against a real scrollable mock ConversationPanel that defines
  `scrollHeight`/`clientHeight` so the offset actually applies. Third
  test asserts the stale-state clearing branch.
- New `State2Readiness.spec.tsx` (4 tests) replaces the
  prop-introspection-only assertion with a fidelity-mocked
  OutputsDock that replays its real pre-run branch
  (`isPreRun && nodes.length > 0 → PreAnalysisPanel`) and asserts:
  the readiness card renders inside the analysis zone, receives a
  function `onSendMessage`, disappears on transition to
  post-analysis, and never renders in welcome (blank-panel regression
  guard).

## Five states

| State | Trigger | Layout |
|---|---|---|
| 1 — welcome | no messages + no nodes | full-panel `WelcomeComposer`, analysis zone NOT mounted |
| 2 — pre-analysis | nodes exist, no analysis result | 35% analysis / 65% AI docked split |
| 3 — post-analysis | `results.status === 'complete'` + hash set | 65% / 35% docked split |
| 4 — minimised | user toggle | analysis fills (panel − 48px); 48px `MinimisedBar` pinned at bottom |
| 5 — floating | user toggle | `FloatingPanel` (drag/resize, clamped to viewport + min/max); analysis 100% docked |

State derivation lives in `hooks/usePanelView.ts`; the layout switches
on `view.kind` and renders one of `WelcomeComposer` / docked split /
`MinimisedBar` + analysis / `FloatingPanel` + analysis.

## Browser verification (Compact desktop, FF on)

Performed against the worktree's POC dev server (`localhost:5176`):

| State | Probe | Result |
|---|---|---|
| 1 (welcome) | `data-view="welcome"`, analysis zone missing, content block centred (delta block↔zone-centre = 0px) | ✅ |
| 2 (pre-analysis, after first send) | `data-view="docked"`, `data-state="pre-analysis"`, ratio `0.650` | ✅ |
| 4 (minimise) | `data-view="minimised"`, 48px bar mounted at bottom, analysis zone still present | ✅ |
| Expand → docked | ratio restored to `0.650` | ✅ |
| 5 (float) | `[data-testid="ai-panel-v2-floating"]` mounted at `400×500` anchored right `(1108, 80)`; docked AI layout unmounted; analysis remains | ✅ |
| Dock from floating | docked layout returns; floating unmounted | ✅ |
| Cog popover | Voice mode + Decision depth disabled with "Coming soon" badge | ✅ |
| Draft preservation (docked → minimised → expand) | `"partial follow-up"` persisted at every step | ✅ |

## State preservation guarantees

| Across | Draft text | Scroll position | Conversation state |
|---|---|---|---|
| docked ↔ minimised | ✅ (layout-owned `draftText`, controlled inputs on both) | ✅ (capture in layout-effect cleanup, restore in layout-effect body, clear ref after restore) | ✅ (singleton `useConversation()` in layout) |
| docked ↔ floating | ✅ | ✅ | ✅ |
| minimised ↔ floating | ✅ (both controlled by layout) | ✅ | ✅ |
| Welcome → docked | ✅ (Welcome composer now also controlled) | n/a (no thread in welcome) | ✅ |
| Expand from minimised | additionally transfers FOCUS to the docked textarea via `focusOnNextDockRef` flag + `surfaceRef.current.focusInput()` | ✅ | ✅ |

Scroll preservation evidence: `ScrollPreservation.spec.tsx` drives the
layout through both `docked ↔ minimised` and `docked ↔ floating`
transitions against a ConversationPanel mock that defines a real
`scrollHeight`/`clientHeight` pair. The third test asserts that an
unrelated re-render (same `view.kind`, different message count) does
NOT reapply a stale scrollTop — the ref-clear after restore is what
guarantees this.

Browser evidence for scroll preservation was deferred this round:
the dev tab was in background visibility and the local orchestrator
isn't reachable, so live messages don't populate and a real scroll
test in the browser couldn't be staged. The integration test above is
the authoritative proof for this batch; a live browser pass can be
appended to the next round once the orchestrator is reachable.

## Tests — exact counts

```
$ npx vitest run src/canvas/ai-panel-v2
 Test Files  18 passed (18)
      Tests  94 passed (94)
```

New spec files in batch 2:
- `WelcomeComposer.spec.tsx`
- `AIHeaderStrip.spec.tsx`
- `MinimisedBar.spec.tsx`
- `FloatingPanel.spec.tsx`
- `useFloatingPanel.spec.tsx`
- `usePanelView.spec.tsx`
- `DraftPreservation.spec.tsx` ← post-review-1 (2 tests: 4 view transitions + minimised-focus-transfer)
- `FloatingDragResize.spec.tsx` ← post-review-1 (8 cases incl. viewport-clamp regressions)
- `ScrollPreservation.spec.tsx` ← post-review-2 (3 tests with real scrollable thread)
- `State2Readiness.spec.tsx` ← post-review-2 (4 tests with fidelity-mocked OutputsDock)

Existing rewritten for the state-led model: `AIPanelV2Layout.spec.tsx`
(now with a State-2 assertion that OutputsDock mounts as `embedded`
with a real send handler — not a blank panel), `usePanelSplit.spec.tsx`,
`SingletonInvariant.spec.tsx`.

Obsolete tests removed: `FocusMode`, `AnalysisTabStripOverlay`,
`PullTab`, `PopoverModeSwitch`, prior `Prefill.spec.tsx`.

## Regression suites (post dead-CompareTabBody-chain delete)

```
$ npx vitest run src/canvas/compare-tab src/canvas/components/__tests__/OutputsDock
 Test Files  5 passed (5)
      Tests  62 passed (62)
```

Pre-existing 7 `InsightsPanel.spec.tsx` failures still reproduce on
`origin/staging` HEAD — unrelated, not regressed by this branch.

## Typography + colour audits

- All panel-v2 text uses `typo('panelHeader' | 'panelBody' | 'panelMeta')` exclusively. No `text-lg`/`text-xl`/`text-base` on the panel surface (`grep -rE "text-(lg|xl|2xl|3xl|base)" src/canvas/ai-panel-v2` returns nothing).
- Primary readable text: `text-text-body` (off-black). Secondary: `text-text-light`. Warnings: `text-warning` (stale only). Action buttons: `bg-primary text-text-on-color`. Links: `text-info`.
- CogPopover items: panelBody + text-text-body; coming-soon badge: panelMeta + text-text-light, outlined pill.

## Analysis action placement audit

`grep -rnE "Run analysis|Analyse now|run_analysis" src/canvas/ai-panel-v2` returns nothing. The AI zone never renders a standalone "Run analysis" button; the readiness card and `StaleAnalysisBadge` own those affordances per the brief.

## Lint claim — precisely scoped

```
$ npx eslint src/canvas/ai-panel-v2
✖ 0 problems
```

`src/canvas/conversation/` (touched but pre-existing) currently shows
6 warnings dating to March/April 2026 — they are NOT introduced by
this batch and are tracked separately. The "lint clean" claim is
scoped to `src/canvas/ai-panel-v2` only.

## Hard constraints — all held

- **No new Zustand store; no `localStorage`/`sessionStorage` for the
  AI panel v2 surface.** Scope clarification: `OutputsDock` itself
  uses `sessionStorage` (key `canvas.outputsDock.v1`) for its own tab
  + open-state persistence — that's pre-existing behaviour from
  before Batch 1 and lives entirely inside `useDockState` in
  `src/canvas/hooks/useDockState.ts`. This batch does NOT introduce
  any new storage; the v2 layout owns no persisted state.
- No `as any` / `as unknown` introduced
- No new semantic transforms (no new UI-SEM ID)
- No CEE / PLoT request shape changes
- No prompt content changes
- No new analysis trigger pathway
- No changes to FF-off behaviour (verified via RightPanelMount)
- Local-only per the brief

## Known follow-ups (not blocking)

| Item | Why deferred |
|---|---|
| Floating-panel session-only persistence to localStorage | Brief says "Session-only position and size. Resets on page load." — explicitly not wanted. |
| ConversationPanel.tsx + ChatThread.tsx pre-existing lint warnings | 6 warnings outside this batch's scope; March/April 2026 vintage. |
| InsightsPanel.spec.tsx 7 pre-existing failures | Same as previous batches — unrelated to v2 work. |
