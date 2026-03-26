# Orchestrator UI Delta

Changes and findings from Brief A (SafeRichText, commentary rendering) and Brief B (chip rendering, role differentiation, layout) under the `ORCHESTRATOR_RENDERING_V2` feature flag.

---

## Brief A — Response rendering, blocks, and markdown

### Design System v5 mismatches found

| # | Location | Issue | Action |
|---|----------|-------|--------|
| A-1 | `Conversation.module.css` — `.reviewCardInfo` | Background was `var(--info-light, #BAD7E4)`, violating DS v5 §16.2 which requires `bg-panel` on cards. `bg-{colour}-light` is reserved for canvas node fills only. | **Fixed in code** — changed to `var(--bg-panel, #FEFEFE)` |
| A-2 | DS v5 §21.2 | Spec states CommentaryBlock must render inline (no top border). Pre-existing code was compliant; confirmed no change needed. | No change needed |
| A-3 | DS v5 §19 | Collapsible "More"/"Less" toggle pattern referenced in spec — implemented for CommentaryBlock collapse. | **Implemented** |

**Requires manual DS v5 update by Paul:**
- None. The only doc mismatch was A-1 (a code violation of an existing DS rule) which is now fixed.

---

### Upstream issues found

| # | Description | Status |
|---|-------------|--------|
| U-1 | The v2.1 orchestrator prompt spec (`olumi_orchestrator_system_prompt_v21`) can emit XML-escaped entities (`&amp;`, `&lt;`, `&gt;`) in `assistant_text` and block content. These would render as literal entity text without a decode step. | **Fixed in `safeRichText`** — decode → re-escape pipeline |
| U-2 | `review_card` blocks in the v2.1 envelope use `tone: "challenger" \| "facilitator"`, but the UI type used `variant: "info" \| "alert"`. There was no mapping from tone → variant. | **Fixed in `adaptCEEBlock`** — challenger→alert, facilitator→info |
| U-3 | `commentary` blocks can have an optional `title` field per v2.1 spec, but it was not being passed through the `adaptCEEBlock` adapter or rendered. | **Fixed** — title passed through and used as collapse preview |
| U-4 | `review_card` blocks with missing `tone` or unrecognised `tone` values (anything other than `challenger`/`facilitator`) had no fallback. | **Fixed** — both cases default to `facilitator` (info) treatment |

---

### Changed files

| File | Change |
|------|--------|
| `src/flags.ts` | Added `orchestratorRenderingV2` flag config and `isOrchestratorRenderingV2Enabled` export |
| `src/canvas/utils/safeRichText.ts` | **New file** — restricted markdown-to-HTML converter (bold, bullets, line breaks). XSS-safe allowlist `{strong, br, ul, li}`. XML entity decode pipeline. |
| `src/canvas/utils/markdown.ts` | Replaced with re-export redirect: `export { safeRichText as sanitizeMarkdown }` for gradual migration |
| `src/canvas/conversation/types.ts` | Added `title?` to `CommentaryBlock`; added `tone?: 'challenger' \| 'facilitator'` to `ReviewCardBlock` |
| `src/canvas/conversation/useConversation.ts` | Updated `adaptCEEBlock` — commentary `title` passthrough; review_card `tone` → `variant` mapping with missing/unrecognised tone fallback |
| `src/canvas/conversation/InlineBlocks.tsx` | `CommentaryBlockRenderer` — collapsible (default expanded when `assistantTextWordCount < 20`), aria-expanded, keyboard operable. `ReviewCardBlockRenderer` — tone-driven visual treatment (challenger: top 3px danger border + AlertTriangle; facilitator: left 3px info border + Lightbulb), body via `safeRichText`. |
| `src/canvas/conversation/MessageBubble.tsx` | Import updated from `sanitizeMarkdown` → `safeRichText`; passes `assistantTextWordCount` to `InlineBlocks` |
| `src/canvas/conversation/Conversation.module.css` | **DS v5 fix**: `.reviewCardInfo` background changed from `info-light` → `bg-panel`. Added `.commentaryToggle`, `.commentaryPreviewText`, `.commentaryToggleControl`, `.commentaryExpandedContent` classes. |
| `src/canvas/conversation/__tests__/fixtures/orchestrator-rendering-v2.json` | **New file** — golden test fixtures for 8 envelope scenarios |
| `src/canvas/conversation/__tests__/orchestratorRenderingV2.spec.tsx` | **New file** — 58 tests across 6 sections (safeRichText, adaptCEEBlock, CommentaryBlockRenderer, ReviewCardBlockRenderer, flag OFF, fixture golden-path) |

---

### Feature flag behaviour

| Flag state | Markdown in `assistant_text` | Commentary collapse | Review card tone borders | `review_card` body rendering |
|------------|------------------------------|---------------------|--------------------------|-------------------------------|
| `ORCHESTRATOR_RENDERING_V2` OFF | Plain text (legacy) | No collapse | No tone borders | Plain `<p>` text |
| `ORCHESTRATOR_RENDERING_V2` ON | Bold + bullets + `<br>` | Collapsible (default depends on `assistantTextWordCount`) | challenger → danger top border; facilitator → info left border | `safeRichText` (bold/bullets in body) |

Toggle: `localStorage.setItem('feature.orchestratorRenderingV2', 'true')` or URL param `?VITE_FEATURE_ORCHESTRATOR_RENDERING_V2=true`.

---

### Commentary collapse default logic

| Condition | Default state |
|-----------|---------------|
| `assistantTextWordCount < 20` | **Expanded** — the block is the primary finding (thin `assistant_text`) |
| `assistantTextWordCount ≥ 20` | **Collapsed** — the block supplements a substantive `assistant_text` |

Preview text: `block.title` if present, otherwise the first line of `block.text`.

---

### safeRichText pipeline

```
orchestrator string
  ↓ decodeOrchestratorEntities()   — &amp; &lt; &gt; &quot; → real chars (via placeholders to prevent double-decode)
  ↓ escapeHtml()                   — re-escape all HTML chars, including those just decoded
  ↓ bullet processing              — lines starting "- " → <ul><li>
  ↓ convertInline()                — **text** → <strong>text</strong>
  ↓ stripDisallowedTags()          — belt-and-braces: anything not in {strong, br, ul, li} is stripped
  → safe HTML string
```

No full markdown engine. The tiny subset (bold + bullets + line breaks) does not warrant the weight and attack surface.

---

### Test results summary

58 new tests in `orchestratorRenderingV2.spec.tsx` — all passing.

Tier 1 smoke: `npm run typecheck` passed. `npx vitest run --changed --bail=1` — 1826 passing, 1 pre-existing failure (`CanvasContextMenu`/`useMenuItems`, unrelated).

See CI for full suite results.

---

## Brief A (continued) — Block badges, repair log suppression, border corrections

### Design System v5 mismatches found

| # | Location | Issue | Action |
|---|----------|-------|--------|
| A-4 | `Conversation.module.css` — `.reviewCardInfo` | `border-left: none` — facilitator review cards were missing the left 3px info border specified by DS v5 §16.2. | **Fixed in code** — added `border-left: 3px solid var(--info)` |
| A-5 | `Conversation.module.css` — `.graphPatchBlockApplied` | Applied state changed border-top-color from `goal` to `success`. DS v5 §21.2 specifies GraphPatchBlock uses `goal` colour in all states. | **Fixed in code** — applied state now keeps `goal` border |
| A-6 | `Conversation.module.css` — `.commentaryExpandedContent` | `border-left: none` — DS v5 §19 specifies expanded content uses `border-l-2 border-panel-border`. | **Fixed in code** — added `border-left: 2px solid var(--border-default)` |
| A-7 | `InlineBlocks.tsx` | DS v5 §21.2 specifies block type badge dots (8px diameter, main colour fill, top-left). Not rendering on any block type. | **Implemented** — dot per block type, gated behind `ORCHESTRATOR_RENDERING_V2` |

### Upstream issues found

| # | Description | Status |
|---|-------------|--------|
| U-5 | PLoT repair messages (`[DEFAULT_EXISTS_PROBABILITY] Missing value, using default`) leaking into `assistant_text` as user-visible conversation text. CEE/orchestrator is forwarding internal PLoT repair logs in the response envelope. | **Fixed in UI** — `validateResponse.ts` now strips repair log lines matching known patterns. Root cause is upstream (PLoT repair logs should not be included in `assistant_text`). |
| U-6 | When `assistant_text` is null and the envelope contains only a `patch_accepted` system event response, the empty guard in `handleEnvelope` (line 1696) correctly prevents rendering. No code change needed. | Already handled |

### Changed files

| File | Change |
|------|--------|
| `src/canvas/conversation/validateResponse.ts` | Added `stripRepairLogLines()` — strips PLoT repair log lines from `assistant_text`. New repair type `repair_log_stripped`. Also added `prompt` → `message` normalisation for CEE chips (Brief B fix). |
| `src/canvas/conversation/useConversation.ts` | Streaming flush (`flushStreamFrame`) now calls `stripRepairLogLines` alongside `stripDiagnostics` — prevents repair log flash during streaming. Also wired `backfillInterventionsOntoOptionNodes` for V3 intervention round-trip. |
| `src/canvas/conversation/InlineBlocks.tsx` | Added `resolveBlockBadgeDotClass()` — DS v5 §21.2 badge dots for the five specified block types. Flag-gated via `ORCHESTRATOR_RENDERING_V2`. |
| `src/canvas/conversation/Conversation.module.css` | Fixed `.reviewCardInfo` (left info border), `.graphPatchBlockApplied` (goal not success), `.commentaryExpandedContent` (border-l-2). Added `.blockBadgeDot*` classes. |
| `src/canvas/conversation/utils/applyPatch.ts` | V3 edge metadata passthrough: `edge_type`, `provenance_source`, `exists_probability` explicitly extracted in `buildEdge`. |
| `src/canvas/utils/applyDraftResult.ts` | V3 edge metadata passthrough in `applyDraftResult`. Added `backfillInterventionsOntoOptionNodes` export. |
| `src/canvas/domain/edges.ts` | Extended `EdgeDataSchema` with V3 optional fields: `edge_type`, `provenance_source`, `exists_probability`. |
| `src/canvas/conversation/__tests__/fixtures/orchestrator-rendering-v2.json` | Extended with 8 new fixture envelopes covering null text, roles, prompt field, mixed, five chips, unsupported markdown, repair logs, and patch accepted. |
| `src/canvas/conversation/__tests__/orchestratorRenderingV2.spec.tsx` | Added 18 tests: null assistant_text expansion, graceful markdown degradation, block badges, roles, prompt field. |
| `src/canvas/conversation/__tests__/validateResponse.spec.ts` | Added `stripRepairLogLines` tests, `repair_log_stripped` integration, and `prompt` → `message` normalisation tests. |
| `src/canvas/domain/__tests__/edgeLabels.spec.ts` | V3 edge field schema tests. |
| `src/canvas/utils/__tests__/applyDraftResult.spec.ts` | V3 field passthrough and `backfillInterventionsOntoOptionNodes` tests. |

### Block type badge mapping (DS v5 §21.2)

Per Brief A Task 6, only the five explicitly listed block types get dots:

| Block type | Dot colour | Rationale |
|-----------|-----------|-----------|
| CommentaryBlock | None | Inline content, no border colour |
| ReviewCardBlock (alert) | `danger` | Matches top border |
| ReviewCardBlock (info) | `info` | Matches left border |
| GraphPatchBlock | `goal` | Action required |
| FactBlock | `success` | Computed results |
| FramingBlock | `info` | Information/structuring |

### Task 8 (number-band styling) — skipped

Detecting `(number -- label)` patterns in commentary and rendering in `text-text-light` would require adding `<span>` to the `safeRichText` XSS allowlist. This widens the attack surface for a cosmetic enhancement. Skipped per brief guidance: "Only implement if trivial. Skip if fragile."

### Feature flag behaviour

All new changes are gated behind `ORCHESTRATOR_RENDERING_V2`:
- Block badges: only render when flag ON
- Commentary border-left on expanded content: always applies (visual fix, not behaviour change)
- Review card left info border: always applies (DS v5 compliance fix)
- GraphPatchBlock goal border: always applies (DS v5 compliance fix)
- Repair log stripping: always applies in both streaming and non-streaming paths (defensive, not feature-gated)
- V3 edge fields: always preserved (passthrough, no display change)
- Intervention backfill: always runs (data-only, no display change)

### Test results summary

40+ new tests added across four spec files — all passing (992 tests total in changed scope).

Tier 1 smoke: `npm run typecheck` passed. `npx vitest run --changed --bail=1` — all new tests pass. 1 pre-existing failure (`InteractiveActions.spec.tsx`, unrelated).

See CI for full suite results.

---

## Brief B — Chip rendering, role differentiation, and layout

### DS v5 section 21.4 mismatch

Section 21.4 states "Max 2 per AI response." This is outdated. The v2.1 orchestrator prompt specifies **0–3 suggested actions by default, 4 maximum**. The section has been noted as requiring an update:

> **DS v5 §21.4 update needed:** Change "Max 2 per AI response" to "0–3 per AI response (4 maximum). 0 chips = no chip container rendered."

`MAX_SUGGESTED_ACTIONS` in `src/canvas/conversation/types.ts` has been updated from 2 to 3 to match the v2.1 spec. The render cap in `SuggestedChips.tsx` uses 4 (the hard maximum).

### Upstream issues found

None. The chip pipeline is end-to-end functional:

- `OrchestratorResponseEnvelopeV2.suggested_actions` is populated by CEE
- `validateResponse` filters chips missing `label` or `message`
- `enforceChipBudget` applies the coaching-first budget
- Chips arrive in `ConversationMessage.actionChips`
- `ChatThread` renders them via `SuggestedChips` for the last assistant turn

The `role` field is new in v2.1. CEE must include `role` in each `<suggested_actions>` item for dots to render. If `role` is absent, chips render without a dot (graceful fallback — no error).

### DS v5 mismatches found

| # | Location | Issue | Action |
|---|----------|-------|--------|
| B-1 | DS v5 §21.4 | Section states "Max 2 per AI response". v2.1 orchestrator prompt specifies 0–3 default, 4 maximum. | **Doc update needed** — see note above. Code uses correct constants. |
| B-2 | `SuggestedChips.tsx` v2 path | Hover style was in `<style>` block CSS rather than DS v5 token class `hover:bg-panel-hover`. | **Fixed** — moved to Tailwind `hover:bg-panel-hover`; `disabled:hover:bg-panel` guards disabled state. |

### Changed files

| File | Change |
|------|--------|
| `src/canvas/conversation/types.ts` | Added `role` field to `ActionChip`; updated `MAX_SUGGESTED_ACTIONS` from 2 to 3 |
| `src/canvas/conversation/zones/SuggestedChips.tsx` | Role dots, in-flight disable, `isHistorical`, a11y (aria-label with role), flex-wrap layout, feature flag split, DS v5 `hover:bg-panel-hover` token |
| `src/canvas/conversation/ActionChipRow.tsx` | Added `disabled` prop for historical/in-flight coaching chips |
| `src/canvas/conversation/MessageBubble.tsx` | Added `historicalChips` prop; passes `disabled` to `ActionChipRow` |
| `src/canvas/conversation/zones/ChatMessage.tsx` | Added `historicalChips` prop; passes through to `MessageBubble` |
| `src/canvas/conversation/zones/ChatThread.tsx` | Passes `isThinking` to `SuggestedChips`; passes `historicalChips=true` for non-last messages |
| `src/flags.ts` | `orchestratorRenderingV2` flag already present from Brief A |
| `src/canvas/conversation/__tests__/SuggestedChips.spec.tsx` | Full rewrite with role dot, in-flight, historical, a11y, XML escape, flag, count tests |
| `src/canvas/conversation/__tests__/useConversation.helpers.spec.ts` | Updated `enforceChipBudget` tests for new `MAX_SUGGESTED_ACTIONS=3` |

### Feature flag behaviour

| State | Chip cap | Role dots | In-flight disable |
|-------|----------|-----------|-------------------|
| `ORCHESTRATOR_RENDERING_V2` OFF | 2 (legacy) | No | No |
| `ORCHESTRATOR_RENDERING_V2` ON | 4 (hard max, 0-3 suggested) | Yes | Yes |

Toggle via localStorage: `localStorage.setItem('feature.orchestratorRenderingV2', 'true')` or URL param `?VITE_FEATURE_ORCHESTRATOR_RENDERING_V2=true`.

### Test results summary

33 tests in `SuggestedChips.spec.tsx` — all passing. 17 helper tests in `useConversation.helpers.spec.ts` — all passing.

Tier 1 smoke: `npm run typecheck` passed. `npx vitest run --changed --bail=1` — 1826 passing, 1 pre-existing failure (`CanvasContextMenu`/`useMenuItems`, unrelated).

See CI for full suite results.

---

## Brief B (continued) — CEE `prompt` field fix and end-to-end chip rendering

### Root cause: chips not rendering in production

**CEE returns `prompt`, UI expects `message`.** The orchestrator prompt spec uses `<message>` XML tags but CEE serialises the field as `prompt` in the JSON envelope. The `validateResponse` chip filter checked `!c.message` and silently dropped all chips that only had `prompt`, logging `missing_chip_message` repair events.

### Fix applied

`validateResponse.ts` now normalises `prompt` → `message` before the filter step:

```typescript
// Normalise: CEE sends `prompt`, UI uses `message`. Map when present.
const cleanedChips = rawChips.map((c) => {
  const wire = c as ActionChip & { prompt?: string }
  if (!wire.message && wire.prompt) {
    const { prompt: _prompt, ...rest } = wire
    return { ...rest, message: wire.prompt } as ActionChip
  }
  return c
}).filter(...)
```

When both `prompt` and `message` are present, `message` takes precedence (defensive: do not clobber an existing value).

### DS v5 §21.4 updates needed

| # | Spec change needed | Rationale |
|---|-------------------|-----------|
| B-3 | Chip count: change "Max 2" to "0-3 default, 4 max" | v2.1 orchestrator prompt spec |
| B-4 | Add role differentiation spec (8px dot, facilitator=info, challenger=danger, scientist=goal) | Not in current DS v5 |

### Upstream issues found

| # | Description | Status |
|---|-------------|--------|
| U-7 | **CEE field name is `prompt` not `message`.** The orchestrator prompt spec uses `<message>` in XML tags but CEE serialises it as `prompt` in the JSON envelope. This discrepancy caused all suggested action chips to be silently dropped. | **Fixed in UI** — `validateResponse.ts` normalises `prompt` → `message`. Recommend CEE/orchestrator alignment on field name. |
| U-8 | **CEE sends up to 5 chips** in some turns, exceeding the orchestrator prompt's stated max of 4. The UI's `enforceChipBudget` + render cap at 4 handles this gracefully (extra chips are simply not rendered). | **No fix needed** — flag for Paul to review prompt spec or CEE chip generation. |

### Changed files

| File | Change |
|------|--------|
| `src/canvas/conversation/validateResponse.ts` | Added `prompt` → `message` normalisation in chip filter pipeline |
| `src/canvas/conversation/zones/SuggestedChips.tsx` | Fixed legacy path: `disabled` now `false` when flag OFF, preserving pre-v2 click behaviour during `isThinking` |
| `src/canvas/conversation/__tests__/validateResponse.spec.ts` | Added 5 tests: prompt normalisation, both fields present, mixed prompt/message, missing both, role preservation |
| `src/canvas/conversation/__tests__/fixtures/orchestrator-rendering-v2.json` | Added 3 fixtures: `suggestedActionsWithPromptField`, `suggestedActionsMixedPromptAndMessage`, `suggestedActionsFiveChips` |
| `src/canvas/conversation/__tests__/orchestratorRenderingV2.spec.tsx` | Added §17 fixture shape tests for prompt field normalisation |
| `docs/orchestrator-ui-delta.md` | This section |

### ActionChipRow — role dot parity (Brief A)

`ActionChipRow.tsx` (inline chips for historical turns) was updated in Brief A to mirror `SuggestedChips` role dots. This ensures chips retain visual role differentiation when they become historical after a new turn arrives. Both components use the same `ROLE_DOT_CLASS` mapping and `aria-label` pattern.

### Test results summary

5 new tests in `validateResponse.spec.ts`, 4 new tests in `orchestratorRenderingV2.spec.tsx`, 3 new fixture envelopes — all passing.

See CI for full suite results.

---

## Brief C — Content Layout and SafeRichText Degradation

### DS v5 values applied

| # | Token / value | Usage |
|---|---------------|-------|
| C-1 | `line-height: 1.65` | Assistant text vertical rhythm (§2.4) |
| C-2 | `max-width: 65ch` | Assistant text line length cap (§2.4: 65–75 characters) |
| C-3 | `bg-panel-hover` / `#FEF9F3` | Commentary expanded content background |
| C-4 | `border-panel-border` | Commentary left border (kept from existing) |
| C-5 | Spacing: 16px / 12px / 8px | Bullet gap, list-top margin, chip/rule gap (§4 spacing scale) |
| C-6 | ChevronDown / ChevronUp size 12 | GraphPatchBlock disclosure toggle (§20 pattern) |

### Changed files

| File | Change |
|------|--------|
| `src/canvas/conversation/Conversation.module.css` | Added `.v2AssistantText` class (line-height 1.65, max-width 65ch, 16px bullet gaps, 12px list-top margin, `li > p` margin collapse). Modified `.commentaryExpandedContent` to add `bg-panel-hover` background, 12px padding, 4px border-radius |
| `src/canvas/conversation/MessageBubble.tsx` | Import `isOrchestratorRenderingV2Enabled`; conditionally apply `v2AssistantText` CSS class on assistant messages |
| `src/canvas/conversation/zones/SuggestedChips.tsx` | Both paths: chip container `marginTop` 10→16, added `marginBottom: 8` to outer wrapper |
| `src/canvas/conversation/InlineBlocks.tsx` | v2: force all proposal items behind disclosure toggle. Added ChevronDown/ChevronUp icons to "Show details"/"Hide details" button (both paths) |
| `src/canvas/utils/safeRichText.ts` | Graceful degradation: headings (`#`) → bold, horizontal rules (`---`/`***`) → `<br class="md-gap">` gap, table rows → structured text, table separators → stripped, emoji → stripped (conservative BMP + astral range allowlist) |
| `src/index.css` | Added global `.md-gap` class for SafeRichText horizontal rule degradation (8px vertical gap) |
| `docs/orchestrator-ui-delta.md` | This section |

### SafeRichText degradation behaviour

| Input syntax | Rendered output |
|-------------|-----------------|
| `### Heading text` | **Heading text** (bold) |
| `---` or `***` | 8px vertical gap (no visible line) |
| `\| Header1 \| Header2 \|` (first row) | Captured as column headers |
| `\| val1 \| val2 \|` (2-col data row) | **Header1:** val1, **Header2:** val2 |
| `\| a \| b \| c \|` (3+ col data row) | a, b, c |
| `\|---\|---\|` (separator) | Stripped entirely |
| Emoji (checkmark, warning, lock, pin, chart, magnifier) | Stripped; double spaces collapsed |

### Feature flag behaviour

| Behaviour | `ORCHESTRATOR_RENDERING_V2` OFF | `ORCHESTRATOR_RENDERING_V2` ON |
|-----------|-------------------------------|-------------------------------|
| Assistant text line-height | Default (inherited) | 1.65 |
| Assistant text max-width | 100% (bubbles) | 65ch |
| Bullet item spacing | 2px margin-bottom | 16px margin-bottom |
| List top margin | 4px | 12px |
| GraphPatchBlock 1–2 items | Shown inline (no toggle) | Behind "Show details" toggle |
| Chip container top margin | 16px (both paths) | 16px (both paths) |
| Commentary expanded bg | Existing (no bg) | `bg-panel-hover` (#FEF9F3) |

Non-gated changes (apply to both flag states):
- Chip container `marginBottom: 8` (both paths, including ActionChipRow `.chipRow`)
- ActionChipRow `.chipRow` `margin-top` 8→16 for parity with SuggestedChips
- Chevron icons on GraphPatchBlock disclosure toggle
- SafeRichText graceful degradation (headings, rules, tables, emoji)
- `.md-gap` global CSS class
- Bold-lead paragraph spacing: consecutive `**Lead.**` lines get `<br class="md-gap">` (16px gap)

### Post-review fixes (Brief C addendum)

| # | Issue | Fix |
|---|-------|-----|
| C-R1 | Bold-lead paragraphs outside lists had no 16px separation | Join phase detects consecutive bold-lead parts and emits `<br class="md-gap">` instead of plain `<br>` |
| C-R2 | Table without separator row silently suppressed first row | Added `tableHeaderConfirmed` flag; headers only used structurally when separator row follows. Without separator, all rows render as comma-separated data |
| C-R3 | ActionChipRow `.chipRow` had `margin-top: 8px` (not aligned with SuggestedChips) | Changed to `margin-top: 16px; margin-bottom: 8px` |
| C-R4 | Emoji strip collapsed all double spaces globally | Replaced global `/ +/g` with sentinel approach: emoji → `\x00`, then `\s*\x00+\s*` → single space. Only whitespace adjacent to emoji is collapsed |

### DS v5 values that may need manual update

None identified. All values use existing DS v5 tokens or the §4 spacing scale.
