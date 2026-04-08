# AI experience systemic audit

Date: 8 April 2026
Scope: CEE backend (`olumi-assistants-service`) + UI frontend (`DecisionGuideAI`)
Method: investigation only — no code changes. Six parallel deep traces, file:line citations throughout.
Active production prompt: `src/prompts/orchestrator-cf-v28.ts` (referenced in user request as "v33e" — confirmed via `src/prompts/defaults.ts` `registerDefaultPrompt('orchestrator', getOrchestratorPromptV28())`).

## Why this audit exists

After the recent core fixes (deletion of `recomputeAnalysisReady`, tightening of `assist/v1/graph-readiness` to treat `needs_encoding` as a hard blocker, the `ResultsPanel` synthetic-readiness fix on 2026-04-08), the **engine produces correct ready options**. But the **AI experience remains poor**: users see chips for tools that are filtered out, patch summaries that count nodes instead of describing decisions, cap-hit errors that the LLM never learns about, "Please confirm" mixed with "I'll add now" because no rule forbids it, and post-analysis coaching that quietly degrades because half the calibration signals never reach Zone 2.

These are symptoms of subsystems that don't share a contract, not bugs in any single file. The fix is one consolidated brief, not nine patches.

---

## 1. Turn state and mutation lifecycle

### 1a. Post-mutation lifecycle trace

#### Path 1 — `add_option` (deterministic action handler)

| Step | File | Lines |
|---|---|---|
| Tool dispatch | `olumi-assistants-service/src/orchestrator/tools/dispatch.ts` | 129–136 |
| Handler entry | `src/orchestrator/deterministic/actions/add-option.ts` | 54–244 |
| Build PatchOperation[] (add_node + intervention edges) | `add-option.ts` | 101–132 |
| Empty-interventions guard | `add-option.ts` | 84–97 |
| Synthetic graph construction | `add-option.ts` | 150–199 |
| `computeStructuralReadiness(syntheticGraph)` | `add-option.ts` | 201–228 |
| Returns `ActionResult { operations, analysis_ready }` | `add-option.ts` | 231–237 |
| Block assembly (`createGraphPatchBlock`) | `src/orchestrator/deterministic/response-assembler.ts` | 92–105 |
| Assistant text (action confirmation + LLM coaching) | `response-assembler.ts` | 75–84 |

Operations are **NOT applied** inside the handler. The handler builds `operations[]`, computes `analysis_ready` against a *synthetic* shallow-cloned graph (does not mutate `ctx.graph`), and ships both atomically in the response envelope. The block is created with `auto_apply: false` (`response-assembler.ts:98`). No `applied_graph` field is attached on deterministic actions.

SSE order on the wire:
1. `blocks` event (GraphPatchBlock with operations + analysis_ready, no applied_graph)
2. `text` event (assistant confirmation message)
3. (no intermediate readiness recompute event)

#### Path 2 — `edit_graph` with `set_factor_value` (LLM-routed handler)

| Step | File | Lines |
|---|---|---|
| Tool dispatch | `dispatch.ts` | 277–308 |
| Handler entry `handleEditGraph` | `src/orchestrator/tools/edit-graph.ts` | 1258–2310+ |
| `classifyEditIntent()` → 'parameter_update' / 'structural' / 'option_configuration' | `edit-graph.ts` | 210–228 |
| `determineEditResolutionMode()` → 'auto_apply' / 'propose_and_confirm' / 'clarify' | `edit-graph.ts` | 548–588 |
| LLM call via adapter | `edit-graph.ts` | 1543–1567 |
| Zod + referential validation `validatePatchOperations` | `edit-graph.ts` | 1717–1764 |
| Optional pre-validation `applyPatchOperations` to candidate | `edit-graph.ts` | 1820–1827 |
| `validateGraphStructure(candidateGraph)` | `edit-graph.ts` | 1889 |
| PLoT semantic validation | `edit-graph.ts` | 1972–2180 |
| Post-mutation `computeStructuralReadiness(readinessGraph)` | `edit-graph.ts` | 2201–2222 |
| `createGraphPatchBlock(patchData, turnId)` | `edit-graph.ts` | 2226 |
| `buildAppliedChanges()` (human descriptions, rerun_recommended) | `edit-graph.ts` | 2250–2253 |
| Suggested-actions assembly ("Re-run analysis" chip when applicable) | `edit-graph.ts` | 2294–2310 |

Critical observation: `readinessGraph = appliedGraph ?? candidateGraph` (line 2202) prefers the PLoT-validated graph when present. The block is **always** built with `auto_apply: false` regardless of resolutionMode (line 2215).

#### Status of `recomputeAnalysisReady`

**NOT FOUND in codebase.** Confirmed: the only vestige is a comment at `src/orchestrator/tools/analysis-ready-helper.ts:49` referencing the now-removed envelope recomputation path. Handler-produced `analysis_ready` is validated by the envelope, not recomputed.

### 1b. Proposal vs applied semantics

| Handler | Condition | `auto_apply` flag in block | Source |
|---|---|---|---|
| `draft_graph` | always | **`true`** | `src/orchestrator/tools/draft-graph.ts:152` |
| `edit_graph` (success path, all 3 modes) | always | **`false`** | `edit-graph.ts:2215` |
| `edit_graph` constraint shortcut | always | **`false`** | `edit-graph.ts:1400` |
| `add_option` deterministic | always | (not set in patchData) | `response-assembler.ts:98` |
| `set_factor_value` deterministic | always | (not set in patchData) | `response-assembler.ts:98` |

**`auto_apply` is decoupled from resolution mode.** The `resolutionMode` selects the conversational flow (clarify question, propose-and-confirm copy, or proceed-to-LLM), but the resulting block flag is always `false` for `edit_graph`. The user's "Please confirm" experience comes from `propose_and_confirm` mode emitting the constant text `"Here's the change I'd propose. If you want, I can apply it next."` (`edit-graph.ts:208`), independent of any patch-block flag.

**Mixing of "Please confirm" and "I'll add now":** No code path constructs both phrases in the same message. LLM coaching text is kept separate from action confirmation text (`edit-graph.ts:2274–2292`). However — and this is the gap — **no explicit rule in `orchestrator-cf-v28.ts` forbids the LLM from contradicting the deterministic confirmation copy**. The orchestrator prompt has 40 mentions of "propose"/"confirm"/"auto_apply" but none enforces the rule "if the action handler is emitting an unconfirmed proposal, do not narrate it as already done." See section 1b of recommendations below.

The closest implicit guidance is:
- `orchestrator-cf-v28.ts:1390`: "Note: ACT with edit_graph. 'Proposing' language reflects the patch requires user acceptance"
- `orchestrator-cf-v28.ts:51`: "Never propose a patch that contradicts Zone 2"
- `orchestrator-cf-v28.ts:199, 304, 577`: scattered references to confirmation/proposed/state-after

### 1c. Cap/range constraint handling

**Location:** `src/orchestrator/deterministic/actions/set-factor-value.ts:68–76`

```typescript
const nodeEntry = ctx.entities.nodes.get(entity.id);
if (nodeEntry?.cap != null && value > nodeEntry.cap) {
  return {
    blocks: [],
    assistantText: `${entity.label} has a cap of ${nodeEntry.cap}${nodeEntry.unit ? ' ' + nodeEntry.unit : ''}. The value ${value} exceeds this.`,
    guidance_items: [],
  };
}
```

This is the **exact source** of the user-reported error string ("Design Capability has a cap of 0. The value 60 exceeds this.").

Behaviour:
- Value is **rejected** (early return at line 71)
- No fallback clamping, no partial application
- **No operation generated**, so no patch block, no `analysis_ready` recompute
- **The LLM never learns the action failed.** The cap check sits in the deterministic action handler; the LLM gets no toolResult with error details. From the LLM's perspective, the user said "set X to 60", and on the next turn the LLM sees the previous turn's assistant text but no structured signal that the request was rejected.

Same pattern at `src/orchestrator/deterministic/actions/add-factor.ts:68–75` for the `add_factor` redirect path.

This is the deepest handler/LLM contract gap in the audit. See section 7.

### 1d. Edge correctness on `add_factor` and `add_option`

**`add_factor`** (`add-factor.ts:104–137`):
```typescript
const targets = connectToTargets.length > 0 ? connectToTargets : (ctx.entities.goal_id ? [ctx.entities.goal_id] : []);
for (const targetId of targets) {
  operations.push({
    op: 'add_edge',
    path: `${nodeId}->${targetId}`,
    value: { from: nodeId, to: targetId, strength: { mean: 0.5, std: 0.15 }, exists_probability: DEFAULT_EXISTS_PROBABILITY, effect_direction: 'positive' },
  });
}
```
- Defaults to goal connection if no explicit targets
- **No edge validation** within the handler
- No semantic check that target is a valid causal node kind
- Strength: causal belief (mean 0.5, std 0.15)

**`add_option`** (`add-option.ts:117–132`):
```typescript
if (Object.keys(interventions).length > 0) {
  for (const [factorId, value] of Object.entries(interventions)) {
    operations.push({
      op: 'add_edge',
      path: `${nodeId}->${factorId}`,
      value: { from: nodeId, to: factorId, strength: { mean: 1.0, std: 0.01 }, exists_probability: 1.0, effect_direction: 'positive' },
    });
  }
}
```
- **No option→goal edge created** (intentional — line 114 comment)
- Intervention edges are **structural** (strength 1.0, std 0.01, exists_probability 1.0)
- **No edge validation**: if a `factorId` doesn't exist in the graph, only Zod catches it downstream

**`enforceStructuralEdgeDefaults`** (`edit-graph.ts:840–894`):
- Applies **only** to LLM-generated edges from `edit_graph`, not deterministic actions
- Forces option→factor edges to structural defaults (exists_probability=1.0, strength={mean:1.0, std:0.01})
- Validates node kinds before enforcement (lines 867–870)

**Gap:** Deterministic actions construct edges by hand and don't go through `enforceStructuralEdgeDefaults`. They're trusted by construction. Any future deterministic action that adds a structural edge could drift from these invariants without warning.

### 1e. Missing post-mutation analysability gate (newly identified)

There is **no gate immediately after `applyPatchOperations()` that says "the graph is now analysable, proceed" or "the graph is broken, surface a recovery"**. The pieces exist but aren't wired together:

- `graph-structure-validator.ts:62` — `validateGraphStructure` is invoked **only** post-PLoT (`edit-graph.ts:1889`), not after deterministic action mutations
- `analysis_ready` is **descriptive**, not prescriptive — its `status` field ("ready" / "needs_encoding" / "needs_user_mapping") guides the UI and the LLM but does not gate any backend code path
- `rerun_recommended` (from `buildAppliedChanges`) is a hint for the chip builder, not an enforcement
- The recently-tightened readiness route makes `needs_encoding` a hard blocker for the **client-side run gate** (see `docs/blocked-readiness-ux-verification-2026-04-08.md`), but the **action handlers themselves** never check the post-mutation readiness status before returning

This gap is what allows the system to drift back into "the model has options that look ready but actually aren't" if any future mutation slips through without computing readiness on a synthetic graph the way `add-option.ts` does today.

---

## 2. Patch block rendering

### 2a. CEE patch summary generation

**Function:** `buildPatchSummary(operations, coachingSummary?, patchContext?)` at `src/orchestrator/patch-summary.ts:174–267`

**Decision logic:**
1. Line 180–181: if `coachingSummary` is non-empty, return it verbatim (LLM text wins)
2. Line 188–189: classify operations via `analyseOperations()` (lines 72–138) into buckets
3. Line 189: classify "large" if `totalOps > SMALL_PATCH_THRESHOLD` (= 3, line 158)
4. Lines 192–255: assemble additions/removals/updates parts
5. Line 265: join with `; ` and suffix with `.`

**Example outputs:**
- `"Added contractor option and 2 connections"` (small)
- `"Added 3 options, 5 factors, and 7 connections"` (large)
- `"Updated Developer Headcount: value"`
- `"No changes were applied."` (line 185)

**Call sites:**
| File | Line | Coaching source |
|---|---|---|
| `src/orchestrator/tools/edit-graph.ts` | 2217 | `llmResult.coaching?.summary` |
| `src/orchestrator/tools/draft-graph.ts` | 171 | `extractCoachingSummary()` (line 169) |
| `src/orchestrator/system-event-router.ts` | (×2) | `null` (post-accept flows) |

**Critical data-flow gap:** at all three call sites, `context.graph` (the full GraphV3T) **is in scope** but is **not threaded into** `buildPatchSummary()`. The function resolves labels from path strings only (lines 144–148), which is lossy and never accesses node metadata. Semantic synthesis is impossible at this layer with the current signature.

### 2b. UI patch block rendering

**Component:** `GraphPatchBlockRenderer` at `src/canvas/conversation/InlineBlocks.tsx:898–1310`

**Block shape consumed** (`types.ts:215–255`): `summary`, `operations`, `analysis_ready`, `proposal_items`, `proposal_items_source`, `operation_meta`, `goal_constraints`, `related_elements`, `auto_apply`, etc.

**Summary rendering** (`InlineBlocks.tsx:1073`):
```tsx
<div className={`${typography.body} ${styles.graphPatchSummary}`}>
  {opSummary || normaliseDashes(block.summary || '')}
</div>
```

`opSummary` comes from `summarisePatchOps(block.operations)` at line 931, which is the **UI's own count-based assembler** at `InlineBlocks.tsx:87–96`:
```typescript
function summarisePatchOps(operations) {
  const counts = {}
  for (const op of operations) {
    const kind = (op.data?.kind as string) ?? (op.data?.type as string) ?? op.op.replace(/^(add|remove|update)_/, '')
    counts[kind] = (counts[kind] || 0) + 1
  }
  const parts = Object.entries(counts).map(([k, v]) => `${v} ${k}${v > 1 ? 's' : ''}`)
  return parts.length > 0 ? parts.join(', ') : `${operations.length} operation${operations.length !== 1 ? 's' : ''}`
}
```

**Output:** `"1 node, 2 edges"` / `"3 options, 5 factors, 7 connections"` / `"8 operations"`

**Critical:** the UI **prefers its own count-based summary** over CEE's text. If CEE shipped a semantic summary today (e.g. "Added a contractor option that increases development capacity"), the UI would still render `summarisePatchOps()` first because the line-1073 fallback is `opSummary || block.summary`, not `block.summary || opSummary`. **Both ends are wrong simultaneously.**

**"Changes applied" eyebrow** (`InlineBlocks.tsx:1070`):
- Class `.graphPatchReceiptEyebrow`
- Color `var(--success, #67C89E)` — semantic green
- Font weight 600, letter spacing 0.02em (`Conversation.module.css:384–388`)

**Show details disclosure** (`InlineBlocks.tsx:1103–1143`):
- Toggle button with `ChevronDown`/`ChevronUp` (size 12)
- Expanded body renders `proposalItems` (each with `description`, `elementLabel`, `changeLabel`, plus `operationMeta[index]?.rationale` if present)
- `proposalItems` source priority (lines 932–970): CEE-provided `block.proposal_items` → derived from operations (`isGenerativeDraft`) → empty

### 2c. Semantic summary feasibility

**Could the system render "Added a contractor option that increases development capacity" instead of "1 option, 2 edges"?**

**Yes** — but it requires changes on both ends because the rendering precedence is currently inverted.

**Backend changes (CEE):**
1. Extend `buildPatchSummary` signature to accept the graph:
   ```typescript
   buildPatchSummary(operations, graph, coachingSummary?, patchContext?)
   ```
2. For small patches (`totalOps ≤ SMALL_PATCH_THRESHOLD`) with `add_node` for an option, traverse the option's outgoing edges and resolve target node labels from `graph.nodes`:
   ```typescript
   const addedOption = graph.nodes.find(n => n.id === extractId(addNodeOp.path))
   if (addedOption?.kind === 'option') {
     const outgoing = graph.edges.filter(e => e.from === addedOption.id)
     const factorLabel = graph.nodes.find(n => n.id === outgoing[0].to)?.label
     return `Added ${addedOption.label} option that affects ${factorLabel}`
   }
   ```
3. Update all three call sites to pass `context.graph` / `graphOutput`.

**UI changes (DecisionGuideAI):**
1. **Invert the precedence** at `InlineBlocks.tsx:1073`: prefer `block.summary` when CEE provides it; only fall back to `summarisePatchOps()` when `block.summary` is empty. The current `opSummary || block.summary` is a regression on any semantic improvements the backend makes.
2. Optionally remove `summarisePatchOps()` entirely once the backend is reliable.

**Cost:** trivial — one parameter addition, ~30 lines of resolution logic, one UI line swap. The blocker is purely contract: nobody owns the patch-summary text end-to-end.

---

## 3. AI panel presentation

### 3a. Typography and spacing

**Files:**
- `src/canvas/conversation/ConversationPanel.tsx:65–498` (3-zone layout)
- `src/canvas/conversation/zones/ChatThread.tsx:43–165` (message list)
- `src/canvas/conversation/MessageBubble.tsx:116–240`
- `src/canvas/conversation/Conversation.module.css`
- `src/styles/typography.ts`

**Container** (`ChatThread.tsx:88–91`): `padding: 20px 16px 8px`, `bg-panel`, `olumi-scrollbar`.

**Assistant message text** (`MessageBubble.tsx:184–195`): `className={typography.body}` → `'text-base font-sans leading-relaxed'` (16px) per `typography.ts:25`. Max width `65ch`. Padding 16px (CSS module line 23). Line height 1.65 in v2 (line 134).

**DS v5 alignment finding:**

DS v5 defines a **three-token panel system**: `panelHeader` (14px semibold), `panelBody` (12px), `panelMeta` (11px) — see `typography.ts:49–51` and `docs/Design/Olumi_Design_System_v5.md` §21.

The conversation panel uses these tokens correctly for **metadata** (e.g., new-messages pill at `ChatThread.tsx:151` uses `typography.panelMeta`; graph-patch meta uses `panelBody` at CSS line 396; accept button label uses `panelHeader` at CSS line 454).

But **assistant message text uses `typography.body` (16px)**, which is **not a panel token**. The panel cannot pass DS v5 §21 conformance with this size — DS v5 §21.1 is explicit that "AI text" sits "inline on canvas bg, text-text-body, left-aligned" and the panel-body context demands the panel-token system. (Note: DS v5 §21 is documented as **target architecture, being built via Track D** — so the panel as currently shipped is consciously divergent from §21 because §21 hasn't shipped yet.)

**Markdown content spacing** (`Conversation.module.css`):
- Paragraphs: `margin: 0 0 8px` (line 33), last-child `0`
- Lists: `4px 0 8px` (line 40), nested indent `32px` (line 50)
- List items: `margin-bottom: 2px` (line 44); v2 override `16px` (line 138)
- Code blocks: `bg-panel-hover` (lines 53, 60)

**Coloured accents:**
- "Changes applied" eyebrow → `var(--success, #67C89E)`, semibold (`InlineBlocks.tsx:1070`)
- Commentary warning → `var(--warning, #FFA656)` (`Conversation.module.css:245`)
- Rejected patch → `var(--danger, #EA7B4B)`
- Info card → `border: 1px solid color-mix(in srgb, var(--info, #52A3C8) 30%, transparent)` (DS v5 30%-opacity rule)

### 3b. Streaming pre-text lifecycle ("Building your decision model…")

**Source:** UI-generated, NOT from CEE.

`useConversation.ts:176–184`:
```typescript
function mapToolLoadingLabel(toolName: string): string {
  switch (toolName) {
    case 'draft_graph': return 'Building your decision model\u2026'
    // ...
  }
}
```

**Lifecycle** (`useConversation.ts:2549–2580`):
1. `tool_start` event → `updateMessage(msgId, { isProvisional: true, toolLoadingState: mapToolLoadingLabel(tool_name) })`
2. `text_delta` event → if no progress message yet, `updateMessage(msgId, { toolLoadingState: null })` (line 2553) — **the label is replaced when streaming text begins**
3. `tool_result` event → explicitly clears: `updateMessage(msgId, { toolLoadingState: null })` (line 2579)
4. `turn_complete` → envelope processed; `toolLoadingState: null`

**Final message contains either streamed text or graph_patch blocks; the pre-text never appears in `assistant_text`.** Rendering at `MessageBubble.tsx:196–200` uses `styles.toolLoadingState` (separate from message content/blocks) and is cleared once tool completes.

This is a clean lifecycle. **One opportunity**: the label is hardcoded ("Building your decision model"). For non-`draft_graph` tools the label is generic. The product copy could be richer if CEE emitted a `progress` event with a contextual message ("Adding contractor option…", "Re-running analysis with new value…").

### 3c. Message input persistence

**Composer:** `src/canvas/conversation/zones/ChatComposer.tsx:240–298`

**State storage:** Local `useState` only at `useComposerState.ts:35` (`const [value, setValue] = useState('')`).

**NOT persisted to:** Zustand store, Context, LocalStorage, SessionStorage.

**Single exception:** brief text (framing stage only) is debounced to canvas store at `ChatComposer.tsx:138–144`:
```typescript
const debouncedBriefText = useDebounce(composer.value.trim(), 500)
useEffect(() => {
  useCanvasStore.setState({ currentBriefText: debouncedBriefText || null })
}, [debouncedBriefText])
```
This is for readiness signals, not input persistence.

**On panel collapse** (`store.ts:536, 2844–2846` `setShowDraftChat(false)`):
- `ConversationPanel` unmounts
- `ChatComposer` unmounts
- Local state garbage-collected
- **Input text is lost.** When panel reopens, the input is blank.

**Status:** unintentional loss. If a user is mid-typing, expands the canvas to inspect a node, then reopens the panel, their text is gone. Fix is small: persist composer value to canvas store on every change (or on unmount), restore on mount.

### 3d. Stop / cancel capability

**AbortController exists** (`useConversation.ts:1133, 2408, 2537`):
```typescript
const abortRef = useRef<AbortController | null>(null)
const controller = new AbortController()
abortRef.current = controller
for await (const event of streamOrchestratorTurn(request, controller.signal)) { ... }
```

The signal is wired through both `streamOrchestratorTurn()` (line 2537) and `callOrchestratorTurn()` (~line 2679, non-streaming).

**Timeout-based abort** (`useConversation.ts:162–172, 2428–2460`):
- `DEFAULT_TIMEOUT_MS = 60_000` (60s)
- `EXTENDED_TIMEOUT_MS = 120_000` (120s for `explicit_generate`, `run_analysis`, `analyse_now`)
- On timeout: `controller.abort()`, show "trying longer than expected" + "Try again" chip

**`STREAM_HEARTBEAT_MS = 30_000`** in `turnService.ts:77`.

**Cleanup on unmount** (`useConversation.ts:1166–1175`):
```typescript
useEffect(() => {
  return () => {
    clearTimeout(longRunningTimerRef.current)
    clearTimeout(timeoutTimerRef.current)
    clearInterval(elapsedIntervalRef.current)
    cleanupStreamRefs()
    abortRef.current?.abort()
  }
}, [])
```

**No user-facing Stop button.** The infrastructure for cancellation exists end to end (controller is plumbed through, cleanup on unmount, timeout-driven abort), but **no UI button surfaces it**. The only "cancel-shaped" buttons are:
- Proposal block "Dismiss" (`InlineBlocks.tsx:1434–1492`) — UI state only, does not abort the request
- Browser tab close (triggers unmount cleanup)

For long-running tools (`draft_graph`, `run_analysis`), the user must wait up to 120s for auto-abort. The "Long running hint" at `useConversation.ts:2410–2430` shows a status label after 15s but is purely informational.

**Adding a Stop button is a one-component change** — the controller already exists; only a button on the composer or status row is needed.

---

## 4. Chip system

### 4a. Generation logic

**Entry point:** `buildDeterministicChips()` at `src/orchestrator/deterministic/chip-builder-v4.ts:105`. **Chip generation is fully deterministic — no LLM input.**

**Inputs driving selection:**
- `ctx.eligible_actions` (line 115) — filtered by stage and prerequisites
- `ctx.conversation.recent_actions_taken` (line 110) — suppress repeats via `suppress_same_turn`
- `executedAction` parameter — added to recentSet (line 110–111) to suppress same-turn duplicates
- `deferredActions` parameter — compound calls dropped by one-tool-per-turn policy
- `ctx.stage` (line 136) — stage-appropriate filter
- `ctx.analysis_summary` — used **only for prioritization** (lines 204–216), never for suppression

**Constants:**
- `MAX_CHIPS = 3` (line 14)
- `MAX_DEFERRED_CHIPS = 1` (line 16)
- `EXCLUDED_FROM_CHIPS` (line 19): `generate_artefact`, `draft_graph`

**Boost rules (lines 204–216):**
- `run_analysis` → priority 0 when `!ctx.analysis_summary`
- `run_analysis` → priority 8 when `ctx.analysis_summary && ctx.capabilities.can_explain_results`
- `explain_result` → priority 0 when analysis exists AND `run_analysis` was just executed

**Chip labels:** each ACTION_CATALOGUE entry defines `chipLabel()` and `chipPrompt()`. Examples:
- `actions/explain-result.ts:122` — `chipLabel() { return 'Explain results'; }`
- `actions/compare-options.ts:137` — `chipLabel() { return 'Compare options'; }`

**Stage filter** (`chip-builder-v4.ts:29–71`):
- `frame`: add_factor, set_factor_value, add_constraint, set_goal_target
- `ideate`: + add_option, adjust_edge_strength, run_analysis, remove_factor
- `evaluate`: explain_result, compare_options, what_would_flip, run_premortem, challenge_assumption, set_factor_value, adjust_edge_strength, run_analysis
- `decide`: run_premortem, challenge_assumption, compare_options

### 4b. Deduplication and relevance

**Same-turn suppression:** the chip is added to `recentSet` immediately (line 110–111), preventing the same chip from appearing in the same turn output.

**Across turns:** `recent_actions_taken` is governed by conversation history management in `turn-context.ts` (referenced from `pipeline-v4.ts:22`). Chips can reappear in subsequent turns once the action falls out of recent history.

**Deferred-action dedup** (lines 152–174): if an LLM-deferred action is already in `boosted` candidates, it's promoted to slot 0 rather than duplicated.

**Analysis-staleness signal:** `ctx.analysis_summary` is treated as the staleness oracle (lines 210–212 mirror `tool-builder.ts:290–294`). Present + `can_explain_results` → deprioritize `run_analysis`. Absent → boost `run_analysis` to priority 0.

### 4c. Tool/chip alignment — **CRITICAL DIVERGENCE**

This is the single largest contract gap in the chip subsystem.

**Tool filtering** (`src/orchestrator/deterministic/tool-builder.ts:39–43, 56–61, 310–317`):
```typescript
const POST_ANALYSIS_EXPLANATION_ACTIONS: ReadonlySet<ActionName> = new Set([
  'explain_result',
  'compare_options',
  'what_would_flip',
]);

export function isExplanationChipSuppressedByAnalysis(chipAction, ctx) {
  return POST_ANALYSIS_EXPLANATION_ACTIONS.has(chipAction) && !!ctx.analysis_summary;
}

// inside computeContextExclusions() at lines 310–317:
if (hasAnalysis) {
  for (const action of POST_ANALYSIS_EXPLANATION_ACTIONS) {
    excluded.add(action);
  }
  if (!bypassStaleness) {
    excluded.add('run_analysis');
  }
}
```

When fresh analysis is in context, **the LLM is NOT given `explain_result`, `compare_options`, or `what_would_flip` as available tools** — the prompt rule is to answer from pre-computed Zone 2 data instead of calling handlers. The exclusion intentionally does **not** honour `bypassStaleness` (lines 307–308): "there is no chip path that should reinstate those tools when fresh analysis is in context."

**Chip generation** (`chip-builder-v4.ts:105–191`):
- **Does NOT read `ctx.analysis_summary` to suppress chips**, only to prioritize them
- The `evaluate` stage filter (`STAGE_ALLOWED_ACTIONS`, lines 54–63) **still includes** `explain_result` and `compare_options`
- These pass the stage filter and end up in `suggestedActions`

**Result:**
1. CEE removes `explain_result` from the LLM's toolset (because analysis is fresh and the LLM should answer from Zone 2)
2. CEE simultaneously emits a chip labelled "Explain results" with prompt "Explain the results"
3. User clicks the chip → user message "Explain the results" goes back to CEE
4. CEE rebuilds toolset, sees fresh analysis, removes `explain_result` again, asks the LLM to answer from Zone 2
5. LLM answers from Zone 2 — which it would have done anyway

The chip is a **false affordance**. Both code paths read the same field and apply it differently. Tool-builder uses it as a *gate*; chip-builder uses it for *prioritization* only.

**Pipeline assembly** (`src/orchestrator/deterministic/pipeline-v4.ts:687, 743`):
```typescript
const suggestedActions = buildDeterministicChips(turnContext, executedAction, deferredActions);
// ...
suggested_actions: suggestedActions.length > 0 ? suggestedActions : undefined,
```
Direct passthrough — no secondary filtering that mirrors `computeContextExclusions()`.

**UI** (`src/canvas/conversation/zones/SuggestedChips.tsx:158–206`): renders `envelope.suggested_actions` as buttons; no client-side knowledge of tool filtering. `validateResponse.ts:87–108` maps `prompt → message` for dispatch — pure mapping, no filter.

**Fix is one of two trivial options:**
- (a) Add the same `POST_ANALYSIS_EXPLANATION_ACTIONS` exclusion to `chip-builder-v4.ts` so both code paths apply the gate consistently
- (b) Document the divergence as intentional ("the chip is a coaching prompt; clicking it routes the user to a Zone-2-driven answer") and rename the chips so they don't promise tool calls

Option (a) is faster; option (b) is the right product decision if you want the chips to remain after analysis as conversation prompts.

---

## 5. Entity resolution and option quality

### 5a. Duplicate option detection — **ABSENT**

**Current state:** `src/orchestrator/deterministic/actions/add-option.ts:54–244` performs **no duplicate detection** before creating an option.

- Accepts label from user (line 55)
- Generates ID via slug at line 99: `option_${label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+$/, '')}`
- Builds operations immediately (lines 101–132)
- **Never calls** any `findExistingOption` helper, never normalises label for comparison

**Contrast with `add_factor`:** (`src/orchestrator/deterministic/actions/add-factor.ts:60–99`):
```typescript
const normalisedLabel = label.toLowerCase().replace(/\s+/g, ' ').trim();
const existingFactor = findExistingFactor(ctx, normalisedLabel);
if (existingFactor) {
  return {
    blocks: [],
    assistantText: `Found existing factor **${existingFactor.label}**. I'll update its value${valueStr} instead of creating a duplicate. Please confirm.`,
    ...
  };
}
```

The `add_factor` handler does **exact case-insensitive whitespace-normalised matching** via `findExistingFactor()` (lines 160–172) and redirects to update instead of creating a duplicate. **`add_option` has no equivalent code path.**

**Available but unused infrastructure:** `src/orchestrator/deterministic/entity-resolver.ts` already has fuzzy matching (`Levenshtein distance` at lines 174–205, threshold ≤2 → confidence 0.7–0.8 at line 150, substring matching for 4+ char labels at lines 155–160, high-risk threshold 1.0 at line 49). **It is never invoked during `add_option` execution** — it exists for resolving user references, not for preventing duplicate creation.

**Impact:** the user can say "Hire Contractor" and "Hire a Contractor" and "hire contractor" and get three distinct option nodes. Combined with the lack of post-mutation analysability gate (§1e), this is the most direct path to a model that "looks ready but is actually unanalysable".

**Recommended fix** (insertion point: `add-option.ts` after line 59, before slug generation):
```typescript
const normalisedLabel = label.toLowerCase().replace(/\s+/g, ' ').trim();
const existingOption = findExistingOption(ctx, normalisedLabel);
if (existingOption) {
  return {
    blocks: [],
    assistantText: `Option **${existingOption.label}** already exists. Would you like to update its interventions instead?`,
    guidance_items: [],
  };
}
```
Helper mirrors `findExistingFactor()` exactly, filtering by `entry.kind === 'option'`.

### 5b. AI-added option data completeness

**Validation today** (`add-option.ts:54–237`):
- ✅ Empty-interventions guard (lines 84–97): rejects if `interventions === {}` AND graph has factors, returns coaching ask
- ✅ Format parsing (lines 62–79): accepts both array and legacy object formats

**Validation gaps:**
- ❌ Zero-valued interventions (e.g., `{ fac_cost: 0 }`) accepted as-is
- ❌ Partial intervention coverage (option specifies 2 of 5 relevant factors) not detected
- ❌ Causal sense / domain validation: none
- ❌ Post-creation status check: none

**Status computation** is delegated to `computeStructuralReadiness()` at `add-option.ts:201`, which uses option-status logic from `src/cee/transforms/option-status.ts:64–190`:
- `ready`: resolved interventions (exact_id OR exact_label) — line 183
- `needs_encoding`: categorical/boolean values — line 162
- `needs_user_mapping`: no interventions or only semantic/unresolved — lines 128–155

**Empirical evidence — three most recent debug bundles:**

| Bundle | AI-created options | `data.interventions` populated |
|---|---|---|
| `test-diagnostics/golden-path-v2-e2e/step01-create-2026-03-31T19-00-20-053Z.json` | 3 (`opt_price_increase`, `opt_status_quo`, `opt_usage_based`) | **0/3** |
| `test-diagnostics/golden-path-v2-e2e/step01-create-2026-03-29T23-24-47-831Z.json` | 3 | **0/3** |
| `test-diagnostics/golden-path-v2-e2e/step01-create-2026-03-30T10-45-20-339Z.json` | 3 | **0/3** |

**Pattern:** initial `draft_graph` creates options as **shells** with labels only; interventions are expected to arrive later via `add_option` action or user edit. **No real bundle examined contains AI-generated interventions meeting "ready" criteria.**

The `add_option.test.ts:103–123` unit test feeds synthetic interventions `[{ factor_id: 'fac_ramp', value: 0.6 }, { factor_id: 'fac_cost', value: 0.4 }]` — but this is test scaffolding, not observed model behaviour.

**Combined finding:** the system today produces options that are textually present, structurally connected to factors only in the synthetic-test path, and almost never have ready-status interventions on first creation. The user's experience is "I added an option and the analyser still says I can't run" — and the audit confirms this is the **expected** behaviour given the current LLM/handler contract.

---

## 6. Confidence calibration

### 6a. Available calibration data in Zone 2

**Profile selection:** when `ctx.hasAnalysis === true`, the `post_analysis` profile (`src/orchestrator/prompt-zones/profiles.ts:42–50`) activates these blocks: `stage_context`, `graph_state`, **`analysis_state`**, `conversation_summary`, `recent_turns`, `event_log`, `analysis_hint`.

**Calibration signals rendered in `analysis_state`** (`src/orchestrator/prompt-zones/zone2-blocks.ts:214–249`, function `renderAnalysisState`):

| Signal | Field | Line | Rendered? | Notes |
|---|---|---|---|---|
| Robustness Level | `robustness.level` | 236 | Yes | enum: robust / moderate / fragile |
| Confidence Band | `confidence_band` | 238–240 | When present | enum: low / medium / high |
| Top Drivers | `top_drivers[]` (factor + elasticity) | 229–234 | Yes (≤3) | textual labels only |
| Winner Probability | `recommendation.win_probability` | 227 | Yes | as % |
| Constraints Status | `constraints_status[]` | 242–245 | When present | satisfied bool + probability |
| Recommendation Stability | `robustness.recommendation_stability` | (schema 42) | **Not rendered** | numeric 0–1 in `AnalysisInputsSummary` schema |
| Sensitivity Concentration | `sensitivity_concentration` | (schema 23) | **Not rendered** | numeric 0–1 |

Schema location: `src/schemas/analysis-inputs-summary.ts:61–74`.

**Signals expected by the prompt but missing from Zone 2 entirely:**

| Expected | Used by | Gap |
|---|---|---|
| `edge_e_values[]` | ROBUSTNESS COACHING (`orchestrator-cf-v28.ts:910–919`) | Not in `AnalysisInputsSummary` schema |
| `inference_warnings[]` | INFERENCE WARNING COACHING (`v28:921–928`) | Not in schema |
| `evpi` / `voi_ranking` / `factor_sensitivity` | EVIDENCE PRIORITY (`v28:889–898`) | Not in schema |
| `fragile_edge_ids` | explain_results tool description (`v28:608`) | Not in schema |
| `conditional_winners[]` | CONDITIONAL LEAD COACHING (`v28:900`) | Not in schema |
| PLoT critiques | OPTIONAL FIELD RULE (`v28:444–448`) | Not in schema |

### 6b. Prompt calibration rules (orchestrator-cf-v28)

**CONFIDENCE LANGUAGE** (lines 400–409):
> Strong evidence: "typically", "reliably", "research shows"
> Medium evidence: "can", "often", "may", "some evidence suggests"
> Never make stronger claims than the evidence supports.
>
> UNCERTAINTY LANGUAGE: Use medium-confidence phrasing for analytical claims: "the analysis suggests", "based on current assumptions". Never "definitely" or "it's impossible to say".

**CONFIDENCE GAPS rule** (lines 496–504):
> Flag low-confidence areas when they materially affect the next decision or analysis result. Name the gap and the single most useful thing that would improve confidence. Never block progress.

**POST-ANALYSIS NARRATION PRECEDENCE — CTA-LITE table** (lines 655–673):

| Stability | Separation | Guidance |
|---|---|---|
| Stable / highly stable | >15% | "Your analysis is stable. The result is unlikely to change with more evidence." |
| Stable / highly stable | <15% | "Options are close but the model is stable. Consider which you'd regret not choosing." |
| Moderate | any (dominant factor) | "Your decision depends heavily on [factor]. Gathering evidence here would be high-value." |
| Fragile | <10% | "This is too close to call. Gather evidence on [top priority item] before deciding." |

This is the **primary calibration vehicle** post-analysis — and it depends on **stability** (numeric) + **separation** (numeric). Zone 2 supplies neither directly: only the `robustness.level` enum and `top_drivers[]`. The LLM has to infer the right CTA-LITE row from the enum + separation it computes itself from `top_drivers`.

**Coaching plays expected when data present** (lines 845–981):

1. **ROBUSTNESS COACHING** (lines 910–919) — trigger: `edge_e_values[]` present. Surface 1–2 fragile edges + 1 robust edge with plain-language narration. "Never say 'E-value' to the user." **Cannot fire** — `edge_e_values` not in Zone 2.

2. **DOMINANT FACTOR WARNING** (lines 881–887) — trigger: single factor >50% of outcome sensitivity. MUST emit as `review_card`. **Cannot fire reliably** — sensitivity concentration is not in Zone 2; LLM must infer from `top_drivers[]` elasticity values.

3. **EVIDENCE PRIORITY** (lines 889–898) — trigger: any of `evpi`, `voi_ranking`, `factor_sensitivity` present. Priority order: EVPI → VoI ranking → top_drivers fallback. **Only the fallback is reachable** — `top_drivers[]` is the only one of the three rendered into Zone 2.

4. **INFERENCE WARNING COACHING** (lines 921–928) — trigger: `inference_warnings[]` with `MISSING_ROOT_VALUE`. **Cannot fire** — not in Zone 2.

**OPTIONAL FIELD RULE** (lines 444–448):
> OPTIONAL FIELD RULE (applies to gap_summary, model_health, voi_ranking, edge_e_values, conditional_winners, evpi, inference_warnings, and PLoT critiques): check field presence before narrating. Never fabricate absent fields. When absent, fall back to what you can infer from the graph in context.

This rule is the *correct* defence — but the result is that **most of the rich coaching plays in v28 are dead code** for the post-analysis turn. The LLM dutifully suppresses them and falls back to generic CTA-LITE language.

### 6c. Gap analysis

| Missing signal | Prompt rule | Severity | Impact |
|---|---|---|---|
| `edge_e_values[]` | ROBUSTNESS COACHING (line 910) | **HIGH** | Cannot say "the link between X and Y would need to be 3× wrong to flip the result" |
| `evpi` / `voi_ranking` | EVIDENCE PRIORITY (line 889) | **HIGH** | Cannot quantify value of information; falls back to generic top-driver narration |
| `fragile_edges[]` / `fragile_edge_ids` | explain_results tool (line 608) | **HIGH** | Cannot explain edge fragility |
| `recommendation_stability` (numeric) | CTA-LITE table (line 944) | **MEDIUM** | Must use enum instead of numeric stability — can't choose between table rows precisely |
| `inference_warnings[]` | INFERENCE WARNING COACHING (line 921) | **MEDIUM** | Cannot flag MISSING_ROOT_VALUE issues |
| `conditional_winners[]` | CONDITIONAL LEAD COACHING (line 900) | **MEDIUM** | Cannot surface scenario flips |
| `sensitivity_concentration` (numeric) | DOMINANT FACTOR WARNING (line 881) | **MEDIUM** | Must infer from `top_drivers[]` — fragile inference |

**The fundamental gap:** Zone 2 was designed to be minimal (enums + small lists), but the prompt was written for a richer signal set. The OPTIONAL FIELD RULE prevents fabrication, so the LLM correctly falls back to generic coaching — and the user perceives the AI as **less calibrated post-analysis than pre-analysis**, even though the back-end has all the data.

**Where the data is:** PLoT computes most of these signals (it has e-values, EVPI, fragile edges, inference warnings). They surface in the UI layer (see `src/components/results/`) but never make the round-trip back into Zone 2 for the LLM to narrate. The `AnalysisInputsSummary` schema is the bottleneck.

---

## 7. Prioritised findings and recommendations

Findings are ranked by **impact on perceived AI quality** × **inverse fix cost**.

### Tier 1 — fix first (highest impact, smallest fix)

**T1.1 — Chip/tool divergence creates false affordances post-analysis**
- **Where:** `chip-builder-v4.ts:105–191` (no analysis-summary suppression) vs `tool-builder.ts:310–317` (full suppression).
- **Symptom:** chips for "Explain results", "Compare options", "What would flip" appear after analysis even though the LLM no longer has the corresponding tools. Click → round-trip → answer comes from Zone 2 anyway.
- **Fix:** add `POST_ANALYSIS_EXPLANATION_ACTIONS` exclusion to `buildDeterministicChips()`. ~10 lines, one file.
- **Why now:** every post-analysis turn currently shows at least one false-affordance chip.

**T1.2 — `add_option` has no duplicate detection**
- **Where:** `add-option.ts:54–244` (no `findExistingOption` call). Contrast `add-factor.ts:60–99` which has the gold-standard pattern.
- **Symptom:** users get "Hire Contractor", "Hire a Contractor", "hire contractor" as three distinct nodes. Combined with the §1e gate gap, this is the dominant cause of "looks ready but isn't".
- **Fix:** copy `add_factor`'s pattern verbatim. ~30 lines, one file.

**T1.3 — Cap-hit failures are silent to the LLM**
- **Where:** `set-factor-value.ts:68–76` (early return with assistantText, no operations, no toolResult signal). Same pattern at `add-factor.ts:68–75`.
- **Symptom:** LLM proposes "set X to 60", deterministic handler rejects, user sees "Design Capability has a cap of 0. The value 60 exceeds this." — and on the next turn the LLM has no structured signal that the previous action failed. Often retries the same value.
- **Fix:** return a structured `actionResult.failure` field that the orchestrator surfaces back to the LLM as a tool failure observation. ~20 lines across 2 files.

**T1.4 — UI inverts CEE patch summary precedence**
- **Where:** `InlineBlocks.tsx:1073` — `{opSummary || normaliseDashes(block.summary || '')}`. UI's `summarisePatchOps` (line 87–96) wins over CEE's text.
- **Symptom:** even if CEE shipped a perfect semantic summary tomorrow, the UI would still render "1 option, 2 edges".
- **Fix:** swap precedence to `block.summary || opSummary`. **One line.**

**T1.5 — Composer text lost on panel collapse**
- **Where:** `useComposerState.ts:35` (local `useState` only). No persistence on unmount.
- **Symptom:** mid-typing user expands canvas, reopens panel, text gone.
- **Fix:** persist value to canvas store in a debounced `useEffect`, restore on mount. ~15 lines.

### Tier 2 — high value, moderate cost

**T2.1 — `buildPatchSummary` cannot synthesise semantic text**
- **Where:** `patch-summary.ts:174` signature does not accept the graph; call sites at `edit-graph.ts:2217`, `draft-graph.ts:171`, `system-event-router.ts` have `context.graph` in scope but don't thread it.
- **Symptom:** patch blocks read like accounting receipts ("Added 1 option and 2 connections") instead of decisions ("Added a contractor option that increases development capacity").
- **Fix:** add optional `graph: GraphV3T | null` parameter, implement small-patch semantic synthesis (~50 lines), update three call sites. Pair with T1.4.

**T2.2 — Zone 2 starves the calibration coaching plays**
- **Where:** `AnalysisInputsSummary` schema (`src/schemas/analysis-inputs-summary.ts:61–74`) renders only enums + top_drivers. Prompt v28 expects `edge_e_values`, `evpi`, `voi_ranking`, `inference_warnings`, `fragile_edge_ids`, `conditional_winners`, `recommendation_stability`, `sensitivity_concentration`.
- **Symptom:** post-analysis coaching is generic. ROBUSTNESS COACHING (v28:910), EVIDENCE PRIORITY (v28:889), INFERENCE WARNING COACHING (v28:921), DOMINANT FACTOR WARNING (v28:881) cannot fire reliably. The OPTIONAL FIELD RULE (v28:444) makes the LLM correctly fall back to bland CTA-LITE language.
- **Fix:** extend the schema. The data exists in PLoT; the bottleneck is the round-trip contract. Larger change because it touches schema, renderer, prompt assembly, and PLoT response mapping.

**T2.3 — No post-mutation analysability gate**
- **Where:** §1e — `validateGraphStructure` runs only post-PLoT in `edit-graph.ts:1889`. Deterministic actions trust their constructions. `analysis_ready.status` is descriptive, not enforced.
- **Symptom:** future mutations can leave the graph in an inconsistent state without any backend signal. The UI run-gate catches it (after the recent CEE readiness fix), but only at the moment the user tries to run.
- **Fix:** add a gate after `applyPatchOperations` (or after each deterministic handler returns operations) that calls `validateGraphStructure` + `computeStructuralReadiness` and either blocks the action or includes the failure in the response envelope.

**T2.4 — No user-facing Stop button**
- **Where:** `useConversation.ts:2408` (AbortController exists), but no UI button surfaces it. `MessageBubble.tsx:196–200` shows tool loading state but it's read-only.
- **Symptom:** long-running tools (`draft_graph`, `run_analysis`) make the user wait up to 120s with no escape.
- **Fix:** add a Stop button in the composer or status row that calls `abortRef.current?.abort()`. ~20 lines.

### Tier 3 — quality polish

**T3.1 — Streaming pre-text labels are generic**
- **Where:** `useConversation.ts:176–184` `mapToolLoadingLabel`. Hardcoded per tool name.
- **Symptom:** "Building your decision model…" is the only good label. Other tools get generic copy or nothing.
- **Fix:** emit a `progress` event from CEE with contextual message; UI consumes it instead of (or in addition to) the static map.

**T3.2 — Assistant text uses `typography.body` (16px) — not a panel token**
- **Where:** `MessageBubble.tsx:184–195` uses `typography.body`. DS v5 §21 (target architecture) wants the panel three-token system.
- **Symptom:** panel diverges from DS v5 §21. The divergence is conscious (DS v5 §21 is being built via Track D), but worth noting.
- **Fix:** when DS v5 §21 ships, switch to `panelHeader`/`panelBody`/`panelMeta`. Track-D scope.

**T3.3 — Prompt v28 has no rule preventing "Please confirm" + "I'll add now" mixing**
- **Where:** `orchestrator-cf-v28.ts` — 40 references to propose/confirm/auto_apply but no explicit rule.
- **Symptom:** rule is enforced implicitly via mode separation; one hallucination from the LLM and the rule breaks.
- **Fix:** add an explicit prompt rule to PRIMARY_RULES: "When the action handler emits a proposal (auto_apply: false), narrate it as 'I'd propose…' / 'Please confirm', never as 'Adding now' / 'I've added'."

**T3.4 — Zero-valued and partial intervention coverage accepted in `add_option`**
- **Where:** `add-option.ts:84–97` (only blocks zero interventions when factors exist; doesn't validate per-factor coverage or non-zero values).
- **Symptom:** `{ fac_cost: 0 }` accepted as a meaningful intervention. Partial coverage (option specifies 2 of 5 factors) silently produces a model with weak comparison signal.
- **Fix:** add zero-value warning + partial-coverage note in the action's coaching response.

**T3.5 — Edge defaults differ between handlers without enforcement**
- **Where:** `add-factor.ts:128` uses `strength: { mean: 0.5, std: 0.15 }` (causal); `add-option.ts:124` uses `strength: { mean: 1.0, std: 0.01 }` (structural). `enforceStructuralEdgeDefaults` (`edit-graph.ts:840`) only applies to LLM-generated edges.
- **Symptom:** drift risk if a future deterministic action adds a structural edge with the wrong defaults.
- **Fix:** extract defaults into a shared module and have both deterministic actions and `enforceStructuralEdgeDefaults` consume from it.

---

## 8. Proposed fix architecture

### Principle: one contract, three layers

The current state is **subsystems with overlapping responsibilities and no shared contract**. Each finding traces back to one of three contract gaps:

1. **Handler ↔ LLM contract** — what does a deterministic action handler tell the LLM happened? (cap-hit silence, no failure signal, action confirmation text disconnected from `auto_apply` flag)
2. **CEE ↔ UI contract** — what does the patch summary, the chip set, the readiness status mean to the renderer? (chip/tool divergence, summary precedence inversion, semantic-summary gap)
3. **PLoT ↔ Zone 2 contract** — what calibration data does the LLM get to narrate? (`AnalysisInputsSummary` is too thin for v28 coaching plays)

A consolidated fix should unify each of these three contracts in a single place rather than patching the symptoms.

### Workstream 1 — Action handler observability

**Goal:** every deterministic action returns a structured observation the LLM can see.

**Changes:**
- Extend `ActionResult` type with `failure?: { code: string; message: string; user_message: string; suggested_recovery?: string }` and `applied_changes?: { description: string; affected_node_ids: string[] }[]`.
- Migrate `set-factor-value.ts:68–76` and `add-factor.ts:68–75` cap-hit early returns to populate `failure` instead of returning empty operations.
- Have the response assembler surface `failure` as a `tool_failure` observation back into Zone 2 conversation context, so the next turn's LLM sees that the previous action was rejected.
- Add an explicit prompt rule to `orchestrator-cf-v28.ts` PRIMARY_RULES section: "When a previous tool call failed, acknowledge it explicitly and propose a recovery, never silently retry the same value."

**Files:** `add-option.ts`, `add-factor.ts`, `set-factor-value.ts`, `response-assembler.ts`, `turn-context.ts`, `orchestrator-cf-v28.ts`. Estimated: 5 files, ~150 lines.

**Resolves:** T1.3, T3.3, partial T3.4

### Workstream 2 — Patch summary end-to-end ownership

**Goal:** one place owns the human-readable patch summary; both ends read it.

**Changes:**
- Extend `buildPatchSummary(operations, graph, coachingSummary?, patchContext?)` to accept the graph.
- Implement small-patch semantic synthesis: for `add_node` of an option, traverse intervention edges and resolve target labels; for `update_node` of a factor, render `Updated <label>: <field>` properly; for edges, use source/target labels not IDs.
- Update three call sites to pass `context.graph` / `graphOutput`.
- Invert UI precedence at `InlineBlocks.tsx:1073` so `block.summary` wins.
- Delete `summarisePatchOps()` (`InlineBlocks.tsx:87–96`) once backend is reliable.

**Files:** `patch-summary.ts`, `edit-graph.ts`, `draft-graph.ts`, `system-event-router.ts`, `InlineBlocks.tsx`. Estimated: 5 files, ~80 lines.

**Resolves:** T1.4, T2.1

### Workstream 3 — Chip/tool unification

**Goal:** chip suppression and tool suppression read the same gate, and the rule is documented.

**Changes:**
- Extract `POST_ANALYSIS_EXPLANATION_ACTIONS` into a shared module (e.g., `src/orchestrator/deterministic/post-analysis-policy.ts`).
- Both `tool-builder.ts:computeContextExclusions()` and `chip-builder-v4.ts:buildDeterministicChips()` import and apply the same set.
- Add a comment block at the top of the policy module explaining: "These actions are answered from Zone 2 data when fresh analysis is in context. Both tool list and chip list must suppress them in lockstep."
- Add a unit test in `chip-builder-v4.test.ts` and `tool-builder.test.ts` that asserts they apply the same exclusion when `ctx.analysis_summary` is present.

**Files:** `chip-builder-v4.ts`, `tool-builder.ts`, new policy file, two test files. Estimated: 4 files, ~50 lines.

**Resolves:** T1.1

### Workstream 4 — Option creation hardening

**Goal:** `add_option` reaches feature parity with `add_factor`.

**Changes:**
- Add `findExistingOption()` helper in `add-option.ts` mirroring `findExistingFactor()`.
- Insert duplicate check after label validation, before slug generation.
- Optionally call `entity-resolver.ts` Levenshtein matcher for fuzzy detection (warn at distance ≤2).
- Add zero-value intervention warning (loop after parse, lines 79–84).
- Add partial-coverage note: when fewer than 50% of relevant factors are intervened on, surface coaching ask.

**Files:** `add-option.ts`. Estimated: 1 file, ~80 lines.

**Resolves:** T1.2, T3.4

### Workstream 5 — Post-mutation gate

**Goal:** every mutation passes through validation before the response envelope ships.

**Changes:**
- Add `validateMutationOutcome(graph, operations, options)` helper that runs `validateGraphStructure` and `computeStructuralReadiness` on the post-patch graph.
- Wire it into the deterministic action layer in `response-assembler.ts` immediately before block creation.
- For `edit_graph`, the call already exists at `edit-graph.ts:1889/2203`; make the failure path consistent (return a structured failure observation rather than swallowing).
- Add a unit test asserting that an action returning operations that produce an invalid graph results in a `failure` envelope, not a successful response.

**Files:** `response-assembler.ts`, `edit-graph.ts`, new helper, test files. Estimated: 4 files, ~120 lines.

**Resolves:** T2.3, indirect mitigation of T1.2 + §1e gap

### Workstream 6 — Calibration data round-trip

**Goal:** Zone 2 carries the signals v28 was written for.

**Changes (largest workstream):**
- Extend `AnalysisInputsSummary` schema (`src/schemas/analysis-inputs-summary.ts`) with: `edge_e_values?: Array<{edge_id, e_value, source_label, target_label}>`, `inference_warnings?: Array<{code, node_id, node_label, message}>`, `evpi?: Array<{factor_id, factor_label, percentage_points}>`, `voi_ranking?: Array<{factor_id, factor_label, value}>`, `fragile_edge_ids?: string[]`, `conditional_winners?: Array<{condition, winner_id, win_probability}>`, `recommendation_stability?: number`, `sensitivity_concentration?: number`.
- Map these from PLoT response in the analysis enrichment layer (find the PLoT→AnalysisInputsSummary adapter and add the fields).
- Render them in `zone2-blocks.ts:renderAnalysisState()` using bullet lists with the `OPTIONAL FIELD RULE` semantics (only render when present).
- Verify `orchestrator-cf-v28.ts` coaching plays now have data and remove "Cannot fire" from the gap analysis.
- Add an integration test that runs an analysis and asserts the LLM-visible Zone 2 contains all expected calibration signals.

**Files:** schema, PLoT response adapter, `zone2-blocks.ts`, integration test. Estimated: 4–6 files, ~250 lines.

**Resolves:** T2.2

### Workstream 7 — UI persistence and control

**Goal:** the panel is a first-class workspace, not a transient overlay.

**Changes:**
- Persist composer text to canvas store (debounced) and restore on mount (`useComposerState.ts`, `ChatComposer.tsx`).
- Add a Stop button in the composer or status row that calls `abortRef.current?.abort()` (`ChatComposer.tsx`, `useConversation.ts` exposes a `cancelTurn` callback).
- Optionally: emit `progress` event from CEE with contextual labels; UI consumes via `mapToolLoadingLabel` (workstream 1 carries the back-end half).

**Files:** `useComposerState.ts`, `ChatComposer.tsx`, `useConversation.ts`. Estimated: 3 files, ~50 lines.

**Resolves:** T1.5, T2.4, partial T3.1

### Sequencing recommendation

Tier-1 first, in this order:
1. **W3 (chip/tool unification)** — 1 day, eliminates the most visible false affordance
2. **W4 (option creation hardening)** — 1 day, kills the dominant cause of unanalysable models
3. **W2 (patch summary ownership)** — 1 day, makes every patch block humanised
4. **W1 (action handler observability)** — 2 days, structural fix to handler/LLM contract
5. **W7 (UI persistence + Stop button)** — 1 day

Then Tier-2:

6. **W5 (post-mutation gate)** — 2 days, hardens the mutation pipeline
7. **W6 (calibration round-trip)** — largest, restores the design intent of v28's coaching plays

W6 is the longest-running; it's a contract change between PLoT, the analysis adapter, the schema, the prompt-zone renderer, and the prompt itself. Not a single-PR fix, but the highest ceiling on perceived AI quality.

### What this audit deliberately does **not** recommend

- **Changing the orchestrator prompt** beyond T3.3 (the explicit propose-vs-add rule) and the v28 cleanup that comes naturally after W6 ships. The v28 prompt is well-structured; the issues are upstream of the prompt.
- **Replacing `chip-builder-v4` or `tool-builder` wholesale.** Both are coherent; they just disagree on one rule.
- **Rebuilding the patch block component.** The renderer is fine; only the rendering precedence and the upstream summary text are wrong.
- **A full rewrite of `useConversation.ts`.** It's a 2,957-line god-file and a known refactor target, but the audit finds no bugs that require touching the streaming pipeline. The fixes are localised.
- **Anything in `ResultsPanel.tsx`.** The 2026-04-08 fix already addressed the synthetic-readiness shortcut; `OutputsDock.tsx:376` is the canonical surface.

---

## Cross-references

- `docs/blocked-readiness-ux-verification-2026-04-08.md` — Recent CEE readiness tightening + ResultsPanel synthetic-readiness fix
- `docs/phase1-ui-consumption-audit-2026-04-07.md` — SSE / rendering pipeline audit
- `olumi-assistants-service/src/prompts/orchestrator-cf-v28.ts` — Active production orchestrator prompt
- `olumi-assistants-service/src/orchestrator/prompt-zones/zone2-blocks.ts` — Post-analysis Zone 2 renderer
- `olumi-assistants-service/src/schemas/analysis-inputs-summary.ts` — Calibration signal schema (the bottleneck for W6)
