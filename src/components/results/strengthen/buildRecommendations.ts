/**
 * buildRecommendations — Wave 3a trigger engine (brief §8.6: every
 * recommendation has a named deterministic or producer-backed trigger; the
 * UI adapts presentation, never invents semantic truth).
 *
 * Pure and fixture-testable. Trigger honesty rules:
 * - success-measure is the one DETERMINISTIC trigger (null goal threshold).
 * - flip / robustness / commit / phase-3 read producer fields only.
 * - low-evidence-high-influence is PATH-CONDITIONAL: it fires only when the
 *   producer sent per-factor confidence (newer wires) — never from the
 *   beliefExists fallback (plan §2).
 * - VOI cites the producer worth_investigating flag when present; otherwise
 *   the evpi>0.05pp UI threshold fallback is HONESTLY labelled (the
 *   UI-SEM-014 class) — the source line never claims producer provenance.
 * - broaden fires ONLY from a producer bias finding (§19: never local
 *   option counting) — no live emission until CEE ships the signal.
 *
 * Priority is deterministic (ascending): the framing foundation first, then
 * the producer's own Phase-3 ranking (ascending `priority_rank`, verbatim),
 * then evidence work, then challenge, then commit — and last, the UI-SEM-085
 * unranked phase-3 band (guidance blocks CEE sent with no `priority_rank` —
 * by contract, exercise and pre-0.19.0 blocks — whose order is arrival order
 * and is labelled as such). Reprioritisation reorders; the lifecycle store owns
 * status and never resets it. When the producer supplies an adaptive
 * priority (inputs.adaptivePriority), matching-helpType recs float above
 * the rest while preserving relative order within each group.
 */
import { guidanceCategoryRank, type GuidanceItem } from '../../../canvas/stores/guidanceStore'
import type { Recommendation, StrengthenInputs, StrengthenPhase3Item } from './strengthenTypes'

/**
 * GuidanceItem → StrengthenPhase3Item, the ONE store→engine mapping
 * (UI-SEM-085 narrowed; Stage 2). `priorityRank` rides through VERBATIM —
 * ascending, lower = first, unbounded, presence = producer-ranked. Nothing is
 * inverted and nothing is defaulted here: the historic `100 - priority`
 * re-inversion at this seam is what collapsed the coaching band (every rank
 * >= 100 had already clamped to priority 0 upstream, so 101 and 201 became one
 * tie broken by wire array order).
 *
 * Stage 2: `category`, `actionLabel` and `signal` now ride through VERBATIM
 * too. Stage 1 hardcoded `actionLabel: undefined` here, silently dropping the
 * producer's CTA label for every phase-3 row; `category` and `signal` were
 * never carried. Exported so specs can pin the live seam instead of
 * re-implementing it.
 */
export function toStrengthenPhase3Item(item: GuidanceItem): StrengthenPhase3Item {
  return {
    id: item.item_id,
    title: item.title,
    body: item.detail,
    actionIntent: item.primary_action.type === 'discuss' ? 'discuss' : item.primary_action.type,
    actionLabel: item.actionLabel,
    ...(item.category ? { category: item.category } : {}),
    ...(item.signal ? { signal: item.signal } : {}),
    targetIds: item.target_object?.id ? [item.target_object.id] : [],
    ...(typeof item.priorityRank === 'number' ? { priorityRank: item.priorityRank } : {}),
  }
}

/** UI-SEM-014-class VOI visibility floor (percentage points). */
const VOI_EVPI_FLOOR_PP = 5
/** Producer influence above this + confidence below the low bar = LEHI. */
const LEHI_INFLUENCE_FLOOR = 0.5
const LEHI_CONFIDENCE_CEILING = 0.4

// UI-SEM-075: Strengthen list flood control — display gating only, never a
// semantic judgement. (a) Phase-3 promotion is capped at the producer's own
// top-N ranking (MAX_PHASE3_PROMOTED) so a verbose guidance payload cannot
// flood the panel with a dozen rows; the un-promoted items still render in
// their own guidance surfaces. (b) Recommendations are deduplicated by
// normalised title + body (keep the highest-priority instance) so the panel
// never shows two rows with an identical visible identity. Title ALONE is
// not a duplicate: the producer emits distinct findings under one generic
// headline (four "A load-bearing assumption" review cards with different
// bodies) and title-only dedupe silently dropped real findings. Remove when
// CEE ships a canonical per-surface promotion budget / deduplicated
// strengthen feed.
const MAX_PHASE3_PROMOTED = 4

/** Adaptive-priority boost: large enough that a matching rec always outranks
 * every non-matching band while in-band relative order is preserved. */
const ADAPTIVE_MATCH_BOOST = 10_000

// UI-SEM-085 (narrowed, 0.19.0): two phase-3 bands, not one. A guidance
// block the producer ranked (it carries `priority_rank` — ascending, lower =
// first, UNBOUNDED) keeps its place near the top of the ladder (phase3Base).
// A block the producer did NOT rank (pre-0.19.0 blocks, exercise blocks —
// the contract gives them no rank) has no producer ORDER — those rows drop
// to phase3Unranked, BELOW every producer-backed trigger, and each says so
// in its source line. Demotion + disclosure ONLY: no replacement order is
// derived from `category`/`priority` (urgency is not an order), and the
// order WITHIN the unranked band remains the arrival order — labelled as
// such instead of presented as a ranking.
//
// Band offsets are DENSE indices into the promoted list (0..3 under
// MAX_PHASE3_PROMOTED), NOT the raw rank: ranks are unbounded, so adding
// them (the historic `phase3Base + rank`) let a coaching-band rank (>= 100)
// spill past the flip trigger and even past the unranked band. An ordinal
// carries only ORDER — the dense index preserves it exactly.
const PRIORITY = {
  successMeasure: 0,
  phase3Base: 10, // + dense promoted-list index (producer-ranked only)
  flip: 100,
  lehi: 110,
  voi: 120,
  robustness: 130,
  broaden: 140,
  commit: 200,
  phase3Unranked: 210, // + dense index; below the whole producer-backed ladder
} as const

/** UI-SEM-085 source lines. Producer-ranked rows keep the original line; a
 * defaulted row must not imply an ordering the producer never sent. */
const PHASE3_SOURCE_RANKED = 'Source: Olumi model review.'
const PHASE3_SOURCE_UNRANKED =
  'Source: Olumi model review (not ranked — shown in the order received).'

/** Text normalisation for the UI-SEM-075 dedupe keys (case/whitespace only). */
function normaliseText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** UI-SEM-075(b) dedupe key: normalised title + body. Two entries are true
 * duplicates only when BOTH match — a shared generic headline over distinct
 * bodies is distinct findings, never a duplicate. */
function dedupeKey(title: string, body: string | undefined): string {
  return `${normaliseText(title)}\u0000${normaliseText(body ?? '')}`
}

function pct(p: number): string {
  return `${Math.round(p * 100)}%`
}

export function buildRecommendations(inputs: StrengthenInputs): Recommendation[] {
  const recs: Recommendation[] = []

  // ── Clarify: define a measurable success (deterministic) ──────────────────
  if (inputs.goalThreshold == null) {
    recs.push({
      id: 'strengthen:success-measure',
      helpType: 'clarify',
      title: 'Define what success looks like',
      signal: 'No measurable success target is set.',
      whyNow: 'Without a target the analysis cannot say how likely each option is to succeed, only which is ahead.',
      tryThis: 'Pick the number that would make this decision a win, and the date it matters by.',
      sourceLine: 'Source: your goal has no success threshold (checked directly).',
      action: {
        // Round-2 wiring: the primary DOES the thing — the structured
        // Define-success modal (threshold commits through the canonical
        // rerun path). The Olumi route stays available on the ✦ affordance.
        kind: 'open-modal',
        modal: 'define-success',
        label: 'Define success',
        prompt: 'Help me define what success looks like for this decision.',
      },
      targetId: null,
      priority: PRIORITY.successMeasure,
    })
  }

  // ── Phase-3 promotion (producer-owned coaching blocks, verbatim) ──────────
  // UI-SEM-075(a): promote only the producer's own top-N ranking, first
  // occurrence per title+body — display gating so the panel never floods
  // with a dozen near-identical guidance rows (the rest stay on their own
  // surfaces). Keying on title ALONE dropped distinct findings: the producer
  // emits several review cards under one generic headline with different
  // bodies (fixture cee-response-b82c89dd-trimmed). The cap is a display
  // budget and still applies AFTER true-duplicate removal.
  // UI-SEM-085 (narrowed): producer-ranked items sort ahead of unranked ones
  // BEFORE the MAX_PHASE3_PROMOTED budget is applied. Without this the cap
  // could be spent on unranked rows (which are then demoted to the bottom
  // anyway) while a genuinely producer-ranked block is dropped entirely.
  // Ranked-ness IS rank presence (0.19.0: `priority_rank` is the producer's
  // ordering; exercise blocks and pre-0.19.0 blocks legitimately lack it).
  const isProducerRanked = (i: StrengthenInputs['phase3Items'][number]): boolean =>
    typeof i.priorityRank === 'number'
  const seenPhase3Keys = new Set<string>()
  const promotedPhase3 = [...inputs.phase3Items]
    .sort((a, b) => {
      // Stage 2 — SEVERITY-major: the producer's `category` is the primary
      // display order (must_fix → should_fix → could_fix → technique). It is
      // the user-facing hierarchy, so a must_fix finding outranks a should_fix
      // one whatever their ranks. Items the producer did NOT categorise fall
      // into one trailing bucket (honest absence — never a synthesised
      // severity), preserving their existing ranked/arrival order among
      // themselves (guidanceRankHonesty pins that category-less rows are never
      // silently reordered).
      const catDelta = guidanceCategoryRank(a.category) - guidanceCategoryRank(b.category)
      if (catDelta !== 0) return catDelta
      // Within a category: producer-ranked before unranked (UI-SEM-085 — rank
      // PRESENCE is the "producer ordered this" fact; the ranked/unranked band
      // split below then keeps unranked rows demoted + disclosed).
      const rankedDelta = Number(isProducerRanked(b)) - Number(isProducerRanked(a))
      if (rankedDelta !== 0) return rankedDelta
      // Then ascending producer rank — lower = first, verbatim wire semantics
      // (unbounded; the bands are disjoint numeric ranges, so plain numeric
      // order respects them — no cross-band re-ranking). Equal ranks are
      // producer-order ties: sort() is stable, arrival order holds, which is
      // what the contract prescribes. Unranked pairs both hit the sentinel →
      // stable → arrival order, labelled as such below.
      return (
        (a.priorityRank ?? Number.MAX_SAFE_INTEGER) -
        (b.priorityRank ?? Number.MAX_SAFE_INTEGER)
      )
    })
    .filter((item) => {
      const key = dedupeKey(item.title, item.body)
      if (seenPhase3Keys.has(key)) return false
      seenPhase3Keys.add(key)
      return true
    })
    .slice(0, MAX_PHASE3_PROMOTED)
  let promotedIndex = 0
  for (const item of promotedPhase3) {
    recs.push({
      id: `strengthen:phase3:${item.id}`,
      helpType: 'clarify',
      title: item.title, // verbatim wire copy — never UI-authored
      // The producer's factor-naming body rides BOTH display fields VERBATIM
      // (trigger honesty holds — wire copy, never UI-authored):
      // - signal: the collapsed-row subtitle (information scent, clamped by
      //   the panel);
      // - whyNow: the expanded-row prose AND the Ask-Olumi drawer context
      //   (StrengthenContainer passes rec.whyNow) — a generic line here
      //   degraded every phase-3 drawer ask to boilerplate (round 2).
      // Boilerplate is the no-body fallback only. The PANEL dedupes display:
      // an open row renders the body once, in full, never clamp + full copy.
      // Stage 2: a producer `signal` display line (carried today only on the
      // deterministic stale-rerun nudge) is preferred VERBATIM over the body —
      // it is the producer's own subtitle. Body is the fallback; boilerplate
      // the no-copy floor.
      signal: item.signal ?? item.body ?? 'Olumi flagged this while reviewing your model.',
      whyNow: item.body ?? 'Resolving it improves what the analysis can tell you.',
      tryThis: item.actionLabel ?? 'Work through it with Olumi.',
      // UI-SEM-085: the label IS the band marker — an unranked row states that
      // its position is arrival order, not merit.
      sourceLine: isProducerRanked(item) ? PHASE3_SOURCE_RANKED : PHASE3_SOURCE_UNRANKED,
      action: {
        kind: 'ai-dialogue',
        label: item.actionLabel ?? 'Work through with Olumi',
        actionType: item.actionIntent ?? 'discuss',
        parameters: { block_id: item.id },
        prompt: item.title,
      },
      targetId: item.targetIds[0] ?? null,
      // UI-SEM-085 (narrowed): producer-ranked keeps the top band, unranked
      // drops below the entire producer-backed ladder. The offset is the
      // DENSE position in the promoted list (never the raw rank — unbounded
      // ranks spill across bands; an ordinal carries only order, and the
      // dense index preserves it exactly). Ranked rows precede unranked rows
      // in promotedPhase3, so one running index keeps both bands in
      // producer/arrival order without ever colliding with the flip trigger.
      priority:
        (isProducerRanked(item) ? PRIORITY.phase3Base : PRIORITY.phase3Unranked) +
        promotedIndex++,
      // Stage 2: the producer's severity, VERBATIM — drives the row badge.
      // Only phase-3 recs carry it (the UI's own triggers are uncategorised,
      // so they show no badge — honest absence).
      ...(item.category ? { category: item.category } : {}),
    })
  }

  // ── Evaluate: the single top flip risk (producer fragile_edges) ──────────
  if (inputs.analysisComplete && inputs.fragileEdges.length > 0) {
    const top = [...inputs.fragileEdges].sort(
      (a, b) => b.switchProbability - a.switchProbability,
    )[0]
    const alt = top.alternativeWinnerLabel
    recs.push({
      id: `strengthen:flip:${top.edgeId}`,
      helpType: 'evaluate',
      title: 'Test the assumption most likely to change the leader',
      signal: alt
        ? `${pct(top.switchProbability)} chance the result flips to ${alt} if ${top.factorLabel} shifts.`
        : `${pct(top.switchProbability)} chance the result flips if ${top.factorLabel} shifts.`,
      whyNow: 'This single relationship carries the most decision risk right now.',
      tryThis: 'Plan one check that would confirm or correct this assumption before you rely on the ranking.',
      sourceLine: 'Source: robustness analysis (fragile relationships).',
      action: {
        kind: 'ai-dialogue',
        label: 'Plan an evidence check',
        actionType: 'discuss',
        parameters: { edge_id: top.edgeId, switch_probability: top.switchProbability },
        prompt: `Help me plan an evidence check for the relationship involving ${top.factorLabel}.`,
      },
      targetId: top.edgeId,
      priority: PRIORITY.flip,
    })
  }

  // ── Clarify: low-evidence, high-influence factor (path-conditional) ──────
  if (inputs.analysisComplete) {
    const lehi = inputs.factors
      .filter(
        (f) =>
          typeof f.confidence === 'number' && // producer confidence ONLY
          f.confidence < LEHI_CONFIDENCE_CEILING &&
          (f.influence ?? 0) > LEHI_INFLUENCE_FLOOR,
      )
      .sort((a, b) => (b.influence ?? 0) - (a.influence ?? 0))[0]
    if (lehi) {
      recs.push({
        id: `strengthen:lehi:${lehi.factorId}`,
        helpType: 'clarify',
        title: `Give ${lehi.label} a realistic range`,
        signal: 'High influence, low evidence.',
        whyNow: 'A single figure hides uncertainty in an important input.',
        tryThis: 'Use a plausible low and high based on what you have seen before.',
        sourceLine: 'Source: sensitivity and evidence-quality signals.',
        action: {
          kind: 'canvas-focus',
          label: 'Set a range',
        },
        targetId: lehi.factorId,
        priority: PRIORITY.lehi,
      })
    }
  }

  // ── Evaluate: highest value of information ────────────────────────────────
  if (inputs.analysisComplete) {
    const producerFlagged = inputs.factors.filter((f) => f.worthInvestigating === true)
    const fallback = inputs.factors.filter(
      (f) =>
        f.worthInvestigating !== true &&
        typeof f.evpiPercentagePoints === 'number' &&
        f.evpiPercentagePoints > VOI_EVPI_FLOOR_PP,
    )
    const pool = producerFlagged.length > 0 ? producerFlagged : fallback
    const top = [...pool].sort(
      (a, b) => (b.evpiPercentagePoints ?? 0) - (a.evpiPercentagePoints ?? 0),
    )[0]
    if (top) {
      const producerBacked = top.worthInvestigating === true
      recs.push({
        id: `strengthen:voi:${top.factorId}`,
        helpType: 'evaluate',
        title: `Investigate ${top.label} before relying on the ranking`,
        signal:
          typeof top.evpiPercentagePoints === 'number'
            ? `Knowing this better could shift the result by about ${Math.round(top.evpiPercentagePoints)} percentage points.`
            : 'Knowing this better has the highest information value in your model.',
        whyNow: 'Of everything uncertain, this is the most valuable thing to learn next.',
        tryThis: 'Spend a short, time-boxed effort narrowing this down before deciding.',
        sourceLine: producerBacked
          ? 'Source: value of information analysis (flagged by the engine).'
          : 'Source: value of information estimate (UI threshold, engine flag not available).',
        action: {
          kind: 'ai-dialogue',
          label: 'Plan the investigation',
          actionType: 'discuss',
          parameters: { factor_id: top.factorId, evpi_percentage_points: top.evpiPercentagePoints ?? null },
          prompt: `Help me plan a quick investigation into ${top.label}.`,
        },
        targetId: top.canFocus ? top.factorId : null,
        priority: PRIORITY.voi,
      })
    }
  }

  // ── Challenge: pressure-test a fragile-looking leader ─────────────────────
  const level = inputs.robustness.level?.toLowerCase() ?? null
  if (inputs.analysisComplete && (level === 'low' || level === 'very_low')) {
    recs.push({
      id: 'strengthen:robustness',
      helpType: 'challenge',
      title: 'Pressure-test the leading option',
      signal: 'The current lead does not hold up strongly under stress-testing.',
      whyNow: 'A fragile lead can flip with small changes, so it deserves a challenge before you act on it.',
      tryThis: 'Build the strongest case AGAINST the current leader and see if it survives.',
      sourceLine: 'Source: robustness analysis.',
      action: {
        kind: 'ai-dialogue',
        label: 'Challenge the leader',
        actionType: 'challenge_assumption',
        parameters: { topic: 'challenge_leader' },
        prompt: 'Build the strongest case against the current leading option.',
      },
      targetId: null,
      priority: PRIORITY.robustness,
    })
  }

  // ── Broaden (producer-gated: §19 — never local option counting) ──────────
  const NARROW_TYPES = ['narrow_framing', 'framing', 'framing_bias']
  if (inputs.biasFindingTypes.some((t) => NARROW_TYPES.includes(t))) {
    recs.push({
      id: 'strengthen:broaden',
      helpType: 'broaden',
      title: 'Find a route that works differently',
      signal: 'Your options look structurally similar.',
      whyNow: 'Comparing near-identical routes can crown a winner without testing the real alternatives.',
      tryThis: 'Generate one materially different option before relying on this comparison.',
      sourceLine: 'Source: framing review.',
      action: {
        kind: 'ai-dialogue',
        label: 'Generate a different option',
        actionType: 'add_option',
        parameters: { reason: 'narrow_framing' },
        prompt: 'Suggest one materially different option that works through a different mechanism.',
      },
      targetId: null,
      priority: PRIORITY.broaden,
    })
  }

  // ── Commit: readiness supports a provisional decision ────────────────────
  if (
    inputs.analysisComplete &&
    inputs.robustness.status === 'computed' &&
    level === 'high'
  ) {
    recs.push({
      id: 'strengthen:commit',
      helpType: 'commit',
      title: 'Record the decision and what would trigger a rethink',
      signal: 'The result held up under stress-testing.',
      whyNow: 'Capturing the decision and its revisit triggers now preserves the reasoning while it is fresh.',
      tryThis: 'Note the chosen option, the key assumptions, and the one change that would reopen this.',
      sourceLine: 'Source: robustness analysis (result stable).',
      action: {
        // Round-2 wiring: opens the Record-the-decision modal (honest
        // local-only capture) instead of the prototype's generic-dialogue
        // wiring bug. Olumi route stays on the ✦ affordance.
        kind: 'open-modal',
        modal: 'decision-record',
        label: 'Create a decision record',
        prompt: 'Help me record this decision, its key assumptions, and what would trigger a rethink.',
      },
      targetId: null,
      priority: PRIORITY.commit,
    })
  }

  // ── Adaptive priority (producer signal only — see StrengthenInputs) ──────
  // Matching-helpType recs float above every other band; relative order
  // within the matching group is preserved. Fail-closed: null/absent leaves
  // the deterministic ladder untouched.
  const boosted = inputs.adaptivePriority
    ? recs.map((rec) =>
        rec.helpType === inputs.adaptivePriority
          ? { ...rec, priority: rec.priority - ADAPTIVE_MATCH_BOOST }
          : rec,
      )
    : recs

  // ── UI-SEM-075(b): never two rows with an identical visible identity ─────
  // Keyed on title + signal — exactly what the collapsed two-line row shows.
  // Keep the highest-priority (lowest number) instance of each. (Phase-3
  // signals carry the producer body, so distinct findings under one generic
  // headline survive; true duplicates still collapse.)
  const byIdentity = new Map<string, Recommendation>()
  for (const rec of boosted) {
    const key = dedupeKey(rec.title, rec.signal)
    const existing = byIdentity.get(key)
    if (!existing || rec.priority < existing.priority) byIdentity.set(key, rec)
  }
  return boosted.filter((rec) => byIdentity.get(dedupeKey(rec.title, rec.signal)) === rec)
}
