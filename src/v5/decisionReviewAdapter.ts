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
 *    this codebase*.
 *
 *    ⚠ **The producer manifest below was wrong TWICE — it named a dead site as
 *    live and omitted the real writer.** Corrected by tracing each candidate to
 *    the store boundary rather than to a variable name (A6). What actually
 *    reaches `runMeta.ceeReviewV1`:
 *
 *    | site | route | reaches runMeta? | payload |
 *    |---|---|---|---|
 *    | `useResultsRun.ts:159` (value from `:113`) | `setRunMeta` | **YES** | **REAL M1**, off the PLoT v1 SSE stream — the only non-synthesised source |
 *    | `useV2Run.ts:1055` (value from `:906`) | `setRunMeta` | **YES** | synthesised |
 *    | `hydrateAnalysis.ts:154` | → `useScenario.ts:673` → `resultsHydrateFromSupabase` → the `...hydratedRunMeta` spread at `store.ts:3466` | **YES** | synthesised, from persisted V2 |
 *    | `useConversation.ts:3112` | `resultsComplete` | **NO — DEAD** | discarded at `store.ts:3012`: destructured `ceeReviewV1: _ceeReviewV1` and never read |
 *    | `useV2Run.ts:994` | `resultsComplete` | **NO — DEAD** | same boundary. Note `useV2Run` writes on BOTH lists — dead at `:994`, live at `:1055` |
 *
 *    So: **three live producers, one of them real** — not the "four" an earlier
 *    revision claimed, and not the set it named. `useResultsRun.ts:60` and
 *    `useV2Run.ts:483` also write via `setRunMeta`, but only `null` (resets).
 *
 *    (CEE also serves this shape from `POST /assist/v1/review`, but **no UI code
 *    calls that route** — complete manifest over `src/`, where it appears only in
 *    comments, with a positive control showing the sweep does find
 *    `/assist/v1/{draft-graph,ask,graph-readiness,draft-flows}`. True
 *    server-side; inert here.)
 *
 *    What no producer does is emit the M1 shape **into a V5 turn's block
 *    enrichment**, at either upstream tip (PLoT `3d13e0ac`: complete manifest,
 *    PLoT never writes a `decision_review` key at all; CEE `2180702`/#758:
 *    exactly two writers of the wire key, the 0.30 enricher and a `null`
 *    patch). `validateM1Payload` below handles it and is therefore INERT on live
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
 * **The rationale reduces to ONE reason, and it is weak.** The completion
 * reviewer went further than reading the code — they DELETED this branch and ran
 * the suites: **every eviction test stayed green**, confirming eviction lives
 * entirely in the `v0_30` arm and the caller's `else` arm. So the following are
 * NOT reasons to keep it, and are recorded here only so nobody re-derives them
 * as such:
 *   - *not* eviction (disproved above, twice);
 *   - *not* "the type and its consumers are live" — true (`ceeDataAdapter`,
 *     `useResultsSectionData`, `buildV7Bias`, `DecisionQuality`,
 *     `DecisionSummary`, `store`), but they are fed by the producers listed
 *     above, none of which route through this branch. Deleting the branch would
 *     not have touched any of them.
 *
 * **The one reason that survives:** the producer sweep has a named residual gap —
 * CEE *computed-key* writers into `fact.result.enrichment` (`enrichment[someVar]
 * = …`), which a `decision_review\s*:` pattern manifest cannot see. If such a
 * writer exists and emits the M1 shape, this branch retains the payload; without
 * it the payload would be discarded, `ceeReviewV1` cleared, and the only record
 * would be an `aria-hidden` operator marker. Retention is the conservative side
 * of an acknowledged unknown — and that is the whole of the argument.
 *
 * If that gap is ever closed and comes back empty, **delete this branch**; the
 * reviewer has already demonstrated the deletion is clean.
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
import { EnrichmentDecisionReviewSchema } from '@talchain/schemas/boundary'
import type { CeeDecisionReviewPayloadV1, ReviewBlock } from '../types/cee'
import { isRecord } from '../lib/guards'

const VALID_INTENTS = new Set(['selection', 'prediction', 'validation'])
const VALID_ANALYSIS_STATES = new Set(['not_run', 'ran', 'partial', 'stale'])
const VALID_READINESS_LEVELS = new Set(['ready', 'caution', 'not_ready'])

/**
 * The five 0.30 fields THIS view-model projects and renders — the orphans that
 * no other wire block delivers.
 */
export const V0_30_PROJECTED_KEYS = [
  'narrative_summary',
  'story_headlines',
  'robustness_explanation',
  'readiness_rationale',
  'scenario_contexts',
] as const

/**
 * The five 0.30 fields that already reach the UI as `decision_review_enricher`
 * wire blocks (5 × `review_card`, 4 × `coaching`, 2 × `evidence` on the captured
 * runs). **This module must never render them** — they would appear twice.
 *
 * Exported so the non-duplication guard can be DERIVED from this list rather
 * than from a hand-typed set of example strings. An earlier version of that
 * guard named three literal strings from one fixture while its title claimed
 * six fields, and `flip_thresholds`/`bias_findings` — `[]` in both live
 * fixtures — were unguarded entirely: planting a render of them stayed green.
 * A guard that names examples tests the examples; a guard that iterates the
 * list tests the rule.
 */
export const V0_30_ENRICHER_OWNED_KEYS = [
  'evidence_enhancements',
  'flip_thresholds',
  'bias_findings',
  'key_assumptions',
  'decision_quality_prompts',
] as const

/**
 * The ten non-timestamp keys of the 0.30 payload, as captured on the live wire
 * (2/2 runs). Used ONLY as the shape discriminator: a bare `{produced_at}` is a
 * timestamp, not a review, so at least one of these must be present.
 *
 * COMPOSED from the two halves above rather than listed a third time, so a key
 * cannot be a content key while belonging to neither half — a new 0.30 field
 * has to be classified as projected-here or owned-elsewhere before it can
 * participate in the discriminator at all.
 */
const V0_30_CONTENT_KEYS = [
  ...V0_30_PROJECTED_KEYS,
  ...V0_30_ENRICHER_OWNED_KEYS,
] as const

/**
 * ⭐ A-1 — THE SHAPE DISCRIMINATOR IS BOUND TO THE CONTRACT, NOT HAND-ROLLED.
 *
 * `produced_at` is this module's discriminator: it is the field that decides
 * whether a payload is judged as a 0.30 review at all (`readV0_30`). A
 * hand-rolled `typeof raw.produced_at === 'string'` would keep compiling if the
 * contract renamed or retyped the pin, and the failure would be SILENT and
 * TOTAL — every live payload reclassified `not_v0_30`, then `malformed`, which
 * is precisely the whole-payload drop ROADMAP 2.154 exists to have fixed. The
 * repo's #1 hazard is schema skew (CLAUDE.md hazard 1), and a discriminator is
 * the worst possible place to carry a second, private declaration of it.
 *
 * `.pick({produced_at: true})` binds it: a rename or retype upstream becomes a
 * COMPILE error here rather than a behavioural one. Follows the live precedent
 * in `voi/voiRanking.ts` (`EnrichmentFactorEvppiEntrySchema.pick`), whose own
 * docstring names hand-rolled `typeof` checks "a SECOND definition of the row
 * contract in a repo whose #1 hazard is schema skew".
 *
 * ⚠ SCOPE, AND WHY IT IS THIS NARROW. `EnrichmentDecisionReviewSchema` declares
 * `produced_at` and NOTHING ELSE — it is `.passthrough()`, so the five prose
 * fields this view-model renders have nothing to bind to and their hand-rolled
 * readers below are FORCED, not a choice. The trichotomy (absent / `null` /
 * record) is likewise already declared by the contract, at the parent:
 * `decision_review: EnrichmentDecisionReviewSchema.nullable().optional()`. So
 * this binding buys exactly one thing — the discriminator — and claims no more.
 *
 * The parse is deliberately `safeParse` at the call site rather than a throw:
 * a missing/blank `produced_at` is a legitimate "not a 0.30 payload" answer that
 * must still let the M1 branch have its look, not an exception.
 */
const DecisionReviewDiscriminatorSchema = EnrichmentDecisionReviewSchema.pick({
  produced_at: true,
})

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
 * `v0_30 { hasProse: false }` and mounted **no marker** — the very defect
 * 2.154 exists to fix, reappearing for the type-error case. Meanwhile a merely
 * missing `produced_at` — which costs the user nothing — lit it.
 *
 * **Precisely what was and was not silent** (an earlier version of this note
 * said "silently discarded", which over-claimed): the USER still got a signal
 * either way, because `hasProse: false` leaves
 * `decision_review_unavailable` firing in `useResultCompleteness` — "Decision
 * coaching is still being prepared for this analysis". What went dark was the
 * **operator** marker, which is the only witness that distinguishes "the
 * producer sent nothing" from "the producer sent something broken". So the
 * defect was a *misdiagnosis* signal, not a wholly absent one: the user was
 * told the review was still coming when it had in fact arrived malformed, and
 * nothing anywhere recorded the contract break.
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
 *     (2.466 nuance: `decision_quality_prompts` is now additionally CARRIED
 *     verbatim on the view-model for the results key-question card — still
 *     silent here, still never rendered by this module; the carry field's own
 *     docstring holds the policy and its rationale.)
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

/**
 * A COLLECTION read. Deliberately NOT `FieldRead<T[]>`: there is no null arm,
 * because no consumer of these three readers distinguishes "the key was absent"
 * from "the key held an empty list" — every one of them asks only `.length > 0`,
 * and the render surface treats both as "no rows".
 *
 * The null arm used to exist and was paid for FOUR times, once per call site, as
 * a `?? []` coalesce. Every coalesce is a place where a future reader could
 * forget it and get `null.length`; collapsing the arm makes that unrepresentable
 * rather than merely currently-correct. The strictness that MATTERS is untouched:
 * a wrong-typed CONTAINER is still `{ok: false}` → `malformed`, which is the
 * whole point of the `FieldRead` header above. What went is a distinction nobody
 * consumed, not a distinction that guarded anything.
 */
type ListRead<T> = { ok: true; value: T[] } | { ok: false }

function absent(v: unknown): v is undefined | null {
  return v === undefined || v === null
}

/**
 * Strict singleton string. The blankness rule is `prose()`'s, not restated:
 * "present, correctly-typed but blank reads as absent content" is one policy and
 * it belongs to one function.
 */
function readProseField(v: unknown): FieldRead<string> {
  if (absent(v)) return { ok: true, value: null }
  if (typeof v !== 'string') return { ok: false }
  return { ok: true, value: prose(v) }
}

/** Strict singleton record (container kind only — members stay lenient). */
function readRecordField(v: unknown): FieldRead<Record<string, unknown>> {
  if (absent(v)) return { ok: true, value: null }
  if (!isRecord(v)) return { ok: false }
  return { ok: true, value: v }
}

/** Strict array container; its MEMBERS are filtered leniently. */
function readStringListField(v: unknown): ListRead<string> {
  if (absent(v)) return { ok: true, value: [] }
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
  /**
   * ROADMAP 2.466 — the RAW `decision_quality_prompts` wire entries, carried
   * VERBATIM for the results-surface key-question card (`KeyQuestionCard`,
   * lens-hero posture) to map via the single mapping site,
   * `components/results/utils/decisionQualityPrompts.mapDecisionQualityPrompts`.
   *
   * This is a CARRY, not a projection: the key stays in
   * `V0_30_ENRICHER_OWNED_KEYS`, this module still renders none of it, and the
   * decision-review card's non-duplication guard keeps its meaning unchanged.
   * (Before this field, the live V5 path DROPPED the prompts at this boundary
   * — `runMeta.decisionReview030` was the only live-path retention that reaches
   * the results surface, and it omitted them — so the product asked
   * science-grounded key questions on the wire and showed the user none of
   * them: the 2026-08-04 walk-train finding.)
   *
   * Policy is deliberately LENIENT, not the A1 strictness: absent, `null` and
   * a wrong-typed container all read as `[]`, never `malformed`. Escalating a
   * wrong-typed container would refuse the WHOLE payload — vaporising the five
   * prose fields other surfaces already render — to alarm about a key whose
   * sole consumer fails soft (the card simply does not mount). Note strictness
   * would not even save that consumer: refusal nulls `decisionReview030`, so
   * the card loses the data either way. Member-level honesty (id-gating,
   * closed-vocabulary strength, sanitisation) lives in the mapper, where the
   * A1-equivalent decisions for THIS field belong.
   */
  decision_quality_prompts: ReadonlyArray<unknown>
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

  if (
    summary.value === null &&
    primaryRisk.value === null &&
    stability.value.length === 0 &&
    fragility.value.length === 0
  ) {
    // Well-typed but carrying nothing — absent content, not a contract break.
    return { ok: true, value: null }
  }
  return {
    ok: true,
    value: {
      summary: summary.value,
      primary_risk: primaryRisk.value,
      stability_factors: stability.value,
      fragility_factors: fragility.value,
    },
  }
}

/** Strict on the container kind; lenient per item (a dropped row is countable). */
function readStoryHeadlines(v: unknown): ListRead<DecisionReviewStoryHeadline> {
  const container = readRecordField(v)
  if (!container.ok) return { ok: false }
  if (container.value === null) return { ok: true, value: [] }

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
function readScenarioContexts(v: unknown): ListRead<DecisionReviewScenarioContext> {
  const container = readRecordField(v)
  if (!container.ok) return { ok: false }
  if (container.value === null) return { ok: true, value: [] }

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
 * The 0.30 view-model, or `null` when this payload is not a usable 0.30 review.
 *
 * ⚠ THIS USED TO RETURN A THREE-OUTCOME UNION (`ok` / `not_v0_30` /
 * `type_error`) AND THE THIRD ARM WAS PURE OVERHEAD BY THE TIME IT LANDED.
 * The union was written when 0.30 was tried FIRST, so a caller genuinely had to
 * tell "not this shape, go try M1" from "this shape, broken". The A2 fix moved
 * M1 ahead of 0.30 (`readDecisionReviewWireState`, see its precedence section)
 * and the sole caller has mapped BOTH non-ok arms to `malformed` ever since —
 * two names, three lines of dispatch, one behaviour.
 *
 * ⚠ WHAT IS NOT LOST, because it would matter if it were: the STRICTNESS is
 * untouched. A field this view-model renders arriving wrong-typed still refuses
 * the whole payload and still lights the operator marker, which is the A1 fix and
 * the reason `FieldRead` distinguishes absent from wrong-typed at all (see its
 * header). Only the caller-facing LABEL on the refusal is gone, and the caller
 * never branched on it.
 */
function readV0_30(raw: Record<string, unknown>): DecisionReview030 | null {
  // The produced_at + content-key pair is the SHAPE discriminator: it decides
  // whether this payload is judged as a 0.30 review at all, rather than judged
  // as a broken one. `produced_at` is read through the CONTRACT (see
  // `DecisionReviewDiscriminatorSchema`), not a hand-rolled typeof.
  const parsed = DecisionReviewDiscriminatorSchema.safeParse(raw)
  const producedAt = parsed.success ? prose(parsed.data.produced_at) : null
  if (producedAt === null) return null
  if (!V0_30_CONTENT_KEYS.some((k) => raw[k] !== undefined)) return null

  const narrative = readProseField(raw.narrative_summary)
  const readiness = readProseField(raw.readiness_rationale)
  const robustness = readRobustnessExplanation(raw.robustness_explanation)
  const headlines = readStoryHeadlines(raw.story_headlines)
  const scenarios = readScenarioContexts(raw.scenario_contexts)

  // ANY of the five sent with the wrong type is a contract break. Refusing the
  // payload rather than nulling the field is the whole point: a null would render
  // as "the producer sent nothing", with no alarm, and the field's content would
  // be lost in silence.
  if (!narrative.ok || !readiness.ok || !robustness.ok || !headlines.ok || !scenarios.ok) {
    return null
  }

  return {
    narrative_summary: narrative.value,
    story_headlines: headlines.value,
    robustness_explanation: robustness.value,
    readiness_rationale: readiness.value,
    scenario_contexts: scenarios.value,
    // 2.466 carry — verbatim, lenient by documented policy (see the field's
    // docstring); NOT a hasProse input and NOT part of the shape gate beyond
    // its existing membership of V0_30_CONTENT_KEYS.
    decision_quality_prompts: Array.isArray(raw.decision_quality_prompts)
      ? raw.decision_quality_prompts
      : [],
    produced_at: producedAt,
    hasProse:
      narrative.value !== null ||
      readiness.value !== null ||
      robustness.value !== null ||
      headlines.value.length > 0 ||
      scenarios.value.length > 0,
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
  if (v030) return { kind: 'v0_30', review: v030 }

  // A record on the key that neither branch could use. M1 has already been tried
  // and failed above, so there is nothing left to fall through to — and BOTH
  // reasons `readV0_30` can refuse (not 0.30-shaped, or 0.30-shaped but
  // type-broken) land here identically. That is why it returns a nullable rather
  // than a labelled union: this line is the only consumer, and it never branched.
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

/*
 * ⚠ `extractDecisionReview` USED TO BE EXPORTED FROM HERE AND IS DELETED.
 *
 * It was a one-line projection of `readDecisionReviewWireState` —
 * `state.kind === 'm1' ? state.review : null` — with **zero production callers**
 * at the tip that removed it (complete manifest over `src/`: the only remaining
 * mentions are prose in this file, in `V5AnalysisResultBlock.tsx`, and in
 * `ContractIntegrityTab.tsx`'s note about the same-named local it renamed away
 * from). Its two specs kept calling it, which is what made it look live.
 *
 * ⚠ THE DANGER IT CARRIED IS THE REASON IT IS GONE, NOT ITS LINE COUNT. Its own
 * docstring had to warn, in bold, that a `null` from it must NEVER be read as
 * "the turn carried no decision review" — because that exact inference IS the
 * ROADMAP 2.154 defect: the card mounted an invalid-enrichment marker on every
 * live turn by treating this function's `null` as malformed-ness. A zero-caller
 * export whose contract needs a warning about the bug it already caused once is
 * a loaded gun in a drawer.
 *
 * The M1 BRANCH ITSELF STAYS (`validateM1Payload` above, reached by
 * `readDecisionReviewWireState`). That branch is a documented conservative call
 * against a named residual gap in the producer sweep — see the header's
 * "Why the M1 branch is KEPT" section — and the M1 coverage that used to run
 * through this wrapper now runs through a one-line local helper in
 * `__tests__/decisionReviewAdapter.test.ts`, so the branch is tested through the
 * public API every real caller uses.
 */
