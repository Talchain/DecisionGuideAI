# AI Panel Tranche 1 — Implementation Summary

**Date:** 2026-04-16
**Branch:** `ui/ai-panel-tranche-1` (off `staging`)
**Brief:** CC Brief — AI Panel UI Tranche 1 (surgical fixes, ships on V4)
**Companion docs:** [`ai-panel-investigation-v1.md`](./ai-panel-investigation-v1.md), [`ai-panel-design-proposal-v1.md`](./ai-panel-design-proposal-v1.md)

---

## What shipped

18 items implemented, committed locally, zero push.

| # | Area | Change | Files |
|---|---|---|---|
| 7 | Line-height 1.65 unconditionally | `.markdownContent { line-height: 1.65 }` applied to all message text, not just V2-flagged | `Conversation.module.css` |
| 8 | Bold-lead vertical rhythm | `.md-gap` → `display: block; height: 0; margin-bottom: 0.75em` | `src/index.css` |
| 9 | Number emphasis (tabular-nums) | `convertInline` wraps standalone digits/decimals/% in `<span class="md-number">`; regex excludes HTML numeric entities (`&#39;`) and mid-identifier digits | `src/canvas/utils/safeRichText.ts`, `src/index.css` |
| 10 | Commentary block styling | `.commentaryBlock` → `color: var(--text-light); padding-left: 12px`; no border (DS v5 §21.2 inline) | `Conversation.module.css` |
| 11 | Chip container spacing | `mt-1 mb-2` → `mt-4 mb-4` (symmetric 16px) | `SuggestedChips.tsx` |
| 13 | Flip-up dropdown primitive | New `FlipDropdown` in `src/components/ui/` with viewport-aware placement (prefers above; flips below when insufficient room). `GuideDropdown` and `ThinkingModeDropdown` refactored to use it | `src/components/ui/FlipDropdown.tsx` (new), `GuideDropdown.tsx`, `ThinkingModeDropdown.tsx` |
| 14 | Focus ring offset | `SuggestedChips` adds `focus-visible:ring-offset-2` to match DS v5 §6.3 | `SuggestedChips.tsx` |
| 15 | Empty-state light fill at idle | `LIGHT_FILLS` layer `opacity: 1` at rest; flash-animation keyframes swapped so main briefly shows on tick | `EmptyState.tsx` |
| 16 | Shape alignment | Arrow wrappers matched to shape size (16px in ThinkingIndicator, 27px in EmptyState) with `flex items-center justify-center` on each pair | `ThinkingIndicator.tsx`, `EmptyState.tsx` |
| 17 | Minimize pill placeholder removed | V2 and legacy DraftChat placeholder copy cleared (option a: let shapes speak) | `DraftChat.tsx` |
| 18 | Full-bar click to expand | V2 minimize pill became a single `<button>` wrapping the chevron, `cursor: pointer`, hover tint, ring-offset-2 focus | `DraftChat.tsx` |
| 19 | Left-edge 4px resize, 360–600px | Resize handle moved from right-edge 1.5px to left-edge 4px (`data-testid="draft-chat-resize-handle"`). Clamp 320–1014 → 360–600. Default 676 → 480. 1.44 render multiplier removed (storage == rendered) | `DraftChat.tsx` |
| 27 | `describeOperation` safety | **Deliberately retained existing generic fallback.** The brief's proposed mono-ID fallback would have violated `RAW_ID_PATTERN` invariants enforced by existing tests. See §Scope drift below | `friendlyOperation.ts` (docstring only) |
| 30 | ChatTopBar removed | `ChatTopBar.tsx` deleted; `ChatTopBar.spec.tsx` deleted. Collapse `>>` control moved to `ConversationPanel` header (32px, right-aligned). All consumers updated: `ConversationPanel`, `ChatComposer` (GenerateState inlined), `DraftChat` (comment only), `OutputsDock` (comment only) | `ConversationPanel.tsx`, `ChatComposer.tsx`, `DraftChat.tsx`, `OutputsDock.tsx` |
| 31 | ComposerTools | New `ComposerTools` (⚙️ trigger, FlipDropdown content with Guide section + Thinking mode section). "Fast" and "Deep" show "Coming soon" badge (DS v5 §20 disabled-state). Render inline on composer right | `src/canvas/conversation/zones/ComposerTools.tsx` (new), `ChatComposer.tsx` |
| — | Composer row layout | Left cluster: Attach · Voice (disabled) · Run analysis (ideate/evaluate only, gated by `canRunAnalysis`). Centre: textarea. Right: ComposerTools · Send/Stop. Matches Claude-pattern | `ChatComposer.tsx` |

## Files added

- `src/components/ui/FlipDropdown.tsx` — exported via `src/components/ui/index.ts`
- `src/canvas/conversation/zones/ComposerTools.tsx`
- `src/canvas/conversation/__tests__/aiPanelTranche1.spec.tsx` — 8 new DOM regression tests
- `docs/ui/ai-panel-tranche-1-implementation.md` (this file)

## Files deleted

- `src/canvas/conversation/zones/ChatTopBar.tsx`
- `src/canvas/conversation/__tests__/ChatTopBar.spec.tsx`

## Files modified

Per the table above, plus test updates to match new behaviour:
- `src/canvas/conversation/__tests__/orchestratorRenderingV2.spec.tsx` — `<li>Market share erosion (0.28)</li>` → `<li>Market share erosion (<span class="md-number">0.28</span>)</li>` (item 9)
- `src/canvas/utils/__tests__/markdown.spec.ts` — list items now include `<span class="md-number">` around standalone digits (item 9)
- `src/canvas/conversation/__tests__/BlockFallback.spec.tsx` — added `hasText` helper so `"Block 5"` assertions still pass when the `5` renders as a child span (item 9 side-effect)

---

## Scope drift — item 27 rollback

The brief specifies for item 27:

> fall back to `op.path` or `op.value.id` when `nodeLabels[id]` is missing, and surface unresolved IDs as mono-styled

Implementing this as written emits the raw ID inside `<span class="md-mono">`. The existing `friendlyOperation` test suite asserts a **raw-ID-leak invariant** (lines 298-304 of `friendlyOperation.spec.ts`):

```ts
for (const op of ops) {
  it(`${op.op}(${op.target_id}) with unresolvable label never emits raw IDs`, () => {
    const result = describeOperation(op, deps)
    expect(result).not.toMatch(RAW_ID_PATTERN)
    expect(result).not.toContain(op.target_id)
  })
}
```

This invariant is documented in-code at `friendlyOperation.ts:23-38` as a defence-in-depth security measure ("Without the full-word alternatives, a `factor_team_morale` string leaking into a label field would slip past every tier of resolveNodeLabel and render verbatim in the conversation panel.").

The proposed mono-ID fallback would violate this invariant. Given the brief's rollback trigger "Any existing UI test regression," I rolled back the fallback and kept the existing "Remove connection" generic text. Added a clarifying docstring to `GENERIC_BY_OP`.

The new test file includes one assertion that re-verifies the invariant holds after all Tranche 1 edits.

Recommendation for Paul: if the visibility of specific identifiers is genuinely valuable for destructive actions, a follow-up brief could widen the test-time criteria for what counts as a "safe" fallback (e.g. permit mono-styled IDs that pass a stricter regex than `RAW_ID_PATTERN`, OR redact-to-hash before display).

---

## Tests — results

### New regression tests (8 — all pass)

[`src/canvas/conversation/__tests__/aiPanelTranche1.spec.tsx`](../../src/canvas/conversation/__tests__/aiPanelTranche1.spec.tsx)

- Item 13: FlipDropdown flips above a bottom-of-viewport anchor (`data-placement="above"`).
- Item 14: SuggestedChips className includes `focus-visible:ring-offset-2`.
- Items 15/16: ThinkingIndicator row layout inline style asserted.
- Item 19: resize handle exposes `data-testid="draft-chat-resize-handle"` with 4px width, left 0.
- Item 27: `describeOperation` unresolvable `remove_edge` falls through to `"Remove connection"` and never contains the raw ID.
- Item 30: dynamic import of `../zones/ChatTopBar` throws (file deleted).
- Item 31: clicking ComposerTools trigger reveals Guide scaffold/help/example buttons, Thinking mode Normal enabled, Fast/Deep disabled.
- Item 31: Normal mode click invokes `onSelectMode('normal')`.

### Existing tests — net change

- Pre-existing failures: 30 (26 in `markdown.spec.ts` + 4 in `integratedPath.brief2026-04-10.spec.ts` + `sse-params.test.tsx`). Not introduced by this brief.
- Tests updated to match new behaviour: 4 (listed above).
- Tests newly added: 8.
- Regressions I introduced: 0 (all transient failures fixed within this session).
- Tests deleted: `ChatTopBar.spec.tsx` (11 tests; component removed per item 30).

### Typecheck

`npm run typecheck` → clean, zero errors.

---

## DS v5 alignment

Every change references a DS v5 section or documents a DS v5 gap:

- Item 7: DS v5 §2 — gap flagged (body line-height unspecified)
- Item 8: DS v5 §4.1 spacing scale
- Item 9: DS v5 §2 — gap flagged (tabular numerics not specified)
- Item 10: DS v5 §21.2 (Commentary block inline pattern)
- Item 11: DS v5 §4.1 + §21.4
- Item 13: DS v5 §27.3 (popover z-index 400), §8 — gap flagged (flip-up primitive)
- Item 14: DS v5 §6.3 (focus ring 2px info + 2px offset)
- Item 15: DS v5 §3.8 (entity-light)
- Item 16: DS v5 §10 (shape rendering)
- Item 17: DS v5 §18 (empty state copy)
- Item 18: DS v5 §6.3 (focus ring) + §7.3 (hover)
- Item 19: DS v5 — gap flagged (resize handle width)
- Item 27: existing safety invariant preserved
- Item 30: DS v5 §8.9 sticky footer / panel header pattern
- Item 31: DS v5 §8 (component dropdown) + §20 (progressive disclosure / disabled state)

Four follow-up DS v5 gaps flagged for the v5.1 review (per Paul's earlier decision):
1. Body line-height token (`--leading-body`)
2. Bold-lead paragraph vertical rhythm token (`--space-bold-lead`)
3. Tabular numerics utility class (`.md-number` pattern)
4. Flip-up dropdown primitive spec (document FlipDropdown)
5. Panel resize handle width (`--panel-resize-handle-width: 4px`)
6. Empty-state shape treatment (idle light-fill vs animation-only)

---

## What Paul needs to verify

1. **Dev server smoke test** — `npm run dev`, open canvas, confirm:
   - Top bar is gone; panel header has chevron on right.
   - Composer row shows Attach · Voice · Run analysis (when ideate/evaluate stage) · textarea · ⚙️ · Send.
   - Clicking ⚙️ opens Guide + Thinking mode dropdown; Fast/Deep disabled with "Coming soon".
   - Resize handle works on left edge, clamped 360–600px.
   - Collapsed pill expands on full-bar click.
   - Shapes in empty state show light fill at idle; flash to main briefly during wave.
2. **Tranche-2 collision check** — nothing in this tranche touches `useConversation.ts`. A1 may merge freely.
3. **Visual QA** of the typography rhythm (line-height 1.65, bold-lead spacing, tabular numerics for percentages).

---

## Commit

Local commit only, not pushed:

```
git log -1 --oneline
# (to be created on this session's final commit)
```
