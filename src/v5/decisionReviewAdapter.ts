/**
 * decisionReviewAdapter — read `blocks[].enrichment.decision_review` off a V5
 * analysis turn.
 *
 * ## TWO DIFFERENT PAYLOADS SHARE THIS KEY NAME. Read this before editing.
 *
 * 1. **The 0.30 / F.6 shape — THE ONLY ONE CEE PUTS ON A V5 TURN TODAY.**
 *    `{...verbatim gpt-4.1 output, produced_at}`, written by
 *    `orchestrator-v5/coaching/decision-review-enricher.ts`. Eleven keys,
 *    `produced_at` last. No `intent`, no `analysis_state`, no `readiness`
 *    object, no `blocks` array. `readDecisionReviewWireState` handles it.
 *
 * 2. **The M1 REST shape** (`CeeDecisionReviewPayloadV1`:
 *    `intent`/`analysis_state`/`readiness`/`blocks`). Still a LIVE shape *in
 *    this codebase* — `runMeta.ceeReviewV1` is populated by four producers, one
 *    of which delivers REAL (non-synthesised) M1 payloads:
 *    `useResultsRun.ts:113` reads `report.ceeReview` off the PLoT v1 SSE
 *    stream; `useV2Run.ts:906`, `hydrateAnalysis.ts:125` and
 *    `useConversation.ts:3105` synthesise it via `synthesizeCeeReviewFromV2`.
 *    (CEE also serves this shape from `POST /assist/v1/review`, but **no UI
 *    code calls that route** — complete manifest over `src/`, with a positive
 *    control showing the sweep does find `/assist/v1/{draft-graph,ask,
 *    graph-readiness,draft-flows}` — so it is irrelevant to this module.)
 *
 *    What no producer does is emit the M1 shape **into a V5 turn's block
 *    enrichment**, at either upstream tip (PLoT `3d13e0ac`: complete manifest,
 *    PLoT never writes a `decision_review` key at all; CEE `2180702`/#758:
 *    exactly two writers of the wire key, the 0.30 enricher and a `null`
 *    patch). `extractDecisionReview` handles it and is therefore INERT on live
 *    payloads.
 *
 * ## THE FALSE LABEL THIS DOCSTRING REPLACES (ROADMAP 2.154)
 *
 * The previous docstring asserted: *"CEE embeds a `decision_review` key whose
 * shape mirrors CeeDecisionReviewPayloadV1 (the M1 Decision Review payload
 * from PLoT)."* Every clause of that was wrong. CEE embeds the 0.30 shape; it
 * does not come from PLoT; PLoT emits no such key. Because the adapter had
 * only the M1 branch, it returned `null` on **every** live analysis turn —
 * a total, deterministic rejection — and five prose fields costing a real
 * ~8-9s gpt-4.1 call per turn were dropped silently at this boundary. The
 * sibling suite stayed green the whole time because its `validDR` fixture was
 * a hand-written mirror of the retired shape. A green suite certifying a
 * 100%-dead path is the failure mode; the label is what hid it.
 *
 * ## Why the M1 branch is KEPT rather than deleted
 *
 * ⚠ **A PREVIOUS VERSION OF THIS SECTION HAD THE ARGUMENT BACKWARDS** and is
 * withdrawn (A3). It claimed the branch was needed because `applyV5State` uses
 * this adapter to decide whether to CLEAR `runMeta.ceeReviewV1`, and *"a V5
 * analysis turn must be able to evict a prior run's M1 review"*. **Contradicted
 * at the bytes:** eviction does not depend on this branch at all. It happens in
 * two places, both unconditional —
 *   - `applyV5State.ts` `applyDecisionReviewToRunMeta`: on a `v0_30` result,
 *     `ceeReviewV1` is written `null` by the ternary; and
 *   - the caller's `else` arm: when NOTHING is recognised, BOTH review fields
 *     are cleared.
 *
 * Deleting the M1 branch would make eviction **MORE** aggressive, not less: an
 * M1-shaped payload in block enrichment would become `malformed`, fall to the
 * `else` arm, and be cleared. **The branch's real effect is the opposite of what
 * was claimed — it SUPPRESSES eviction for that case**, retaining the payload
 * into `ceeReviewV1` instead of discarding it.
 *
 * The honest rationale is therefore **defensive retention**, and it is weaker
 * than the withdrawn one — recorded as such rather than dressed up:
 *
 * 1. The branch is inert on live payloads, so keeping it costs nothing
 *    observable, and deleting it would also change nothing observable.
 * 2. What deleting it *would* change is the handling of a shape that is still
 *    live in this codebase (four `ceeReviewV1` producers, one of them real —
 *    see above) if it ever reached this seam: instead of being retained, it
 *    would be discarded, `ceeReviewV1` cleared, and only an `aria-hidden`
 *    operator marker would record it. Given that the one residual gap in the
 *    producer sweep is CEE *computed-key* writers into `fact.result.enrichment`
 *    — which a `decision_review\s*:` manifest cannot see — retaining is the
 *    conservative side of an acknowledged unknown.
 * 3. The type and its consumers are what is unambiguously live:
 *    `ceeDataAdapter`, `useResultsSectionData`, `buildV7Bias`,
 *    `DecisionQuality`, `DecisionSummary`, `store`. Retiring this *branch*
 *    would not have retired any of that, so a "retire the dead thing" framing
 *    would have overstated its own scope.
 *
 * The branch's danger was never the code; it was the false docstring above and
 * a test fixture that made the dead shape look like the only shape. Both are
 * fixed, together, in this change.
 *
 * ## The wire has FOUR states, not two
 *
 * CEE distinguishes its two absences deliberately (see
 * `turn-executor.ts::patchRunAnalysisDecisionReviewNull`):
 *
 *   - **absent** (key not set) — the enricher's own soft-fail path, one of
 *     seven documented skips. By design. Not an alarm.
 *   - **degraded** (`decision_review: null`) — review attempted, degraded at
 *     the call site. By design. Not an alarm.
 *   - **populated** — a 0.30 payload (or, inertly, an M1 one).
 *   - **malformed** — a record on the key matching neither shape. THIS is the
 *     alarm, and the only state that should mount an invalid marker.
 *
 * ## Passthrough discipline
 *
 * Every field is type-checked and passed through **verbatim**. Nothing is
 * coerced, defaulted, clamped or rewritten: a wrong-typed field becomes `null`
 * and a wrong-typed array member is dropped. The prose is CEE-authored and has
 * already passed CEE's egress gate — the UI renders it, never edits it.
 */
import type { CeeDecisionReviewPayloadV1, ReviewBlock } from '../types/cee'

const VALID_INTENTS = new Set(['selection', 'prediction', 'validation'])
const VALID_ANALYSIS_STATES = new Set(['not_run', 'ran', 'partial', 'stale'])
const VALID_READINESS_LEVELS = new Set(['ready', 'caution', 'not_ready'])

/**
 * The ten non-timestamp keys of the 0.30 payload, as captured on the live wire
 * (2/2 runs, identical order). Used ONLY as the shape discriminator: a bare
 * `{produced_at}` is a timestamp, not a review, so at least one of these must
 * be present. Five of them are surfaced by this view-model; the other five
 * already reach the UI as `decision_review_enricher` wire blocks and are
 * deliberately NOT re-projected here (they would render twice).
 */
const V0_30_CONTENT_KEYS = [
  'narrative_summary',
  'story_headlines',
  'robustness_explanation',
  'readiness_rationale',
  'evidence_enhancements',
  'scenario_contexts',
  'flip_thresholds',
  'bias_findings',
  'key_assumptions',
  'decision_quality_prompts',
] as const

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** A non-blank string, verbatim; `null` for anything else. Never coerces. */
function prose(v: unknown): string | null {
  if (typeof v !== 'string') return null
  return v.trim() === '' ? null : v
}

/** The string members of an array, in wire order. Non-strings are dropped. */
function stringList(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is string => typeof x === 'string' && x.trim() !== '')
}

/**
 * ⭐ ABSENT AND WRONG-TYPED ARE DIFFERENT ANSWERS — the adversarial review of
 * PR #535 (finding A1) demonstrated on 17 payloads that conflating them
 * INVERTS the alarm.
 *
 * The first cut of this module mapped every unusable value to `null` via
 * `prose()`. That made "the producer did not send this field" (routine,
 * by design, nothing lost) indistinguishable from "the producer sent this
 * field with the wrong type" (a contract break, and the field's entire
 * content is unrenderable). The `V0_30_CONTENT_KEYS.some(k => raw[k] !==
 * undefined)` shape gate admits both, so a payload whose five prose fields
 * were ALL wrong-typed classified as a perfectly healthy
 * `v0_30 { hasProse: false }` and mounted **no marker** — five fields
 * silently discarded with the lamp dark, which is the very defect 2.154
 * exists to fix, reappearing for the type-error case. Meanwhile a merely
 * missing `produced_at` — which costs the user nothing — lit it.
 *
 * So a read of a SINGLETON field now returns one of three answers, and
 * `readV0_30` routes the third to `malformed`.
 *
 * Scope of the strictness, deliberately bounded:
 *   - **Strict** at the five fields this view-model surfaces and at
 *     `robustness_explanation`'s own four fields. Every one is a singleton,
 *     so dropping it is a TOTAL, SILENT loss of that field with no signal
 *     left on screen.
 *   - **Lenient** inside the per-item collections (`story_headlines` values,
 *     `scenario_contexts` entries, and the factor-array members): a dropped
 *     item is a PARTIAL loss and it is countable — the remaining rows still
 *     render, so the payload is degraded rather than mute. One malformed
 *     headline out of four must not blank the other three.
 *   - **Silent** for the five 0.30 keys this view-model does NOT project
 *     (`evidence_enhancements`, `flip_thresholds`, `bias_findings`,
 *     `key_assumptions`, `decision_quality_prompts`). They reach the UI via
 *     the enricher wire blocks, and validating a field this module neither
 *     reads nor renders would light the lamp for a surface it does not own.
 *
 * `undefined` AND `null` both count as ABSENT: explicit `null` is the
 * idiomatic JSON way to say "no value here", not a type error. A present,
 * correctly-typed but blank/whitespace string is likewise NOT a type error —
 * it is a producer emitting no content, so it reads as absent content.
 */
type FieldRead<T> =
  /** Key not sent (or explicitly null) — legitimate. */
  | { ok: true; value: null }
  /** Key sent and well-typed. */
  | { ok: true; value: T }
  /** Key sent with the WRONG TYPE — a contract break; caller → malformed. */
  | { ok: false }

function absent(v: unknown): v is undefined | null {
  return v === undefined || v === null
}

/** Strict singleton string. */
function readProseField(v: unknown): FieldRead<string> {
  if (absent(v)) return { ok: true, value: null }
  if (typeof v !== 'string') return { ok: false }
  return { ok: true, value: v.trim() === '' ? null : v }
}

/** Strict singleton record (container kind only — members stay lenient). */
function readRecordField(v: unknown): FieldRead<Record<string, unknown>> {
  if (absent(v)) return { ok: true, value: null }
  if (!isRecord(v)) return { ok: false }
  return { ok: true, value: v }
}

/** Strict array container; its MEMBERS are filtered leniently. */
function readStringListField(v: unknown): FieldRead<string[]> {
  if (absent(v)) return { ok: true, value: null }
  if (!Array.isArray(v)) return { ok: false }
  return { ok: true, value: stringList(v) }
}

// ── The 0.30 view-model ────────────────────────────────────────────────────

/** `decision_review.robustness_explanation`, projected field-for-field. */
export interface DecisionReviewRobustnessExplanation {
  summary: string | null
  primary_risk: string | null
  stability_factors: ReadonlyArray<string>
  fragility_factors: ReadonlyArray<string>
}

/** One entry of `decision_review.story_headlines` (a per-option record). */
export interface DecisionReviewStoryHeadline {
  /** The wire's own key. An option_id on live payloads; treated as opaque. */
  optionId: string
  headline: string
}

/** One entry of `decision_review.scenario_contexts` (a per-trigger record). */
export interface DecisionReviewScenarioContext {
  /**
   * The wire's own key — a node-pair id such as
   * `out_cost_efficiency->goal_crm_value`. It is NOT stable across runs (the
   * two captured runs carry different key sets), so it is opaque: used for
   * identity only, never parsed and never rendered as copy.
   */
  id: string
  trigger_description: string | null
  consequence: string | null
}

/**
 * The five prose fields of CEE's 0.30 `decision_review` that no other wire
 * block delivers. This is a UI VIEW-MODEL, deliberately its own type: it is
 * never cast to `CeeDecisionReviewPayloadV1`, which is a different payload
 * with a different producer and a different consumer set.
 */
export interface DecisionReview030 {
  narrative_summary: string | null
  story_headlines: ReadonlyArray<DecisionReviewStoryHeadline>
  robustness_explanation: DecisionReviewRobustnessExplanation | null
  readiness_rationale: string | null
  scenario_contexts: ReadonlyArray<DecisionReviewScenarioContext>
  /** The V5-added timestamp. Verbatim; the UI does not format or parse it. */
  produced_at: string
  /**
   * True when at least one of the five fields carries renderable prose. A
   * valid review can legitimately carry none (the LLM may return empty
   * collections) — that is an honest empty, NOT malformed input, so callers
   * must gate rendering on this rather than on validity.
   */
  hasProse: boolean
}

/** The four states `enrichment.decision_review` can be in on a live turn. */
export type DecisionReviewWireState =
  /** Key not set — one of the enricher's seven documented soft-fail skips. */
  | { kind: 'absent' }
  /** `decision_review: null` — attempted, degraded at the call site. */
  | { kind: 'degraded' }
  /** A record on the key matching neither shape. The only alarm state. */
  | { kind: 'malformed' }
  /** The live CEE shape. */
  | { kind: 'v0_30'; review: DecisionReview030 }
  /** The M1 REST shape. Inert on live payloads — see the header. */
  | { kind: 'm1'; review: CeeDecisionReviewPayloadV1 }

/**
 * Strict on the container kind AND on its own four singleton fields; lenient
 * on the factor-array MEMBERS. A wrong-typed `summary` is a silent total loss
 * of that line, so it is a contract break; a wrong-typed member of
 * `stability_factors` costs one bullet out of several and the rest still
 * render.
 */
function readRobustnessExplanation(
  v: unknown,
): FieldRead<DecisionReviewRobustnessExplanation> {
  const container = readRecordField(v)
  if (!container.ok) return { ok: false }
  if (container.value === null) return { ok: true, value: null }

  const summary = readProseField(container.value.summary)
  const primaryRisk = readProseField(container.value.primary_risk)
  const stability = readStringListField(container.value.stability_factors)
  const fragility = readStringListField(container.value.fragility_factors)
  if (!summary.ok || !primaryRisk.ok || !stability.ok || !fragility.ok) {
    return { ok: false }
  }

  const stabilityList = stability.value ?? []
  const fragilityList = fragility.value ?? []
  if (
    summary.value === null &&
    primaryRisk.value === null &&
    stabilityList.length === 0 &&
    fragilityList.length === 0
  ) {
    // Well-typed but carrying nothing — absent content, not a contract break.
    return { ok: true, value: null }
  }
  return {
    ok: true,
    value: {
      summary: summary.value,
      primary_risk: primaryRisk.value,
      stability_factors: stabilityList,
      fragility_factors: fragilityList,
    },
  }
}

/** Strict on the container kind; lenient per item (a dropped row is countable). */
function readStoryHeadlines(v: unknown): FieldRead<DecisionReviewStoryHeadline[]> {
  const container = readRecordField(v)
  if (!container.ok) return { ok: false }
  if (container.value === null) return { ok: true, value: null }

  const out: DecisionReviewStoryHeadline[] = []
  // Object key order is the wire order. Not sorted: any reordering would be a
  // UI transform over producer-ranked data.
  for (const [optionId, headline] of Object.entries(container.value)) {
    const text = prose(headline)
    if (text !== null) out.push({ optionId, headline: text })
  }
  return { ok: true, value: out }
}

/** Strict on the container kind; lenient per entry. */
function readScenarioContexts(v: unknown): FieldRead<DecisionReviewScenarioContext[]> {
  const container = readRecordField(v)
  if (!container.ok) return { ok: false }
  if (container.value === null) return { ok: true, value: null }

  const out: DecisionReviewScenarioContext[] = []
  for (const [id, entry] of Object.entries(container.value)) {
    if (!isRecord(entry)) continue
    const trigger = prose(entry.trigger_description)
    const consequence = prose(entry.consequence)
    // An entry carrying neither field has nothing to render, so it is not an
    // entry. Emitting it would produce an empty row.
    if (trigger === null && consequence === null) continue
    out.push({ id, trigger_description: trigger, consequence })
  }
  return { ok: true, value: out }
}

/**
 * Three outcomes, not two — see the `FieldRead` header for why conflating the
 * last two inverts the alarm.
 *
 *   `not_v0_30`   — does not look like a 0.30 payload; caller may try M1.
 *   `type_error`  — IS 0.30-shaped, but a field this view-model renders was
 *                   sent with the wrong type. Caller → `malformed`.
 *   the review    — usable, though possibly carrying no prose.
 */
type V0_30Read =
  | { outcome: 'ok'; review: DecisionReview030 }
  | { outcome: 'not_v0_30' }
  | { outcome: 'type_error' }

function readV0_30(raw: Record<string, unknown>): V0_30Read {
  // The produced_at + content-key pair is the SHAPE discriminator, and it is
  // deliberately unchanged by the A1 fix: a payload that fails it is not being
  // judged as a broken 0.30 review, it is being judged as not a 0.30 review at
  // all, which is what lets the M1 branch still get a look.
  const producedAt = prose(raw.produced_at)
  if (producedAt === null) return { outcome: 'not_v0_30' }
  if (!V0_30_CONTENT_KEYS.some((k) => raw[k] !== undefined)) {
    return { outcome: 'not_v0_30' }
  }

  const narrative = readProseField(raw.narrative_summary)
  const readiness = readProseField(raw.readiness_rationale)
  const robustness = readRobustnessExplanation(raw.robustness_explanation)
  const headlines = readStoryHeadlines(raw.story_headlines)
  const scenarios = readScenarioContexts(raw.scenario_contexts)

  // ANY of the five sent with the wrong type is a contract break. Failing here
  // rather than nulling the field is the whole point: a null would render as
  // "the producer sent nothing", with no alarm, and the field's content would
  // be lost in silence.
  if (!narrative.ok || !readiness.ok || !robustness.ok || !headlines.ok || !scenarios.ok) {
    return { outcome: 'type_error' }
  }

  const headlineList = headlines.value ?? []
  const scenarioList = scenarios.value ?? []
  return {
    outcome: 'ok',
    review: {
      narrative_summary: narrative.value,
      story_headlines: headlineList,
      robustness_explanation: robustness.value,
      readiness_rationale: readiness.value,
      scenario_contexts: scenarioList,
      produced_at: producedAt,
      hasProse:
        narrative.value !== null ||
        readiness.value !== null ||
        robustness.value !== null ||
        headlineList.length > 0 ||
        scenarioList.length > 0,
    },
  }
}

/**
 * Classify `enrichment.decision_review`. This is the function render and state
 * callers should use: it separates the two by-design absences from the one
 * genuine alarm, which the previous `extractDecisionReview`-returns-null API
 * could not express.
 *
 * ## ⭐ SHAPE PRECEDENCE IS STRICT-M1-FIRST, AND IT IS LOAD-BEARING (A2)
 *
 * An earlier revision of this docstring claimed *"the two shapes are disjoint
 * in practice (the M1 payload carries no top-level `produced_at`), so the order
 * is not load-bearing"*. That claim was **withdrawn — it was exactly the claim
 * that needed a pin, and it was false.**
 *
 * `CeeDecisionReviewPayloadV1` has an **open index signature**, and the UI's own
 * consumers rely on real M1 payloads carrying extra keys —
 * `useResultsSectionData.ts:2780-2782` reads `ceeReviewV1.bias_findings`,
 * `.quality_factors`, `.improvement_guidance`. **`bias_findings` is one of the
 * ten `V0_30_CONTENT_KEYS`.** So under 0.30-first, an M1 payload carrying
 * `bias_findings` plus *any* top-level `produced_at` satisfied the 0.30 shape
 * gate, classified `v0_30`, and made `extractDecisionReview` return `null` —
 * **silently dropping a real M1 review.** That is this module's own headline
 * defect reappearing through a different door.
 *
 * Strict M1 is therefore checked FIRST, because its structure is far more
 * specific and is implausible for a 0.30 payload: it requires `intent` in a
 * three-value enum, `analysis_state` in a four-value enum, a `readiness` record
 * with a string `level` in a three-value enum plus a string `headline` plus an
 * array `factors`, AND a `blocks` array whose every member carries string
 * `id`/`status`/`source`/`summary` and a numeric `priority`. **Verified at the
 * bytes rather than assumed:** the two captured live 0.30 payloads carry
 * `intent`, `analysis_state`, `readiness` and `blocks` all `undefined` (pinned
 * in `decisionReviewAdapter.wire030.spec.ts`), so M1-first cannot steal a live
 * 0.30 payload. Both directions of the precedence are pinned there.
 */
export function readDecisionReviewWireState(
  enrichment: Record<string, unknown> | undefined,
): DecisionReviewWireState {
  if (!enrichment) return { kind: 'absent' }

  const raw = enrichment.decision_review
  // Key not set, or set to undefined — the enricher's soft-fail path.
  if (raw === undefined) return { kind: 'absent' }
  // CEE's explicit degraded marker. Distinct from absent, by CEE's own
  // docstring; neither is an alarm.
  if (raw === null) return { kind: 'degraded' }
  if (!isRecord(raw)) return { kind: 'malformed' }

  // STRICT M1 FIRST — see the precedence section above. Do not reorder these
  // two blocks without re-reading it; the order is the fix for A2.
  const m1 = validateM1Payload(raw)
  if (m1) return { kind: 'm1', review: m1 }

  const v030 = readV0_30(raw)
  if (v030.outcome === 'ok') return { kind: 'v0_30', review: v030.review }
  // 0.30-shaped but type-broken → the alarm. M1 has already been tried and
  // failed above, so there is nothing left to fall through to.
  if (v030.outcome === 'type_error') return { kind: 'malformed' }

  return { kind: 'malformed' }
}

// ── The M1 REST shape (inert on live payloads — see the header) ────────────

function validateReviewBlock(raw: unknown): ReviewBlock | null {
  if (!isRecord(raw)) return null
  if (typeof raw.id !== 'string') return null
  if (typeof raw.status !== 'string') return null
  if (typeof raw.source !== 'string') return null
  if (typeof raw.summary !== 'string') return null
  if (typeof raw.priority !== 'number') return null
  // Pass through — the panel handles optional fields (items, details, etc.)
  return raw as unknown as ReviewBlock
}

function validateM1Payload(raw: Record<string, unknown>): CeeDecisionReviewPayloadV1 | null {
  const intent = raw.intent
  const analysisState = raw.analysis_state
  const readiness = raw.readiness
  const blocks = raw.blocks

  if (typeof intent !== 'string' || !VALID_INTENTS.has(intent)) return null
  if (typeof analysisState !== 'string' || !VALID_ANALYSIS_STATES.has(analysisState)) return null

  if (!isRecord(readiness)) return null
  if (typeof readiness.level !== 'string' || !VALID_READINESS_LEVELS.has(readiness.level)) return null
  if (typeof readiness.headline !== 'string') return null
  if (!Array.isArray(readiness.factors)) return null

  if (!Array.isArray(blocks)) return null
  const validatedBlocks: ReviewBlock[] = []
  for (const b of blocks) {
    const vb = validateReviewBlock(b)
    if (!vb) return null
    validatedBlocks.push(vb)
  }

  return {
    ...raw, // preserve extra fields via index signature
    intent: intent as CeeDecisionReviewPayloadV1['intent'],
    analysis_state: analysisState as CeeDecisionReviewPayloadV1['analysis_state'],
    readiness: readiness as unknown as CeeDecisionReviewPayloadV1['readiness'],
    blocks: validatedBlocks,
  }
}

/**
 * Return a validated `CeeDecisionReviewPayloadV1` when
 * `enrichment.decision_review` carries the **M1 REST** shape; `null`
 * otherwise — including on the 0.30 payload CEE actually sends today, which
 * is a different payload and is read by `readDecisionReviewWireState`.
 *
 * Validation is deliberately lenient: each field is checked for presence and
 * primitive type, not exhaustive schema conformance.
 *
 * ⚠ A `null` from this function means "no M1 payload here". It does **not**
 * mean the turn carried no decision review, and it must **not** be used to
 * mount an invalid-enrichment marker — that inference is exactly the bug
 * ROADMAP 2.154 fixed. Use `readDecisionReviewWireState` for that question.
 */
export function extractDecisionReview(
  enrichment: Record<string, unknown> | undefined,
): CeeDecisionReviewPayloadV1 | null {
  const state = readDecisionReviewWireState(enrichment)
  return state.kind === 'm1' ? state.review : null
}
