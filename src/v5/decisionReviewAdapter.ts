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
 *    `intent`/`analysis_state`/`readiness`/`blocks`). Still a LIVE platform
 *    shape — CEE serves it from `POST /assist/v1/review` — but **nothing emits
 *    it into a V5 turn's block enrichment**, at either upstream tip
 *    (PLoT `3d13e0ac`: complete manifest, PLoT never writes a `decision_review`
 *    key at all; CEE `2180702`/#758: exactly two writers of the wire key, the
 *    0.30 enricher and a `null` patch). `extractDecisionReview` handles it and
 *    is therefore INERT on live payloads.
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
 * It is inert on live payloads, so deleting it would change nothing live — but
 * deleting it is not free. `applyV5State` uses this adapter to decide whether
 * to CLEAR `runMeta.ceeReviewV1`, and that clear IS load-bearing: `ceeReviewV1`
 * has live non-V5 producers (`synthesizeCeeReviewFromV2` via `useV2Run`,
 * `hydrateAnalysis`, `useConversation`), so a V5 analysis turn must be able to
 * evict a prior direct/V2 run's real M1 review. Removing the branch would mean
 * replacing that with an unconditional null-write — a behaviour change with no
 * defect motivating it. The branch's danger was never the code; it was the
 * false docstring above and a test fixture that made the dead shape look like
 * the only shape. Both are fixed, together, in this change.
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

function readRobustnessExplanation(v: unknown): DecisionReviewRobustnessExplanation | null {
  if (!isRecord(v)) return null
  const summary = prose(v.summary)
  const primaryRisk = prose(v.primary_risk)
  const stability = stringList(v.stability_factors)
  const fragility = stringList(v.fragility_factors)
  if (summary === null && primaryRisk === null && stability.length === 0 && fragility.length === 0) {
    return null
  }
  return {
    summary,
    primary_risk: primaryRisk,
    stability_factors: stability,
    fragility_factors: fragility,
  }
}

function readStoryHeadlines(v: unknown): DecisionReviewStoryHeadline[] {
  if (!isRecord(v)) return []
  const out: DecisionReviewStoryHeadline[] = []
  // Object key order is the wire order. Not sorted: any reordering would be a
  // UI transform over producer-ranked data.
  for (const [optionId, headline] of Object.entries(v)) {
    const text = prose(headline)
    if (text !== null) out.push({ optionId, headline: text })
  }
  return out
}

function readScenarioContexts(v: unknown): DecisionReviewScenarioContext[] {
  if (!isRecord(v)) return []
  const out: DecisionReviewScenarioContext[] = []
  for (const [id, entry] of Object.entries(v)) {
    if (!isRecord(entry)) continue
    const trigger = prose(entry.trigger_description)
    const consequence = prose(entry.consequence)
    // An entry carrying neither field has nothing to render, so it is not an
    // entry. Emitting it would produce an empty row.
    if (trigger === null && consequence === null) continue
    out.push({ id, trigger_description: trigger, consequence })
  }
  return out
}

function readV0_30(raw: Record<string, unknown>): DecisionReview030 | null {
  const producedAt = prose(raw.produced_at)
  if (producedAt === null) return null
  if (!V0_30_CONTENT_KEYS.some((k) => raw[k] !== undefined)) return null

  const narrative = prose(raw.narrative_summary)
  const readiness = prose(raw.readiness_rationale)
  const robustness = readRobustnessExplanation(raw.robustness_explanation)
  const headlines = readStoryHeadlines(raw.story_headlines)
  const scenarios = readScenarioContexts(raw.scenario_contexts)

  return {
    narrative_summary: narrative,
    story_headlines: headlines,
    robustness_explanation: robustness,
    readiness_rationale: readiness,
    scenario_contexts: scenarios,
    produced_at: producedAt,
    hasProse:
      narrative !== null ||
      readiness !== null ||
      robustness !== null ||
      headlines.length > 0 ||
      scenarios.length > 0,
  }
}

/**
 * Classify `enrichment.decision_review`. This is the function render and state
 * callers should use: it separates the two by-design absences from the one
 * genuine alarm, which the previous `extractDecisionReview`-returns-null API
 * could not express.
 *
 * The 0.30 branch is tried first. The two shapes are disjoint in practice (the
 * M1 payload carries no top-level `produced_at`), so the order is not
 * load-bearing — but 0.30 is the live shape, so it is checked first.
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

  const v030 = readV0_30(raw)
  if (v030) return { kind: 'v0_30', review: v030 }

  const m1 = validateM1Payload(raw)
  if (m1) return { kind: 'm1', review: m1 }

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
