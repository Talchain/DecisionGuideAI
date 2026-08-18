/**
 * `analysis_ready.status: 'blocked'` — the pre-run gate must not answer a
 * producer refusal with engine jargon and a destructive remedy.
 *
 * THE DEFECT, AND WHY IT REACHES A USER
 * -------------------------------------
 * `usePreRunValidation`'s `RECOGNISED_STATUSES` was a hand-maintained copy of
 * CEE's `AnalysisReadyStatus` (cee `src/schemas/analysis-ready.ts:220-227`) and
 * was one member short: it had no `'blocked'`. A blocked payload therefore took
 * the defensive unrecognised-status branch and produced
 *   `Unrecognised analysis status "blocked". Please re-draft.`
 * with `action: { type: 'retry_draft' }` — engine jargon quoting an internal
 * status name, offering a remedy that DISCARDS options the user added in chat
 * (the same destruction ROADMAP 2.924 removed from the sibling branch).
 *
 * REACHABILITY — derived at the producer, not assumed (trap 16-inverse: a path
 * being executable says nothing about the producer being able to feed it):
 *   cee `src/orchestrator/tools/analysis-ready-helper.ts:1113-1119` — the
 *   `semantic` + `hardBlocked` branch spreads the FULL readiness payload (real
 *   `goal_node_id`, NON-EMPTY `options`) and overwrites `status: 'blocked'` with
 *   a `blocked_reason`. That carrier survives the UI's lenient V5 normaliser
 *   (`src/v5/applyV5State.ts:228-296`, which only requires >=1 normalisable
 *   option) and is written to the store by `setCeeAnalysisReady`
 *   (`applyV5State.ts:1191`) — so it arrives here with options populated.
 *   The OTHER two blocked carriers (`analysis-ready-helper.ts:1123` and
 *   `orchestrator-v5/compose/analysis-ready-emit.ts:60`) carry `options: []`
 *   and are rejected upstream; they are not the case under test.
 *
 * The fixtures below are that carrier's shape. Assertions bind to the blocker by
 * CODE and to the message by the EXACT producer-derived sentence — never by a
 * predicate another blocker could satisfy (trap 19).
 */

import { describe, it, expect } from 'vitest'
import type { Node } from '@xyflow/react'
import {
  ANALYSIS_READY_STATUSES,
  ANALYSIS_READY_STATUS_UNSUPPLIED,
  RECOGNISED_ANALYSIS_READY_STATUSES,
  type CEEAnalysisReady,
} from '../../../adapters/cee/types'
import { SOFT_BYPASS_STATUSES, validateBeforeRun } from '../usePreRunValidation'
import { KNOWN_READINESS_STATUSES } from '../../../lib/coherence/crossSurfaceCoherence'
import { deriveAnalysisDisplayState } from '../../utils/deriveAnalysisDisplayState'
import { enrichBlocker } from '../../components/pre-analysis/blockerEnrichment'
import {
  ANALYSIS_REFUSAL_GENERIC_REASON,
  describeAnalysisRefusalReason,
} from '../../store/analysisRefusalNotice'

// ---------------------------------------------------------------------------
// Fixtures — the reachable `blocked` carrier
// ---------------------------------------------------------------------------

const GOAL_ID = 'goal_revenue'
const OPTION_A_ID = 'opt_partnerships'
const OPTION_A_LABEL = 'Grow via partnerships'
const OPTION_B_ID = 'opt_direct_sales'
const OPTION_B_LABEL = 'Hire direct sales'

/** A structural code CEE really emits (StructuralViolationCode, graph-structure-validator.ts:22-32). */
const MAPPED_REASON_CODE = 'NO_PATH_TO_GOAL'

function nodes(): Node[] {
  return [
    { id: GOAL_ID, type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Revenue', kind: 'goal' } },
    { id: OPTION_A_ID, type: 'option', position: { x: 0, y: 0 }, data: { label: OPTION_A_LABEL, kind: 'option' } },
    { id: OPTION_B_ID, type: 'option', position: { x: 0, y: 0 }, data: { label: OPTION_B_LABEL, kind: 'option' } },
  ]
}

/**
 * The `semantic` + `hardBlocked` carrier: every option fully RESOLVED
 * (`status: 'ready'`, non-empty interventions) while the overall status is
 * `blocked`. Options being resolved is the point — it is what makes the
 * soft-bypass path look tempting, and CEE's hard block must still win.
 */
function blockedCarrier(overrides: Partial<CEEAnalysisReady> = {}): CEEAnalysisReady {
  return {
    goal_node_id: GOAL_ID,
    status: 'blocked' as CEEAnalysisReady['status'],
    blocked_reason: MAPPED_REASON_CODE,
    options: [
      { id: OPTION_A_ID, label: OPTION_A_LABEL, status: 'ready', interventions: { fac_reach: 0.4 } },
      { id: OPTION_B_ID, label: OPTION_B_LABEL, status: 'ready', interventions: { fac_reach: 0.2 } },
    ],
    ...overrides,
  } as CEEAnalysisReady
}

function blockerCodes(result: ReturnType<typeof validateBeforeRun>): string[] {
  return result.blockers.map(b => b.code)
}

// ---------------------------------------------------------------------------

describe('analysis_ready.status "blocked" is recognised and answered honestly', () => {
  it('does not emit the unrecognised-status jargon message', () => {
    const result = validateBeforeRun(GOAL_ID, nodes(), [], blockedCarrier())
    const messages = result.blockers.map(b => b.message)
    expect(messages).not.toContain('Unrecognised analysis status "blocked". Please re-draft.')
    for (const message of messages) {
      expect(message).not.toContain('blocked')
      expect(message).not.toContain('Unrecognised analysis status')
    }
  })

  it('emits ANALYSIS_BLOCKED carrying the producer-derived sentence for its blocked_reason', () => {
    const result = validateBeforeRun(GOAL_ID, nodes(), [], blockedCarrier())
    expect(blockerCodes(result)).toContain('ANALYSIS_BLOCKED')

    const blocked = result.blockers.find(b => b.code === 'ANALYSIS_BLOCKED')
    // Identity-bound: the exact sentence the producer-derived map holds for
    // THIS code, not "some sentence mentioning the goal".
    const expected = describeAnalysisRefusalReason(MAPPED_REASON_CODE)
    expect(expected).toBe(
      'No option connects to the goal through the model, so there was nothing to compute.',
    )
    expect(blocked?.message).toBe(expected)
  })

  it('offers NO destructive re-draft — and no action at all, because none recovers this state', () => {
    const result = validateBeforeRun(GOAL_ID, nodes(), [], blockedCarrier())
    const blocked = result.blockers.find(b => b.code === 'ANALYSIS_BLOCKED')
    expect(blocked?.action).toBeUndefined()
    // No OTHER blocker on this payload may smuggle the destructive remedy back.
    expect(result.blockers.some(b => b.action?.type === 'retry_draft')).toBe(false)
  })

  it('still blocks the run — recognising the status must not make it runnable', () => {
    const result = validateBeforeRun(GOAL_ID, nodes(), [], blockedCarrier())
    expect(result.canRun).toBe(false)
  })

  it('is NOT soft-bypassed when every option is resolved (CEE hard block wins)', () => {
    // Same carrier, all options ready with interventions — the exact input that
    // makes the needs_encoding/needs_user_mapping bypass fire. It must not fire here.
    const result = validateBeforeRun(GOAL_ID, nodes(), [], blockedCarrier())
    expect(blockerCodes(result)).toContain('ANALYSIS_BLOCKED')
    expect(result.warnings.some(w => w.code === 'ANALYSIS_NOT_READY')).toBe(false)
  })

  it('falls back to the honest generic — never a guessed specific — for an unmapped blocked_reason', () => {
    const result = validateBeforeRun(
      GOAL_ID,
      nodes(),
      [],
      blockedCarrier({ blocked_reason: 'A_BRAND_NEW_CEE_CODE' } as Partial<CEEAnalysisReady>),
    )
    const blocked = result.blockers.find(b => b.code === 'ANALYSIS_BLOCKED')
    expect(describeAnalysisRefusalReason('A_BRAND_NEW_CEE_CODE')).toBeNull()
    expect(blocked?.message).toBe(ANALYSIS_REFUSAL_GENERIC_REASON)
    expect(blocked?.action).toBeUndefined()
  })

  it('says only what it can when blocked_reason is absent, and still blocks', () => {
    const result = validateBeforeRun(
      GOAL_ID,
      nodes(),
      [],
      blockedCarrier({ blocked_reason: undefined } as Partial<CEEAnalysisReady>),
    )
    const blocked = result.blockers.find(b => b.code === 'ANALYSIS_BLOCKED')
    expect(blocked?.message).toBe(ANALYSIS_REFUSAL_GENERIC_REASON)
    expect(result.canRun).toBe(false)
  })
})

describe('the MOUNTED consumer renders no destructive affordance for it (P2)', () => {
  // BlockersSection.tsx:199 gates the "Retry Draft" button on
  // `display.supportsRetry`, keyed by blocker CODE — never on `blocker.action`.
  // So the code's display metadata, not the action, is what removes the button.
  it('enrichBlocker gives ANALYSIS_BLOCKED supportsRetry=false and no suggested actions', () => {
    const result = validateBeforeRun(GOAL_ID, nodes(), [], blockedCarrier())
    const blocked = result.blockers.find(b => b.code === 'ANALYSIS_BLOCKED')!
    const enriched = enrichBlocker(blocked)
    expect(enriched.display.supportsRetry).toBe(false)
    expect(enriched.display.suggestedActions).toEqual([])
  })

  it('the rendered description IS the producer-derived sentence, not the generic fallback title text', () => {
    const result = validateBeforeRun(GOAL_ID, nodes(), [], blockedCarrier())
    const blocked = result.blockers.find(b => b.code === 'ANALYSIS_BLOCKED')!
    const enriched = enrichBlocker(blocked)
    expect(enriched.display.description).toBe(describeAnalysisRefusalReason(MAPPED_REASON_CODE))
    // Not the UNKNOWN_BLOCKER fallback — that would mean the code has no entry.
    expect(enriched.display.title).not.toBe('Validation issue')
  })
})

describe('THE DRIFT GUARD — one recorded vocabulary, and drift breaks the build', () => {
  /**
   * The producer half cannot be DERIVED: CEE's `AnalysisReadyStatus` is not
   * exported by `@talchain/schemas` at the 0.48.0 pin, nor by olumi-schemas
   * main — measured with contrast controls (`ProductReadiness`,
   * `ValidationBlocker` both present in the same sweep). So it is a RECORDED
   * mirror, and per trap 12 it must fail LOUD instead of assuming good.
   *
   * The loud mechanism is TYPE-LEVEL and lives in `usePreRunValidation.ts`:
   * `STATUS_DISPOSITION` is `Record<RecognisedAnalysisReadyStatus, …>`, so a
   * member added here without a decision about what the product does is a
   * missing-property error, and a member removed leaves an excess key. Those
   * are compile failures, which no test can express — the mutation battery in
   * the PR record proves both directions.
   *
   * What THIS block adds is the runtime half: the recorded list is pinned to
   * the producer's exact five, and every consumer of the vocabulary is total
   * over it, so a silent widening cannot pass unnoticed either.
   */
  it('pins the recorded vocabulary to CEE AnalysisReadyStatus — exactly five, in producer order', () => {
    // cee src/schemas/analysis-ready.ts:220-227, read at CEE staging 83a11574.
    expect([...ANALYSIS_READY_STATUSES]).toEqual([
      'ready',
      'needs_user_mapping',
      'needs_encoding',
      'needs_user_input',
      'blocked',
    ])
  })

  it("'unknown' is the UI's own sentinel and is NOT part of the producer vocabulary", () => {
    // applyV5State.ts:262 mints it when CEE sends no usable status. Recording
    // it as a producer value would assert CEE emits a verdict it never emits.
    expect(ANALYSIS_READY_STATUSES as readonly string[]).not.toContain(
      ANALYSIS_READY_STATUS_UNSUPPLIED,
    )
    expect(RECOGNISED_ANALYSIS_READY_STATUSES).toContain(ANALYSIS_READY_STATUS_UNSUPPLIED)
    expect(RECOGNISED_ANALYSIS_READY_STATUSES).toHaveLength(
      ANALYSIS_READY_STATUSES.length + 1,
    )
  })

  it('every recognised status resolves to a branch — none silently falls through', () => {
    // Totality in the direction a test CAN see: drive each member through the
    // real validator and require a decision (runnable, or a blocker).
    for (const status of RECOGNISED_ANALYSIS_READY_STATUSES) {
      const carrier = blockedCarrier({
        status: status as CEEAnalysisReady['status'],
        blocked_reason: status === 'blocked' ? MAPPED_REASON_CODE : undefined,
      } as Partial<CEEAnalysisReady>)
      const result = validateBeforeRun(GOAL_ID, nodes(), [], carrier)
      if (status === 'ready') {
        expect(result.canRun, `status "${status}" should be runnable`).toBe(true)
      } else {
        expect(
          result.blockers.length + result.warnings.length,
          `status "${status}" produced neither a blocker nor a warning`,
        ).toBeGreaterThan(0)
      }
      // No recognised status may reach the unrecognised-jargon sentence.
      for (const b of result.blockers) {
        expect(b.message).not.toContain('Unrecognised analysis status')
      }
    }
  })

  it('SOFT_BYPASS_STATUSES is derived from the disposition map, not hand-listed', () => {
    expect([...SOFT_BYPASS_STATUSES].sort()).toEqual(['needs_encoding', 'needs_user_mapping'])
    // The two members that must never be bypassable.
    expect(SOFT_BYPASS_STATUSES.has('blocked')).toBe(false)
    expect(SOFT_BYPASS_STATUSES.has('needs_user_input')).toBe(false)
    // Every member is a real producer status — a typo could not survive this.
    for (const status of SOFT_BYPASS_STATUSES) {
      expect(ANALYSIS_READY_STATUSES as readonly string[]).toContain(status)
    }
  })

  it('the display-state helper derives its not-ready set from the SAME vocabulary', () => {
    // `deriveAnalysisDisplayState` kept a fifth copy of the producer enum (its
    // negative half). Deriving the complement means a status CEE adds later
    // renders not-ready rather than a green "Analysis complete".
    for (const status of ANALYSIS_READY_STATUSES) {
      const { state } = deriveAnalysisDisplayState({
        ceeAnalysisReadyStatus: status,
        hasReport: true,
        analysisChanged: false,
      })
      if (status === 'ready') {
        expect(state, `"${status}" must not be forced not_ready`).not.toBe('not_ready')
      } else {
        expect(state, `"${status}" must render not_ready even with a prior report`).toBe('not_ready')
      }
    }
  })

  it('the coherence module reads the SAME vocabulary — the two lists cannot disagree', () => {
    // crossSurfaceCoherence kept a second copy of the producer enum. It now
    // spreads this one, so a change here reaches both surfaces at once.
    for (const status of ANALYSIS_READY_STATUSES) {
      expect(KNOWN_READINESS_STATUSES).toContain(status)
    }
    expect(KNOWN_READINESS_STATUSES).toHaveLength(ANALYSIS_READY_STATUSES.length + 1)
  })
})

describe('OPPOSITE-DIRECTION TWIN — a genuinely unrecognised status keeps the unrecognised path', () => {
  // Recognising `blocked` must not degrade into recognising everything. A status
  // outside the producer's vocabulary is still a defensive hard block, because
  // silently accepting it would trade a jargon message for a silent wrong answer.
  it('keeps ANALYSIS_NOT_READY + the unrecognised message + retry_draft for an unknown status', () => {
    const carrier = blockedCarrier({
      status: 'totally_invented_status' as CEEAnalysisReady['status'],
      blocked_reason: undefined,
    } as Partial<CEEAnalysisReady>)
    const result = validateBeforeRun(GOAL_ID, nodes(), [], carrier)

    expect(blockerCodes(result)).toContain('ANALYSIS_NOT_READY')
    expect(blockerCodes(result)).not.toContain('ANALYSIS_BLOCKED')
    const blocker = result.blockers.find(b => b.code === 'ANALYSIS_NOT_READY')
    expect(blocker?.message).toBe(
      'Unrecognised analysis status "totally_invented_status". Please re-draft.',
    )
    expect(blocker?.action).toEqual({ type: 'retry_draft', label: 'Retry Draft' })
    expect(result.canRun).toBe(false)
  })

  it('leaves the four already-recognised statuses on their existing branches', () => {
    // needs_user_input keeps its own hard block and its own copy.
    const needsInput = validateBeforeRun(
      GOAL_ID,
      nodes(),
      [],
      blockedCarrier({ status: 'needs_user_input', blocked_reason: undefined } as Partial<CEEAnalysisReady>),
    )
    const inputBlocker = needsInput.blockers.find(b => b.code === 'ANALYSIS_NOT_READY')
    expect(inputBlocker?.message).toBe('Your decision brief needs changes before analysis can run.')
    expect(blockerCodes(needsInput)).not.toContain('ANALYSIS_BLOCKED')

    // ready stays runnable.
    const ready = validateBeforeRun(
      GOAL_ID,
      nodes(),
      [],
      blockedCarrier({ status: 'ready', blocked_reason: undefined } as Partial<CEEAnalysisReady>),
    )
    expect(blockerCodes(ready)).not.toContain('ANALYSIS_BLOCKED')
    expect(ready.canRun).toBe(true)
  })
})
