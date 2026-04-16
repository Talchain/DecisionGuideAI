# Text Flow Audit Follow-ups — Self-Review

**Reviewer:** Claude (Opus 4.6)
**Date:** 2026-04-06
**Scope:** Brief "Cross-Service: Text Flow Audit Follow-ups"
**Repos audited:**
- `DecisionGuideAI` (UI) — branch `staging`, commit `593af460` "feat(rationale): CEE V3 per-node and per-operation rationale surfacing"
- `olumi-assistants-service` (CEE) — branch `staging`, commit `f7151b54` "fix(cee): harden V3 egress schemas, validate rationales, strip internal fields"

**Verification commands run:**
- UI: `npx vitest run src/canvas/components/__tests__/RationaleTooltip.spec.tsx src/canvas/components/__tests__/nodeRationales.store.spec.ts` → 7/7 pass
- CEE: `npx vitest run tests/integration/cee.schema-v3.test.ts tests/unit/cee.v3-passthrough.test.ts` → 80/80 pass

> **Headline:** Implementation is functionally complete but contains **multiple deviations from the brief's exact prescriptions** and **two missed items** (A4 file location, B2 test). All deviations preserve or improve the intended behaviour, but they should be acknowledged before sign-off.

---

## Part 1: Requirement-by-requirement compliance

### CEE — `olumi-assistants-service` commit `f7151b54`

| Task | Requirement | Status | Evidence |
|------|------------|--------|----------|
| **A1a** | NodeV3 has 6 new optional fields: `prior`, `factor_type`, `extractionType`, `uncertainty_drivers`, `intercept`, `display_value` | **DONE** | `src/schemas/cee-v3.ts:120-130`. All six fields declared as `.optional()`. Note: spec also added `interventions` (L134) and `is_baseline` (L136) for option-kind nodes — bonus declarations. |
| **A1b** | EdgeV3 has `defaulted: z.boolean().optional()` | **DONE** | `src/schemas/cee-v3.ts:192` |
| **A1c** | CEEGraphResponseV3 has `draft_warnings`, `analysis_ready`, `rationales` | **DONE** | `src/schemas/cee-v3.ts:457-466` (draft_warnings), `:468` (analysis_ready), `:470-474` (rationales) |
| **A1d** | `.passthrough()` removed from NodeV3, EdgeV3, CEEGraphResponseV3 (replaced with default `.strip()` behaviour) | **DONE** | `src/schemas/cee-v3.ts:137` (NodeV3), `:193` (EdgeV3), `:500` (CEEGraphResponseV3). Each ends with bare `})` and explicit "CIL Phase 1: declared fields only" comment. |
| **A1d** | `warnOnUnknownV3Fields()` utility exists and is **called before/during parse** on the three egress schemas | **PARTIAL — DEVIATED** | Utility defined at `src/schemas/cee-v3.ts:558-576`. It is exercised by the integration test suite but **never called from production code**. `boundary.ts:177` calls `CEEGraphResponseV3.safeParse(v3Body)` directly without first calling `warnOnUnknownV3Fields`. Drift is therefore silent in production logs. (See Part 6, Decision 1.) |
| **A1d** | `.passthrough()` retained on ObservedStateV3, EdgeProvenanceV3, InterventionV3, OptionV3, GraphMetaV3, trace | **DONE** | Verified all six lines: ObservedStateV3 `:74`, EdgeProvenanceV3 `:152`, InterventionV3 `:270`, OptionV3 `:330`, GraphMetaV3 `:412`, trace `:499`. Also retained on TargetMatch `:215`, OptionProvenanceV3 `:281`, and the `prior` nested object `:120`. |
| **A2a** | Coaching sub-object `.passthrough()` removed at both levels | **DONE (in egress only)** | `src/schemas/cee-v3.ts:443-452` — coaching wrapper and `strengthen_items` items both bare `z.object`. **NOT removed** from `src/schemas/assist.ts:168-177` (V1 internal pipeline schema), which retains `.passthrough()` at both levels. This is intentional per the egress-hardening framing of the brief but should be confirmed: if the brief intended *all* coaching schemas, this is **PARTIAL**. |
| **A2b** | `GoalConstraintSchema` `.passthrough()` removed | **DONE** | `src/schemas/assist.ts:109-134`. Schema definition ends with bare `})` and "CIL Phase 1: strip unknown fields" comment. |
| **A3** | Rationale carrythrough added in `schema-v3.ts` after causal_claims block | **DONE** | `src/cee/transforms/schema-v3.ts:947-965`. Carrythrough lives directly after the `causal_claims` carrythrough block at L942-945. |
| **A3** | `why` field capped at 500 characters via `.slice(0, 500)` | **DONE** | `src/cee/transforms/schema-v3.ts:957` — `String(r.why ?? r.rationale ?? r.text ?? "").slice(0, 500)` |
| **A3** | Defensive filtering: entries missing `target` or `why` are excluded | **DONE** | `src/cee/transforms/schema-v3.ts:954-960`. Filters non-objects, then maps with fallback field names (`target` ← `target` \| `node_id` \| `id`, `why` ← `why` \| `rationale` \| `text`), then filters empty strings. Exceeds spec by accepting alternate field names. |
| **A3** | `provenance_source` added to LLMDraftResponse rationale schema | **DONE (bonus)** | `src/adapters/llm/shared-schemas.ts:131` — third optional field `provenance_source: z.string().optional()`. Surfaced in V3 schema response too (`cee-v3.ts:473`) and passed through carrythrough (`schema-v3.ts:958`). |
| **A4** | `explainer_default` and `bias_check_default` removed from `data/prompts.json` | **MISSED — DEVIATED** | Both entries still present at `data/prompts.json` lines 235 and 273 (verified via `git show HEAD:data/prompts.json | grep`). The implementation took a different approach: **deprecation comments added** in `src/prompts/defaults.ts:2193-2196` and `src/adapters/llm/prompt-loader.ts:108-109`. The brief explicitly required removal from `data/prompts.json`. |
| **A4** | `CeeTaskIdSchema`, `PROMPT_TASKS`, model routing, config all UNTOUCHED | **DONE** | The deprecation comments are non-functional; entries remain in `OPERATION_TO_TASK_ID` and the prompt registry. No call sites changed. |

### UI — `DecisionGuideAI` commit `593af460`

| Task | Requirement | Status | Evidence |
|------|------------|--------|----------|
| **B1a** | V3 response type includes `rationales?: Array<{ target: string; why: string; provenance_source?: string }>` | **DONE** | `src/adapters/cee/types.ts:426-427` on `CEEv3Response` interface |
| **B1b** | `adaptDraftResponse()` passes through rationales | **DONE** | `src/adapters/cee/client.ts:157-160`. Uses `(result as Record<string, unknown>).rationales = draft.rationales` (cast because `CEEDraftResponse` doesn't yet declare the field on the V2 type — minor type smell). |
| **B1c** | Canvas store has `nodeRationales: Record<string, string>` state and `setNodeRationales` action | **DONE** | `src/canvas/store.ts:313` (state), `:552` (action signature), `:1007` (initial value), `:1946` (reset value), `:2980-2986` (action implementation) |
| **B1d** | `DraftChat.tsx` calls `setNodeRationales()` after nodes created | **DEVIATED** | `src/canvas/components/DraftChat.tsx:751-758`. Implementation builds the map inline and writes via `metadataPatch.nodeRationales` on a batched `useCanvasStore.setState(metadataPatch)` call **rather than calling the `setNodeRationales` action**. The action exists but is unused outside of tests. Functionally equivalent (single batched setState avoids 6+ extra render cycles per the file comment), but bypasses the action layer. |
| **B1e** | `RationaleTooltip.tsx` exists, **wraps existing Tooltip**, reads from store, renders conditionally | **PARTIAL — DEVIATED** | `src/canvas/components/RationaleTooltip.tsx` exists. Reads from store: ✓ (`:21`). Renders conditionally: ✓ (`:42` returns `children` when no rationale). **Does NOT wrap the existing `Tooltip` component** at `src/canvas/components/Tooltip.tsx` — instead it duplicates the cloneElement / hover-state / Escape-dismiss / aria-describedby logic. ~80 lines of near-duplicated tooltip plumbing. |
| **B1f** | BaseNode label wrapped with `<RationaleTooltip nodeId={id}>` | **DONE** | `src/canvas/nodes/BaseNode.tsx:364-370`. The flex-1 label container is wrapped. Note this means hovering the label area (not the whole node) triggers the tooltip — consistent with the brief intent. |
| **B1g** | Info icon (HelpCircle, 16px, `text-text-light`) added to `FactorControllablePanel`, `FactorObservablePanel`, `FactorExternalPanel`, `OutcomePanel` — only when rationale exists | **DEVIATED** | Verified via `grep HelpCircle src/canvas/ui/inspector-v2/panels/` → no matches. The icon is added **once** in `src/canvas/ui/inspector-v2/InspectorShell.tsx:99-115` (centralised at the shell level so it applies to ALL inspector panels, not just the four named factor/outcome panels). 16px ✓, `text-text-light` ✓, gated on `rationale` truthiness ✓. The deviation is arguably a quality improvement (one place vs four duplicated patches), but it differs from the brief's explicit file list and exposes the icon on edge panels too — `nodeId` is optional on `InspectorShellProps` (`types.ts:50`) and `useCanvasStore` lookup gracefully returns undefined for edges, so no false positives in practice. |
| **B2a** | `GraphPatchBlock` type includes `operation_meta?: Array<{ impact: string; rationale: string }>` | **DONE** | `src/canvas/conversation/types.ts:253-254` |
| **B2b** | `InlineBlocks.tsx` extracts `block.provenance?._meta?.operation_meta` and pairs by index | **DEVIATED** | `src/canvas/conversation/InlineBlocks.tsx:929` extracts `block.operation_meta` directly (top-level on the block), NOT from `block.provenance?._meta?.operation_meta`. Source path differs:<br>- `useConversation.ts:736` reads `dataObj.operation_meta` (top-level on the orchestrator block payload)<br>- `hydrateThread.ts:69` reads `base.operation_meta`<br>Pairing by index: ✓ (`InlineBlocks.tsx:1083`, `:1123` use `operationMeta[index]?.rationale`). The deviation matters because if CEE actually nests the field under `provenance._meta`, the UI will not find it — and conversely, if CEE places it top-level, the UI will, but the brief contract is broken. **This is a contract drift risk that needs cross-team confirmation.** |
| **B2c** | Expandable rationale uses DS v5 §19 pattern: "More"/"Less" with ChevronDown/ChevronUp, border-left indent | **DONE** | `src/canvas/conversation/InlineBlocks.tsx:97-118`. `OperationRationale` component:<br>- "More" / "Less" labels (sentence case) ✓<br>- ChevronDown / ChevronUp 12px icons ✓<br>- `border-l-2 border-panel-border pl-3 mt-2` ✓<br>- Typography: `typography.panelMeta` + `text-text-light` ✓ |

---

## Part 2: Design system compliance

| # | Rule | New/modified components | Verdict |
|---|------|------------------------|---------|
| 1 | **Typography tokens only** | `RationaleTooltip` uses `typography.bodySmall`. `OperationRationale` uses `typography.panelMeta`. `InspectorShell` HelpCircle wrapper does not introduce raw text classes; the rationale paragraph at `:111` uses `typography.panelMeta`. | **COMPLIANT** |
| 2 | **Sentence case** | "Why this element was included" (InspectorShell title/aria-label), "More"/"Less" (OperationRationale), no all-caps anywhere. | **COMPLIANT** |
| 3 | **No em dashes** | Searched all four touched files for `—`: zero matches in user-visible strings. (Em dashes appear in source comments, which is fine.) | **COMPLIANT** |
| 4 | **No ampersands** | Zero `&` in user-facing strings across the four touched files. | **COMPLIANT** |
| 5 | **British English** | "Why this element was included", "More", "Less" — neutral. No US-only spellings introduced. | **COMPLIANT** |
| 6 | **Lucide icons only** | `HelpCircle` (Lucide), `ChevronUp`/`ChevronDown` (Lucide). No emoji, no custom SVG. | **COMPLIANT** |
| 7 | **Coaching tone** | "Why this element was included" — neutral, no Failed/Error/Cannot/Blocked/Must/Required. The rationale text itself is LLM-generated and outside DS scope. | **COMPLIANT** |

**Caveat:** The HelpCircle icon button has no visible label — it relies on `title` and `aria-label` ("Why this element was included"). This is consistent with other inspector chrome in the codebase but worth noting for screen-reader audit completeness.

---

## Part 3: Test coverage

### Tests added (CEE — `f7151b54`)

| Test name | File | Asserts | Real fixture? |
|-----------|------|---------|---------------|
| `strips undeclared fields from NodeV3 during parse` | `tests/integration/cee.schema-v3.test.ts` | Unknown `llm_invented_field` is removed; declared fields preserved | Hand-crafted minimal node |
| `strips undeclared fields from EdgeV3 during parse` | same | Unknown `llm_extra` is removed | Hand-crafted minimal edge |
| `warnOnUnknownV3Fields detects undeclared fields and calls logFn` | same | Logs `cee.v3_schema.unknown_fields_stripped` event with `unknownKeys` array | Hand-crafted node with `unknown_a`, `unknown_b` |
| `preserves all newly declared NodeV3 fields through parse` | same | All 6 A1a fields (prior/factor_type/extractionType/uncertainty_drivers/intercept/display_value) survive parse | Hand-crafted external factor |
| `carries rationales from V1 to V3 response` | same | Two rationales (one with provenance_source) round-trip via `transformResponseToV3` | Built on top of `sampleV1Response` (golden-style fixture, defined at top of file) |
| `omits rationales when V1 has empty array` | same | `v3Response.rationales === undefined` when input is `[]` | `sampleV1Response` + override |
| `filters out malformed rationales missing target or why` | same | 5 inputs (1 valid, 1 missing target, 1 missing why, 1 null, 1 alternate field names) → 2 in output | `sampleV1Response` + override |
| `caps rationale why text at 500 characters` | same | 800-char input → output length === 500 | Synthetic |
| `NodeV3 accepts interventions and is_baseline on option-kind nodes` | `tests/unit/cee.v3-passthrough.test.ts` | Bonus declarations work | Hand-crafted |
| `NodeV3 accepts all declared metadata fields` | same | A1a fields parse successfully | Hand-crafted |
| Existing tests **rewritten**: `NodeV3 strips extra fields`, `EdgeV3 strips extra fields`, `CEEGraphResponseV3 strips extra top-level fields` | `tests/unit/cee.v3-passthrough.test.ts` | Inverted from "preserves" to "strips" | Hand-crafted |

### Tests added (UI — `593af460`)

| Test name | File | Asserts | Real fixture? |
|-----------|------|---------|---------------|
| `RationaleTooltip > renders tooltip on hover when rationale exists` | `src/canvas/components/__tests__/RationaleTooltip.spec.tsx` | Hover renders tooltip role + text | Direct store.setState |
| `RationaleTooltip > renders children only when no rationale for node` | same | Hover does NOT show tooltip when nodeRationales empty | Direct store.setState |
| `RationaleTooltip > hides tooltip on mouse leave` | same | mouseLeave clears tooltip | Direct store.setState |
| `RationaleTooltip > auto-dismisses after 5 seconds` | same | Fake timers + advance 5s | Direct store.setState |
| `nodeRationales store > setNodeRationales populates map from array` | `src/canvas/components/__tests__/nodeRationales.store.spec.ts` | Action populates expected shape | Direct |
| `nodeRationales store > filters out entries with missing target or why` | same | Empty target/why entries dropped | Direct |
| `nodeRationales store > overwrites previous rationales on second call` | same | Second call replaces map | Direct |

### Brief target vs. delivered

- **5 CEE tests required** → **10 added** (8 new + 2 inverted-from-preserves-to-strips). All pass.
- **3 UI tests required** → **7 added** (4 RationaleTooltip + 3 store). All pass.
- **Tests beyond brief:** the bonus interventions/is_baseline test and the extra `setNodeRationales` overwrite/filter tests. Justification: the implementation surface is larger than the brief envisaged (option-kind node fields, store reset semantics) and the additional tests catch real edge cases.
- **Real/golden fixture data:** CEE rationale tests build on `sampleV1Response`, which is the existing fixture pattern in `cee.schema-v3.test.ts`. The strip-behaviour tests use minimal hand-crafted objects (acceptable for schema unit tests). UI tests use direct store seeding (acceptable for store/component unit tests).

### **Coverage gap**

- **No test for B2 (`InlineBlocks.tsx` per-operation rationale rendering).** The `OperationRationale` component, the `operation_meta` extraction, and the index-pairing logic are all completely untested. This is the largest test debt in the implementation.

---

## Part 4: Risk assessment

### 1. Breaking changes

The strip-mode change on `NodeV3` / `EdgeV3` / `CEEGraphResponseV3` is a **silent semantic change**: any consumer that previously relied on a passthrough field surviving Zod parse will now find that field missing. The CEE PR rewrote the existing `cee.v3-passthrough.test.ts` "preserves extra fields" assertions to "strips extra fields" — this is the only place that pinned the previous behaviour, so no other in-repo CEE tests should regress. **However**, several places that previously passed `as any` casts now use typed access (per the commit message: "Remove as-any casts in V3 transform"). If any *production* code path in CEE relied on a now-stripped field that was not declared in A1, it would silently lose data on or after `f7151b54`. The `boundary.ts` stage uses `parseResult.data` (the stripped version), so any LLM/upstream-pipeline field not in A1's enumeration is now permanently lost at the egress boundary.

UI side: zero risk to existing tests. The new RationaleTooltip wraps BaseNode label inline; the BaseNode test suite renders the same DOM and the wrapper is a no-op when `nodeRationales` is empty.

### 2. Schema migration drop risk

Specific concerns about fields the brief did NOT enumerate but downstream UI may want:

- `goal_threshold_*` fields — declared (NodeV3 lines 107-113). ✓
- `encoding_map` — declared (NodeV3 line 117). ✓
- `interventions` / `is_baseline` — declared (NodeV3 lines 134/136, beyond brief). ✓
- `validation` on EdgeV3 — declared (line 190 as `z.any()`). ✓
- `origin`, `edge_type` on EdgeV3 — declared (lines 184, 186). ✓
- **Concern**: any LLM-emitted node-level field that the V3 transform was relying on passthrough to forward (e.g. future fields added to the LLM prompt without simultaneously updating the schema) will now be **silently dropped** at the egress boundary, **without a log line** because `warnOnUnknownV3Fields` is not wired into production code (see A1d above).

### 3. Passthrough retained

✅ **Confirmed retained** on ObservedStateV3 (`:74`), EdgeProvenanceV3 (`:152`), TargetMatch (`:215`), InterventionV3 (`:270`), OptionProvenanceV3 (`:281`), OptionV3 (`:330`), GraphMetaV3 (`:412`), trace (`:499`), and the inline `prior` object (`:120`). None of the listed schemas had `.passthrough()` accidentally removed.

### 4. Graceful degradation (rationales absent)

✅ **Confirmed graceful**:
- `RationaleTooltip` returns `children` directly (no wrapper, no behaviour) when `nodeRationales[id]` is undefined (`RationaleTooltip.tsx:42`).
- `InspectorShell` HelpCircle button is wrapped in `{rationale && (...)}` (`InspectorShell.tsx:101`) — invisible when no rationale.
- `InlineBlocks` `OperationRationale` is wrapped in `{operationMeta[index]?.rationale && ...}` (`InlineBlocks.tsx:1083, 1123`) — never renders for ops without rationale.
- The `adaptDraftResponse` rationale passthrough is gated on `Array.isArray(draft.rationales) && draft.rationales.length > 0`, so the field is simply absent (not null) when CEE omits it.
- Pre-A3 deployment: CEE returns no `rationales` field → adapter no-op → store stays `{}` → tooltips/icons never render. No crashes.

### 5. Store cleanup on new draft

✅ **Correct**:
- The action `setNodeRationales` (`store.ts:2980-2986`) and the inline patch in `DraftChat.tsx:752-758` both **construct a fresh object and replace** the entire `nodeRationales` map. No accumulation.
- A new draft → a new `metadataPatch` → fresh `nodeRationales` overwrite. Stale rationales from a previous draft cannot leak.
- Workspace reset path (`store.ts:1946`) explicitly sets `nodeRationales: {}`.
- ⚠️ **Minor concern**: if a new draft response *omits* `rationales`, the `metadataPatch.nodeRationales` is not set (only set when `rawRationales.length > 0`), so the previous draft's rationales persist on the new graph. This would be visible only if (a) the previous draft had rationales and (b) the new draft does not and (c) any new node ID happens to collide with an old one. Low risk in practice but worth a one-line clear.

---

## Part 5: Staging replay readiness

| Check | Verifiable locally? | Status |
|-------|---------------------|--------|
| Generate model from a pricing brief → V3 response includes non-empty `rationales[]` | No — requires running pipeline against real LLM | Code path verified: LLM emits `rationales`, `LLMDraftResponse` schema accepts them (incl. `provenance_source`), V1→V3 carrythrough copies them, CEEGraphResponseV3 declares them. **All four hops are wired.** Cannot prove LLM actually emits without staging replay. |
| Hover canvas node → tooltip shows rationale text | Yes (manual + spec) | ✓ Verified by `RationaleTooltip.spec.tsx > renders tooltip on hover when rationale exists` (passes). End-to-end visual depends on adapter wiring (verified at `DraftChat.tsx:751-758`). |
| Edit graph → confirmation shows expandable rationale per operation | **Partially** | The rendering code path is wired (`InlineBlocks.tsx:97-118` + `:1083` + `:1123`), but no test exists, AND the source path (`block.operation_meta` top-level vs the brief's `block.provenance?._meta?.operation_meta`) differs from the brief contract. **Cannot confirm without verifying the actual edit_graph response shape from CEE.** |
| V3 response with undeclared field → field absent from API response + warning in server logs | **Partially** | Field absent: ✓ verified by tests. **Warning in logs: ✗** — `warnOnUnknownV3Fields` is defined and tested in isolation but **never called from boundary.ts** or any other production path. Drift will be silent in production. |
| Generate model from a brief with no constraints → `rationales` is absent or empty array, not null, no crash | Yes | ✓ Verified by `omits rationales when V1 has empty array` (passes) — V3 transform sets `v3Response.rationales = undefined` when input is empty. No null path; no crash path. |

---

## Part 6: Assumptions and deviations

### Decision 1 — `warnOnUnknownV3Fields` not wired into production

**Decided:** Define and unit-test the helper, but do not call it from `boundary.ts` before the `safeParse`.

**Why (inferred from the commit):** The strip behaviour is the production safety net; the warn is a developer aid. Wiring it in would require deciding on log severity, throttling, and where in the boundary stage to call it for each of the three schemas (response level + node loop + edge loop). The author appears to have prioritised the schema correctness over the observability hook.

**Alternative considered:** Wire it into `boundary.ts` immediately before line 177's `safeParse`, iterating over `v3Body.nodes` and `v3Body.edges` in addition to the response root. This would add ~15 lines and a per-request log volume cost.

**Impact on brief compliance:** Brief explicitly asks the utility to be "called before/during parse". This is **PARTIAL** as marked. Recommend a follow-up to wire it in before staging replay if observability is required.

### Decision 2 — `RationaleTooltip` reimplements rather than wraps `Tooltip`

**Decided:** Hand-roll a near-identical clone of `Tooltip` instead of wrapping it.

**Why:** The existing `Tooltip` component takes `content: string` and renders it inside a custom shell. To wrap it, the rationale lookup would need to happen *outside* and the result passed in as `content`, which means rendering the wrapper unconditionally and depending on Tooltip's internal hover-state to gate visibility. The hand-rolled version fully bypasses Tooltip when no rationale exists (the no-op `if (!rationale) return children` at `:42`), avoiding any wrapper DOM at all. This is faster but duplicates ~60 lines of cloneElement / Escape / aria-describedby logic.

**Alternative considered:** Lift the no-op gate to the call site (`<BaseNode>...{rationale && <Tooltip content={rationale}>...</Tooltip>}...</BaseNode>`). This would require BaseNode itself to read from the store, which is what we wanted to avoid by encapsulating it in `RationaleTooltip`.

**Impact on brief compliance:** Brief explicitly says "wraps existing Tooltip". This is **DEVIATED**. Functionally identical to the brief intent.

### Decision 3 — Inspector HelpCircle centralised in InspectorShell, not added to four panels

**Decided:** Add the HelpCircle button once in `InspectorShell.tsx` (which all four named panels render through) instead of in `FactorControllablePanel`, `FactorObservablePanel`, `FactorExternalPanel`, `OutcomePanel` separately.

**Why:** All four panels render through `InspectorShell` via `InspectorRouter`. Adding it once at the shell layer:
- avoids 4× duplicated state, lookup, and JSX
- automatically inherits any future inspector-shell styling changes
- guarantees consistent placement

**Cost:** The button now also appears on edge inspectors and decision/option/risk inspectors. Mitigated by `nodeId` being optional on `InspectorShellProps` and the `useCanvasStore` selector returning undefined for any element without a rationale, so the button never renders for edges or non-rationaled elements.

**Alternative considered:** Add the button to each of the four panels as the brief specified. Strictly more code, identical user-visible effect.

**Impact on brief compliance:** **DEVIATED**. Quality improvement, but a deviation from the literal file list.

### Decision 4 — `DraftChat` uses inline `metadataPatch`, not the `setNodeRationales` action

**Decided:** Build the `nodeRationales` map inline in `DraftChat.tsx` and write it via `useCanvasStore.setState(metadataPatch)` along with all the other CEE metadata, instead of calling the dedicated `setNodeRationales` action.

**Why:** The file comment at `DraftChat.tsx:760` explains: "Single batched setState for non-side-effect metadata — avoids 6+ separate render cycles". The action exists for store-spec testability but isn't used in the hot path.

**Alternative considered:** Call `setNodeRationales(rawRationales)` after the batched `setState`. Adds one extra render commit; otherwise identical.

**Impact on brief compliance:** **DEVIATED**. The action is dead code in production but is tested by `nodeRationales.store.spec.ts`. Not reachable from real flows.

### Decision 5 — `operation_meta` source path differs from brief contract

**Decided:** Read `operation_meta` from `dataObj.operation_meta` (top-level on the conversation block) instead of `block.provenance?._meta?.operation_meta`.

**Why:** Unknown — the commit doesn't justify this. Inspecting `useConversation.ts:736` shows `dataObj` is the orchestrator block payload, so the implementation expects CEE to emit `operation_meta` as a top-level block field, not nested under provenance metadata.

**Alternative considered:** The brief contract (`block.provenance?._meta?.operation_meta`) — the nested path suggests the field was meant to live alongside other internal `_meta` provenance metadata.

**Impact on brief compliance:** **DEVIATED — and this is a contract risk.** If the CEE side emits `operation_meta` under `provenance._meta`, the UI will not find it. If the CEE side emits it top-level, the UI will, but the brief contract is violated. **Needs cross-team confirmation against the actual CEE edit_graph response shape before staging replay.** No CEE-side emission code was inspected as part of this audit.

### Decision 6 — A4 (`explainer_default`/`bias_check_default`) deprecated rather than deleted

**Decided:** Mark both prompt entries as DEPRECATED in `src/prompts/defaults.ts` and `src/adapters/llm/prompt-loader.ts` with explanatory comments, instead of removing from `data/prompts.json`.

**Why (per commit message):** "Mark explainer/bias_check prompt entries as deprecated (no callers)". The author chose to leave the entries in place to preserve "prompt-store schema completeness" and noted they should be removed when the task IDs are retired from `PROMPT_TASKS`.

**Alternative considered:** The brief approach — actually delete from `data/prompts.json`. This would break the prompt-store schema if any test or migration relies on the entries existing.

**Impact on brief compliance:** **MISSED** for the literal requirement. Deviation is more conservative than the brief; the entries will still be loaded into the registry but no code path can reach them.

### Decision 7 — Bonus declarations on NodeV3

**Decided:** Beyond the 6 fields the brief required, also declare `interventions` and `is_baseline` on NodeV3 for option-kind display nodes.

**Why (per commit message):** "Add interventions + is_baseline to NodeV3 for option-kind display nodes". These were previously surviving via `.passthrough()`; once that was removed they would have been silently stripped from option-kind nodes used for canvas display.

**Alternative considered:** Declare them only on a separate `OptionDisplayNode` schema. More type-safe but requires more refactoring.

**Impact on brief compliance:** Bonus — does not violate the brief, but extends the surface area and requires the bonus tests in Part 3.

---

## Summary

| | Done | Partial | Deviated | Missed |
|-|------|---------|----------|--------|
| **CEE A1** | A1a (with bonus), A1b, A1c, A1d (passthrough removal) | A1d (warn-fn wiring) | — | — |
| **CEE A2** | A2b | A2a (egress only, V1 untouched) | — | — |
| **CEE A3** | All sub-items | — | — | — |
| **CEE A4** | task-id/routing untouched | — | A4 (deprecation instead of deletion) | A4 file location |
| **UI B1** | B1a, B1b, B1c, B1f | B1e (lookup-only wrap) | B1d, B1e, B1g | — |
| **UI B2** | B2a, B2c | — | B2b (path) | B2 test |
| **DS compliance** | All 7 rules | — | — | — |

**Tests:** 80/80 CEE schema tests pass, 7/7 UI rationale tests pass.

**Blocking concerns before staging replay:**
1. **B2 contract drift** — `operation_meta` source path needs cross-team confirmation against CEE edit_graph response shape. If CEE emits under `provenance._meta`, the UI per-operation rationale will silently not render.
2. **Silent schema drift** — `warnOnUnknownV3Fields` is unwired, so any new LLM field will be stripped without log evidence. Either wire it in or accept the observability gap.
3. **A4 file deletion** — if the brief's "remove from `data/prompts.json`" was load-bearing (e.g. some downstream tooling reads `data/prompts.json` directly), the deprecation comments won't satisfy it.

**Non-blocking but worth follow-up:**
4. No test for `OperationRationale` rendering or `operation_meta` extraction (B2).
5. `setNodeRationales` action is dead code in production — either delete or wire it in for consistency.
6. `RationaleTooltip` reimplements `Tooltip`-internal logic — consider refactoring to share the cloneElement plumbing.
7. Stale rationale risk: if a new draft omits `rationales`, the previous draft's map is not cleared. One-line fix: always set `metadataPatch.nodeRationales = {}` when rawRationales is empty/missing.
