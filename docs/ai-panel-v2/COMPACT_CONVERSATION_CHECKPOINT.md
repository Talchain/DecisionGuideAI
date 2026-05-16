# AI panel v2 — Compact/Conversation stable checkpoint

**Status:** Steps 1-10 + 14 complete. Focus mode (steps 12-13) deferred for review.
**Branch:** `claude/stoic-jang-052395`
**Flag:** `FF_AI_PANEL_V2` (default `false`, env `VITE_FEATURE_AI_PANEL_V2`, storage `feature.aiPanelV2`)

---

## What ships in this checkpoint

| Step | Status | Notes |
|---|---|---|
| 1 — FF + skeleton | ✅ committed | `80c4bf60` |
| 2 — Singleton checkpoint | ✅ committed | 1 fetch / 1 ChatThread / 1 ChatComposer verified |
| 3 — AIInputBar + CogPopover | ✅ committed | Brief §5.1 mockup; cog popover dismissal per correction #7 |
| 4 — ChatThread mounted | ✅ committed | Via `ConversationPanel hideComposer` |
| 4a — DraftChat hidden under FF on | ✅ committed | Toolbar AI button also hidden |
| 5 — PullTab + vertical resize | ✅ committed | Compact (0.30) / Conversation (0.55) presets; 8px axis dead-zone; ±20px arrow-key support; min-zone clamps enforced |
| 6 — SelectionPill + StaleBadge + tint | ✅ committed | Text-first stale signal; pill primary; Rerun reuses `useV2Run.runV2Analysis` |
| 7 — ReadinessGuidanceCard | ⏭ deferred | Existing `PreAnalysisPanel` inside OutputsDock already covers the brief's pre-analysis trigger conditions |
| 8 — Inspector "Back to results" | ✅ committed | FF-gated text link in `InspectorShell` header |
| 9 — EntityLink + block FF guards | ✅ committed | `EntityLink` lives in `src/canvas/conversation/components/` (minimal alternative — avoids `conversation/` → `ai-panel-v2/` folder-graph circularity). FF-gated "Related:" footer on `GraphPatchBlockRenderer`. Other block renderers don't carry `related_elements` in the current type contract |
| 10 — Block width QA | ✅ | Browser-verified: panel width 400px, ChatThread content 366px (target 360px) |
| 11 — Compact/Conversation commit | ✅ this doc + final commit | |
| 12 — Focus horizontal drag + column | ⏸ deferred for review | See "Focus mode" below |
| 13 — Focus overlay + tab-strip | ⏸ deferred for review | Depends on 12 |
| 14 — Reduced-motion audit | ✅ committed | Height transition uses `--duration-base` which collapses to 0.01ms under `prefers-reduced-motion: reduce` via `brand.css`. Stale tint is static. Tailwind `transition-colors` honoured by global CSS reduce-motion reset |
| 15 — Voice input | ⏭ deferred per plan | Marked optional from day one |

---

## Singleton checkpoint (correction #9) — re-verified

Browser-side under FF on:

| Criterion | Result |
|---|---|
| Mount `ChatThread + AIInputBar` in AIZone while DraftChat is hidden | ✅ |
| Send one message via the in-panel input | ✅ |
| Exactly ONE network request fires | ✅ `POST /bff/orchestrate/v2/turn` |
| Exactly ONE assistant response appears | ⚠ structural guarantee; PoC backend isn't running to deliver |
| No duplicate message IDs in the conversation store | ✅ (single `useConversation()` instance) |

---

## Architecture summary

```
src/canvas/ai-panel-v2/
├── constants.ts                      // sizing, ratios, viewport thresholds, z-index
├── AIPanelV2Layout.tsx               // top-level fixed panel, --olumi-* CSS-var coordination
├── AIZone.tsx                        // singleton useConversation() + ConversationPanel + AIInputBar
├── AIInputBar.tsx                    // compact textarea + cog + send, stage-aware placeholder
├── CogPopover.tsx                    // explicit dismissal contract (correction #7)
├── SelectionPill.tsx                 // primary selection cue (brief §6.1)
├── StaleAnalysisBadge.tsx            // brief §5.4 / §6.2 — Rerun → useV2Run.runV2Analysis
├── PullTab.tsx                       // Compact | Conv | Focus labels + drag handle
├── RightPanelMount.tsx               // FF gating block (real component tests import)
├── hooks/
│   ├── usePanelSplit.ts              // aiRatio + activeMode + drag + arrow keys
│   ├── useSelectionContext.ts        // label + kind + entity border colour
│   └── useStageAwarePlaceholder.ts   // brief §5.2 5-state placeholder matrix
├── utils/
│   └── entityColour.ts               // kind → border-token mapping
└── __tests__/                        // 51 tests across 7 files

src/canvas/conversation/components/
├── EntityLink.tsx                    // click-to-highlight (brief §9.2)
└── __tests__/EntityLink.spec.tsx     // 5 tests
```

External integration points (FF-gated, no FF-off behaviour change):
- `src/canvas/ReactFlowGraph.tsx` — mounts `<RightPanelMount />`
- `src/canvas/components/OutputsDock.tsx` — reads `--olumi-ai-panel-dock-width` + `--olumi-ai-panel-bottom`; FF-gated stale icon on Results tab
- `src/canvas/CanvasToolbar.tsx` — hides AI quick-draft button when FF on
- `src/canvas/conversation/ConversationPanel.tsx` — adds `hideComposer?: boolean` prop
- `src/canvas/conversation/blocks/GraphPatchBlockRenderer.tsx` — FF-gated `EntityLink` footer for `related_elements`
- `src/canvas/ui/inspector-v2/InspectorShell.tsx` — FF-gated "Back to results" header link

---

## What's left — Focus mode (steps 12-13)

Substantive remaining work I'm pausing to flag before continuing:

### Functional requirements (brief §4.3 / §4.5 / §4.6)

- **Horizontal drag** on PullTab triggers Focus mode (only when viewport ≥ 1440px, 8px axis dead-zone). `usePanelSplit` already detects axes; needs a `'horizontal'` commit path.
- **AIFocusColumn** — detached, fixed-position full-height column between canvas and OutputsDock when Focus active. 400px default, 320 min, 50vw max. `z-30` (per `Z_FOCUS_COLUMN` once re-introduced).
- **OutputsDock returns to 100% height** in Focus mode (variable override).
- **Snap-back**: dragging the column's right edge to within 20px of OutputsDock's left edge exits Focus.
- **Viewport-adaptive (brief §4.5)**:
  - ≥1600px: three-column (tools rail + canvas + AI column + dock).
  - 1440–1599px: AI column + canvas; right panel collapses to a 48px tab strip (`AnalysisTabStripOverlay`); clicking a tab opens a 400px right-anchored overlay at `z-40` (`Z_ANALYSIS_OVERLAY`); Escape / outside-click closes.
  - <1440px: Focus disabled (already wired in PullTab).
- **Mode-switch animation**: 300ms slide on enter/exit; instant under `prefers-reduced-motion`.
- **Singleton invariant**: AIZone must remain the only `useConversation()` instance — Focus toggle changes WHERE the zone mounts, not WHAT it mounts.

### Why I paused

- Mounting AIZone as either a `bottom: x` panel OR a `top: 12 / bottom: 12` column requires conditional rendering and a parent-controlled portal/move that preserves React state (the `useConversation` instance must not unmount across mode toggles, or in-flight turns would die). Either a `React.Portal` swap or a sibling mount kept persistent with CSS visibility — both are non-trivial.
- The tab-strip overlay at 1440-1599px is a small new component that conflicts with the existing OutputsDock width override variable — needs careful CSS-variable arbitration.
- Total scope: ~3–4 hours of careful state + viewport-rules work. Conversation length suggests pausing for review here rather than charging through. Per the plan's "Focus mode risk handling": commit Compact/Conversation as a stable local checkpoint before attempting Focus. This is that checkpoint.

### What's NOT a blocker

- Compact/Conversation modes are fully functional. Users can resize, switch modes, send messages, see selection/stale signals. The brief's primary contract (canvas + analysis + AI all visible) is satisfied at any viewport that supports a 400px right column.

---

## Verification (one more time)

- ✅ Typecheck clean (whole repo)
- ✅ 56 tests pass across 8 ai-panel-v2 / EntityLink files
- ✅ Lint clean on touched files (0 new warnings)
- ✅ Browser FF off: legacy DraftChat + OutputsDock at 24rem, AI toolbar button visible, no AI panel v2 mount, no CSS vars set
- ✅ Browser FF on: AI panel v2 visible bottom-right, DraftChat unmounted, dock contracts via `--olumi-ai-panel-bottom`, mode click switches preset (verified ratio 0.300 → 0.501), Focus disabled at vw < 1440px with tooltip
- ⚠ 1 pre-existing test failure (`useConversation.hook.spec.ts > V5 graph re-fetch on analyse response`) — reproduces on `origin/staging`; unrelated

## Commits in this checkpoint

```
80c4bf60  feat(ai-panel-v2): step 1 — FF flag + right-panel scaffold
44de85e6  feat(ai-panel-v2): step 2–4 — mount conversation in AI zone (singleton verified)
???       feat(ai-panel-v2): step 3 — compact AIInputBar + CogPopover
???       feat(ai-panel-v2): step 5 — PullTab + vertical resize + mode control
???       feat(ai-panel-v2): step 6 — selection pill + stale badge + tint + tab warning
???       feat(ai-panel-v2): steps 8 & 9 — Back-to-results link + EntityLink
(this)    feat(ai-panel-v2): step 14 — reduced-motion audit + Compact/Conversation checkpoint
```
