/**
 * ⭐ A LATER TURN THAT CAN READ THE SEPARATION RESTORES THE LEADER.
 *
 * ## The harm, and why the obvious fix was WRONG
 *
 * CEE withholds a leader claim for two different reasons under one boolean:
 * *we looked and declined*, and *we could not read the separation at all*
 * (`orchestrator-v5/compose/analysis-state-v1.ts:189-215`). Either way the
 * withholding is stamped onto the held report and persisted, and `applyV5State`
 * step 5b stated flatly that nothing grants it back: *"it subtracts and never
 * adds… permission returns the only way it safely can: with a NEW run."*
 *
 * So an ordinary follow-up question about a finished analysis could cost the
 * user their leading option until they re-ran the whole thing.
 *
 * ⛔ THE OBVIOUS FIX — stop withholding on an unreadable separation — WAS
 * ATTEMPTED AND CLOSED (PR #1512). `withheldLeaderClaimSurvivesReload.spec.ts`
 * exists because of a harm measured on deployed staging `113375a1`: on exactly
 * that payload, a reload brought "Most supported" back while the refusal
 * vanished. Not withholding reopens it. **Two harms, and trading one for the
 * other is trap 22b.**
 *
 * ## What this pins instead
 *
 * The withholding STAYS at the moment of an unreadable turn — that spec is
 * untouched and still load-bearing. What changes is RECOVERY: a later turn on
 * which the producer POSITIVELY PERMITS clears it, instead of the user needing
 * a whole new run.
 *
 * ⛔ THE CLIENT NEVER DECIDES THE PRODUCER CHANGED ITS MIND. It acts only on a
 * positive `leader_claim.permitted === true` that the producer sent on a turn
 * it chose to restate. `applyV5State` clears `analysis_state` on every turn that
 * does NOT restate it, so silence can never reach this path.
 *
 * ⚠ AND TWO CONJUNCTS GUARD THE STALE CASE, both the producer's own words:
 *   · `requires_rerun !== true` — the producer says the model has not moved, so
 *     its permission is about the state the held report describes. This is the
 *     field deliberately excluded from the WITHHOLDING predicates because it
 *     means "the graph moved"; here it earns its keep in the opposite direction.
 *   · `blocked_unusable !== true` — a producer calling its own analysis unusable
 *     cannot simultaneously license a claim over it.
 *
 * ⚠ SCOPE, STATED RATHER THAN IMPLIED: this grants over BOTH kinds of
 * withholding, not only the unreadable one. The held stamp records the UI's own
 * two-value reason and not CEE's code, so the kind is not recoverable at this
 * point without a new field — and adding one would break
 * `withheldLeaderClaimSurvivesReload`'s identity assertion on the persisted
 * record. A producer that declined and then permits has spoken twice; honouring
 * the newer statement is not the client deciding.
 *
 * Scope (trap 3): store-level state assertions over the real store. No layout
 * claim, and nothing here is witnessed on a deployed build.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useCanvasStore } from '../store'

const REPORT = { summary: 'held report', options: [] } as never

function seedHeldReportWithWithholding(): void {
  useCanvasStore.setState({
    results: { status: 'complete', progress: 100, report: REPORT } as never,
  })
  useCanvasStore.getState().resultsWithholdLeaderClaim('leader_claim_withheld')
}

const permissionNow = () =>
  (useCanvasStore.getState().results.report as unknown as
    { producer_leader_permission?: unknown } | null)?.producer_leader_permission ?? null

beforeEach(() => {
  useCanvasStore.getState().reset()
  // ⚠ `reset()` does NOT clear `results.report` — the same trap
  // `store.scenarioSwitchAuthoritativeRecord.spec.ts` records about a sibling
  // field. Leaving it to the reset would let one case's report reach the next
  // and make the no-report case pass for the wrong reason.
  useCanvasStore.setState({ results: { status: 'idle', progress: 0 } as never })
})

describe('a readable permitting verdict restores what an unreadable one withdrew', () => {
  it('PRECONDITION: the withholding is really stamped before anything clears it', () => {
    seedHeldReportWithWithholding()
    expect(permissionNow()).toEqual({ permitted: false, withheld_reason: 'leader_claim_withheld' })
  })

  it('clears the withholding when the producer positively permits on a settled model', () => {
    seedHeldReportWithWithholding()
    useCanvasStore.getState().resultsRestoreLeaderClaim({
      leader_claim: { permitted: true },
      requires_rerun: false,
      blocked_unusable: false,
    } as never)
    expect(permissionNow()).toBeNull()
  })
})

describe('fail-closed: only the producer, only on a settled model', () => {
  it.each([
    ['the producer did not permit', { leader_claim: { permitted: false }, requires_rerun: false, blocked_unusable: false }],
    ['the producer said nothing about a leader', { requires_rerun: false, blocked_unusable: false }],
    ['permitted is not a strict true', { leader_claim: { permitted: 'yes' }, requires_rerun: false, blocked_unusable: false }],
    ['⛔ the model has MOVED — the permission is about a different state', { leader_claim: { permitted: true }, requires_rerun: true, blocked_unusable: false }],
    ['⛔ the producer calls its own analysis unusable', { leader_claim: { permitted: true }, requires_rerun: false, blocked_unusable: true }],
    ['a null verdict', null],
    ['a non-object verdict', 'not a verdict'],
  ])('leaves the withholding in force when %s', (_why, verdict) => {
    seedHeldReportWithWithholding()
    useCanvasStore.getState().resultsRestoreLeaderClaim(verdict as never)
    expect(permissionNow()).toEqual({ permitted: false, withheld_reason: 'leader_claim_withheld' })
  })

  it('does nothing at all when there is no held report to speak about', () => {
    useCanvasStore.getState().resultsRestoreLeaderClaim({
      leader_claim: { permitted: true }, requires_rerun: false, blocked_unusable: false,
    } as never)
    expect(useCanvasStore.getState().results.report ?? null).toBeNull()
  })

  it('does nothing when the held report carries no withholding — it never ADDS a permission', () => {
    useCanvasStore.setState({ results: { status: 'complete', progress: 100, report: REPORT } as never })
    const before = useCanvasStore.getState().results.report
    useCanvasStore.getState().resultsRestoreLeaderClaim({
      leader_claim: { permitted: true }, requires_rerun: false, blocked_unusable: false,
    } as never)
    expect(permissionNow()).toBeNull()
    // ⚠ BOUND BY IDENTITY, NOT BY VALUE, AND THAT IS WHAT MAKES IT BITE. Without
    // the no-stamp early return the action still produces an equal object — the
    // spread of a report with no stamp — so a `toEqual` here is an equivalent
    // mutant. `toBe` catches the needless re-allocation, which is the observable
    // difference: every results surface re-renders for a change that is not one.
    expect(useCanvasStore.getState().results.report).toBe(before)
  })
})


/**
 * ⛔⛔ THE WIRING, PINNED AT THE SEAM — because the store action being correct
 * proves nothing about anything calling it.
 *
 * Measured: with step 5c deleted from `applyV5State`, every test above stayed
 * GREEN. That is this estate's signature dark-ship shape (trap 3b) — a
 * capability whose unit is perfect and whose call site does not exist — and it
 * is why this file asserts the TURN PATH, not just the reducer.
 */
describe('the turn path actually calls it', () => {
  it('a permitting turn clears a withholding the previous turn stamped', async () => {
    const { applyV5State } = await import('../../v5/applyV5State')
    const store = useCanvasStore.getState()

    seedHeldReportWithWithholding()
    expect(permissionNow()).toEqual({ permitted: false, withheld_reason: 'leader_claim_withheld' })

    applyV5State(
      {
        blocks: [],
        analysis_state: {
          run_state: { kind: 'complete_current', computed_at: '2026-09-11T10:00:00Z' },
          readiness: { status: 'ready', blockers: [] },
          leader_claim: { permitted: true },
          robustness: {},
          usable_for_prose: true,
          usable_for_chips: true,
          usable_for_followup: true,
          requires_rerun: false,
          blocked_unusable: false,
          contradictions: [],
        },
      } as never,
      {
        ...store,
        resultsRestoreLeaderClaim: store.resultsRestoreLeaderClaim,
      } as never,
    )

    expect(permissionNow()).toBeNull()
  })
})
