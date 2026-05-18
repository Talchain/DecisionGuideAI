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

## Local commits ahead of `origin/staging`

```
$ git log --oneline origin/staging..HEAD
30b06082 feat(ai-panel-v2): batch 2 — state-led layout, minimise/float controls, simplified settings menu
```

A follow-up commit landing on top of this doc captures the post-batch-2
review tightening: MinimisedBar input lifted to layout `draftText`,
focus transfer from minimised → docked on expand, scroll-position
preservation across `view.kind` transitions, stronger State 2
assertion that OutputsDock is mounted as `embedded` with a live send
handler (not a blank panel), refreshed stale `AIZone` comments, and
two integration test files (`DraftPreservation.spec.tsx`,
`FloatingDragResize.spec.tsx`).

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
| docked ↔ minimised | ✅ (layout-owned `draftText`, controlled inputs on both) | ✅ (`savedScrollTopRef` captured pre-swap, restored in `useLayoutEffect`) | ✅ (singleton `useConversation()` in layout) |
| docked ↔ floating | ✅ | ✅ | ✅ |
| minimised ↔ floating | ✅ (both controlled by layout) | ✅ | ✅ |
| Welcome → docked | ✅ (Welcome composer now also controlled) | n/a (no thread in welcome) | ✅ |
| Expand from minimised | additionally transfers FOCUS to the docked textarea via `focusOnNextDockRef` flag + `surfaceRef.current.focusInput()` | ✅ | ✅ |

## Tests — exact counts

```
$ npx vitest run src/canvas/ai-panel-v2
 Test Files  16 passed (16)
      Tests  87 passed (87)
```

New spec files in batch 2:
- `WelcomeComposer.spec.tsx`
- `AIHeaderStrip.spec.tsx`
- `MinimisedBar.spec.tsx`
- `FloatingPanel.spec.tsx`
- `useFloatingPanel.spec.tsx`
- `usePanelView.spec.tsx`
- `DraftPreservation.spec.tsx` ← post-review (4 view transitions)
- `FloatingDragResize.spec.tsx` ← post-review (8 cases incl. viewport-clamp regressions)

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

- No new Zustand store; no `localStorage`/`sessionStorage` for v2 state
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
