# AI panel v2 — Final delivery summary

**Status:** All 15 plan steps complete (step 15 deferred per plan as optional). The original-delivery commits documented here were pushed to `origin/staging` at HEAD `c6e26f50`. Follow-up UX batches sit locally on this branch — see `docs/ai-panel-v2/UX_BATCH_1_WALKTHROUGH.md` for the current state.
**Branch:** `claude/stoic-jang-052395`
**Origin staging at end of this delivery sweep:** `c6e26f50` (12 commits 80c4bf60…c6e26f50 landed)
**Flag:** `FF_AI_PANEL_V2` (default `false`, env `VITE_FEATURE_AI_PANEL_V2`, storage `feature.aiPanelV2`)

---

## Per-step status

| Step | Status | Commit |
|---|---|---|
| 1 — FF flag + right-panel scaffold | ✅ | `80c4bf60` |
| 2 — `useConversation` singleton hard checkpoint | ✅ verified | `44de85e6` |
| 3 — Compact AIInputBar + CogPopover | ✅ | `f5561a40` |
| 4 — ChatThread mounted in AIZone | ✅ | bundled `44de85e6` |
| 4a — DraftChat + toolbar AI button hidden under FF on | ✅ | bundled `44de85e6` |
| 5 — PullTab + vertical resize + mode control | ✅ | `86d198c6` |
| 6 — SelectionPill + StaleAnalysisBadge + Results-tab warning + tint | ✅ | `5ee14003` |
| 7 — ReadinessGuidanceCard | ⏭ deferred | existing PreAnalysisPanel covers the brief's four trigger conditions |
| 8 — Inspector "Back to results" link | ✅ | `9cf72f3a` |
| 9 — EntityLink + GraphPatchBlock FF-gated footer | ✅ | `9cf72f3a` |
| 10 — Block width QA at 360px | ✅ | browser-verified (366px content) |
| 11 — Compact/Conversation checkpoint commit + close-out | ✅ | `fb61691e` |
| 12 — Focus mode horizontal drag + AIFocusColumn | ✅ | `2902fd3f` + local follow-up patch |
| 13 — 1440–1599 tab-strip overlay | ✅ | bundled with 12; local follow-up patch makes the strip drive the real OutputsDock tab body |
| 14 — Reduced-motion audit | ✅ | bundled `fb61691e` + step-12 commit |
| 15 — Voice input | ⏭ deferred per plan as optional |

---

## Singleton checkpoint (correction #9) — verified

Browser-side under FF on with the compact AIInputBar:

| Criterion | Result |
|---|---|
| One `useConversation()` instance active (DraftChat unmounted) | ✅ |
| Send one message via the in-panel input | ✅ |
| Exactly ONE network request fires | ✅ `POST /bff/orchestrate/v2/turn` |
| Exactly ONE assistant response in the thread | ⚠ structural guarantee (PoC backend doesn't respond) |
| No duplicate message IDs | ✅ (single subscription) |

---

## Focus mode — verified across viewport buckets

| Viewport | Behaviour | Verified |
|---|---|---|
| ≥ 1600px | Three-column: tools rail + canvas + AI column (400×872 at right=424) + dock | ✅ at 1680px |
| 1440–1599px | AI column + canvas; dock collapses to a 48px tab strip; clicking a tab expands the real OutputsDock to a temporary 400px overlay and switches to that tab; Escape closes | ✅ at 1500px |
| < 1440px | Focus disabled; viewport guard drops out of Focus → Compact if previously active | ✅ at 1300px |

Snap-back: dragging right-edge of AI column toward the dock and releasing within `FOCUS_COLUMN_MIN + 20px` fires `onExit()` → `setMode('compact')`. Unit-tested in `FocusMode.spec.tsx`.

---

## Reduced motion (step 14 audit)

| Animation | Standard | Reduced motion |
|---|---|---|
| Mode-switch height transition | 300ms via `--duration-base` | 0.01ms via brand.css media-query reset |
| Focus enter/exit width/right transition | 300ms via `--duration-base` | 0.01ms |
| Stale resize-bar tint | Static colour swap (no pulse in Compact/Conv) | Same |
| Selection tint | Tailwind `transition-colors` (150ms default) | Respected by global RM reset |
| Click-to-highlight pulse | Existing focusByTarget behaviour (canvas highlight) | Existing RM handling unchanged |
| GraphPatchBlock acceptance | Existing renderer | Unchanged |

The transition is suppressed via `isDragging`/`isFocusResizing` to keep drag-tracking real-time.

---

## Architecture (final shape)

```
src/canvas/ai-panel-v2/
├── constants.ts                      sizing, ratios, viewport thresholds, z-index
├── AIPanelV2Layout.tsx               mode-aware fixed panel (Compact/Conv/Focus); CSS-var coord
├── AIZone.tsx                        singleton useConversation + ConversationPanel(hideComposer) + AIInputBar
├── AIInputBar.tsx                    compact textarea + send + cog (brief §5.1)
├── CogPopover.tsx                    correction #7 dismissal contract
├── SelectionPill.tsx                 primary selection cue (brief §6.1)
├── StaleAnalysisBadge.tsx            text-first stale badge; Rerun → useV2Run
├── PullTab.tsx                       three labels + drag handle; selection/stale tint
├── AnalysisTabStripOverlay.tsx       48px strip that expands the real OutputsDock overlay (1440–1599 Focus)
├── RightPanelMount.tsx               FF gating block (real component tests import)
├── hooks/
│   ├── usePanelSplit.ts              ratio + activeMode + axis detection + arrow keys
│   ├── useFocusColumn.ts             Focus column width + snap-back
│   ├── useSelectionContext.ts        selection label + entity colour
│   └── useStageAwarePlaceholder.ts   5-state placeholder matrix
├── utils/
│   └── entityColour.ts               kind → border-token
└── __tests__/                        63 ai-panel-v2 tests across 9 files

src/canvas/conversation/components/
├── EntityLink.tsx                    click-to-highlight (brief §9.2)
└── __tests__/                        5 EntityLink tests
```

FF-gated external integration points (no FF-off behaviour change):
- [src/canvas/ReactFlowGraph.tsx](../../src/canvas/ReactFlowGraph.tsx) — mounts `<RightPanelMount />`
- [src/canvas/components/OutputsDock.tsx](../../src/canvas/components/OutputsDock.tsx) — reads `--olumi-ai-panel-dock-width` + `--olumi-ai-panel-bottom`; FF-gated stale icon on Results tab
- [src/canvas/CanvasToolbar.tsx](../../src/canvas/CanvasToolbar.tsx) — hides AI quick-draft button under FF on
- [src/canvas/conversation/ConversationPanel.tsx](../../src/canvas/conversation/ConversationPanel.tsx) — `hideComposer?: boolean` prop
- [src/canvas/conversation/blocks/GraphPatchBlockRenderer.tsx](../../src/canvas/conversation/blocks/GraphPatchBlockRenderer.tsx) — FF-gated `EntityLink` footer
- [src/canvas/ui/inspector-v2/InspectorShell.tsx](../../src/canvas/ui/inspector-v2/InspectorShell.tsx) — FF-gated "Back to results" link

---

## Verification summary

- ✅ `npm run typecheck` clean across whole repo
- ✅ 67 ai-panel-v2 + 5 EntityLink tests pass across 11 files (10 ai-panel-v2 + 1 EntityLink)
- ✅ Lint clean on touched files (0 new warnings)
- ✅ Browser FF off at 1280×800: DraftChat mounted, OutputsDock visible, no AI v2 layout, no flag-specific CSS vars set, no errors
- ✅ Browser FF on at 1680×900: AI v2 panel + DraftChat unmounted; mode click switches preset (Compact ↔ Conversation); Focus engages (panel becomes 400-wide full-height column at right=424); CSS var `--olumi-ai-panel-bottom` flips from height to 0 in Focus
- ✅ Browser FF on at 1500×900: Focus + tab-strip mode; closed dock width is 48px, clicking a tab expands the real OutputsDock overlay; capture-phase outside-click closes the overlay and suppresses the underlying click for true-outside targets (canvas) while AI-column clicks keep working; Escape closes; clicking inside the dock or strip does NOT close
- ✅ Browser FF on at 1300×900: Focus disabled, auto-drops to Compact on narrow
- ✅ Prefill — `useGuidanceStore.getState()._prefillChat` (registered by `ConversationPanel` via the `AIZone.prefillChat` prop) populates the visible `AIInputBar` textarea. End-to-end via the real registration path in `Prefill.spec.tsx`
- ⚠ 1 pre-existing test failure (`useConversation.hook.spec.ts > V5 graph re-fetch on analyse response`) — reproduces on `origin/staging`; unrelated

## Hard constraints — all held

- ✅ No new Zustand store
- ✅ No `localStorage` / `sessionStorage` writes for AI-panel-v2 state (session-only React)
- ✅ No `any` / `as unknown` casts
- ✅ No new semantic transforms (no new UI-SEM ID)
- ✅ No CEE / PLoT request shape changes
- ✅ No prompt content changes
- ✅ No new analysis trigger pathway (Rerun uses `useV2Run.runV2Analysis`)
- ✅ No changes to FF-off behaviour
- ✅ No push to remote — 11 commits sit locally on `claude/stoic-jang-052395` (this round's fix commit is appended on top)

## Commit list

```
$ git log --oneline origin/staging..HEAD
56b9d574  fix(ai-panel-v2): prefill targets visible AIInputBar + overlay outside-click
d10b4a80  fix(ai-panel-v2): slide AI column left when tab-strip tab opens
aefe4baa  docs(ai-panel-v2): final delivery summary — all 15 plan steps closed
2902fd3f  feat(ai-panel-v2): steps 12 & 13 — Focus mode + tab-strip overlay
fb61691e  feat(ai-panel-v2): step 14 — reduced-motion audit + Compact/Conversation checkpoint
9cf72f3a  feat(ai-panel-v2): steps 8 & 9 — Back-to-results link + EntityLink
5ee14003  feat(ai-panel-v2): step 6 — selection pill + stale badge + tint + tab warning
86d198c6  feat(ai-panel-v2): step 5 — PullTab + vertical resize + mode control
f5561a40  feat(ai-panel-v2): step 3 — compact AIInputBar + CogPopover
44de85e6  feat(ai-panel-v2): step 2–4 — mount conversation in AI zone (singleton verified)
80c4bf60  feat(ai-panel-v2): step 1 — FF flag + right-panel scaffold
```

(Plus this doc commit.)

## Known follow-ups (documented, not blocking)

| Item | Why deferred |
|---|---|
| ReadinessGuidanceCard (step 7) | Existing PreAnalysisPanel inside OutputsDock already covers all four brief trigger conditions. Build a slim v2-specific card only if pilot UX demands it. |
| EntityLink wired into Commentary/Evidence/Scenario block renderers | Those block types don't carry `related_elements` in the current `types.ts` contract. Wiring lands when their schemas grow related_elements (post-V5 contract update). |
| Voice input (step 15) | Plan-marked optional from day one. |
| Stale-bar pulse animation | Brief §6.2 spec'd 1s pulse; current implementation is text-first static tint (per correction #15 priority). Add 1s pulse if QA shows users miss the stale signal without it. |
