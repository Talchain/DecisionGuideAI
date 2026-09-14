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
import { loadAutosave } from '../store/scenarios'
import { restoreAnalysisFromAutosave } from '../store/restoreAnalysisFromAutosave'

/**
 * ⚠ EVERY PERMITTING FIXTURE NOW CARRIES A `run_state`, AND THAT IS A REAL
 * CONTRACT CHANGE, not test housekeeping. The gate added in response to the
 * review rejects a verdict whose run state does not license a leading option, so
 * a fixture without one is refused — which is the intended fail-closed shape.
 */
const settled = (over: Record<string, unknown> = {}) => ({
  leader_claim: { permitted: true },
  requires_rerun: false,
  blocked_unusable: false,
  run_state: { kind: 'complete_current' },
  ...over,
})

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
  // ⚠ AND `reset()` DOES NOT CLEAR `analysisFreshnessDirty` EITHER — the SAME
  // trap as `results.report` above, found the same way: the three tests that
  // expect a clear began failing the moment a case set the flag, because it
  // survived into them. A local-edit window leaking across cases would make
  // every later "it clears" read as a guard failure.
  useCanvasStore.setState({ analysisFreshnessDirty: false })
})

describe('a readable permitting verdict restores what an unreadable one withdrew', () => {
  it('PRECONDITION: the withholding is really stamped before anything clears it', () => {
    seedHeldReportWithWithholding()
    expect(permissionNow()).toEqual({ permitted: false, withheld_reason: 'leader_claim_withheld' })
  })

  it('clears the withholding when the producer positively permits on a settled model', () => {
    seedHeldReportWithWithholding()
    useCanvasStore.getState().resultsRestoreLeaderClaim(settled() as never)
    expect(permissionNow()).toBeNull()
  })
})

describe('the restore reaches the PERSISTED record — the blocking finding on this PR', () => {
  /**
   * ⛔ THE DEFECT THIS PINS, reproduced independently by two review seats:
   *   live after the restore   = true   (the fix worked)
   *   after reload             = false  (it did not survive a page load)
   *
   * `useAutosave`'s dirty check is `computeGraphHash(nodes, edges)` — GRAPH ONLY
   * — and clearing a stamp changes no node and no edge, so the 30s timer's
   * early-return skipped the write entirely. The producer's newer PERMISSION was
   * transient while its older REFUSAL was durable, and whether a user kept their
   * leading option depended on whether they happened to edit the graph first.
   *
   * ⚠ BOUND TO THE ARTEFACT BY IDENTITY — read out of the autosave slot itself,
   * exactly as `withheldLeaderClaimSurvivesReload.spec.ts` binds its twin. A
   * slice-only write cannot satisfy this.
   */
  it('the cleared stamp reaches the autosave slot, not just the in-memory slice', () => {
    seedHeldReportWithWithholding()
    // PRECONDITION PIN: the withholding is genuinely IN the persisted record
    // first, or "absent afterwards" would hold for the wrong reason.
    expect(loadAutosave()?.analysis?.report?.producer_leader_permission).toEqual({
      permitted: false,
      withheld_reason: 'leader_claim_withheld',
    })

    useCanvasStore.getState().resultsRestoreLeaderClaim(settled() as never)

    expect(loadAutosave()?.analysis?.report?.producer_leader_permission).toBeUndefined()
  })

  it('and the designation survives a reload — the user-visible half', () => {
    seedHeldReportWithWithholding()
    useCanvasStore.getState().resultsRestoreLeaderClaim(settled() as never)

    // Drive the real boot path rather than asserting the slot again, so this
    // fails if the restore persists but the rehydrator drops it.
    useCanvasStore.setState({ results: { status: 'idle', progress: 0 } as never })
    restoreAnalysisFromAutosave(loadAutosave(), useCanvasStore.getState().resultsLoadHistorical)

    expect(permissionNow()).toBeNull()
  })
})

describe('the local-edit window — a permission about a graph CEE has not seen', () => {
  /**
   * ⛔⛔ BLOCKING 2 FROM REVIEW. The scenario, in full, because the guard is
   * meaningless without it:
   *
   *   CEE withholds; the stamp is applied. The user edits a factor value, so
   *   `analysisFreshnessDirty` goes true and CEE has NOT ingested it. The user
   *   asks an ordinary follow-up. CEE composes `analysis_state` from ITS OWN
   *   PRE-EDIT GRAPH, reads the separation fine, and LEGITIMATELY sends
   *   `permitted: true, requires_rerun: false, blocked_unusable: false`. All
   *   three of the other guards pass honestly, the stamp clears, and a leader is
   *   crowned on numbers the user has since changed — while the freshness strip
   *   on the SAME SCREEN reports the run as stale.
   *
   * ⚠ `requires_rerun` DOES NOT COVER IT. That is the producer's statement about
   * its own graph. This is the client's knowledge of an edit the producer has
   * not seen, and a producer cannot report staleness it is unaware of.
   *
   * ⭐ THE PRECONDITION IS WITNESSED, NOT ASSUMED. On deployed `c5b5e86a`,
   * setting ONE factor value through Review-change → Confirm left
   * `analysisFreshnessDirty: true` — the single act the product's own refusal
   * copy instructs the user to perform.
   */
  it('refuses to clear while the client holds an edit CEE has not ingested', () => {
    seedHeldReportWithWithholding()
    useCanvasStore.setState({ analysisFreshnessDirty: true })

    useCanvasStore.getState().resultsRestoreLeaderClaim(settled() as never)

    expect(permissionNow()).toEqual({ permitted: false, withheld_reason: 'leader_claim_withheld' })
  })

  it('CONTRAST CONTROL: the SAME verdict clears once the window is closed', () => {
    // ⚠ Without this the test above passes for any reason at all — a fixture
    // that never permitted, a guard that rejects everything. The discrimination
    // is that ONE field differs between the two cases and the outcome flips.
    seedHeldReportWithWithholding()
    useCanvasStore.setState({ analysisFreshnessDirty: false })

    useCanvasStore.getState().resultsRestoreLeaderClaim(settled() as never)

    expect(permissionNow()).toBeNull()
  })

  it('PRECONDITION PIN: the flag is really set, so the refusal above is the guard and not the fixture', () => {
    seedHeldReportWithWithholding()
    useCanvasStore.setState({ analysisFreshnessDirty: true })
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
  })
})

describe('the run-state gate — a grant is NOT monotone the way a refusal is', () => {
  /**
   * ⛔ A review asked which producer fact makes a run-state gate unnecessary.
   * It could not be derived — the CEE composer fetch returned an EMPTY file,
   * which is UNMEASURED, not zero — so the client gates rather than claims.
   *
   * ⛔⛔ AND THE OBVIOUS PREDICATE IS THE WRONG ONE. `isReadTerminalRunState`
   * includes `blocked` and `refused`, because a blocked analysis is a finished
   * fact worth REHYDRATING. It does not follow that it licenses NAMING A LEADER.
   * These two rows are the ones that would have passed under that reuse.
   */
  it.each([
    ['a run that is blocked', 'blocked'],
    ['a run the producer refused', 'refused'],
    ['a run still in flight', 'running'],
    ['a run that never happened', 'never_run'],
    ['a run whose state cannot be read', 'unknown_degraded'],
  ])('refuses to clear on %s', (_why, kind) => {
    seedHeldReportWithWithholding()
    const before = permissionNow()
    useCanvasStore.getState().resultsRestoreLeaderClaim(settled({ run_state: { kind } }) as never)
    expect(permissionNow()).toEqual(before)
  })

  it('refuses when the producer sends no run_state at all', () => {
    seedHeldReportWithWithholding()
    const { run_state: _omitted, ...noRunState } = settled()
    useCanvasStore.getState().resultsRestoreLeaderClaim(noRunState as never)
    expect(permissionNow()).toEqual({ permitted: false, withheld_reason: 'leader_claim_withheld' })
  })

  it('CONTRAST CONTROL: a claimable kind DOES clear, so the rows above are not all passing vacuously', () => {
    seedHeldReportWithWithholding()
    useCanvasStore.getState().resultsRestoreLeaderClaim(settled({ run_state: { kind: 'complete_stale' } }) as never)
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

  /**
   * ⛔ THE LEDGER ENTRY IS PINNED, because an unpinned one is the same dark-ship
   * shape the review found on step 5c itself: the applicator changed what the
   * canvas designates and its own trace said nothing.
   *
   * ⚠ AND IT IS ASSERTED IN BOTH DIRECTIONS. The entry must appear when a stamp
   * is actually cleared and must NOT appear when the turn permits but nothing is
   * held — otherwise the ledger says the same thing on turns that differ, which
   * is a trace that cannot discriminate (CLAUDE.md trap 20).
   */
  it('the applied ledger records the restore — and only when something was cleared', async () => {
    const { applyV5State } = await import('../../v5/applyV5State')
    const store = useCanvasStore.getState()
    const permittingTurn = {
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
    }

    seedHeldReportWithWithholding()
    const cleared = applyV5State(permittingTurn as never, { ...store } as never)
    expect(cleared.applied).toContain('leader_claim:restored')

    // The other direction: same turn, nothing withheld to clear.
    useCanvasStore.setState({
      results: { status: 'complete', progress: 100, report: REPORT } as never,
    })
    const noop = applyV5State(permittingTurn as never, { ...store } as never)
    expect(noop.applied).not.toContain('leader_claim:restored')
  })
})
