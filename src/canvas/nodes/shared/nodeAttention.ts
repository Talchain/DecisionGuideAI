/**
 * ⭐ THE "WORTH REVIEWING" PLAN — one board-wide, pure aggregation of signals the
 * producers ALREADY emit (locked spec §2 "Attention cue — add"; ED 11:52Z point 7).
 *
 * It means: *Olumi has a grounded reason this element deserves attention.* It
 * must read as "worth thinking about", never as a warning or an error.
 *
 * ── WHAT IT READS (all existing, none computed here) ────────────────────────
 *
 *   · `turning_point` — a PLoT `flip_thresholds` row with `flip_reason: 'found'`
 *     for this factor (the producer's own word for "I determined a flip").
 *   · `fragile_link`  — a `robustness.fragile_edges` entry whose source is this node.
 *   · `evidence_gap`  — this factor is in the top 3 by value of information, by
 *     the existing VoI ordering (`rankFactor`), no new threshold.
 *   · `top_driver`    — this factor holds a determined rank 1..3 (`rankFactor`).
 *   · `behavioural`   — a GROUNDED bias finding maps to this element: CEE's
 *     `analysis_ready.bias_findings[].target_factor_id` (resolvable, the rule the
 *     pre-analysis panel applies — Brief 5.8A D2), or the run review's
 *     `bias_findings[].affected_elements`.
 *
 * ⛔ WHAT NEVER QUALIFIES (spec §2): "AI-generated alone is not an attention
 * trigger." An Olumi estimate only STRENGTHENS a node that already has one of
 * the reasons above — it adds a sentence, never a mark. `Not set` and "analysis
 * out of date" are explicit states already, so neither is a trigger.
 *
 * ⛔ STALE HIDES THE RUN-DERIVED REASONS FROM THIS PLAN (spec §8): the caller
 * passes run inputs only while the analysis is current. CEE's pre-run bias
 * findings are not run output and are cleared by their own producer when stale.
 * A model KNOWN to have changed keeps the last run's reasons in a SEPARATE plan,
 * labelled (`useNodeAttention`'s `fromLastRun`; design-gap row 23).
 *
 * ── HOW IT STAYS SELECTIVE, AND SAYS SO ─────────────────────────────────────
 *
 * At most `ATTENTION_BUDGET` elements are marked. The order that fills the
 * budget is a SELECTION among existing signals, not a score: a found turning
 * point or a fragile link first (the model's comparison depends on them), then
 * an evidence gap, then a rank. One slot is RESERVED for a grounded behavioural
 * finding when one exists, so a rank can never crowd out a bias challenge
 * (purpose audit, #1902 finding 4). The tooltip states that the marks are a
 * selection, and every element's full signal list stays in its inspector.
 *
 * ── HOW IT READS ────────────────────────────────────────────────────────────
 *
 * Every reason is model-scoped and ends in the question it raises — a reasoning
 * prompt, never a verdict ("could change the decision" was the drift the purpose
 * audit named). Flip wording comes from `FLIP_THRESHOLD_COPY`'s withheld form;
 * the rank from `DRIVER_LINE_COPY`, so the marker and the driver line never use
 * two wordings for one rank.
 */
import { FLIP_THRESHOLD_COPY, flipDirectionWording, formatFlipValue } from '../../../components/results/utils/flipThresholdDisplay'
import { DRIVER_LINE_COPY, TURNING_POINT_COPY } from './metricVocabulary'
import { turningPointUnitsCompatible } from './factorTurningPoint'
import { influenceRankReadout } from '../../../components/results/influenceScaleCopy'

export type AttentionReasonKind =
  | 'turning_point'
  | 'fragile_link'
  | 'evidence_gap'
  | 'top_driver'
  | 'behavioural'

export interface AttentionReason {
  readonly kind: AttentionReasonKind
  /** Selection order only — lower fills the budget first. Not a score. */
  readonly order: 1 | 2 | 3 | 4
  /** The sentence the reader sees: model-scoped, ending in its question. */
  readonly label: string
}

export const ATTENTION_BUDGET = 3

export interface FactorTurningPoint {
  currentValue: number
  flipValue: number
  unit: string | undefined
  /** True only when the producer stamped the row `value_scale: 'display'`. */
  displayScale: boolean
}

export interface AttentionInputs {
  /** Every node on the canvas, with the label used in sentences. */
  readonly nodes: ReadonlyArray<{
    id: string
    label: string
    unconfirmedEstimate: boolean
    /**
     * The unit the card shows the factor's value in (`undefined` = the card shows
     * no value). A turning point's number is printed only when its unit is
     * compatible, the same rule the card's track applies.
     */
    factorUnit?: string | null
  }>
  /** Run-derived: present only while the analysis is CURRENT. */
  readonly run: {
    readonly ranks: ReadonlyMap<string, { sensitivityRank: number | null; voiRank: number | null; influenceSetSize: number; rankedSetSize: number }>
    readonly turningPoints: ReadonlyMap<string, FactorTurningPoint>
    readonly fragileEdgeSources: ReadonlySet<string>
    readonly reviewBiasFindings: ReadonlyArray<unknown>
  } | null
  /** CEE `analysis_ready.bias_findings` — pre-run, grounded, target-mapped. */
  readonly ceeBiasFindings: ReadonlyArray<unknown>
  /** Registry lookup for a bias code → human title (e.g. "Anchoring"). */
  readonly resolveBiasTitle: (code: unknown) => string | null
}

export interface AttentionPlan {
  /** Every element with at least one grounded reason (drives the rail icons). */
  readonly reasonsByNode: ReadonlyMap<string, readonly AttentionReason[]>
  /** The budgeted selection that carries the "Worth reviewing" marker. */
  readonly marked: ReadonlySet<string>
  /** How many elements had a reason — the denominator the tooltip discloses. */
  readonly candidateCount: number
}

export const EMPTY_ATTENTION_PLAN: AttentionPlan = {
  reasonsByNode: new Map(),
  marked: new Set(),
  candidateCount: 0,
}

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim().length > 0 ? v.trim() : null

function push(map: Map<string, AttentionReason[]>, id: string, reason: AttentionReason): void {
  const list = map.get(id)
  if (!list) {
    map.set(id, [reason])
    return
  }
  if (!list.some((r) => r.kind === reason.kind)) list.push(reason)
}

/** The flip sentence, in the withheld (no-leader) form, ending in its question. */
export function turningPointSentence(
  factorLabel: string,
  tp: FactorTurningPoint,
  factorUnit?: string | null,
): string {
  const subject = factorLabel.trim() || 'this factor'
  const direction = flipDirectionWording(tp.currentValue, tp.flipValue)
  // The number prints only where the card's track would print it: display scale
  // AND a unit compatible with the card's (`turningPointUnitsCompatible`), so
  // the reason can never state a number in a unit the card withholds.
  const unitsOk = factorUnit === undefined || turningPointUnitsCompatible(tp.unit, factorUnit)
  const value = tp.displayScale && unitsOk ? formatFlipValue(tp.flipValue, tp.unit) : 'a turning point Olumi found'
  return `${FLIP_THRESHOLD_COPY.flipRiskNoAlternative(subject, direction, value, true)} ${TURNING_POINT_COPY.question}`
}

export function deriveAttentionPlan(inputs: AttentionInputs, budget: number = ATTENTION_BUDGET): AttentionPlan {
  const byId = new Map(inputs.nodes.map((n) => [n.id, n]))
  const reasons = new Map<string, AttentionReason[]>()

  const run = inputs.run
  if (run) {
    for (const [id, tp] of run.turningPoints) {
      const node = byId.get(id)
      if (!node) continue
      push(reasons, id, { kind: 'turning_point', order: 1, label: turningPointSentence(node.label, tp, node.factorUnit) })
    }
    for (const id of run.fragileEdgeSources) {
      if (!byId.has(id)) continue
      push(reasons, id, {
        kind: 'fragile_link',
        order: 1,
        label: 'The comparison depends on a link from here. How sure are you of it?',
      })
    }
    for (const [id, rank] of run.ranks) {
      if (!byId.has(id)) continue
      if (rank.voiRank !== null) {
        push(reasons, id, {
          kind: 'evidence_gap',
          order: 2,
          label: 'Evidence here would most reduce uncertainty in the comparison. What would you check first?',
        })
      }
      // ⭐ THE RANK LICENCE IS THE OWNER'S (`influenceRankReadout`: an integer
      // rank inside a set of at least two), the SAME licence the card's driver
      // line and reduced line read — never a re-spelled `influenceSetSize >= 2`,
      // which let a rank beyond its own set be stated and which
      // `theUiRendersItDoesNotDecide` rightly flags as a UI-chosen threshold.
      // And inside the ranked count — the same publication guard as
      // `driverRankFor`, so the reason never states a rank the line refuses.
      if (
        rank.sensitivityRank !== null &&
        influenceRankReadout(rank.sensitivityRank, rank.influenceSetSize) !== null &&
        rank.sensitivityRank <= rank.rankedSetSize
      ) {
        push(reasons, id, {
          kind: 'top_driver',
          order: 3,
          // Contract v3.1 pt 5 (#37): the printed M is the RANKED count, as on the card.
          label: `${DRIVER_LINE_COPY.rank(rank.sensitivityRank, rank.rankedSetSize)}: the comparison responds strongly to it. ${DRIVER_LINE_COPY.question}`,
        })
      }
    }
  }

  const behavioural = (raw: unknown, targets: ReadonlyArray<string | null>) => {
    const f = (raw ?? {}) as Record<string, unknown>
    const title = inputs.resolveBiasTitle(f.code ?? f.type)
    if (!title) return
    // Reflective, never diagnostic (spec §7): "Worth checking: …".
    const label = `Worth checking: ${title.toLowerCase()}. What would show whether it applies here?`
    for (const id of targets) {
      if (id === null || !byId.has(id)) continue
      push(reasons, id, { kind: 'behavioural', order: 4, label })
    }
  }
  for (const raw of inputs.ceeBiasFindings) {
    const f = (raw ?? {}) as Record<string, unknown>
    // Grounded = a resolvable target the producer named (Brief 5.8A D2).
    behavioural(raw, [str(f.target_factor_id)])
  }
  if (run) {
    for (const raw of run.reviewBiasFindings) {
      const f = (raw ?? {}) as Record<string, unknown>
      const targets = Array.isArray(f.affected_elements) ? f.affected_elements.map(str) : []
      behavioural(raw, targets)
    }
  }

  // Selection — a stable order over existing signals, disclosed in the tooltip.
  const rankOf = (id: string) => run?.ranks.get(id)?.sensitivityRank ?? Number.POSITIVE_INFINITY
  const entries = [...reasons.entries()].map(([id, list]) => ({
    id,
    list: [...list].sort((a, b) => a.order - b.order),
  }))
  const byOrder = [...entries].sort(
    (a, b) =>
      a.list[0]!.order - b.list[0]!.order ||
      b.list.length - a.list.length ||
      rankOf(a.id) - rankOf(b.id) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  )
  const cap = Math.max(0, budget)
  const marked: string[] = []
  const firstBehavioural = byOrder.find((e) => e.list.some((r) => r.kind === 'behavioural'))
  for (const e of byOrder) {
    if (marked.length >= cap) break
    const slotsLeft = cap - marked.length
    const reserveForBehaviour =
      firstBehavioural !== undefined && !marked.includes(firstBehavioural.id) && e.id !== firstBehavioural.id
    if (reserveForBehaviour && slotsLeft === 1) continue
    marked.push(e.id)
  }
  if (
    firstBehavioural !== undefined &&
    !marked.includes(firstBehavioural.id) &&
    marked.length < cap
  ) {
    marked.push(firstBehavioural.id)
  }

  const finalReasons = new Map<string, readonly AttentionReason[]>(entries.map((e) => [e.id, e.list]))
  return { reasonsByNode: finalReasons, marked: new Set(marked), candidateCount: entries.length }
}

/**
 * The marker's full text — the visible tooltip AND the accessible name, built
 * once so the two channels cannot say different things.
 *
 * ⭐ `fromLastRun` (design-gap row 23; visual contract v3 §02): the reasons are
 * the LAST run's, on a model known to have changed since it. The contract's
 * stale sentence LEADS in place of "Worth reviewing:", so the reasons are never
 * read as a current finding. The selection disclosure is omitted in that form:
 * its "the rest are in each element's details" is a claim about the CURRENT
 * plan, which the inspector shows, and the last run's reasons are not there.
 */
export function attentionSentence(
  reasons: readonly AttentionReason[],
  opts: { unconfirmedEstimate: boolean; marked: number; candidates: number; fromLastRun?: boolean },
): string {
  const parts = [opts.fromLastRun ? LAST_RUN_FOCUS_LEAD : WORTH_REVIEWING_LEAD, ...reasons.map((r) => r.label)]
  if (opts.unconfirmedEstimate) parts.push('Its value is Olumi’s estimate, not yet confirmed.')
  if (!opts.fromLastRun && opts.candidates > opts.marked) {
    parts.push(`Olumi marks ${opts.marked} of ${opts.candidates} elements with a signal; the rest are in each element’s details.`)
  }
  return parts.join(' ')
}

const WORTH_REVIEWING_LEAD = 'Worth reviewing:'

/** Visual contract v3 §02, the stale attention tooltip — verbatim. */
export const LAST_RUN_FOCUS_LEAD = 'Last run focus: these reasons refer to the previous model.'

/**
 * ⭐ THE CARD'S ONE CUE SENTENCE — the marker's tooltip AND accessible name, or
 * `null` for no marker (design-gap row 23). A current mark wins; otherwise a
 * mark from the LAST run (`useNodeAttention`'s `fromLastRun`, present only when
 * the model is KNOWN to have changed since it), led by the contract's "Last run
 * focus" sentence. An absent `fromLastRun` (a stubbed hook) reads as none.
 */
export function attentionCueSentence(
  attention: {
    reasons: readonly AttentionReason[]
    marked: boolean
    markedCount: number
    candidateCount: number
    fromLastRun?: {
      reasons: readonly AttentionReason[]
      marked: boolean
      markedCount: number
      candidateCount: number
    } | null
  },
  unconfirmedEstimate: boolean,
): string | null {
  if (attention.marked) {
    return attentionSentence(attention.reasons, {
      unconfirmedEstimate,
      marked: attention.markedCount,
      candidates: attention.candidateCount,
    })
  }
  const last = attention.fromLastRun
  if (last?.marked) {
    return attentionSentence(last.reasons, {
      unconfirmedEstimate,
      marked: last.markedCount,
      candidates: last.candidateCount,
      fromLastRun: true,
    })
  }
  return null
}
