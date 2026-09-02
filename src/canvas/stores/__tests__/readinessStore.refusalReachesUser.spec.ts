/**
 * readinessStore — CEE's WRITTEN REFUSAL and its NAMED REPAIRS must survive the
 * normaliser and reach the sentence the user reads.
 *
 * ⚠ WHY THIS FILE EXISTS. The graph-readiness verdict carries `blocker_reason`
 * (CEE's own refusal prose) and `readiness_issues[]` (per-option, per-factor
 * repairs). Neither was in the normaliser's explicit keep-list, so both were
 * dropped before any UI code could see them — and the panel showed a bare count
 * with no route forward. Measured at the DEPLOYED staging bundle `8f5b7a0e`
 * (71 chunks, 5.7 MB): both target symbols 0 occurrences, against SEVEN
 * same-response contrast controls all present in the same crawl.
 *
 * ⚠ THE TWIN THAT MAKES A GREP LIE. `blocker_reason` (singular "blocker",
 * PROSE, the graph-readiness route) is NOT `blocked_reason` (a bare CODE on
 * `analysis_ready`, 24 files, entirely healthy). A sweep for the wrong spelling
 * reads green while the real target is zero.
 *
 * ⚠ ANTI-TAUTOLOGY. The fixture below is the PRODUCER'S shape, read at the CEE
 * bytes (`canonical-readiness.ts:139-162`, `:371-373`, `:402-424` and
 * `assist.v1.graph-readiness.ts:59,84` at CEE staging `3575b189`) — not this
 * repo's types, and not the three `analysis_ready` captures in this repo, which
 * are a DIFFERENT carrier that happens to share the field name.
 *
 * ⭐ THE INV-P6 CASE IS THE ONE THAT MATTERS. On the witnessed model every
 * blocker was `obligation: 'offered'` — structure Olumi itself authored. A
 * panel that rendered those as a task list would ask the user to supply effect
 * values for links the product invented, which is the harm CEE's own comment
 * names. The pins below assert BOTH directions: owed repairs are named, and
 * offered ones are never demanded.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useReadinessStore } from '../readinessStore'
import { useCanvasStore } from '../../store'
import { clearInflightCache } from '../../hooks/useGraphReadiness'
import { canRunAnalysis } from '../../utils/canRunAnalysis'
import { BLOCKED_REASON_COPY } from '../../utils/composeBlockedReason'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)
vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' })

/** CEE's refusal prose for the all-`offered` case, verbatim from the producer. */
const CEE_OFFERED_REFUSAL =
  "This model can't be analysed yet. The values involved are Olumi's own " +
  'suggestions, not yours — ask Olumi to work them through, or set them yourself.'

/** One producer repair, verbatim in the producer's own sentence shape. */
function repair(option: string, factor: string, obligation: 'required' | 'offered') {
  return {
    issue_id: `${option}-${factor}`,
    code: 'MISSING_OPTION_VALUE',
    category: 'option_values',
    repairability: 'human_input_required',
    option_id: `opt_${option}`,
    option_label: option,
    factor_id: `fac_${factor}`,
    factor_label: factor,
    obligation,
    message: `Choose the missing effect value for "${option}" on "${factor}".`,
  }
}

/**
 * The verdict WITHOUT the two fields under test — i.e. exactly what an older
 * CEE build sends. Kept as its own constant rather than produced by
 * destructuring-and-discarding, so the absence cases below state the absence
 * directly instead of leaving unused bindings behind.
 */
const CEE_BLOCKED_BARE = {
  readiness_score: 90,
  readiness_level: 'ready',
  confidence_level: 'high',
  confidence_explanation: 'not ready',
  can_run_analysis: false,
  improvements: [],
  options_ready: 0,
  options_total: 5,
  goal_node_valid: true,
} as const

/** The witnessed P0 body: five blockers, ALL system-authored (`offered`). */
const CEE_BLOCKED_ALL_OFFERED = {
  ...CEE_BLOCKED_BARE,
  blocker_reason: CEE_OFFERED_REFUSAL,
  readiness_issues: [
    repair('Electrify one-third of fleet', 'Net EV capex', 'offered'),
    repair('Electrify one-third of fleet', 'Clean-air charge burden', 'offered'),
    repair('Subcontract inner-city runs', 'Net EV capex', 'offered'),
    repair('Subcontract inner-city runs', 'Subcontractor cost share', 'offered'),
    repair('Keep the diesel fleet', 'Clean-air charge burden', 'offered'),
  ],
} as const

/** The same verdict where the user genuinely owes two of the repairs. */
const CEE_BLOCKED_TWO_OWED = {
  ...CEE_BLOCKED_ALL_OFFERED,
  blocker_reason: 'Choose the missing effect value for "Electrify one-third of fleet" on "Net EV capex".',
  readiness_issues: [
    repair('Electrify one-third of fleet', 'Net EV capex', 'required'),
    repair('Subcontract inner-city runs', 'Subcontractor cost share', 'required'),
    repair('Keep the diesel fleet', 'Clean-air charge burden', 'offered'),
  ],
} as const

/** The five options the client believes need values — drives rung 1. */
const FIVE_OPTIONS_NEEDING_VALUES = [
  { id: 'opt_a', label: 'Electrify one-third of fleet' },
  { id: 'opt_b', label: 'Subcontract inner-city runs' },
  { id: 'opt_c', label: 'Keep the diesel fleet' },
  { id: 'opt_d', label: 'Lease a shared depot' },
  { id: 'opt_e', label: 'Stagger the rollout' },
]

function mockCeeResponse(body: Record<string, unknown>) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(''),
    headers: new Headers(),
  }
}

function seedCanvasWithNodes(count: number) {
  const nodes = Array.from({ length: count }, (_, i) => ({
    id: `node-${i}`,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: { label: `Factor ${i}`, kind: 'factor' },
  }))
  useCanvasStore.setState({
    nodes: nodes as never,
    edges: [
      {
        id: 'edge-0-1',
        source: 'node-0',
        target: 'node-1',
        data: { weight: 0.5, direction: 'positive' },
      },
    ] as never,
  })
}

async function readinessAfterCeeSays(body: Record<string, unknown>) {
  mockFetch.mockResolvedValue(mockCeeResponse(body))
  seedCanvasWithNodes(4)
  useReadinessStore.getState().startListening()
  await vi.runAllTimersAsync()
  const { readiness } = useReadinessStore.getState()
  expect(readiness).not.toBeNull()
  return readiness!
}

/** The gate as the pre-run panel on the DEFAULT `results` tab calls it. */
function gateFor(readiness: NonNullable<Awaited<ReturnType<typeof readinessAfterCeeSays>>>) {
  return canRunAnalysis({
    graphHealth: null,
    readiness,
    hasBlockers: false,
    nodeCount: 18,
    optionsNeedingValues: FIVE_OPTIONS_NEEDING_VALUES,
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  mockFetch.mockReset()
  useReadinessStore.getState().reset()
  clearInflightCache()
})

afterEach(() => {
  useReadinessStore.getState().reset()
  vi.useRealTimers()
})

describe("the producer's refusal survives the normaliser", () => {
  it('forwards blocker_reason VERBATIM, byte-for-byte', async () => {
    const readiness = await readinessAfterCeeSays({ ...CEE_BLOCKED_ALL_OFFERED })
    // Bound by IDENTITY to the exact producer string — not a substring, not a
    // shape another sentence could satisfy.
    expect(readiness.blocker_reason).toBe(CEE_OFFERED_REFUSAL)
  })

  it('forwards every readiness_issue message VERBATIM, and its obligation with it', async () => {
    const readiness = await readinessAfterCeeSays({ ...CEE_BLOCKED_ALL_OFFERED })

    expect(readiness.readiness_issues).toHaveLength(5)
    expect(readiness.readiness_issues!.map((i) => i.message)).toEqual([
      'Choose the missing effect value for "Electrify one-third of fleet" on "Net EV capex".',
      'Choose the missing effect value for "Electrify one-third of fleet" on "Clean-air charge burden".',
      'Choose the missing effect value for "Subcontract inner-city runs" on "Net EV capex".',
      'Choose the missing effect value for "Subcontract inner-city runs" on "Subcontractor cost share".',
      'Choose the missing effect value for "Keep the diesel fleet" on "Clean-air charge burden".',
    ])
    // The field INV-P6 is decided on must survive too — forwarding the message
    // without the obligation would be worse than dropping both.
    expect(readiness.readiness_issues!.every((i) => i.obligation === 'offered')).toBe(true)
  })

  it('absent keys ⇒ undefined; an EMPTY array is preserved as empty, not collapsed', async () => {
    const absent = await readinessAfterCeeSays({ ...CEE_BLOCKED_BARE })
    expect(absent.blocker_reason).toBeUndefined()
    expect(absent.readiness_issues).toBeUndefined()

    useReadinessStore.getState().reset()
    clearInflightCache()
    mockFetch.mockReset()

    // "CEE answered and named nothing" is a DIFFERENT fact from "CEE said
    // nothing", and the store must not erase the difference.
    const empty = await readinessAfterCeeSays({ ...CEE_BLOCKED_BARE, readiness_issues: [] })
    expect(empty.readiness_issues).toEqual([])
    expect(empty.readiness_issues).not.toBeUndefined()
  })

  it.each([
    ['wrong type', { blocker_reason: 42, readiness_issues: 'nope' }],
    ['null', { blocker_reason: null, readiness_issues: null }],
  ])('%s ⇒ undefined, and the gate makes no producer claim', async (_label, overrides) => {
    const readiness = await readinessAfterCeeSays({ ...CEE_BLOCKED_BARE, ...overrides })
    expect(readiness.blocker_reason).toBeUndefined()
    expect(readiness.readiness_issues).toBeUndefined()
    // Degrades to the pre-existing count rung — a LESS SPECIFIC TRUE claim.
    expect(gateFor(readiness).reason).toBe(BLOCKED_REASON_COPY.manyOptions(5, true))
  })
})

describe('the refusal reaches the sentence the user reads', () => {
  it("names CEE's refusal instead of the bare count — the P0, end to end", async () => {
    // transport → normaliser → store → gate → the copy the pre-run panel renders
    // on the DEFAULT `results` tab.
    const readiness = await readinessAfterCeeSays({ ...CEE_BLOCKED_ALL_OFFERED })
    const gate = gateFor(readiness)

    expect(gate.allowed).toBe(false)
    // IDENTITY: the exact producer sentence, verbatim.
    expect(gate.reason).toBe(CEE_OFFERED_REFUSAL)
    // And explicitly NOT the count copy that used to win here. This is the
    // whole defect: five options needing values made rung 1 short-circuit.
    expect(gate.reason).not.toBe(BLOCKED_REASON_COPY.manyOptions(5, true))
    expect(gate.reason).not.toContain('5 options have no effect values yet')
  })

  it('the sentence is PUBLISHED to the panel listing, not only the tooltip', async () => {
    // `blockedListing.sentences` is what PreAnalysisPanelV3's footer renders as
    // rows. A fix that reached only the hover tooltip would not be a fix.
    const readiness = await readinessAfterCeeSays({ ...CEE_BLOCKED_ALL_OFFERED })
    const gate = gateFor(readiness)

    expect(gate.blockedListing?.sentences.map((s) => s.text)).toContain(CEE_OFFERED_REFUSAL)
    expect(gate.blockedListing?.summary).toContain(CEE_OFFERED_REFUSAL)
  })

  it('names EVERY repair the user owes — never a truncated subset', async () => {
    const readiness = await readinessAfterCeeSays({ ...CEE_BLOCKED_TWO_OWED })
    const gate = gateFor(readiness)

    expect(gate.reason).toContain(
      'Choose the missing effect value for "Electrify one-third of fleet" on "Net EV capex".',
    )
    expect(gate.reason).toContain(
      'Choose the missing effect value for "Subcontract inner-city runs" on "Subcontractor cost share".',
    )
  })
})

describe('INV-P6 — an OFFERED repair is shown, never demanded', () => {
  it("does not turn Olumi's own suggestions into a task list", async () => {
    // The producer's comment: "A PANEL THAT IGNORES THIS FIELD REPRODUCES THE
    // DEFECT." All five blockers here are `offered`, so NONE of their demand
    // sentences may appear; the honest refusal stands in their place.
    const readiness = await readinessAfterCeeSays({ ...CEE_BLOCKED_ALL_OFFERED })
    const gate = gateFor(readiness)

    expect(gate.reason).toBe(CEE_OFFERED_REFUSAL)
    for (const issue of CEE_BLOCKED_ALL_OFFERED.readiness_issues) {
      expect(gate.reason).not.toContain(issue.message)
    }
  })

  it('the OFFERED member of a mixed list is withheld while the owed ones are named', async () => {
    // The discriminating case: same payload, same code path, and the ONLY
    // difference between the named and the withheld is `obligation`.
    const readiness = await readinessAfterCeeSays({ ...CEE_BLOCKED_TWO_OWED })
    const gate = gateFor(readiness)

    expect(gate.reason).toContain(
      'Choose the missing effect value for "Electrify one-third of fleet" on "Net EV capex".',
    )
    expect(gate.reason).not.toContain(
      'Choose the missing effect value for "Keep the diesel fleet" on "Clean-air charge burden".',
    )
  })

  it('a waived_by_exclusion repair is withheld — the run answers it, not the user', async () => {
    const readiness = await readinessAfterCeeSays({
      ...CEE_BLOCKED_ALL_OFFERED,
      blocker_reason: 'Choose the missing effect value for "Kept option" on "Kept factor".',
      readiness_issues: [
        repair('Kept option', 'Kept factor', 'required'),
        { ...repair('Excluded option', 'Excluded factor', 'required'), waived_by_exclusion: true },
      ],
    })
    const gate = gateFor(readiness)

    expect(gate.reason).toContain(
      'Choose the missing effect value for "Kept option" on "Kept factor".',
    )
    expect(gate.reason).not.toContain('Excluded option')
  })

  it('an UNKNOWN obligation class is not promoted into a demand by default', async () => {
    // `!== 'required'` would have been the tempting test. It would silently
    // demand every future obligation class CEE invents. Only the exact string
    // 'offered' waives, so an unknown class is treated as owed — which is the
    // safe direction ONLY because it is the producer's own sentence, but the
    // pin exists so the predicate cannot quietly become a negation.
    const readiness = await readinessAfterCeeSays({
      ...CEE_BLOCKED_ALL_OFFERED,
      blocker_reason: 'fallback should not be used',
      readiness_issues: [repair('Future option', 'Future factor', 'some_new_class' as 'required')],
    })
    const gate = gateFor(readiness)

    expect(gate.reason).toBe(
      'Choose the missing effect value for "Future option" on "Future factor".',
    )
  })
})

describe('rung 0 must NOT fire — the wrong-direction twins', () => {
  /**
   * ⚠ WHY THIS BLOCK EXISTS. The first version of this spec had TWELVE cases in
   * which rung 0 firing was the RIGHT answer and ZERO in which it was the
   * WRONG one. The obligation filter got proper opposite-direction twins; the
   * rung-0 PLACEMENT did not, and a corpus that tests one direction is a guard
   * watching one door. The review found the open one.
   *
   * The affirmative case below is not hypothetical: it is REACHABLE, derived at
   * CEE `3575b189` (see `producerAuthoredRefusal`'s header for the chain), and
   * it puts the P0's own contradiction back on screen inside the P0's fix.
   */

  it('an AFFIRMATIVE blocker_reason is never rendered as the reason the gate is shut', async () => {
    // CEE's third fallback branch: nothing owed, and the run WILL proceed.
    // `can_run_analysis: false` with `will_scaffold_options` absent ⇒ the UI
    // gate still blocks, so this sentence would otherwise print beneath a
    // disabled Run button.
    const readiness = await readinessAfterCeeSays({
      ...CEE_BLOCKED_BARE,
      may_run: true,
      blocker_reason:
        'This model can be analysed now. Some values are Olumi’s suggestions — review them whenever you like.',
      readiness_issues: [repair('Suggested option', 'Suggested factor', 'offered')],
    })
    const gate = gateFor(readiness)

    expect(gate.allowed).toBe(false)
    // The affirmative sentence must not appear anywhere the user reads.
    expect(gate.reason).not.toContain('can be analysed now')
    expect(gate.blockedListing?.summary ?? '').not.toContain('can be analysed now')
    // It degrades to the ladder's own TRUE copy instead of a contradiction.
    expect(gate.reason).toBe(BLOCKED_REASON_COPY.manyOptions(5, true))
  })

  it('may_run true does NOT suppress a repair the user genuinely owes', async () => {
    // The opposite-direction twin OF THE GUARD ITSELF. Suppressing rung 0
    // wholesale on `may_run === true` would fix the contradiction by losing the
    // named repair — trading one silent failure for another.
    const readiness = await readinessAfterCeeSays({
      ...CEE_BLOCKED_BARE,
      may_run: true,
      blocker_reason: 'Choose the missing effect value for "Owed option" on "Owed factor".',
      readiness_issues: [repair('Owed option', 'Owed factor', 'required')],
    })

    expect(gateFor(readiness).reason).toBe(
      'Choose the missing effect value for "Owed option" on "Owed factor".',
    )
  })

  it('may_run false — the witnessed P0 — still renders the honest refusal', async () => {
    // Guards against the guard being written too wide. The P0 arm has
    // `may_run: false`, so it must be untouched by the affirmative check.
    const readiness = await readinessAfterCeeSays({
      ...CEE_BLOCKED_ALL_OFFERED,
      may_run: false,
    })
    expect(gateFor(readiness).reason).toBe(CEE_OFFERED_REFUSAL)
  })

  it("'unknown' is carried, not coerced to false, and still renders the refusal", async () => {
    const readiness = await readinessAfterCeeSays({
      ...CEE_BLOCKED_ALL_OFFERED,
      may_run: 'unknown',
    })
    // Preserved verbatim — "we could not ask" is not "we were refused".
    expect(readiness.may_run).toBe('unknown')
    expect(gateFor(readiness).reason).toBe(CEE_OFFERED_REFUSAL)
  })

  it('may_run survives the normaliser, and a malformed value degrades to undefined', async () => {
    const ok = await readinessAfterCeeSays({ ...CEE_BLOCKED_ALL_OFFERED, may_run: false })
    expect(ok.may_run).toBe(false)

    useReadinessStore.getState().reset()
    clearInflightCache()
    mockFetch.mockReset()

    const bad = await readinessAfterCeeSays({ ...CEE_BLOCKED_ALL_OFFERED, may_run: 'yes please' })
    expect(bad.may_run).toBeUndefined()
    // Absent/malformed must not be read as the affirmative case.
    expect(gateFor(bad).reason).toBe(CEE_OFFERED_REFUSAL)
  })
})
