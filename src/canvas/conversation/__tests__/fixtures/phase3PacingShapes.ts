/**
 * Deterministic block-shape enumeration for the phase-3 pacing pins
 * (ROADMAP 2.242).
 *
 * Why an enumeration rather than a handful of examples: 2.211-②'s reviewer
 * found the constant-only change regressed 42 of 189 enumerated shapes that
 * the PR's own hand-picked examples never touched. A change to the pacing
 * rule therefore gets pinned across the SHAPE SPACE, not against a few
 * fixtures — and the reference it is pinned against is a frozen recording of
 * the PRE-CHANGE behaviour (see phase3Pacing.pre-2242-baseline.json), not a
 * restatement of the rule in the test (a restated rule is a hand-maintained
 * mirror of the thing under test — platform trap 12).
 *
 * NO shape here contains a lens companion (`v5_exercise`) block. That is the
 * point: this grid is the "companion absent ⇒ byte-identical to pre-2.242"
 * control. Companion-bearing shapes are asserted explicitly in the spec.
 */
import type {
  ConversationBlock,
  FactBlock,
  V5CoachingBlock,
  V5EvidenceBlock,
  V5ExerciseBlock,
  V5ReviewCardBlock,
} from '../../types'

export function reviewCard(n: number): V5ReviewCardBlock {
  return {
    type: 'v5_review_card',
    block_id: `rc_${n}`,
    title: `Review card ${n}`,
    body: `Review body ${n}`,
    severity: 'info',
    card_kind: 'narrative',
    target_refs: [],
    priority_rank: 70 + n,
    freshness: 'fresh',
  }
}

export function coaching(n: number): V5CoachingBlock {
  return {
    type: 'v5_coaching',
    block_id: `co_${n}`,
    title: `Coaching card ${n}`,
    body: `Coaching body ${n}`,
    coaching_kind: 'assumption_check',
    source: 'decision_review',
    target_refs: [],
    priority_rank: 100 + n,
    freshness: 'fresh',
  }
}

export function biasCoaching(n: number): V5CoachingBlock {
  return {
    type: 'v5_coaching',
    block_id: `bias_${n}`,
    title: `Bias signal ${n}`,
    body: `Bias body ${n}`,
    coaching_kind: 'bias_signal',
    source: 'decision_review',
    target_refs: [],
    freshness: 'fresh',
  }
}

export function evidence(n: number): V5EvidenceBlock {
  return {
    type: 'v5_evidence',
    block_id: `ev_${n}`,
    factor_label: `Evidence factor ${n}`,
    target_refs: [],
    current_confidence: 'low',
    evidence_gap: `Gap ${n}`,
    suggested_technique: `Technique ${n}`,
    impact_if_gathered: `Impact ${n}`,
    priority_rank: n,
    severity: 'info',
    freshness: 'fresh',
  }
}

/** The lens companion card CEE's `buildLensCompanionBlocks` emits. */
export function companionExercise(n = 1): V5ExerciseBlock {
  return {
    type: 'v5_exercise',
    block_id: `ex_${n}`,
    exercise_kind: 'pre_mortem',
    failure_scenario: `Failure scenario ${n}`,
    warning_signs: [`Warning ${n}`],
    mitigation: `Mitigation ${n}`,
    target_refs: [],
    freshness: 'fresh',
  }
}

export function factBlock(n: number): FactBlock {
  return { type: 'fact', value: `${n}%`, label: `Fact ${n}`, fact_type: 'simple' }
}

const MIXES = ['allReview', 'alternating', 'evidenceFirst'] as const
type Mix = (typeof MIXES)[number]

function phase3Run(n: number, mix: Mix): ConversationBlock[] {
  const out: ConversationBlock[] = []
  for (let i = 1; i <= n; i++) {
    if (mix === 'allReview') out.push(reviewCard(i))
    else if (mix === 'alternating') out.push(i % 2 === 1 ? reviewCard(i) : coaching(i))
    else out.push(i <= 2 ? evidence(i) : i % 2 === 1 ? reviewCard(i) : coaching(i))
  }
  return out
}

export interface PacingShape {
  id: string
  blocks: ConversationBlock[]
}

/**
 * The companion-ABSENT grid: leading non-phase-3 blocks × phase-3 count ×
 * composition × leading bias-signal cards. 468 shapes, none of which carries
 * a `v5_exercise`.
 */
export function enumerateCompanionAbsentShapes(): PacingShape[] {
  const shapes: PacingShape[] = []
  for (const leading of [0, 1, 3]) {
    for (let n = 0; n <= 12; n++) {
      for (const mix of MIXES) {
        for (const bias of [0, 1, 2, 3]) {
          const blocks: ConversationBlock[] = []
          for (let i = 1; i <= leading; i++) blocks.push(factBlock(i))
          for (let i = 1; i <= bias; i++) blocks.push(biasCoaching(i))
          blocks.push(...phase3Run(n, mix))
          shapes.push({ id: `L${leading}-N${n}-${mix}-B${bias}`, blocks })
        }
      }
    }
  }
  return shapes
}
