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
import * as narration from '../DraftLoadingAnimation'
import {
  NARRATION_TABLES,
  PROGRESSIVE_STAGES,
  SETTLING_STAGES,
  SETTLING_AFTER_COACHING_STAGES,
  UNSETTLED_DRAFT_NOTICE,
  STOPPED_DRAFT_NOTICE,
  DRAFT_FAILED_MODEL_KEPT_NOTICE,
  EARLY_STOP_NOT_SAVED_NOTICE,
  EARLY_STOP_ALREADY_SAVED_NOTICE,
  EARLY_STOP_UNCONFIRMED_NOTICE,
} from '../DraftLoadingAnimation'
import {
  DRAFT_VALUES_SETTLING_REFUSAL,
  DRAFT_VALUES_UNSETTLED_REFUSAL,
} from '../../utils/canRunAnalysis'

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
 * Every live table. The analysis table doubles as a NEGATIVE control on the
 * rules themselves: it is the already-ratified copy, so if a rule ever flags
 * it, the rule is over-strict rather than the copy being dishonest.
 *
 * ⚠ AMENDED 29 Jul (ROADMAP 2.122). This used to be a HAND-LISTED array, and
 * that was trap 12 sitting inside the guard written to prevent trap 12: adding
 * a narration table without also adding it here would leave the new copy
 * completely ungoverned, and the omission would read as GREEN. The draft-side
 * entries are now DERIVED from `DraftLoadingAnimation.NARRATION_TABLES`, so a
 * table added to that module is governed the moment it exists. The analysis
 * banner stays named explicitly because it lives in a different module and
 * exports exactly one table.
 */
const LIVE_TABLES: ReadonlyArray<readonly [string, readonly Stage[]]> = [
  ['AnalysisRunningBanner.NARRATION_STAGES', NARRATION_STAGES],
  ...(Object.entries(NARRATION_TABLES) as Array<[string, readonly Stage[]]>),
]

describe('narration honesty — one bar for every wait surface', () => {
  describe.each(LIVE_TABLES)('%s', (_label, stages) => {
    // ⚠ RENAMED 29 Jul (ROADMAP 2.122). This test used to be titled "asserts
    // nothing the client cannot know from elapsed time alone", which was exactly
    // right while every table was elapsed-time-licensed — and became an
    // OVERCLAIM the moment `SETTLING_STAGES` joined, because that table is
    // licensed by a held GRAPH_READY frame and legitimately says the graph
    // exists. What this test actually checks, and all it ever checked, is that
    // no table reproduces one of the retired fabrication CLASSES. The
    // per-surface licence is asserted separately below. Correcting the title
    // rather than the assertion, because the assertion was never the problem.
    it('reproduces none of the retired fabrication classes', () => {
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

// ---------------------------------------------------------------------------
// ROADMAP 2.122 — the FRAME-LICENSED surfaces
// ---------------------------------------------------------------------------
//
// `PROGRESSIVE_STAGES` is licensed by elapsed time alone, so it cannot name a
// phase. `SETTLING_STAGES` (and the two standing notices) are licensed by a
// GRAPH_READY frame the client is HOLDING — so they may say the graph exists
// and that its values are still in flight, because the frame is stamped
// `status: "in_progress"` and its contract says the numbers get refined.
//
// That extra licence is exactly where a fabrication would slip in, so it comes
// with an extra rule set. The claim these surfaces may NOT make is any claim
// ABOUT the graph now visible: a verdict, a leader, a probability, a freshness
// judgement, a recommendation. Those are what the dispatch's honesty
// constraint forbids, and this is where they would be written.

const FRAME_LICENCE_RULES: readonly Rule[] = [
  {
    name: 'no analysis verdict or recommendation',
    pattern:
      /\b(recommend|recommended|recommendation|best option|optimal|you should|we suggest|verdict|conclusion)\b/i,
    control: 'Your model is ready — we recommend the build option.',
  },
  {
    name: 'no leader or ranking language',
    pattern: /\b(lead(s|ing)?|ahead|winner|winning|wins|front[- ]runner|top option|ranked)\b/i,
    control: 'Build in-house is leading so far…',
  },
  {
    name: 'no probability or confidence claim',
    pattern: /\b(probability|likelihood|confidence|\d+\s*%\s*(chance|likely)|odds)\b/i,
    control: 'Build in-house has a 62% probability of winning…',
  },
  {
    name: 'no freshness or up-to-date verdict',
    pattern: /\b(up to date|current results|fresh|stale|reflects the current model)\b/i,
    control: 'Results are fresh and reflect the current model.',
  },
  {
    name: 'no claim the model is finished',
    pattern: /\b(ready to run|analysis ready|complete|finished|done)\b/i,
    control: 'Your model is complete and ready to run.',
  },
]

function frameLicenceViolations(message: string): string[] {
  return FRAME_LICENCE_RULES.filter((r) => r.pattern.test(message)).map((r) => r.name)
}

/**
 * Every string shown while a GRAPH_READY preview is on the canvas. Includes the
 * run-gate refusal, because a blocked Run button whose tooltip made a claim
 * would be exactly as dishonest as a status line that did.
 */
const FRAME_LICENSED_STRINGS: ReadonlyArray<readonly [string, string]> = [
  ...SETTLING_STAGES.map((s) => [`SETTLING_STAGES@${s.afterSeconds}s`, s.message] as const),
  // The post-COACHING_READY table is licensed by TWO held frames (GRAPH_READY
  // + COACHING_READY) and held to the same bar: it may stop claiming coaching
  // is outstanding, it may not claim coaching content it has never seen.
  ...SETTLING_AFTER_COACHING_STAGES.map(
    (s) => [`SETTLING_AFTER_COACHING_STAGES@${s.afterSeconds}s`, s.message] as const,
  ),
  ['UNSETTLED_DRAFT_NOTICE', UNSETTLED_DRAFT_NOTICE],
  ['STOPPED_DRAFT_NOTICE', STOPPED_DRAFT_NOTICE],
  ['DRAFT_FAILED_MODEL_KEPT_NOTICE', DRAFT_FAILED_MODEL_KEPT_NOTICE],
  // The three explicit-Stop notices (Codex P0 stop-fence). They are shown when
  // drafting has ENDED rather than while it runs, but they are held to the same
  // bar: the frame licence lets them say the canvas is or is not changed, never
  // that a model is finished or worth acting on.
  ['EARLY_STOP_NOT_SAVED_NOTICE', EARLY_STOP_NOT_SAVED_NOTICE],
  ['EARLY_STOP_ALREADY_SAVED_NOTICE', EARLY_STOP_ALREADY_SAVED_NOTICE],
  ['EARLY_STOP_UNCONFIRMED_NOTICE', EARLY_STOP_UNCONFIRMED_NOTICE],
  ['DRAFT_VALUES_SETTLING_REFUSAL', DRAFT_VALUES_SETTLING_REFUSAL],
  ['DRAFT_VALUES_UNSETTLED_REFUSAL', DRAFT_VALUES_UNSETTLED_REFUSAL],
]

describe('frame-licensed narration — may say the graph exists, may not judge it', () => {
  it.each(FRAME_LICENSED_STRINGS)('%s makes no claim the frame does not license', (_label, message) => {
    expect(frameLicenceViolations(message)).toEqual([])
  })

  it.each(FRAME_LICENSED_STRINGS)('%s also obeys every elapsed-time-table rule', (_label, message) => {
    // The extra licence is additive, not a waiver: a settling line still may not
    // forecast a duration, compare against a baseline, or claim proximity.
    expect(violations(message)).toEqual([])
  })

  it('the settling table is non-empty, starts at 0 and escalates strictly', () => {
    expect(SETTLING_STAGES.length).toBeGreaterThan(0)
    expect(SETTLING_STAGES[0].afterSeconds).toBe(0)
    for (let i = 1; i < SETTLING_STAGES.length; i++) {
      expect(SETTLING_STAGES[i].afterSeconds).toBeGreaterThan(SETTLING_STAGES[i - 1].afterSeconds)
    }
  })
})

describe('positive control — the frame-licence rules can SEE a violation', () => {
  it.each(FRAME_LICENCE_RULES.map((r) => [r.name, r] as const))(
    '%s fires on its control string',
    (_name, rule) => {
      expect(rule.pattern.test(rule.control)).toBe(true)
      expect(frameLicenceViolations(rule.control)).toContain(rule.name)
    },
  )

  it('an honest settling line trips no frame-licence rule', () => {
    expect(frameLicenceViolations('Still finishing the values and coaching…')).toEqual([])
  })

  it('the elapsed-time table would FAIL the frame-licence rules if shown post-GRAPH_READY', () => {
    // Not a defect — it proves the two rule sets are genuinely different and
    // that the frame-licence set is the STRICTER one. "Still drafting your
    // decision model…" is true before GRAPH_READY and misleading after it, so
    // the phase switch in AIInputBar is load-bearing rather than cosmetic.
    const escalated = PROGRESSIVE_STAGES[PROGRESSIVE_STAGES.length - 1].message
    expect(violations(escalated)).toEqual([])
    expect(FRAME_LICENSED_STRINGS.map(([, m]) => m)).not.toContain(escalated)
  })
})

describe('the derived table registry cannot silently miss a surface (trap 12)', () => {
  it('governs every table DraftLoadingAnimation exports, without a hand-listed copy', () => {
    const governed = LIVE_TABLES.map(([label]) => label)
    for (const label of Object.keys(NARRATION_TABLES)) {
      expect(governed).toContain(label)
    }
    // And the registry really does carry every draft table — a registry that
    // had quietly lost one would make the loop above vacuous.
    expect(Object.keys(NARRATION_TABLES)).toEqual([
      'DraftLoadingAnimation.PROGRESSIVE_STAGES',
      'DraftLoadingAnimation.SETTLING_STAGES',
      'DraftLoadingAnimation.SETTLING_AFTER_COACHING_STAGES',
    ])
    expect(NARRATION_TABLES['DraftLoadingAnimation.PROGRESSIVE_STAGES']).toBe(PROGRESSIVE_STAGES)
    expect(NARRATION_TABLES['DraftLoadingAnimation.SETTLING_STAGES']).toBe(SETTLING_STAGES)
    expect(NARRATION_TABLES['DraftLoadingAnimation.SETTLING_AFTER_COACHING_STAGES']).toBe(
      SETTLING_AFTER_COACHING_STAGES,
    )
  })
})

describe('every notice this module exports is governed (trap 12, round 2)', () => {
  /**
   * `FRAME_LICENSED_STRINGS` is hand-listed, which is the shape that let a table
   * escape the guard once already. Round 2 added TWO more notices
   * (`STOPPED_DRAFT_NOTICE` for the abort path, and a second refusal string), so
   * this DERIVES the completeness check: every `*_NOTICE` export of the narration
   * module must be under the frame-licence rules.
   *
   * Scoped to that module on purpose. The gate module also exports
   * `CEE_DRAFT_FIRST_REFUSAL`, which is CEE's own words quoted verbatim and
   * predates this lane — holding someone else's copy to this lane's licence model
   * would be the wrong claim, so the two refusals this lane owns are listed
   * explicitly above and asserted here by name.
   */
  it('covers every *_NOTICE the narration module exports', () => {
    const exportedNotices = Object.keys(narration).filter((k) => k.endsWith('_NOTICE'))
    // Trap 13: if this finds nothing the loop below is vacuous.
    expect(exportedNotices.length).toBeGreaterThan(0)
    const governed = FRAME_LICENSED_STRINGS.map(([label]) => label)
    for (const name of exportedNotices) {
      expect(governed).toContain(name)
    }
    // And the manifest is named, so a reviewer sees what was actually covered.
    expect(exportedNotices.sort()).toEqual([
      'DRAFT_FAILED_MODEL_KEPT_NOTICE',
      'EARLY_STOP_ALREADY_SAVED_NOTICE',
      'EARLY_STOP_NOT_SAVED_NOTICE',
      'EARLY_STOP_UNCONFIRMED_NOTICE',
      'STOPPED_DRAFT_NOTICE',
      'UNSETTLED_DRAFT_NOTICE',
    ])
  })

  it('covers both refusal strings this lane owns', () => {
    const governed = FRAME_LICENSED_STRINGS.map(([label]) => label)
    expect(governed).toContain('DRAFT_VALUES_SETTLING_REFUSAL')
    expect(governed).toContain('DRAFT_VALUES_UNSETTLED_REFUSAL')
  })

  it('the three notices differ — one cause cannot describe them all truthfully', () => {
    // A dead connection, a user pressing Stop, and a server-reported terminal
    // error behind a kept model are three different facts. One sentence
    // asserting "the connection dropped" would be false for the other two
    // (review F1; F1-terminal extends the same rule).
    expect(UNSETTLED_DRAFT_NOTICE).not.toBe(STOPPED_DRAFT_NOTICE)
    expect(DRAFT_FAILED_MODEL_KEPT_NOTICE).not.toBe(UNSETTLED_DRAFT_NOTICE)
    expect(DRAFT_FAILED_MODEL_KEPT_NOTICE).not.toBe(STOPPED_DRAFT_NOTICE)
    expect(UNSETTLED_DRAFT_NOTICE).toMatch(/connection dropped/i)
    expect(STOPPED_DRAFT_NOTICE).not.toMatch(/connection dropped/i)
    expect(DRAFT_FAILED_MODEL_KEPT_NOTICE).not.toMatch(/connection dropped/i)
    // The kept-model notice names its own cause (the turn failed) and its own
    // epistemic limit (the save is unconfirmed) — the two claims the 8 Aug
    // measurement showed the product inverting.
    expect(DRAFT_FAILED_MODEL_KEPT_NOTICE).toMatch(/drafting failed/i)
    expect(DRAFT_FAILED_MODEL_KEPT_NOTICE).toMatch(/can[’']t confirm/i)
  })

  it('no notice promises an action the handler cannot perform (F3)', () => {
    // They used to say "Draft again", wired to `retryLast`, which CEE declines on
    // a committed scenario. The copy now names the action that works.
    for (const notice of [
      UNSETTLED_DRAFT_NOTICE,
      STOPPED_DRAFT_NOTICE,
      DRAFT_FAILED_MODEL_KEPT_NOTICE,
    ]) {
      expect(notice).toMatch(/start a new draft/i)
      expect(notice).not.toMatch(/draft again/i)
    }
  })
})
