# CEE: LLM Context Assembly Audit

**Date:** 2026-04-08
**Scope:** Full picture of what the LLM receives on every turn in the v4 native tool-use pipeline — system prompt + dynamic context block + conversation history + tool definitions, end to end.
**Methodology:** Investigation only. No code changes. Every finding cited as `file:line`.
**Repos:** `~/Documents/GitHub/olumi-assistants-service` (CEE backend), `~/Documents/GitHub/DecisionGuideAI` (UI).

This audit was commissioned because the prior systemic audit (`docs/ai-experience-systemic-audit-2026-04-08.md` §6) concluded that "Zone 2 starves coaching plays" by examining `src/orchestrator/prompt-zones/zone2-blocks.ts`. That file is **NOT** the path the v4 pipeline takes. The v4 native tool-use pipeline assembles its dynamic block via `src/orchestrator/deterministic/prompt-builder-v2.ts:buildStateSection`, which is structurally richer. This audit verifies the FULL composition of the LLM input on a single post-analysis evaluate turn, then assesses what is actually present, what is omitted, and what to recommend.

**Headline conclusions** (detailed in Part 5):
- **The static prompt is the dominant cost**: ~58 KB / ~14 500 tokens for the cf-v28 PMS payload, marked `cache_control: { type: 'ephemeral' }` so it is paid once per session.
- **The dynamic block is small but uneven**: typically 600–2 000 chars / 150–500 tokens. It DOES render `factor_sensitivity`, `fragile_edges`, `edge_e_values`, `conditional_winners`, `inference_warnings` when populated upstream — refuting the prior audit's "Zone 2 starves coaching plays" finding for the v4 path. But several first-class fields the prompt explicitly references are absent (EVPI, VoI ranking, recommendation_stability numeric, sensitivity concentration, intervention completeness, per-factor provenance).
- **Conversation history is aggressively trimmed**: max 10 messages, tool_use blocks dropped from prior assistant turns, no tool_results retained. This breaks the model's ability to remember "I just ran analysis with these inputs" across turns.
- **Tool surface is small but partly defaulted**: 6 tools survive post-analysis filtering (~360 tokens). Three explanation tools are intentionally suppressed so the LLM responds from Zone 2 data instead — but `set_factor_value` is the only one whose description is enriched with model state.
- **`max_tokens` is fixed at 2 048 for every v4 turn** (`pipeline-v4.ts:314`). Draft and analysis turns get no extension.
- **The PMS prompt actually loaded is `cf-v28`** (registered at `src/prompts/defaults.ts:2203`). No `v30`, `v31`, `v32a`, `v33`, `v33e` file exists in the repo. The "v33e content uploaded to PMS version 99" claim cannot be verified from source — it lives only in the Supabase `cee_prompts.staging_version` row.

---

## Part 1 — Static Prompt

### 1a. What loads, from where, on every turn

`src/orchestrator/deterministic/prompt-builder-v2.ts:56–120` is the only entry point for v4 system-prompt assembly.

```ts
// prompt-builder-v2.ts:75-86
const result = await loadPrompt('orchestrator', {
  forceDefault: false,
  useStaging: shouldUseStagingPrompts(),
});
if (result.source === 'store') {
  promptCache = { content: result.content, loadedAt: now };
  log.info({
    prompt_id: result.promptId,
    version: result.version,
    is_staging: result.isStaging ?? false,
  }, 'v4.prompt.pms_loaded');
}
```

- **Cache**: module-level singleton, 5-minute TTL, no in-flight dedupe (`prompt-builder-v2.ts:39–44, 66–71`). Two concurrent turns hitting an expired cache will both call `loadPrompt`.
- **`useStaging`** is resolved from `shouldUseStagingPrompts()` once per turn, defined at `src/config/index.ts:1143–1157`:
  1. `config.prompts.useStaging` explicit override (env `PROMPTS_USE_STAGING`),
  2. `PROMPTS_ENVIRONMENT` or `DD_ENV` lower-cased; `'staging'` ⇒ true,
  3. legacy fallback: `!isProduction()` (NODE_ENV).
- **Resolution inside `loadPrompt`** (`src/prompts/loader.ts:109–190`):
  - If prompt management is disabled or `forceDefault` is set ⇒ `loadDefaultPrompt()` returns the in-memory hardcoded default registered at startup.
  - Otherwise the DB-backed `getPromptStore()` returns the compiled prompt for `orchestrator`. When `useStaging: true`, the store loads `prompt.stagingVersion`; staging match is detected by comparing `compiled.version === prompt.stagingVersion` (`loader.ts:141`).
  - On any error ⇒ falls back to default and emits `prompt.loader.error` (`loader.ts:182`).
- **Failure path inside `prompt-builder-v2.ts`**: if `loadPrompt` throws or returns no `source: 'store'` payload, `staticBlock` is set to `STATIC_PROMPT_FALLBACK` (a ~1 500-char hardcoded literal at `prompt-builder-v2.ts:126–149`) and `v4.pms_fallback_used` is emitted. The fallback prompt is dramatically shorter than v28 and contains no coaching plays, no UI awareness, no JSON/tool-use rules, no examples. **A silent fallback is functionally a regression.**

### 1b. Which version is currently authoritative

| PMS slot | Source on disk | Active in prod | Active in staging | Notes |
|---|---|---|---|---|
| `orchestrator` (default) | `src/prompts/orchestrator-cf-v28.ts` | Yes — registered at `src/prompts/defaults.ts:2203` | If PMS DB unhealthy or `forceDefault` true | Explicit `registerDefaultPrompt('orchestrator', getOrchestratorPromptV28())` |
| `orchestrator` (PMS production pin) | DB row `cee_prompts.active_version` | Yes (when PMS healthy) | — | Cannot be inspected from source — query Supabase |
| `orchestrator` (PMS staging pin) | DB row `cee_prompts.staging_version` | — | When `shouldUseStagingPrompts()` true and staging row populated | Cannot be inspected from source — query Supabase |
| `orchestrator-cf-v30/v31/v32a/v33/v33e` | NONE | NO | NO | No file exists in `src/prompts/`. `v31` is mentioned only as "FLAG FOR PAUL" at `prompt-builder-v2.ts:11–17`. `v32a` is mentioned only as a hypothetical example in comments at `prompt-builder-v2.ts:64, 200`. |

**On-disk orchestrator prompts** (verified by `ls src/prompts/orchestrator-cf-v*.ts`): v4, v11, v12, v13, v19, v26, v28. Nothing v30+.

**Resolving "what is loaded right now on staging"** requires either:
1. Querying the `cee_prompts` table directly (`promptId` for orchestrator, `staging_version` field) — outside the scope of source inspection, OR
2. Reading the most recent `v4.prompt.pms_loaded` log line, which emits `{ prompt_id, version, is_staging }` (`prompt-builder-v2.ts:81–86`).

The "v33e uploaded as staging version 99" assertion in the request brief cannot be verified from source. **It is a data-plane fact, not a code-plane fact.** If you want it audited, point me at the Datadog/Loki query or run `select id, name, active_version, staging_version from cee_prompts where name = 'orchestrator';` against the staging Supabase.

### 1c. Character count and token estimate

- **`src/prompts/orchestrator-cf-v28.ts`**: 59 101 bytes total file size (full TS source).
- **The exported `ORCHESTRATOR_PROMPT_CF_V28` template literal body** (lines 27–1440 of the file): **57 832 characters / 1 414 lines** ≈ **14 458 tokens** at the 4-char-per-token rule of thumb.
- **Static prompt fallback** (`prompt-builder-v2.ts:126–149`): **~1 500 characters / ~375 tokens**. This is what the LLM gets if PMS load fails — a 97% reduction in instruction surface.
- **`system_prompt_chars` telemetry**: emitted at 7 sites; the v4-relevant one is `pipeline-v4.ts:277`. Search a recent staging log for `system_prompt_chars` with `pipeline=v4` to see actual production values.

### 1d. Static-prompt content alignment with v4 pipeline (TODO debt)

`prompt-builder-v2.ts:11–17` is an explicit "FLAG FOR PAUL (v31 prompt)" header comment listing four PMS edits required to bring the static prompt in line with what v4 actually does:

```ts
// 1. Remove the JSON response contract ({ text, insights[], recommended_actions[] })
// 2. Remove action vocabulary section
// 3. Add tool-use instruction: use tools for structural actions, respond with
//    conversational text for questions/analysis
// 4. Remove "Respond with valid JSON only" suffix
```

**These four edits have not been made on disk** (verify by reading the v28 source). cf-v28 still teaches the LLM the JSON response contract, lists the action vocabulary, and never tells it about native tool calls. The v4 pipeline uses native Anthropic tool_use blocks — not the JSON contract — so the prompt is currently teaching dead instructions while the actual surface area lives in the tool definitions. This is dead instruction debt with measurable token cost (the JSON contract + action vocabulary section probably runs to ~3 000–4 000 of the 14 500 tokens).

---

## Part 2 — Dynamic Context (`buildStateSection`)

### 2a. Section inventory (line-by-line)

`src/orchestrator/deterministic/prompt-builder-v2.ts:155–300`. Each line range below contributes one fragment to the dynamic block, joined with `\n`.

| Lines | Section | Field source | Conditional on |
|---|---|---|---|
| 156 | `## Current Decision State` header | constant | always |
| 158 | `Stage: **${ctx.stage}**` | `ctx.stage` | always |
| 160–170 | Model summary `Model: N nodes, M edges, K options`, optional `Goal:`, optional `Options:` | `ctx.graph_summary.{node_count, edge_count, option_count, goal_label, option_labels}` | always (`Model: not yet created` if empty) |
| 172–189 | Entity loop: `Factors:` line, `Options:` line | `ctx.entities.nodes` (Map iteration) — only label, id, category, value, unit | `entities.nodes.size > 0` |
| 191–201 | (comment block — staleness contract, no output) | — | — |
| 202–216 | `**Analysis Results:**` header + `Winner:`, `Runner-up:`, `Robustness:`, `Constraint tensions:` | `ctx.analysis_summary.{winner, winner_probability, runner_up, runner_up_probability, robustness_band, constraint_tensions}` | `analysis_summary != null` |
| 222–235 | `### Key drivers` (top 3 from `factor_sensitivity` with `influence_percent` + `confidence_band`; falls back to `top_drivers` with sensitivity number) | `analysis_summary.factor_sensitivity` OR `analysis_summary.top_drivers` | the array is non-empty |
| 238–243 | `### Fragile relationships` (top 3 by `switch_probability`) | `analysis_summary.fragile_edges` | non-empty |
| 246–252 | `### Robustness detail` (top 2 fragile + top 1 robust by `e_value`) | `analysis_summary.edge_e_values` | non-empty |
| 255–261 | `### Conditional results` (scenario + winner_label + probability) | `analysis_summary.conditional_winners` | non-empty |
| 264–269 | `### Inference warnings` (one bullet each, max 5) | `analysis_summary.inference_warnings` | non-empty |
| 274–286 | `Signals: ...` line — close call, dominant factor (label-resolved), default-value count, weak-edge count, high-uncertainty-factor count | `ctx.signals` | at least one signal active |
| 288–290 | `Blockers: ...` (semicolon-joined `reason`s) | `ctx.blockers` | non-empty |
| 292–294 | `Conversation: N messages` | `ctx.conversation.turn_count` | `> 0` |
| 295–297 | `Pending confirmation: ...` | `ctx.conversation.pending_confirmation` | non-null |

**Disambiguation section** (`prompt-builder-v2.ts:302–311`) is appended as a separate dynamic section, joined by `\n\n---\n\n`, only when `ctx.disambiguation_hints.length > 0`.

**Critical formatting observation**: `Options:` is rendered TWICE when both the `graph_summary.option_labels` array and the `entities` map contain options (`lines 165–167` AND `lines 184, 188`). The first emits labels only; the second emits `label (id)` pairs. The LLM sees both. This is a low-cost duplication but is listed as a fix in §6.

### 2b. The actual rendered text (verbatim simulation)

For a representative post-analysis evaluate turn — 12-node graph, 3 options, fresh analysis, one close call, one dominant factor, one MISSING_ROOT_VALUE warning — `buildStateSection` produces the following exact text. Every line maps to a line range above. (See Appendix A for the verbatim block.)

```
## Current Decision State
Stage: **evaluate**
Model: 12 nodes, 14 edges, 3 options
Goal: Maximise quarterly revenue
Options: Raise prices 10%, Hold prices, Lower prices 5%
Factors: Price sensitivity (factor_price_elasticity, observable, value: -1.2 ratio), Customer churn (factor_churn, observable, value: 0.04 monthly), Brand strength (factor_brand, observable, value: 7.2 1-10), Competitor reaction (factor_competitor, external)
Options: Raise prices 10% (option_raise), Hold prices (option_hold), Lower prices 5% (option_lower)

**Analysis Results:**
Winner: option_raise (52%)
Runner-up: option_hold (38%)
Robustness: moderate
Constraint tensions: churn cap risk; minimum margin floor

### Key drivers
- Price sensitivity — influence 42% — confidence: medium
- Customer churn — influence 28% — confidence: low
- Competitor reaction — influence 15% — confidence: low

### Fragile relationships
- Price → Revenue — switch probability 35%
- Churn → LTV — switch probability 22%

### Robustness detail
- Price → Revenue — e-value 1.40 (fragile)
- Churn → LTV — e-value 1.65 (fragile)
- Brand → Conversion — e-value 4.20 (robust)

### Conditional results
- Under high competitor reaction: option_hold (45%)
- Under low churn: option_raise (61%)

### Inference warnings
- MISSING_ROOT_VALUE for factor_competitor — defaulted to zero

Signals: close call (tight margin), dominant factor: Price sensitivity, 2 default values, 1 weak edges, 2 high-uncertainty factors

Conversation: 4 messages
```

This block is **~1 130 characters / ~280 tokens**. Without the optional headed sections (key drivers, fragile relationships, robustness detail, conditional results, inference warnings) it collapses to **~430 characters / ~110 tokens**.

Notes:
1. `option_raise` is the **id**, not the label, on the Winner line — `analysis_summary.winner` is whatever the upstream PLoT response wrote (`turn-context.ts:401–423`), and `buildStateSection` does not resolve it to the label even though `ctx.entities.nodes.get(winner)?.label` would work. Same for `runner_up`. **Wasted resolution.**
2. The `Signals` line says `1 weak edges` (incorrect plural agreement) and surfaces only counts, never the labels of the weak edges or the high-uncertainty factors.
3. There is no provenance, no evidence quality, no per-option intervention completeness, and no readiness flag anywhere in the block — see §2c.

### 2c. What is omitted from the dynamic block

There are two omission classes: (1) fields that exist in `DeterministicTurnContext` but `buildStateSection` does not render, and (2) fields the prompt assumes exist but the upstream pipeline never extracts.

**Class 1 — present in `DeterministicTurnContext` but never rendered**

| Field | Defined at | Why it matters |
|---|---|---|
| `entities.edges[]` (`from_label`, `to_label`, `strength_mean`, `strength_std`, `exists_probability`, `effect_direction`) | `types.ts:35–44` | Only the **count** is in the block (via `graph_summary.edge_count`). The LLM cannot reason about which edge is weak, which has high uncertainty, or which direction it points without calling `explain_result` (which is suppressed). |
| `entities.nodes[entry].is_action_target`, `aliases`, `cap` | `types.ts:20–32` | Aliases are completely invisible; the LLM sees only the canonical label. `cap` (the upper bound on a factor) is dropped even though the prompt expects it to ground constraint reasoning. |
| `graph_summary.missing_structural[]` | `types.ts:62` | Specific structural issues — exactly the kind of grounding the prompt's GRAPH_SAFETY section needs. Computed but unused. |
| `analysis_summary.constraints_met` (boolean) | `types.ts:84` | The prompt has rules about constraint satisfaction, but only the textual `constraint_tensions` strings are rendered. The boolean is dropped. |
| `analysis_summary.fragile_edge_count` | `types.ts:74` | Only the top 3 are listed; the total count is dropped, so the LLM does not know whether 3 of 3 or 3 of 30 fragile edges are shown. |
| `signals.weak_edges[]` (edge IDs) | `types.ts:142` | Only the **count** is rendered. The LLM sees `1 weak edges` but cannot name them. |
| `signals.high_uncertainty_factors[]` | `types.ts:134` | Only the count is rendered. Same blindness as weak_edges. |
| `capabilities` (entire object) | `types.ts:146–153` | The LLM is never told what it can/cannot do; it has to infer from the tool list. This is mostly fine since tools are the surface, but the lack of explicit `can_explain_results: true` etc. removes a sanity-check signal. |
| `eligible_actions: ActionName[]` | `types.ts:177` | The full eligible action list is hidden from the prompt — the LLM only sees the post-filter tool list. |
| `blockers[].suggested_action_type` | `types.ts:128` | The block surfaces `reason` but not the recommended next action — exactly the "actionable hint" the COACH rule asks for. |
| `conversation.last_user_intent` | `types.ts:158` | Computed but never surfaced. The LLM has to re-derive intent from the truncated history every turn. |
| `conversation.recent_actions_taken[]` / `recent_actions_declined[]` | `types.ts:159–160` | Never surfaced. The LLM has no idea which actions the user has already accepted or dismissed in this session. |
| `conversational_state` (raw turn metadata) | `types.ts:185` | Never surfaced. |
| `analysis_inputs` | `types.ts:191` | The exact graph slice that was fed into PLoT for the most recent run. Never surfaced. The LLM cannot answer "what assumptions did the run use" without calling a tool. |

**Class 2 — referenced by the v28 prompt but never extracted into `analysis_summary`**

These come from `src/prompts/orchestrator-cf-v28.ts` coaching plays. They are also flagged in the prior systemic audit (§6).

| Field | Prompt rule that needs it | Status |
|---|---|---|
| EVPI / VoI ranking per factor | EVIDENCE PRIORITY play (v28: COACHING_PLAYS) | NOT extracted into `AnalysisSummary` (`types.ts:66–86` has no field). The PLoT response may carry it, but `turn-context.ts:computeAnalysisSummary` does not pull it. |
| `recommendation_stability` (numeric 0–1) | CTA-LITE table — distinguishes "stable highly" from "stable" | NOT extracted. Only the enum-banded `robustness_band` is rendered (line 211–212 of prompt-builder-v2.ts), so the LLM cannot distinguish 0.92 from 0.61. |
| `sensitivity_concentration` (numeric 0–1) | DOMINANT FACTOR WARNING (>50% rule) | NOT extracted. The dominant-factor signal at `signals.dominant_factor` is computed via a 2× ratio heuristic (`turn-context.ts:40 — DOMINANT_FACTOR_RATIO`), which does not match the prompt's 50% rule. |
| Per-factor provenance (AI-estimated vs user-provided vs brief-extracted) | "How did this number get into the model" reasoning | NOT extracted. `EntityEntry` (`types.ts:20`) has `value`, `unit`, `cap` only. There is no `provenance` field anywhere. |
| Evidence quality indicators | EVIDENCE_HANDLING section | NOT extracted. |
| Per-option intervention completeness | analysis_ready / readiness signal | The graph patch envelope carries it (`GraphPatchBlockData['analysis_ready']`) but it never reaches `buildStateSection`. |
| Per-option readiness status | same as above | Not surfaced in the block. |
| Per-edge strength parameters | edge-level coaching | Available in `entities.edges[]` but the block prints only the count. |
| Node `observed_state` provenance | "is this value observed or defaulted?" | `EntityEntry` has the value; there is no flag distinguishing observed from inferred. The `signals.default_value_count` count is the only proxy. |

**Verification of the "Zone 2 starves coaching plays" claim from the prior audit**

The prior audit (`docs/ai-experience-systemic-audit-2026-04-08.md` §6) listed `factor_sensitivity`, `fragile_edges`, `edge_e_values`, `conditional_winners`, `inference_warnings` as missing. Inspecting `prompt-builder-v2.ts:222–269`, all five ARE rendered when populated. The contradiction is resolved as follows:

- The prior audit examined `src/orchestrator/prompt-zones/zone2-blocks.ts:renderAnalysisState`, which IS the assembler for an OLDER prompt-zones pipeline. The v4 native tool-use pipeline does not call it.
- `turn-context.ts:computeAnalysisSummary` (lines 372–555) DOES extract all five fields from the upstream `V2RunResponseEnvelope`, with defensive parsing that walks `analysis.factor_sensitivity`, `analysis.results.factor_sensitivity`, `analysis.robustness.factor_sensitivity`, `analysis.robustness_synthesis.factor_sensitivity` (`turn-context.ts:598–621`).
- The remaining gap is whether PLoT actually populates these fields in the upstream payload. From the agent investigation (test fixtures, golden-path JSON):

| Field | Upstream populated? | Notes |
|---|---|---|
| `factor_sensitivity[]` | SOMETIMES | UI explicitly forwards `influence_rank` + `influence_percent` (turn-context.ts:444–465). When PLoT returns `elasticity` only, the parser computes `influence_percent = abs(elasticity) * 100`. |
| `fragile_edges[]` | SOMETIMES | Real PLoT golden-path responses include populated `robustness.fragile_edges[]`; empty when the decision is highly robust or PLoT omits the breakdown. |
| `edge_e_values[]` | RARELY | Requires the ISL deep robustness module. Tool-builder test fixtures default to empty (`tool-builder.test.ts:20`). |
| `conditional_winners[]` | RARELY | Requires scenario / what-if capability. Test fixtures default to empty. |
| `inference_warnings[]` | SOMETIMES | Emitted by PLoT when extrapolation, convergence, or data-quality issues are detected. |

**Net finding**: The v4 dynamic block has the structural CAPACITY to render robust calibration signals — but two of the five sub-blocks (`edge_e_values`, `conditional_winners`) are starved by the upstream PLoT/ISL pipeline, not by the dynamic builder. The prior audit's blame attribution was correct in spirit (the LLM rarely sees these signals) but wrong in location (the bug is upstream of `buildStateSection`, not in it).

### 2d. Format assessment

**Strengths**
- Compact, line-oriented, low ceremony.
- Headed sections (`### Key drivers`, `### Fragile relationships`, …) match the field names the v28 prompt instructs the LLM to "navigate by" — a deliberate co-design.
- Staleness contract is clean: when `analysis_summary` is null, the block emits **zero** analysis text rather than "no analysis run", letting the prompt own all absent-data behaviour (`prompt-builder-v2.ts:191–201`).
- Graceful fallback from `factor_sensitivity` to `top_drivers` (`prompt-builder-v2.ts:222–235`).

**Weaknesses**
- **`Options:` is rendered twice** (label-only + label+id) — duplication.
- **Winner / runner-up render IDs**, not labels — wasted entity-resolution opportunity (lines 205–209).
- **Counts without identifiers** for `weak_edges`, `high_uncertainty_factors`, `default_value_count` — the LLM cannot reference them by name.
- **No grouping of conditional results by which assumption flips them** — just a flat list of scenarios.
- **`Conversation: 4 messages`** with no structure — does not signal whether those messages contain prior tool calls, prior accepted patches, or pending state. The actual messages are in the `messages[]` parameter, but the LLM cannot count them itself reliably across the windowing.
- **Dominant factor uses a 2× ratio heuristic, not the prompt's 50% rule** — the signal sometimes fires when the prompt's coaching play would not, and vice versa. (`turn-context.ts:40` vs v28 DOMINANT FACTOR WARNING.)

### 2e. Token-budget contribution

| Block fragment | Typical chars | Typical tokens |
|---|---|---|
| Header + stage | 50 | 12 |
| Graph summary lines (3–4) | 120 | 30 |
| Entities loop (factors+options, 12 nodes) | 350 | 88 |
| Analysis Results header + winner/runner-up/robustness/tensions | 140 | 35 |
| Key drivers (3 rows) | 150 | 38 |
| Fragile relationships (3 rows) | 110 | 28 |
| Robustness detail (3 rows) | 130 | 33 |
| Conditional results (2 rows) | 90 | 23 |
| Inference warnings (1 row) | 60 | 15 |
| Signals line | 150 | 38 |
| Blockers / conversation | 60 | 15 |
| **Typical post-analysis total** | **~1 410 chars** | **~355 tokens** |
| **Bare minimum (analysis null)** | **~430 chars** | **~110 tokens** |
| **Maximal (12 fragile_edges, 5 conditionals, 5 warnings)** | **~2 200 chars** | **~550 tokens** |

For comparison: the static prompt is 14 458 tokens (≈ 41× the dynamic block). **The dynamic block is ~1% of the prompt input cost per turn**, except on the first turn (when the static block also has to be sent uncached).

---

## Part 3 — Conversation History

`pipeline-v4.ts:269` is the assembly site:

```ts
const messages = filterHistoryV4(
  sanitiseAssistantHistory(
    assembleMessages(conversationContext, effectiveMessage)
  )
);
```

A three-stage pipeline: assemble → sanitise → filter. The result is the array passed as `messages` to the Anthropic SDK at `pipeline-v4.ts:310`.

### 3a. Message shape

`src/orchestrator/types.ts:616`:

```ts
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  tool_calls?: Array<{ name: string; input: Record<string, unknown> }>;
}
```

`src/orchestrator/prompt-assembly.ts:84–131` (assembleMessages):
- **User messages** are passed verbatim as `{ role: 'user', content: userMessage }` (`prompt-assembly.ts:96`).
- **Assistant messages with `tool_calls`** are reconstructed as `ToolResponseBlock[]`: a `text` block (if `msg.content` is non-empty) followed by one `tool_use` block per call, with synthetic id `'toolu_${tc.name}'` (`prompt-assembly.ts:114–127`). **The synthetic id is not a real Anthropic tool_use_id** — it satisfies the SDK shape but cannot be paired with a `tool_result`.
- **Assistant messages without `tool_calls`** keep plain string content.
- **Tool results from prior turns are NOT stored**. The history schema has no `tool_result` block type. Once a turn completes, only `text` and `tool_calls` survive.
- **Graph patches are NOT stored in `messages[]`**. They live as separate envelope blocks in the UI's history but never enter the conversation array sent to the LLM.

### 3b. Sanitisation

`pipeline.ts:952–983` (sanitiseAssistantHistory): assistant messages that look like JSON envelopes (`{"text":"..."}`) are unwrapped to just the `.text` field. This removes the v3-era `{ text, insights, recommended_actions }` JSON pollution from the v4 history surface. There is no equivalent unwrap for stale tool_use blocks.

### 3c. Filtering

`src/orchestrator/deterministic/history-filter-v4.ts`:

- **Cap**: `MAX_HISTORY_MESSAGES = 10` (`history-filter-v4.ts:22`). Most-recent N kept; oldest dropped (`history-filter-v4.ts:87–88`). 5 user/assistant pairs.
- **tool_use stripping** in prior assistant turns (`history-filter-v4.ts:141–145`): all `tool_use` blocks are dropped from `ToolResponseBlock[]` content; only text blocks survive. **The model loses the structural memory of which tools it called in prior turns.**
- **XML envelope sanitisation**: legacy cf-v28 XML wrappers are unwrapped to text only (`history-filter-v4.ts:99–127`).
- **Error / synthetic-pattern drop** (`history-filter-v4.ts:28–36`): messages matching "couldn't generate", "try rephrasing", "something went wrong", "please try again", "unable to generate", "couldn't be completed", "taking longer than expected" are dropped wholesale.
- **Empty whitespace** dropped (`history-filter-v4.ts:70–71`).
- **System sentinels** (`[system]` prefix) dropped (`history-filter-v4.ts:73–74`).
- **Normaliser default** "I'm here to help with your decision. What would you like to explore?" dropped (`history-filter-v4.ts:76–77`).
- **No token budget**, only the message count.

### 3d. System events

`pipeline-v4.ts:101–115` short-circuits before any LLM call:

```ts
const systemEventResult = handleSystemEvent(turnRequest, turnId, requestId);
if (systemEventResult) {
  yield { type: 'turn_complete', seq: seq++, envelope: systemEventResult.envelope };
  return;
}
```

System events (`patch_accepted`, `patch_dismissed`, `direct_graph_edit`, `direct_analysis_run`, `feedback_submitted`) never become LLM messages. `direct_analysis_run` produces a templated "Analysis is running…" reply; the others are silent. **The LLM has no visibility into "the user just accepted a patch" or "the user edited the graph by hand" except via the next user message.** This is a deliberate architectural choice but it is also why the "Conversation: N messages" line in the dynamic block is the only handle the LLM has on session activity.

### 3e. Quality assessment

| Aspect | Status |
|---|---|
| User text fidelity | Verbatim |
| Assistant text fidelity | Verbatim, JSON-unwrapped |
| Prior tool calls visible | NO (stripped by `history-filter-v4.ts:141–145`) |
| Prior tool results visible | NO (never stored) |
| Patches / graph mutations visible | NO (envelope-only, never in `messages[]`) |
| System events visible | NO (handled deterministically before LLM) |
| Window | Most recent 10 messages (5 pairs); no token budget |
| Synthetic content injected | NO |

The history is **lossy across turns**. When the LLM in turn N is asked "did you already check the price elasticity?", the only ground truth it has is its own conversational memory of turn N-1's text — not whether it actually called `set_factor_value` on `factor_price_elasticity`. For chain-of-action coherence on multi-turn tasks, this is the single biggest assembly gap.

---

## Part 4 — Tool Definitions (Post-Analysis Evaluate Turn)

Tool assembly is in `src/orchestrator/deterministic/tool-builder.ts:227–262`.

### 4a. Stage policy and exclusions

`src/orchestrator/deterministic/turn-context.ts:50–56`:

```ts
const STAGE_ACTION_POLICY: Record<DecisionStage, ReadonlySet<ActionName>> = {
  frame:    new Set(['set_factor_value', 'add_factor', 'set_goal_target', 'add_constraint']),
  ideate:   new Set(['set_factor_value', 'add_constraint', 'add_factor', 'adjust_edge_strength', 'add_option', 'remove_factor', 'set_goal_target']),
  evaluate: new Set(['run_analysis', 'explain_result', 'compare_options', 'challenge_assumption', 'run_premortem', 'what_would_flip', 'set_factor_value', 'adjust_edge_strength', 'add_constraint']),
  decide:   new Set(['explain_result', 'compare_options', 'what_would_flip', 'challenge_assumption', 'run_premortem']),
  optimise: new Set(['set_factor_value', 'adjust_edge_strength', 'add_constraint', 'run_analysis', 'explain_result', 'compare_options', 'challenge_assumption', 'run_premortem', 'what_would_flip']),
};
```

Evaluate-stage eligible: 9 actions.

`tool-builder.ts:279–330` then applies `computeContextExclusions(ctx)`:
- When `ctx.analysis_summary != null` (post-analysis path): suppress `explain_result`, `compare_options`, `what_would_flip`, AND (unless `bypassStaleness`) `run_analysis`. (`tool-builder.ts:310–317`)
- When `!hasGraph`: suppress all `GRAPH_EDIT_ACTIONS` + `run_analysis`. (Not relevant here — graph exists.)
- Permanent exclusion: `generate_artefact` (`tool-builder.ts:25`).

### 4b. Final tool list shipped to Claude

For a post-analysis evaluate turn with no chip click (i.e. `bypassStaleness=false`) and no entity ambiguity, the LLM receives **5 tools**:

| # | Tool | Description (verbatim) | Required params | Source |
|---|---|---|---|---|
| 1 | `challenge_assumption` | Challenge a specific assumption in the model with data and science. | (none) | `actions/challenge-assumption.ts:12–30` |
| 2 | `run_premortem` | Run a pre-mortem analysis for an option: imagine it failed and explore why. | (none) | `actions/run-premortem.ts:13–31` |
| 3 | `set_factor_value` | Set or update the observed value of a factor in the model. *(+ dynamic suffix when factors with default values exist)* | `target_id`, `value` | `actions/set-factor-value.ts:11–31` |
| 4 | `adjust_edge_strength` | Adjust the causal strength of an edge between two factors. | `from`, `to` | `actions/adjust-edge-strength.ts:11–31` |
| 5 | `add_constraint` | Add a constraint to the decision goal. | `target_id`, `threshold`, `label` | `actions/add-constraint.ts:11–33` |

**Six** if a chip click sets `bypassStaleness=true`, in which case `run_analysis` is also included.

**Three intentionally suppressed**: `explain_result`, `compare_options`, `what_would_flip`. The pipeline-v4 design is that the LLM responds to "explain", "compare", "what would flip" requests by **writing prose grounded in the dynamic block** rather than calling a handler-template tool. `isExplanationChipSuppressedByAnalysis()` (`tool-builder.ts:56–61`) is exported so the chip-click router can distinguish "tool intentionally suppressed; LLM will respond" from "tool genuinely unavailable".

### 4c. Description quality

- **`run_analysis`** description is one-liner. Non-enriched.
- **`challenge_assumption`** says "data and science" but does not enumerate which factor categories are good targets, nor reference the dynamic block's `### Key drivers` section.
- **`run_premortem`** does not say "omit `target_id` to target the current winner" anywhere in the schema description (`'Option ID to analyse (omit to target winner)'` in the param description is the only hint).
- **`set_factor_value`** is the **only** post-analysis tool with dynamic enrichment: `enrichDescription()` at `tool-builder.ts:445–461` appends `Factors with default values: A, B, C (+N more).` when factors with `value == null` exist. This is the only way the LLM finds out which factors still have defaults — the dynamic block surfaces only the **count**.
- **`adjust_edge_strength`** description does not mention that `strength_mean` is in `[0, 1]` (it says "0 to 1" inside the schema parameter description, which the LLM does see).
- **`add_constraint`** description is the shortest at 43 chars but the schema is the largest at ~258 chars because of the `enum: ['threshold', 'range']`.

The three **excluded** tools have rich `enrichDescription()` cases (`tool-builder.ts:418–443`) that produce text like `"Explain why option_raise leads at 52%. Top drivers: Price sensitivity (4.2), Customer churn (2.8), Competitor reaction (1.5)."` — but **this enrichment is dead code post-analysis** because `computeContextExclusions` strips the tool first. The enrichment for `compare_options` and `what_would_flip` is similarly dead.

### 4d. Token-cost estimate

| Tool | name | description | schema | dynamic | Total chars |
|---|---|---|---|---|---|
| `challenge_assumption` | 20 | 82 | 104 | 0 | 206 |
| `run_premortem` | 12 | 88 | 109 | 0 | 209 |
| `set_factor_value` | 16 | 62 | 179 | ~60 | 317 |
| `adjust_edge_strength` | 19 | 65 | 163 | 0 | 247 |
| `add_constraint` | 12 | 43 | 258 | 0 | 313 |
| **Total (5 tools, post-analysis)** | | | | | **~1 292 chars / ~325 tokens** |
| Add `run_analysis` if chip-click | 12 | 51 | 68 | 0 | +131 chars / +33 tokens |

For an evaluate stage turn with no analysis present, all 9 eligible actions ship — roughly **~2 350 chars / ~590 tokens** of tools.

Tools are also wrapped by Anthropic's serialisation (each tool produces a JSON object with `name`, `description`, `input_schema` keys, and the tools array sits in the request body), so the actual on-the-wire cost is ~10–15% higher than the raw character count. For budgeting purposes, **call the post-analysis tool surface ~370 tokens**.

---

## Part 5 — Combined Context Assessment

### 5a. Total token budget for one post-analysis turn

| Component | Chars (typical) | Tokens (typical) | Cached? | Notes |
|---|---|---|---|---|
| Static prompt (cf-v28 from PMS) | 57 832 | ~14 458 | YES (ephemeral cache_control) | Paid in full only on first turn after a 5-min cache window |
| Dynamic block (`buildStateSection` + optional disambiguation) | 1 410 | ~355 | NO | Per-turn |
| Tools (5 post-analysis tools serialised) | ~1 480 | ~370 | NO | Per-turn |
| Conversation history (5 user + 5 assistant pairs, ~150 chars each) | ~1 500 | ~375 | NO | Capped at 10 messages |
| **Per-turn input total (cached cold)** | **~62 222** | **~15 558** | | First turn after cache miss |
| **Per-turn input total (cached warm)** | **~4 390** | **~1 100** | | Static block paid as cache hit (~10% of full cost) |
| **Output budget (`max_tokens`)** | — | 2 048 | | Fixed for every turn (`pipeline-v4.ts:314`) |

When the static prompt is cached, the per-turn billable input is **~1 100 tokens** — small enough that token cost is no longer the limiting factor. When the cache is cold (first turn of a session, or after 5-minute idle), it jumps ~14×.

### 5b. Information balance — how much budget goes to each layer

Cached-warm view (the steady state):

| Layer | Tokens | % of warm budget | What it carries |
|---|---|---|---|
| Static prompt (cached) | ~14 458 | (excluded from billable) | Identity, primary rules, coaching plays, examples, JSON contract (dead), action vocabulary (dead) |
| Dynamic block | ~355 | ~32% | Per-turn state |
| Tools | ~370 | ~34% | Action surface |
| History | ~375 | ~34% | Conversation |

Cold view (first turn):

| Layer | Tokens | % of cold budget |
|---|---|---|
| Static prompt | ~14 458 | ~93% |
| Dynamic block | ~355 | ~2% |
| Tools | ~370 | ~2% |
| History | ~375 | ~2% |

**The dominant cost is the static prompt and it is cache-amortised. The dynamic + tools + history together carry the per-turn information delta and they share the budget evenly.**

### 5c. Per-axis ratings (1–5, 5 = excellent)

| Axis | Rating | Justification |
|---|---|---|
| Decision-state freshness | 4 | `analysis_summary` is current-or-absent by contract; the staleness machinery is clean. |
| Calibration grounding | 2 | `robustness_band` enum + `factor_sensitivity.confidence_band` enums are present, but `recommendation_stability` numeric, `sensitivity_concentration`, EVPI, VoI are NOT extracted upstream. The prompt expects them. |
| Provenance & evidence | 1 | Zero provenance fields anywhere. The LLM cannot tell observed from inferred from defaulted, except via the `default_value_count` proxy. |
| Conversational memory | 2 | History is capped at 10 messages, tool_use blocks stripped, no tool_results, no patches, no system events. The LLM has the **text** of the last 5 exchanges and nothing structural. |
| Action surface | 4 | Post-analysis filtering is intentional and well-reasoned (`tool-builder.ts:286–317`). The 5-tool set is small enough to keep `tool_choice: 'auto'` reliable. |
| Tool description quality | 3 | `set_factor_value` enrichment is good. The other 4 are static one-liners; `add_constraint` has the longest schema but the shortest description. |
| Token efficiency | 3 | Static prompt has ~3–4k tokens of dead-instruction debt (JSON contract + action vocabulary). Dynamic block has duplicated `Options:` line and counts-without-IDs that throw away grounding cheaply. |
| Architectural cohesion | 2 | The static prompt teaches a JSON contract the v4 pipeline does not use; the dynamic block exposes structure the static prompt does not reference (and vice versa); the prior audit examined a different code path entirely. The seams show. |

### 5d. Prompt ↔ context alignment gaps

The v28 prompt asks for things the dynamic block does not provide; the dynamic block exposes things the v28 prompt does not navigate. Both are wasted capacity.

| Prompt rule (v28) | Required field | Status in dynamic block |
|---|---|---|
| ROBUSTNESS COACHING (E-values) | `edge_e_values[]` | Rendered when populated, but RARELY populated upstream (ISL gate) |
| INFERENCE WARNING COACHING | `inference_warnings[]` | Rendered when populated; SOMETIMES populated |
| EVIDENCE PRIORITY | `evpi`, `voi_ranking`, `factor_sensitivity` | Only `factor_sensitivity` extracted; EVPI/VoI not in `AnalysisSummary` |
| CONDITIONAL LEAD COACHING | `conditional_winners[]` | Rendered when populated; RARELY populated |
| DOMINANT FACTOR WARNING (>50% rule) | `sensitivity_concentration` | NOT extracted; signal computed via 2× ratio heuristic instead |
| CTA-LITE table (stable / moderate / fragile + separation %) | `recommendation_stability` numeric + winner separation | Only `robustness_band` enum + winner/runner-up percentages → no numeric stability granularity |
| State grounding (`current: false` → "results may not reflect current structure") | `analysis_state.current` flag | NOT exposed; UI staleness contract makes the field implicit (always current or absent) |
| UI awareness ("your gap summary shows…") | gap_summary, model_health | NOT in dynamic block at all |
| GROUND rule ("every claim references model data") | per-factor provenance | No provenance field |
| EVIDENCE_HANDLING (trust boundary) | evidence quality | NOT extracted |

| Dynamic block field | Prompt rule that uses it |
|---|---|
| `entities.nodes[].cap` | (none — dropped by `buildStateSection`) |
| `entities.edges[]` strength + std | (none — only count rendered) |
| `signals.weak_edges[]` IDs | (none — only count rendered) |
| `graph_summary.missing_structural[]` | (none — never rendered) |
| `analysis_summary.constraints_met` | (none — never rendered) |
| `analysis_summary.fragile_edge_count` | (none — only top 3 listed) |
| `conversation.recent_actions_taken/declined` | (none — never rendered) |
| `conversation.last_user_intent` | (none — never rendered) |

---

## Part 6 — Recommendations

Tier-A (token-cheap, structural alignment, no upstream change):

1. **Resolve `analysis_summary.winner` and `runner_up` to labels in `buildStateSection`.** Lines 205–209 print the raw ID. Use `ctx.entities.nodes.get(a.winner)?.label ?? a.winner`. Saves nothing on tokens but fixes a grounding bug visible to the LLM today.
2. **Drop the duplicate `Options:` line.** Either lines 165–167 (label-only) OR lines 184–188 (label+id), not both. Pick label+id; remove label-only.
3. **Fix the `1 weak edges` plural agreement.** Trivial cosmetic, but the LLM mirrors prompt phrasing.
4. **Surface `weak_edges[]` and `high_uncertainty_factors[]` IDs as labels**, capped at 3 each. Currently only counts are shown. The LLM cannot reference them by name.
5. **Surface `graph_summary.missing_structural[]`** when non-empty. It is computed and discarded.
6. **Surface `conversation.recent_actions_taken[]` and `recent_actions_declined[]`** (last 3 of each) so the LLM has structural memory of session actions even with the truncated history.
7. **Surface `blockers[].suggested_action_type`** alongside the reason — it is the actionable hint the COACH rule asks for.
8. **Fix the dominant-factor signal threshold to match the prompt**: the v28 DOMINANT FACTOR WARNING fires at >50% sensitivity, but `turn-context.ts:40 DOMINANT_FACTOR_RATIO = 2.0` fires at "twice the runner-up", which is a different (and weaker) signal. Either change the constant or change the prompt; do not leave them disagreeing.

Tier-B (upstream extraction — requires PLoT/UI cooperation):

9. **Extract `recommendation_stability` (numeric 0–1)** from PLoT into `AnalysisSummary` and render alongside `robustness_band`. The CTA-LITE table needs the numeric to distinguish stable from highly stable.
10. **Extract `sensitivity_concentration` (numeric 0–1)** for the dominant-factor 50% rule.
11. **Extract `evpi` and `voi_ranking`** from PLoT robustness into `AnalysisSummary`. The EVIDENCE PRIORITY play is dead without them.
12. **Add a `provenance` field to `EntityEntry`** distinguishing `'observed' | 'user_set' | 'brief_extracted' | 'inferred' | 'default'`. Render in the entity loop. The GROUND rule cannot be enforced without this.
13. **Forward `analysis_state.current` (boolean)** even though the UI staleness contract makes it usually true. The prompt rule at v28 lines 107–128 wants it.

Tier-C (static prompt — PMS edits):

14. **Enact the four "FLAG FOR PAUL (v31 prompt)" edits** at `prompt-builder-v2.ts:11–17`:
    - Remove the JSON response contract section.
    - Remove the action vocabulary section.
    - Add an explicit tool-use instruction.
    - Remove the "Respond with valid JSON only" suffix.
    Estimated saving: 3 000–4 000 tokens off the static prompt. This is the largest single token win available without changing model behaviour.
15. **Cite the dynamic-block field names by exact heading** in v28 coaching plays so the LLM can navigate them as data, e.g. `"Use the values under '### Key drivers' to ground claims about influence."` Some cf-v28 plays already do this; audit and complete.
16. **Remove or relocate dead coaching plays** that depend on never-extracted fields (EVPI / VoI / PLoT critique) **OR** add the upstream extraction (Tier-B). One or the other; the current state is unfalsifiable.

Tier-D (history & turn parameters):

17. **Stop stripping `tool_use` blocks from prior assistant turns** in `history-filter-v4.ts:141–145`. The synthetic id problem is real, but it is solvable by either using real tool_use_ids end-to-end or by preserving tool_use as `text` blocks that summarise the call. The current behaviour blinds the LLM to its own action history.
18. **Inject a structural turn header** for accepted patches: when a graph_patch is auto-applied, add a tiny synthetic assistant message `[applied: <description>]` so the LLM has session-level memory of what changed. This is opt-in and reversible.
19. **Differentiate `max_tokens` by turn type.** `pipeline-v4.ts:314` hard-codes 2 048 for every turn including draft and analysis. Long-form coaching responses (post-analysis explanation, comparison) routinely exceed this. Set 2 048 default, 4 096 for `explain_result` / `compare_options` / `what_would_flip` chip clicks (or, since those are suppressed, the LLM-narrated equivalents — gate on `ctx.analysis_summary != null && stage === 'evaluate'`).
20. **Add a token-budget telemetry event** `v4.input_token_breakdown` that emits `{ static_chars, dynamic_chars, tools_chars, history_chars, total_estimated_tokens }` per turn. Without it, this audit will be impossible to run again from logs.

### Open question for the user

> The brief asks "What PMS version is currently loaded on staging?" — that fact is in the Supabase `cee_prompts.staging_version` row, not in source. **This audit cannot answer the question by reading code.** Either:
> - share a recent staging Datadog/Loki query for `v4.prompt.pms_loaded` (the log carries `prompt_id`, `version`, `is_staging`), or
> - run `select id, name, active_version, staging_version, updated_at from cee_prompts where name = 'orchestrator';` against staging.
>
> If "v33e content uploaded as PMS version 99" is correct, the source repo has no record of v33e — the prompt body lives only in the database row. That is itself a finding worth recording: the PMS staging version is not version-controlled in this repo.

---

## Appendix A — Verbatim Dynamic Block (Post-Analysis Evaluate Turn)

This is the **exact text** the LLM receives in the per-turn dynamic system block, generated by `prompt-builder-v2.ts:155–311` for a representative scenario. Every line corresponds to a specific code path in `buildStateSection`. The block is concatenated to the static prompt with `\n\n---\n\n` only when there is also a disambiguation section; otherwise the dynamic block IS this text alone.

**Scenario assumptions** (used to populate the simulated `DeterministicTurnContext`):
- Stage: `evaluate`
- Graph: 12 nodes, 14 edges, 3 options, goal "Maximise quarterly revenue"
- Options: `option_raise` ("Raise prices 10%"), `option_hold` ("Hold prices"), `option_lower` ("Lower prices 5%")
- Factors: 4 factor entries with mixed observed values
- Analysis: fresh PLoT result; winner `option_raise` at 52%, runner-up `option_hold` at 38%, robustness `moderate`; 3 factor_sensitivity rows with confidence_bands; 2 fragile_edges; 3 edge_e_values (2 fragile + 1 robust); 2 conditional_winners; 1 inference_warning
- Signals: close_call true, dominant_factor `factor_price_elasticity`, default_value_count 2, weak_edges length 1, high_uncertainty_factors length 2
- Conversation: 4 prior messages, no pending confirmation
- No disambiguation hints

```
## Current Decision State
Stage: **evaluate**
Model: 12 nodes, 14 edges, 3 options
Goal: Maximise quarterly revenue
Options: Raise prices 10%, Hold prices, Lower prices 5%
Factors: Price sensitivity (factor_price_elasticity, observable, value: -1.2 ratio), Customer churn (factor_churn, observable, value: 0.04 monthly), Brand strength (factor_brand, observable, value: 7.2 1-10), Competitor reaction (factor_competitor, external)
Options: Raise prices 10% (option_raise), Hold prices (option_hold), Lower prices 5% (option_lower)

**Analysis Results:**
Winner: option_raise (52%)
Runner-up: option_hold (38%)
Robustness: moderate
Constraint tensions: churn cap risk; minimum margin floor

### Key drivers
- Price sensitivity — influence 42% — confidence: medium
- Customer churn — influence 28% — confidence: low
- Competitor reaction — influence 15% — confidence: low

### Fragile relationships
- Price → Revenue — switch probability 35%
- Churn → LTV — switch probability 22%

### Robustness detail
- Price → Revenue — e-value 1.40 (fragile)
- Churn → LTV — e-value 1.65 (fragile)
- Brand → Conversion — e-value 4.20 (robust)

### Conditional results
- Under high competitor reaction: option_hold (45%)
- Under low churn: option_raise (61%)

### Inference warnings
- MISSING_ROOT_VALUE for factor_competitor — defaulted to zero

Signals: close call (tight margin), dominant factor: Price sensitivity, 2 default values, 1 weak edges, 2 high-uncertainty factors

Conversation: 4 messages
```

**Total: 1 132 characters, ~283 tokens.**

Notes on what is NOT in this block but is in `DeterministicTurnContext` for the same turn:
- `entities.edges[]` (14 entries with `strength_mean`, `strength_std`, `exists_probability`, `effect_direction`)
- `entities.nodes[*].is_action_target`, `aliases`, `cap`
- `graph_summary.missing_structural[]`
- `analysis_summary.constraints_met`, `analysis_summary.fragile_edge_count`
- `signals.weak_edges` (the actual edge IDs — only the count `1` is rendered)
- `signals.high_uncertainty_factors` (the actual factor IDs — only the count `2` is rendered)
- `capabilities` (entire object)
- `eligible_actions` (the full pre-filter action list)
- `blockers[].suggested_action_type`
- `conversation.last_user_intent`, `recent_actions_taken[]`, `recent_actions_declined[]`
- `analysis_inputs` (the exact graph slice fed to PLoT)

And what is NOT in this block, NOT in `DeterministicTurnContext`, but IS expected by the v28 prompt:
- EVPI / VoI ranking
- `recommendation_stability` numeric
- `sensitivity_concentration` numeric
- Per-factor provenance
- Per-edge / per-factor evidence quality
- Per-option intervention completeness
- Per-option readiness status

---

## Appendix B — Files cited

| File | Lines | What it carries |
|---|---|---|
| `~/Documents/GitHub/olumi-assistants-service/src/orchestrator/deterministic/prompt-builder-v2.ts` | 11–17, 39–44, 56–120, 126–149, 155–311 | Static/dynamic split, PMS load, fallback, `buildStateSection`, `buildDisambiguationSection` |
| `~/Documents/GitHub/olumi-assistants-service/src/orchestrator/deterministic/types.ts` | 20–32, 35–44, 55–63, 66–86, 96–107, 110–122, 125–143, 146–153, 155–162, 168–196 | `EntityEntry`, `EdgeEntry`, `GraphSummary`, `AnalysisSummary`, sub-types, `TurnSignals`, `TurnCapabilities`, `ConversationSummary`, `DeterministicTurnContext` |
| `~/Documents/GitHub/olumi-assistants-service/src/orchestrator/deterministic/turn-context.ts` | 40, 50–56, 66–147, 372–555, 598–621 | `DOMINANT_FACTOR_RATIO`, `STAGE_ACTION_POLICY`, `computeTurnContext`, `computeAnalysisSummary`, `extractAnalysisArray` |
| `~/Documents/GitHub/olumi-assistants-service/src/orchestrator/deterministic/tool-builder.ts` | 25, 39–61, 64–72, 227–262, 279–330, 409–467 | `EXCLUDED_ACTIONS`, `POST_ANALYSIS_EXPLANATION_ACTIONS`, `GRAPH_EDIT_ACTIONS`, `buildToolDefinitions`, `computeContextExclusions`, `enrichDescription` |
| `~/Documents/GitHub/olumi-assistants-service/src/orchestrator/deterministic/pipeline-v4.ts` | 88–115, 269, 277, 305–315 | System-event short-circuit, message assembly call site, `system_prompt_chars` telemetry, LLM call params |
| `~/Documents/GitHub/olumi-assistants-service/src/orchestrator/deterministic/history-filter-v4.ts` | 22, 28–36, 57–92, 99–127, 141–145 | `MAX_HISTORY_MESSAGES`, error/synthetic drop, filtering pipeline, XML sanitisation, tool_use stripping |
| `~/Documents/GitHub/olumi-assistants-service/src/orchestrator/prompt-assembly.ts` | 84–131 | `assembleMessages` |
| `~/Documents/GitHub/olumi-assistants-service/src/orchestrator/deterministic/pipeline.ts` | 952–983 | `sanitiseAssistantHistory` (JSON unwrap) |
| `~/Documents/GitHub/olumi-assistants-service/src/orchestrator/deterministic/system-event-handler.ts` | 33–119 | System event types and templates |
| `~/Documents/GitHub/olumi-assistants-service/src/orchestrator/types.ts` | 95, 616–620, 632 | `analysis_state`, `ConversationMessage`, `analysis_response` |
| `~/Documents/GitHub/olumi-assistants-service/src/prompts/loader.ts` | 28–38, 82–94, 109–190, 195–218, 224–252 | `DEFAULT_PROMPTS`, `isPromptManagementEnabled`, `loadPrompt`, `loadDefaultPrompt`, `loadPromptSync` |
| `~/Documents/GitHub/olumi-assistants-service/src/prompts/orchestrator-cf-v28.ts` | 27, 1440 | Template-literal start/end (body 27–1440 = 57 832 chars) |
| `~/Documents/GitHub/olumi-assistants-service/src/prompts/defaults.ts` | 2203 | `registerDefaultPrompt('orchestrator', getOrchestratorPromptV28())` |
| `~/Documents/GitHub/olumi-assistants-service/src/config/index.ts` | 1143–1157 | `shouldUseStagingPrompts` |
| `~/Documents/GitHub/olumi-assistants-service/src/orchestrator/deterministic/actions/run-analysis.ts` | 14–29 | `run_analysis` schema |
| `~/Documents/GitHub/olumi-assistants-service/src/orchestrator/deterministic/actions/explain-result.ts` | 14–31 | `explain_result` schema (excluded post-analysis) |
| `~/Documents/GitHub/olumi-assistants-service/src/orchestrator/deterministic/actions/compare-options.ts` | 12–28 | `compare_options` schema (excluded post-analysis) |
| `~/Documents/GitHub/olumi-assistants-service/src/orchestrator/deterministic/actions/challenge-assumption.ts` | 12–30 | `challenge_assumption` schema |
| `~/Documents/GitHub/olumi-assistants-service/src/orchestrator/deterministic/actions/run-premortem.ts` | 13–31 | `run_premortem` schema |
| `~/Documents/GitHub/olumi-assistants-service/src/orchestrator/deterministic/actions/what-would-flip.ts` | 12–28 | `what_would_flip` schema (excluded post-analysis) |
| `~/Documents/GitHub/olumi-assistants-service/src/orchestrator/deterministic/actions/set-factor-value.ts` | 11–31 | `set_factor_value` schema |
| `~/Documents/GitHub/olumi-assistants-service/src/orchestrator/deterministic/actions/adjust-edge-strength.ts` | 11–31 | `adjust_edge_strength` schema |
| `~/Documents/GitHub/olumi-assistants-service/src/orchestrator/deterministic/actions/add-constraint.ts` | 11–33 | `add_constraint` schema |
| `~/Documents/GitHub/olumi-assistants-service/src/adapters/llm/anthropic.ts` | 2784, 2829–2848, 2864–2870, 2872–2883 | Model default, message conversion, `system_cache_blocks` mapping, SDK call shape |
| `~/Documents/GitHub/DecisionGuideAI/docs/ai-experience-systemic-audit-2026-04-08.md` | §6 | Prior audit (calibration / Zone 2 starvation finding — partly refuted by this audit's Part 2c) |
