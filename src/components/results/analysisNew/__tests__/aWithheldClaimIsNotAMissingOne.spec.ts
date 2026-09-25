/**
 * ⭐⭐⭐ A WITHHELD CLAIM IS NOT A MISSING ONE.
 *
 * ⛔ THE DEFECT, MEASURED ON A REAL RUN (Paul's export `olumi-debug-1dd2133d-20260916.json`,
 * 16 Sep 2026). CEE returned a COMPLETE, USABLE analysis — `run_state:
 * "complete_current"`, `readiness: { status: "ready", blockers: [] }`,
 * `requires_rerun: false`, `usable_for_prose: true`, options SEPARATED with a
 * 0.51 gap — and withheld exactly one claim, naming its cause:
 *
 *     "leader_claim": { "permitted": false,
 *                       "withheld_reason": "constraint_verdict_withheld" }
 *
 * The panel said only *"Olumi could not confirm which option is most likely on
 * this run"*. True, and reason-free, so it reads as "something did not come
 * back" — the one thing it was not.
 *
 * ⭐ WHY THE READER NEVER SAW THE CAUSE. The UI collapses the producer's string
 * into a two-value local enum (`'leader_claim_withheld' | 'analysis_unusable'`)
 * that answers "on whose account", and the panel reads only the BOOLEAN through
 * `leaderDesignationPermitted` / `rankingWasWithheld`. A boolean cannot
 * distinguish a principled refusal from missing data.
 *
 * ⚠ THE TOKEN IS NEVER RENDERED. `withheld_reason` is `z.string().optional()`
 * at the contract — FREE FORM, not an enum — so an unmapped reason must leave
 * today's sentence exactly as it is.
 *
 * ⚠ HONESTY ABOUT THIS FILE'S ORDER: the fix was written before this spec, so
 * it is not RED-first. Its weight therefore rests on the mutants recorded in the
 * commit, not on having failed first.
 */
import { describe, it, expect } from 'vitest'
import { leaderWithholdCause } from '../analysisNewCopy'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'

/** The exact token CEE sent on the run that produced this fix. */
const REAL = 'constraint_verdict_withheld'

describe('the producer\'s reason for withholding the leader', () => {
  it('⭐ states the cause for the reason a real run actually sent', () => {
    const cause = leaderWithholdCause(REAL)
    expect(cause, 'the reason CEE sent on 16 Sep must produce a sentence').not.toBeNull()
    // 25 Sep: the sentence names the checks, not limits (the token covers more
    // than a constraint verdict; theWithholdNamesNoLimitsTheUserNeverSet).
    expect(cause).toMatch(/checks/i)
    // ⛔ Never the token. This is the assertion that stops a raw enum reaching a reader.
    expect(cause).not.toContain('constraint_verdict_withheld')
    expect(cause).not.toContain('_')
  })

  /**
   * ⛔ THE DISCRIMINATING TWIN. Without it, a composer that returned the same
   * sentence for EVERY reason would pass the case above. The contract types this
   * field as a free-form string, so unknown values are the common case, not an
   * edge case.
   */
  it('⛔ CONTRAST: an unmapped reason produces NOTHING, so today\'s sentence is unchanged', () => {
    // ⚠ `separation_unavailable` USED TO BE THIS ARM'S EXAMPLE, and it moved
    // for the right reason: the map's rule was "it grows when a capture earns
    // the entry", and bundle `b3d5806d` (staging `fd65f971`, 19 Sep 14:32Z)
    // carried it on a real user's run. The arm keeps its job with tokens that
    // genuinely have no capture — replacing the example rather than deleting
    // the case, because what it discriminates is unchanged.
    expect(leaderWithholdCause('some_reason_nobody_has_seen')).toBeNull()
    expect(leaderWithholdCause('a_token_no_run_has_produced')).toBeNull()
    expect(leaderWithholdCause('')).toBeNull()
    expect(leaderWithholdCause('   ')).toBeNull()
    expect(leaderWithholdCause(null)).toBeNull()
    expect(leaderWithholdCause(undefined)).toBeNull()
  })

  /** ⚠ The wire is untyped here; a non-string must not reach the map. */
  it('refuses a non-string, which the contract permits', () => {
    expect(leaderWithholdCause(4 as unknown as string)).toBeNull()
    expect(leaderWithholdCause({} as unknown as string)).toBeNull()
  })

  /**
   * ⭐ THE CAUSE IS A CLAUSE, NOT A REPLACEMENT. The base sentence carries "It is
   * not a finding that the options are level", which stays true whatever the
   * cause and is what stops a figure-less list reading as a tie.
   */
  it('does not duplicate or contradict the sentence it qualifies', () => {
    // ⚠ THE BASE IS THE CLAUSE THE CAUSE IS APPENDED TO, which since the
    // question-split is `orderingCaveat` — the comparison's own half. `meaning`
    // is "What we checked"'s and no cause is appended there.
    const base = COPY.checks.leader_not_assessed.orderingCaveat
    const cause = leaderWithholdCause(REAL) as string
    expect(base).toContain('not a finding that the options are level')
    expect(base).not.toContain(cause)
    expect(cause).not.toContain('level')
  })
})

/**
 * ⛔⛔ THE GATE IS THIS SURFACE'S OWN LEADER CODE, NOT THE REASON'S PRESENCE.
 *
 * A producer can carry a stale `withheld_reason` on a run it then PERMITTED —
 * the field is optional and nothing requires it to be cleared. Rendering a cause
 * beside `leader_present` would explain a refusal that did not happen, which is
 * a fabrication of exactly the kind this panel exists to prevent.
 */
describe('the cause belongs only to a withheld leader', () => {
  it('⭐ the builder attaches it when the leader check is not_assessed', async () => {
    const { buildAnalysisNewViewModel } = await import('../buildAnalysisNewViewModel')
    const { decisionWithLeaderWithheld } = await import('./analysisNewFixtures')
    const vm = buildAnalysisNewViewModel({
      data: decisionWithLeaderWithheld() as never,
      producerLeaderWithholdReason: REAL,
      recommendations: [],
      isPreRun: false,
      isRunning: false,
      isStale: false,
      responseHash: 'w1',
    } as never)
    const leader = vm.checks.items.find((i) => i.id === 'leader')
    expect(leader?.code, 'PRECONDITION: this fixture must withhold the leader').toBe(
      'leader_not_assessed',
    )
    expect(vm.checks.leaderWithholdCause).toBe(leaderWithholdCause(REAL))
  })

  /**
   * ⛔ THE DISCRIMINATING TWIN, and the one that matters most. Same reason, a run
   * that DID name a leader: the cause must be absent.
   */
  it('⛔ CONTRAST: an entitled run carries NO cause, even with a reason present', async () => {
    const { buildAnalysisNewViewModel } = await import('../buildAnalysisNewViewModel')
    const { genuineDecision } = await import('./analysisNewFixtures')
    const vm = buildAnalysisNewViewModel({
      data: genuineDecision() as never,
      producerLeaderWithholdReason: REAL,
      recommendations: [],
      isPreRun: false,
      isRunning: false,
      isStale: false,
      responseHash: 'w2',
    } as never)
    const leader = vm.checks.items.find((i) => i.id === 'leader')
    expect(leader?.code, 'PRECONDITION: this fixture must NOT withhold the leader').not.toBe(
      'leader_not_assessed',
    )
    expect(vm.checks.leaderWithholdCause).toBeNull()
  })

  it('pre-run carries no cause and no checks', async () => {
    const { buildAnalysisNewViewModel } = await import('../buildAnalysisNewViewModel')
    const { makeData } = await import('./analysisNewFixtures')
    const vm = buildAnalysisNewViewModel({
      data: makeData() as never,
      producerLeaderWithholdReason: REAL,
      recommendations: [],
      isPreRun: true,
      isRunning: false,
      isStale: false,
      responseHash: 'w3',
    } as never)
    expect(vm.checks.items).toHaveLength(0)
    expect(vm.checks.leaderWithholdCause).toBeNull()
  })
})
