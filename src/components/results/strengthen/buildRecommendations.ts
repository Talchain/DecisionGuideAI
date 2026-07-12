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
 * the producer's own Phase-3 ranking, then evidence work, then challenge,
 * then commit last. Reprioritisation reorders; the lifecycle store owns
 * status and never resets it.
 */
import type { Recommendation, StrengthenInputs } from './strengthenTypes'

/** UI-SEM-014-class VOI visibility floor (percentage points). */
const VOI_EVPI_FLOOR_PP = 5
/** Producer influence above this + confidence below the low bar = LEHI. */
const LEHI_INFLUENCE_FLOOR = 0.5
const LEHI_CONFIDENCE_CEILING = 0.4

const PRIORITY = {
  successMeasure: 0,
  phase3Base: 10, // + priority_rank
  flip: 100,
  lehi: 110,
  voi: 120,
  robustness: 130,
  broaden: 140,
  commit: 200,
} as const

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
        kind: 'ai-dialogue',
        label: 'Define success',
        actionType: 'discuss',
        parameters: { topic: 'define_success' },
        prompt: 'Help me define what success looks like for this decision.',
      },
      targetId: null,
      priority: PRIORITY.successMeasure,
    })
  }

  // ── Phase-3 promotion (producer-owned coaching blocks, verbatim) ──────────
  for (const item of inputs.phase3Items) {
    recs.push({
      id: `strengthen:phase3:${item.id}`,
      helpType: 'clarify',
      title: item.title, // verbatim wire copy — never UI-authored
      signal: 'Olumi flagged this while reviewing your model.',
      whyNow: item.body ?? 'Resolving it improves what the analysis can tell you.',
      tryThis: item.actionLabel ?? 'Work through it with Olumi.',
      sourceLine: 'Source: Olumi model review.',
      action: {
        kind: 'ai-dialogue',
        label: item.actionLabel ?? 'Work through with Olumi',
        actionType: item.actionIntent ?? 'discuss',
        parameters: { block_id: item.id },
        prompt: item.title,
      },
      targetId: item.targetIds[0] ?? null,
      priority: PRIORITY.phase3Base + (item.priorityRank ?? 99),
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
          (f.influenceScore ?? 0) > LEHI_INFLUENCE_FLOOR,
      )
      .sort((a, b) => (b.influenceScore ?? 0) - (a.influenceScore ?? 0))[0]
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
        kind: 'ai-dialogue',
        label: 'Create a decision record',
        actionType: 'discuss',
        parameters: { topic: 'decision_record' },
        prompt: 'Help me record this decision, its key assumptions, and what would trigger a rethink.',
      },
      targetId: null,
      priority: PRIORITY.commit,
    })
  }

  return recs
}
