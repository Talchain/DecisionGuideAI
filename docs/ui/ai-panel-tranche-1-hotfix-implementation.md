# AI panel Tranche 1 hotfix — implementation

**Date:** 2026-04-17
**Branch:** `ui/ai-panel-tranche-1-hotfix` (off `staging`)
**Brief:** CC Brief — AI panel follow-up (Tranche 1 hotfix)
**Merged to staging:** 2026-04-17 (merge commit `4ecf00e7`)

---

## ⚠️ No-touch list exception — sanctioned, recorded here for future sessions

The Tranche 1 hotfix brief included `src/canvas/conversation/useConversation.ts`
on the no-touch list (A1-owned; V5 scaffolding). **For item 6 only (removing
the 3-second "Thinking…" sentinel timer at lines 2680-2684), Paul explicitly
relaxed this constraint in the live session on 2026-04-17.**

Conditions that made the relaxation safe:
- V5 is paused at Phase 0 (schemas-only; no runtime branching in
  `useConversation.ts`), so no A1/V5 collision risk
- The change is a single-block deletion with zero dependencies on surrounding
  conversation-flow logic (tool/progress labels still flow through
  `toolLoadingState` untouched)
- Reversible via the inline comment at the deletion site, which documents the
  exact removal conditions under which the sentinel could be reintroduced

Future sessions: **do not take this as general permission to edit
`useConversation.ts`.** The no-touch list still applies. Any further edit
needs a fresh explicit authorisation in-session, and must re-verify that V5
hasn't moved past Phase 0. See the inline comment block at
`src/canvas/conversation/useConversation.ts:2679-2693` for the
removal-condition record at the code site itself.
**Scope:** items 3, 4, 6, 7, 9 (five of the brief's nine items; see Tranche 1b deferrals below)

---

## Scope decision: 1a vs 1b

The original brief listed nine items. After audit, items 1, 2, 5, 8 required browser-based reproduction (1, 2, 8) or a standalone architectural brief (5). Paul deferred them to Tranche 1b pending a dev-server smoke session with screenshots. This hotfix lands the five items that have clean root causes identifiable from source and can ship test-safe.

| Item | Status | Reason |
|---|---|---|
| 1 textarea squashed | Deferred to 1b | Requires browser reproduction to distinguish auto-grow vs line-height cause |
| 2 settings dropdown broken | Deferred to 1b | Requires DOM inspection; code looks structurally correct |
| 3 Run analysis icon-only | **Landed** | Trivial label removal |
| 4 disable Run during in-flight | **Landed** | Closed the click-to-statusFlip gap |
| 5 unified card action row | Deferred to Tranche 2 | Architectural — requires design decision on hover-reveal + test migration |
| 6 dual thinking affordance | **Landed** | No-touch relaxation approved for single-line useConversation fix |
| 7 bold-lead vertical rhythm | **Landed** | Root cause located in safeRichText join logic |
| 8 first-line clipping | Deferred to 1b | Requires screenshot to narrow the visual cause |
| 9 label fallback | **Landed** | Path B adopted — element-type word from id prefix, no raw id leak |

---

## What shipped

### Item 3 — Run analysis icon-only
`src/canvas/conversation/zones/ChatComposer.tsx`

The `composer-run-chip` button rendered a `▶ Run analysis` label taking up ~100px horizontal. Replaced with a 34×34 icon-only button that matches the Attach/Voice/Settings visual weight. Kept:
- `data-testid="run-analysis-chip"` (test stability)
- `<Play />` icon
- `aria-label="Run analysis"` (dynamic when blocked)
- `title` tooltip (static "Run analysis", or blocked-reason when disabled)

Behaviour: unchanged. Stage gate (`stage === 'ideate' || stage === 'evaluate'`) and `canRunAnalysis` / `isThinking` disable conditions preserved.

### Item 4 — Disable Run analysis during in-flight turn
`src/canvas/conversation/ConversationPanel.tsx`

Existing gate was `isThinking || canRunAnalysis === false`. `canRunAnalysis` flips off when PLoT enters `preparing`/`connecting`/`streaming`. But the click→status-flip gap could let a rapid double-click fire twice (the F-77 guard inside `useV2Run` aborts the first, but the UX still animates a second click).

Fix: destructure `isRunning` from `useV2Run()` and AND it into `canRunAnalysis`:

```tsx
const { runV2Analysis, isRunning: isV2RunInFlight } = useV2Run()
…
canRunAnalysis={runGateResult.allowed && !isV2RunInFlight}
```

`isV2RunInFlight` flips to `true` synchronously inside `runV2Analysis` (line 233) before any await, so the next render disables the button before the user can re-click.

### Item 6 — Dual thinking affordance
`src/canvas/conversation/useConversation.ts` (no-touch relaxed for this change)

**Exception note:** The no-touch list in the brief was relaxed specifically for this fix. V5 is paused at Phase 0 so there was no collision risk; Paul approved the exception explicitly.

Root cause: `useConversation.ts:2680-2684` set a 3-second timer that wrote `toolLoadingState: 'Thinking\u2026'` to the message record. Combined with `isThinking` driving the composer's Send→Stop swap, the user saw two activity indicators.

Fix: deleted the 3s timer and both `clearTimeout(thinkingTimerId)` references (now unreachable). Tool-specific labels (`mapToolLoadingLabel(event.tool_name)`) and CEE `progress` event messages continue to flow through `toolLoadingState` — they are informational ("Running simulations…", "Olumi is thinking: weighing options") and distinct from the blanket "Thinking…" filler.

Behaviour change: after 3 s of silence the message card shows only the streaming-dot indicator (existing placeholder for empty streaming turns). The composer stop button remains the canonical signal that a turn is live. No regression on `MessageBubble.streaming.spec.tsx`'s "does not show tool loading when toolLoadingState is null" case (that path is now always exercised pre-text-delta).

### Item 7 — Streaming bold-lead vertical rhythm
`src/canvas/utils/safeRichText.ts`

Root cause: the join loop at lines 254-270 only emitted `<br class="md-gap">` in three cases: bullet/horizontal-rule blocks, blank-line paragraph breaks, or *consecutive* bold-lead paragraphs. Streamed output pattern `**Header**\nbody\n**Next**\nbody` hit none of those for the header→body transition, so it rendered with a plain `<br>` (default inline, no visible gap).

Fix: widen the `useGap` condition to include either side being bold-lead:

```ts
const useGap = blankSeen || isBoldLead(part) || isBoldLead(prevPart)
```

This preserves:
- Existing gap on blank-line breaks (`orchestratorRenderingV2.spec.tsx:663-666` still passes)
- Existing gap between consecutive bold-leads (unchanged)
- Plain `<br>` between two non-bold paragraphs with no blank separator

Added: new spec `aiPanelTranche1Hotfix.spec.tsx` covers the four transition cases.

### Item 9 — GraphPatchBlock label fallback (Path B)
`src/canvas/conversation/friendlyOperation.ts`

**Path B chosen over Path A:** the brief hedged between "use real labels" and "fall back to truncated id in mono". Path A would have violated the existing `RAW_ID_PATTERN` security invariant (`friendlyOperation.spec.ts:298-304` asserts `not.toContain(op.target_id)` — any id-derived fallback that includes a substring of the id fails). Path B delivers the brief's primary requirement (specific element-type label) without weakening the invariant.

**Old behaviour:** `GENERIC_BY_OP` hardcoded "factor" for every node op and "connection" for every edge op. An update to an option fell back to "Update factor"; a removed goal fell back to "Remove factor". Wrong.

**New behaviour:** `genericForOp(op)` derives the element type from the `op.target_id` prefix via `ID_PREFIX_TO_TYPE` (covers both short prefixes `opt_`, `fac_`, `goal_`, `dec_`, `out_`, `con_`, `risk_` and long prefixes `option_`, `factor_`, `goal_`, `decision_`, `outcome_`, `constraint_`). Emits `"{verb} {type}"` using only the literal word form — "option", "goal", "decision", etc. Never emits the raw prefix or id substring, so the RAW_ID_PATTERN invariant holds by construction.

Edge operations return "Add/Update/Remove connection" unchanged — edges don't carry a meaningful type prefix.

## Files changed

| File | Lines Δ | Purpose |
|---|---|---|
| `src/canvas/conversation/zones/ChatComposer.tsx` | −14 / +9 | Item 3: icon-only button |
| `src/canvas/conversation/ConversationPanel.tsx` | −1 / +2 | Item 4: in-flight flag threaded |
| `src/canvas/conversation/useConversation.ts` | −7 / +4 | Item 6: removed 3s "Thinking…" timer |
| `src/canvas/utils/safeRichText.ts` | −3 / +8 | Item 7: widened bold-lead gap condition |
| `src/canvas/conversation/friendlyOperation.ts` | −8 / +69 | Item 9: Path B element-type fallback |
| `src/canvas/conversation/__tests__/aiPanelTranche1Hotfix.spec.tsx` | new, 166 lines | 16 regression tests |
| `docs/ui/ai-panel-tranche-1-hotfix-implementation.md` | new | This document |

## Test results

### New regression tests (16 / 16 pass)

`src/canvas/conversation/__tests__/aiPanelTranche1Hotfix.spec.tsx`:

- Item 3: ChatComposer source declares icon-only button (no `<span>Run analysis</span>`, aria-label intact, testid stable).
- Item 4: ConversationPanel threads `isV2RunInFlight` into `canRunAnalysis`.
- Item 7: 5 cases covering header→body, body→header, header→header, body→body, and explicit blank-line breaks.
- Item 9: 9 cases covering update/add/remove for option, goal, decision, outcome, constraint, factor; edge ops unchanged; unrecognised id falls back to "factor"; security invariant (never emits raw id for any of 7 id shapes).

Item 6 requires no new test — the deleted code path is no longer reachable, and the existing `MessageBubble.streaming.spec.tsx` asserts the null-`toolLoadingState` render behaviour that now always applies pre-text-delta.

### Existing tests — net change

Fair baseline comparison on the six directly-affected spec files, run before and after applying the hotfix:

| | Baseline | With hotfix | Δ |
|---|---|---|---|
| Spec files passed | 3 | 3 | 0 |
| Spec files failed | 3 | 3 | 0 |
| Tests passed | 103 | 119 | +16 (new hotfix spec) |
| Tests failed | 26 | 26 | 0 |

All 26 pre-existing failures are infrastructure (Supabase env-var missing in test runner) or pre-hotfix test-expectation drift in `markdown.spec.ts`. None introduced by this hotfix.

### Typecheck

`npm run typecheck` → clean.

## Self-review

- **Root cause vs symptom:** each of the five landed items is a root-cause fix, not a patch over a symptom. Item 3 removes the label at the source; item 4 eliminates the gating gap, not just the double-fire effect; item 6 deletes the timer, not a workaround in render; item 7 corrects the join condition, not a CSS override; item 9 replaces the hardcoded type with correct derivation.
- **DS v5 alignment:** all tokens remain DS v5 (no hex literals introduced). Item 3 re-uses the existing `composer-icon-btn` pattern. Item 7 preserves the existing `.md-gap` class (defined in `src/index.css:614`, `margin-bottom: 0.75em`) which translates to ~12px at body size — matches DS v5 §2.4.
- **Accessibility:** item 3 preserves `aria-label` + `title`. Item 4 gates interaction, not visibility — screen-reader announcement still correct when blocked. Item 7 affects visual rhythm only, not semantics. Item 9 output remains marked-up with `**bold**` for names when resolvable. No accessibility regression.
- **Edge cases checked:**
  - Item 3: narrow panel width (the old chip was ~100px; icon-only saves horizontal space — better at 360px minimum width).
  - Item 4: `useV2Run.isRunning` resets to `false` on both success and error paths (line 920 comment confirms superseded-run state handling). No stuck-disabled risk.
  - Item 6: if `tool_start` fires immediately, the specific tool label still displays — no regression on tool-progress UX.
  - Item 7: consecutive blank lines still collapse to a single `md-gap` (existing `blankSeen` flag is cleared on emit).
  - Item 9: unrecognised id prefixes fall back to "factor" (node) / "connection" (edge). No case returns an empty string or undefined.

## DS v5 gaps flagged

None new. Item 7's `0.75em` `md-gap` translates to ~12px at 16px body — at the lower end of DS v5 §2.4's "12-16px between bold-led paragraphs" range. Upgrading to 1em (~16px) is a DS v5.1 consideration, not a hotfix.

## Follow-up: ChatGPT review hardening (2026-04-17, same branch)

After the initial five-item hotfix landed, a code-review pass surfaced five
real findings plus three improvements. All five findings and all three
improvements were addressed in a follow-up commit on the same branch.

### P0 — handler-level guard
`ConversationPanel.tsx:396` — `handleRunAnalysis` previously guarded only on
`runGateResult.allowed`. The button's `disabled` prop blocked UI clicks, but
the guidance store's `_runAnalysis` callback (registered at line 422) routed
around the button and could fire a second run during the flip-gap. Added
`isV2RunInFlight` to the handler's early-return condition and its dep array.
Belt-and-braces defence in addition to F-77's abort-and-restart behaviour.

### P1 — in-flight tooltip
`ConversationPanel.tsx:393` — `runBlockedReason` was derived only from the
structural gate, so when the button was disabled by `isV2RunInFlight` the
tooltip fell back to the default "Run analysis" (meaningless on a disabled
button). In-flight now takes priority: "Analysis in progress" surfaces as
both `title` and the blocked-state `aria-label` suffix.

### P1 — direct sentinel regression for item 6
Added a source-level tripwire that asserts `useConversation.ts` no longer
writes the literal `toolLoadingState: 'Thinking\u2026'` and no longer
references `clearTimeout(thinkingTimerId)`. The existing
`MessageBubble.streaming.spec.tsx` null-state assertion continues to
exercise the always-null pre-text-delta path; the tripwire is the barrier
preventing reintroduction.

### P1 — rendered-DOM test for item 3
The original item 3 regression was a source-file assertion. Added a
lightweight DOM test that renders `ChatComposer` in isolation with the
existing mock harness and asserts:
  · `chip.textContent.trim() === ''` (no visible label text)
  · `chip.querySelector('svg') !== null` (icon still present)
  · `chip.getAttribute('aria-label') === 'Run analysis'`
The source-file tripwire remains as defence against refactor-to-span-split
cases that a DOM text query could miss.

### Improvement — double-click button-disable test
Render ChatComposer with `canRunAnalysis={true}`, click the chip, re-render
with `canRunAnalysis={false}` (simulating ConversationPanel's in-flight
flip), click again. Asserts `onRunAnalysis` is called exactly once — the
disabled attribute swallows the second click.

### Improvement — safeRichText join-logic matrix
Replaced the original five single-case bold-lead tests with an `it.each`
matrix covering all eight transition combinations between body, bold-lead,
list, and blank-line parts. Locks the intended paragraph rhythm so future
changes to the predicate surface as concrete assertions rather than silent
visual drift.

### Improvement — inline removal-condition comment
Widened the comment at `useConversation.ts:2679-2693` to document explicit
removal conditions under which the Thinking sentinel could be reintroduced
(user-research-confirmed need + dedicated UI surface), and cross-references
this implementation doc.

### Deferred from the review
- **Over-spacing concern on non-section bold-lead paragraphs.** The
  `isBoldLead(s)` predicate matches any `<strong>`-opening part, including
  edge cases like `"**Yes**, that works."`. The over-spacing in those cases
  is bounded (one extra ~12px) and the orchestrator convention uses bold at
  paragraph start for section leads specifically. Tightening to `**word**:`
  or `**word**\nbody` adds complexity for a low-frequency edge. The join
  matrix test locks whatever behaviour is current; revisit if Paul observes
  over-spacing in real streamed output.

### Tests — net change after follow-up
Target-file spec files:
  · Baseline (staging): 103 passed / 26 failed
  · With five-item hotfix: 119 passed / 26 failed (+16)
  · With follow-up hardening: **129 passed / 26 failed** (+26 vs baseline)

All 26 failures remain pre-existing (Supabase env + markdown-spec drift).
Zero regressions introduced. Typecheck clean.

## What Paul needs to verify

1. **Dev server smoke** — `npm run dev`, open a conversation:
   - Composer row: icon-only ▶ where "Run analysis" label used to sit.
   - Start a long-running turn → composer Stop button shows; after 3 s, the card does NOT flash "Thinking…".
   - Stream a response with bold-led paragraphs → visible gaps between header and body.
   - Reject a graph patch that can't resolve labels → see "Update option" (if the patch targets an option) instead of generic "Update factor".
2. **Tranche 1b browser session** — schedule for items 1, 2, 8. Paul's screenshots / DOM inspection required before those dispatch.
3. **Tranche 2 separate brief** — item 5 (unified action row) needs design decisions: hover-reveal timing, test migration from `MessageActions.spec.tsx` + `FeedbackRow` usage, whether Copy/Retry stay icon-only or get labels.

## Commit plan

Per brief: one commit per logical group.

1. `fix(ui): composer icon-only Run analysis + close double-fire gap` (items 3, 4)
2. `fix(ui): streaming card + paragraph rhythm polish` (items 6, 7)
3. `fix(ui): GraphPatchBlock label fallback uses element-type word` (item 9)
4. `test(ui) + docs: Tranche 1 hotfix regression suite + implementation doc`

Local commits only. No push. Paul reviews before merge.
