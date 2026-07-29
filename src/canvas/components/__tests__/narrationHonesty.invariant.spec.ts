/**
 * CROSS-SURFACE narration-honesty invariant (ROADMAP 1.204 M1-L2).
 *
 * There are two wait-narration surfaces in this app, and until this spec they
 * were governed by two different standards:
 *
 *   - `AnalysisRunningBanner.NARRATION_STAGES` (the analysis wait) carries a
 *     RATIFIED honesty doctrine, reasoned out over two review rounds in its
 *     own header: "no claim of a pipeline stage, count or completion
 *     proximity the client cannot know", elapsed time is the ONLY input, and
 *     every line must stay true from its own threshold until the run ends.
 *     That review explicitly killed the "almost there" family AND the
 *     comparative family ("than usual" — the client holds no distribution of
 *     past durations, so it has no baseline to compare against).
 *
 *   - `DraftLoadingAnimation.PROGRESSIVE_STAGES` (the draft wait) never got
 *     it. It claimed internal pipeline phases off a wall clock ("Mapping
 *     factors and causal relationships…" at 15 s) and asserted a property of
 *     the user's own input ("This is a complex decision") purely because the
 *     server was slow.
 *
 * The doctrine was never surface-specific — it just only ever got enforced on
 * one surface. This spec applies it to BOTH, so a future line added to either
 * table is held to the same bar. Testing each table in isolation is what let
 * them diverge in the first place.
 *
 * ── WHY THE DRAFT WAIT CANNOT NAME A PHASE (derived, not assumed) ──────────
 * The client receives no stage signal on the product draft path. Verified at
 * CEE `95e1a2f8`: the V5 turn's draft tool (`src/orchestrator/tools/
 * draft-graph.ts:190`) calls `runUnifiedPipeline(...)` WITHOUT the `onStage`
 * emitter, which is passed only by `assist.v1.draft-graph-staged.ts:486` — a
 * route the UI's product path does not call. So every phase word in the old
 * table was a guess dressed as knowledge.
 *
 * ── HONEST LIMIT OF THIS GUARD (trap 12) ──────────────────────────────────
 * The rule set below is a HAND-LISTED VOCABULARY. It cannot prove the absence
 * of every possible fabrication — a novel phase word would pass. What it DOES
 * guarantee is that the retired lines and their close relatives cannot come
 * back, and that the two surfaces are held to one standard. It is a
 * regression pin plus a shared bar, NOT a general claim-safety proof, and it
 * is deliberately not described as one.
 *
 * ── POSITIVE CONTROL (trap 13) ────────────────────────────────────────────
 * An absence assertion that has never seen a presence is vacuous. Every rule
 * is proved to FIRE on a string that violates it, and the retired draft table
 * — pinned here BY VALUE, permanently, as a historical artefact rather than a
 * pointer at whatever is current (trap 12b) — is proved to fail the suite.
 */

import { describe, it, expect } from 'vitest'

import { NARRATION_STAGES } from '../AnalysisRunningBanner'
import { PROGRESSIVE_STAGES } from '../DraftLoadingAnimation'

interface Stage {
  readonly afterSeconds: number
  readonly message: string
}

/**
 * The draft table EXACTLY as it stood at `0b65ada1`, immediately before this
 * lane. Frozen by value on purpose: a control pinned to "whatever is current"
 * decays into a tautology the first time current changes (trap 12b). This
 * array must never be updated to track the live table.
 */
const RETIRED_DRAFT_STAGES_2026_07_28: readonly Stage[] = [
  { afterSeconds: 0, message: 'Generating your decision model…' },
  { afterSeconds: 15, message: 'Mapping factors and causal relationships…' },
  { afterSeconds: 30, message: 'Assessing options, risks and potential outcomes' },
  { afterSeconds: 45, message: 'This is a complex decision - building a thorough model…' },
  { afterSeconds: 60, message: 'Still working - complex briefs can take up to two minutes.' },
] as const

interface Rule {
  readonly name: string
  readonly pattern: RegExp
  /** A string known to violate this rule — the rule's own positive control. */
  readonly control: string
}

const RULES: readonly Rule[] = [
  {
    name: 'no internal-pipeline-phase claim',
    pattern: /\b(mapping|assessing|shaping|extracting|validating|scoring|simulating|parsing|repairing)\b/i,
    control: 'Mapping factors and causal relationships…',
  },
  {
    name: 'no claim about THIS decision or brief',
    pattern: /\bthis (is|was|looks|seems)\b|\byour (decision|brief) (is|looks|seems)\b/i,
    control: 'This is a complex decision - building a thorough model…',
  },
  {
    name: 'no comparative, baseline or duration forecast',
    pattern: /\b(than usual|usually|typically|on average|normally|up to (a|an|one|two|three|four|five|\d)|takes? about)\b/i,
    control: 'Still working - complex briefs can take up to two minutes.',
  },
  {
    name: 'no completion-proximity claim',
    pattern: /\b(almost|nearly|any (moment|second)|finishing|wrapping up|final(ising|izing))\b/i,
    control: 'Almost there — shaping the results…',
  },
  {
    name: 'no fabricated progress number',
    pattern: /\d+\s*%|\bstep \d+\b|\b\d+\s*of\s*\d+\b/i,
    control: 'Step 2 of 4 — 60% complete',
  },
]

function violations(message: string): string[] {
  return RULES.filter((r) => r.pattern.test(message)).map((r) => r.name)
}

/**
 * Both live tables. The analysis table doubles as a NEGATIVE control on the
 * rules themselves: it is the already-ratified copy, so if a rule ever flags
 * it, the rule is over-strict rather than the copy being dishonest.
 */
const LIVE_TABLES: ReadonlyArray<readonly [string, readonly Stage[]]> = [
  ['AnalysisRunningBanner.NARRATION_STAGES', NARRATION_STAGES],
  ['DraftLoadingAnimation.PROGRESSIVE_STAGES', PROGRESSIVE_STAGES],
]

describe('narration honesty — one bar for every wait surface', () => {
  describe.each(LIVE_TABLES)('%s', (_label, stages) => {
    it('asserts nothing the client cannot know from elapsed time alone', () => {
      const offenders = stages
        .map((s) => ({ message: s.message, broke: violations(s.message) }))
        .filter((r) => r.broke.length > 0)

      expect(offenders).toEqual([])
    })

    it('starts at zero and escalates strictly', () => {
      expect(stages.length).toBeGreaterThan(0)
      expect(stages[0].afterSeconds).toBe(0)
      for (let i = 1; i < stages.length; i++) {
        expect(stages[i].afterSeconds).toBeGreaterThan(stages[i - 1].afterSeconds)
      }
    })

    it('never renders an empty line', () => {
      for (const s of stages) {
        expect(s.message.trim().length).toBeGreaterThan(0)
      }
    })
  })
})

describe('positive control — the guard can SEE a violation', () => {
  it.each(RULES.map((r) => [r.name, r] as const))('%s fires on its control string', (_name, rule) => {
    expect(rule.pattern.test(rule.control)).toBe(true)
    expect(violations(rule.control)).toContain(rule.name)
  })

  it('an honest line trips no rule', () => {
    expect(violations('Still drafting your decision model…')).toEqual([])
  })

  it('the retired draft table FAILS this suite (the defect this lane fixes)', () => {
    const offenders = RETIRED_DRAFT_STAGES_2026_07_28
      .map((s) => ({ message: s.message, broke: violations(s.message) }))
      .filter((r) => r.broke.length > 0)

    // Three of the five retired lines were fabrications; naming them keeps the
    // control specific, so a rule that silently stops matching is visible.
    expect(offenders).toEqual([
      {
        message: 'Mapping factors and causal relationships…',
        broke: ['no internal-pipeline-phase claim'],
      },
      {
        message: 'Assessing options, risks and potential outcomes',
        broke: ['no internal-pipeline-phase claim'],
      },
      {
        message: 'This is a complex decision - building a thorough model…',
        broke: ['no claim about THIS decision or brief'],
      },
      {
        message: 'Still working - complex briefs can take up to two minutes.',
        broke: ['no comparative, baseline or duration forecast'],
      },
    ])
  })

  it('none of the retired messages survives verbatim in either live table', () => {
    const liveMessages = LIVE_TABLES.flatMap(([, stages]) => stages.map((s) => s.message))
    const retiredFabrications = RETIRED_DRAFT_STAGES_2026_07_28
      .filter((s) => violations(s.message).length > 0)
      .map((s) => s.message)

    for (const fabricated of retiredFabrications) {
      expect(liveMessages).not.toContain(fabricated)
    }
  })
})
