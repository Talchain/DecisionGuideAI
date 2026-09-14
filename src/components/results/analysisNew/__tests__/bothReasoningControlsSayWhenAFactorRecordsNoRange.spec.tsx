/**
 * ⭐⭐ #1451'S PREVENTION, ASSERTED AT THE TWO REASONING-TAB CONTROLS THAT
 * SHIPPED WITHOUT IT — AND ASSERTED AS PREVENTION, NOT AS A FIX.
 *
 * ── WHAT THIS IS FOR ───────────────────────────────────────────────────────
 * Two sessions walked the guest journey to the same dead end on 11 Sep, on
 * different scenarios with magnitudes orders of magnitude apart (`7` on a
 * quality factor, `250000` on an investment factor). Both were invited to
 * correct a value, both were told the correction applied, and both were then
 * refused at analyse time: *"recorded as a bare amount with no range for me to
 * measure it against ... Telling me the same amount again won't clear it"*.
 *
 * #1451 shipped the prevention for exactly this, on the Model tab's row editor.
 * The two controls merged today — #1491's "What I estimated" edit and #1496's
 * "Add its current value." rows — write the SAME wire event and carried none of
 * it. This spec pins that they now do.
 *
 * ⛔⛔ THIS DOES NOT CLOSE THE REFUSAL QUESTION AND NOTHING HERE CLAIMS IT DOES.
 * Whether the refusal loop is satisfiable at all, and whether the WRITE PATH
 * drops a range it should have carried, is a separate derivation running in
 * parallel. If the editor should be attaching a range, then "this factor
 * records no range" is a true sentence about a state that should never have
 * existed, and the real repair is upstream of this control. Every assertion
 * below is a claim about the CURRENT state and about this notice only. There is
 * deliberately NO assertion here that the analysis will succeed, that the
 * refusal will stop, or that the recorded state is correct.
 *
 * ── ONE IMPLEMENTATION, SO ONE SET OF ASSERTIONS OVER TWO MOUNTS ───────────
 * #1496 already extracted both surfaces into `FactorValueControl`, so the
 * prevention was wired once, there. This file therefore renders BOTH real
 * surfaces and asserts the behaviour at each — a second spec pointed at a
 * second copy is the shape this estate keeps paying for, and there is no second
 * copy to point it at.
 *
 * ── HOW THE PAIR DISCRIMINATES (trap 19, and 13b's demand for a pair) ──────
 * Each surface carries BOTH halves, in OPPOSITE directions, on DIFFERENT
 * assertions:
 *   · a factor recording NO range must show the notice   -> a mutant that
 *     suppresses the render REDs these;
 *   · a factor recording a range must show NOTHING       -> a mutant that
 *     forces the render unconditionally REDs these.
 * Neither half alone shows binding. The rows are told apart ONLY by `prior`,
 * and both are in the graph with a conversation present, so nothing else can
 * account for the difference.
 *
 * ⚠ PRECONDITIONS ARE PINNED IN-TEST. The predicate is asserted discriminating
 * on the EXACT `data` objects these fixtures put in the store, so a pass can
 * never be the fixture silently failing to reproduce the state (13b's third
 * face — a discriminator whose power depends on a fixture nothing pins).
 *
 * ⚠ ASSERTIONS BIND BY IDENTITY. Every lookup is by `data-testid` AND
 * `data-node-id`; none is "an element containing prose", and none is
 * `getAllByTestId(...)[0]`, which passes on whichever row happened to sort
 * first.
 *
 * ⚠ THE SENTENCE IS SPELLED OUT HERE AND THE COMPONENT'S CONSTANT IS NOT
 * EXPORTED — #1451's own rule, pinned structurally below, because a spec that
 * compares a render against the constant it renders asserts nothing.
 */
import '@testing-library/jest-dom/vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

const sentEvents: unknown[] = []
let conversation: { sendSystemEvent: (e: unknown, o?: unknown) => Promise<unknown> } | null = null

vi.mock('../../../../canvas/conversation/ConversationContext', () => ({
  useOptionalConversationContext: () => conversation,
  useConversationContext: () => conversation,
  ConversationProvider: ({ children }: { children: unknown }) => children,
}))

const showToast = vi.fn()
vi.mock('../../../../canvas/ToastContext', () => ({
  useShowToastSafe: () => showToast,
  ToastProvider: ({ children }: { children: unknown }) => children,
}))

vi.mock('../../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusByTarget: vi.fn(),
  focusExistingTarget: vi.fn(),
  focusModelTarget: vi.fn(() => true),
}))

import * as FactorValueControlModule from '../FactorValueControl'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { DeeperAnalysis } from '../sections/DeeperAnalysis'
import { makeData } from './analysisNewFixtures'
import { WhatIWasGivenSection } from '../../contextIntegrity/WhatIWasGivenSection'
import { factorDeclaresNoRange } from '@/canvas/conversation/factorValueEdit'
import { useCanvasStore } from '@/canvas/store'
import { useContextIntegrityStore } from '@/canvas/stores/contextIntegrityStore'
import { parseNotModelled } from '@/adapters/cee/notModelled'
import b1Fixture from '../../contextIntegrity/__tests__/fixtures/b1-cold-read.not-modelled.json'
import type { ConfidenceSectionData } from '../../types'

/**
 * ⚠ SPELLED OUT, NOT IMPORTED. See the header: the component does not export
 * its constant, and the structural assertion in section (e) keeps it that way.
 */
const NOTICE =
  'This factor records no range. An amount entered here has nothing to measure it against, and once applied it cannot be removed.'

const ESTIMATED_TID = 'what-i-was-given-estimated'
const DEEPER_TID = 'analysis-new-deeper'
const LIVE_SCENARIO_ID = '11111111-1111-4111-8111-111111111111'

// ── IDENTITY ANCHORS, HAND-PINNED ──────────────────────────────────────────
// Read out of the fixtures by hand, never derived at runtime inside an
// assertion: a value read back out of the thing under test is an oracle
// agreeing with itself.

/** "What I estimated" surface: the row that records NO range. */
const EST_NO_RANGE_ID = 'fac_cash_runway'
/** "What I estimated" surface: the row that DOES record a range. */
const EST_RANGED_ID = 'fac_nrr'

/** Deeper-analysis surface: the row that records NO range. */
const DEEP_NO_RANGE_ID = 'fac_carrier_cutoff'
/** Deeper-analysis surface: the row that DOES record a range. */
const DEEP_RANGED_ID = 'fac_seasonal_demand'
const GOAL_NODE_ID = 'g_twelve_month'

/**
 * ⚠ THE ONLY DIFFERENCE BETWEEN EACH PAIR IS `prior`, AND THAT IS THE WHOLE
 * DESIGN. Same type, same presence in the graph, same conversation, same
 * `observedState` shape — so a notice that appeared on both, or on neither,
 * could not be explained by anything except the predicate under test.
 *
 * ⚠ `cap` IS CARRIED because the save-still-works assertion rides the real
 * `buildFactorValueEditEvent`: without a cap `value` and `raw_value` would be
 * the same number and that assertion would be weaker than it looks.
 */
const RANGE = { range_min: 0, range_max: 2 }

const CANVAS_NODES = [
  { id: 'g1', type: 'goal', data: { label: 'Protect the runway' } },
  { id: GOAL_NODE_ID, type: 'goal', data: { label: 'Hit the 12-month goal' } },
  {
    id: EST_NO_RANGE_ID,
    type: 'factor',
    data: {
      label: 'Cash Runway',
      observedState: { value: 0.4, raw_value: 8, cap: 20, unit: 'months', source: 'cee_inference' },
    },
  },
  {
    id: EST_RANGED_ID,
    type: 'factor',
    data: {
      label: 'Net Revenue Retention',
      prior: { ...RANGE },
      observedState: { value: 1.12, raw_value: 112, cap: 200, unit: '%', source: 'cee_inference' },
    },
  },
  {
    id: DEEP_NO_RANGE_ID,
    type: 'factor',
    data: { label: 'Carrier Cut-off Compliance', observedState: { cap: 20, unit: 'months' } },
  },
  {
    id: DEEP_RANGED_ID,
    type: 'factor',
    data: {
      label: 'Seasonal Demand Volatility',
      prior: { ...RANGE },
      observedState: { cap: 50, unit: '%' },
    },
  },
]

/** Written as the producer emits them, per `deeperGapValueControl.spec`. */
const WARNINGS = [
  {
    code: 'ROOT_NODE_DEFAULT_VALUE',
    field: `nodes[${DEEP_NO_RANGE_ID}].observed_state.value`,
    severity: 'info',
    affected_nodes: [],
    message: `No observed value provided for root node '${DEEP_NO_RANGE_ID}'; defaulted to 0.0.`,
  },
  {
    code: 'ROOT_NODE_DEFAULT_VALUE',
    field: `nodes[${DEEP_RANGED_ID}].observed_state.value`,
    severity: 'info',
    affected_nodes: [],
    message: `No observed value provided for root node '${DEEP_RANGED_ID}'; defaulted to 0.0.`,
  },
]

const deeperVm = () =>
  buildAnalysisNewViewModel({
    data: makeData({
      confidence: {
        evidenceGapsAssessed: true,
        inferenceWarnings: WARNINGS,
      } as Partial<ConfidenceSectionData>,
    }),
    recommendations: [],
    isPreRun: false,
    isRunning: false,
    isStale: false,
    responseHash: 'run_no_range',
  }).deeper

beforeEach(() => {
  sentEvents.length = 0
  showToast.mockReset()
  conversation = {
    sendSystemEvent: (e: unknown) => {
      sentEvents.push(e)
      return Promise.resolve(undefined)
    },
  }
  useContextIntegrityStore.getState().reset()
  useCanvasStore.setState({ currentScenarioId: LIVE_SCENARIO_ID, nodes: CANVAS_NODES } as never)
  useContextIntegrityStore.getState().setContextIntegrity({
    scenarioId: LIVE_SCENARIO_ID,
    briefText: (b1Fixture as { brief_text: string }).brief_text,
    // Through the REAL boundary parser, never a hand-built manifest.
    manifest: parseNotModelled((b1Fixture as { not_modelled: unknown }).not_modelled),
  })
})

afterEach(() => {
  useContextIntegrityStore.getState().reset()
  useCanvasStore.setState({ currentScenarioId: null, nodes: [] } as never)
  cleanup()
})

const openEstimated = () => {
  render(<WhatIWasGivenSection offerEstimatedValueControl={true} />)
  fireEvent.click(screen.getByTestId('what-i-was-given-toggle'))
}

const openDeeper = () => {
  render(<DeeperAnalysis deeper={deeperVm()} offerFactorValueControl={true} />)
  fireEvent.click(screen.getByTestId(`${DEEPER_TID}-toggle`))
}

/** By testid AND node id. Never by position, never by prose. */
const byNode = (testId: string, nodeId: string): HTMLElement | undefined =>
  screen.queryAllByTestId(testId).find((el) => el.getAttribute('data-node-id') === nodeId)

/** Reach the `editing` beat — the one beat at which the notice may appear. */
const beginEditing = (tid: string, nodeId: string) => {
  const trigger = byNode(`${tid}-value-edit`, nodeId)
  if (!trigger) throw new Error(`no value control on row ${nodeId}`)
  fireEvent.click(trigger)
}

const noticeOn = (tid: string, nodeId: string) => byNode(`${tid}-value-no-range`, nodeId)

// ─────────────────────────────────────────────────────────────────────────────
// (a) PRECONDITIONS — pinned before anything is concluded from a render
// ─────────────────────────────────────────────────────────────────────────────

describe('(a) the fixtures really do reproduce the two states', () => {
  /**
   * ⚠ THE PREDICATE IS ASSERTED DISCRIMINATING ON THE EXACT OBJECTS THE STORE
   * HOLDS. Without this, a render assertion could pass because the fixture
   * quietly stopped reproducing the state it names, and nothing would go red.
   */
  it('the predicate answers differently for each pair, on the stored data', () => {
    const dataFor = (id: string) => CANVAS_NODES.find((n) => n.id === id)?.data
    expect(factorDeclaresNoRange(dataFor(EST_NO_RANGE_ID))).toBe(true)
    expect(factorDeclaresNoRange(dataFor(EST_RANGED_ID))).toBe(false)
    expect(factorDeclaresNoRange(dataFor(DEEP_NO_RANGE_ID))).toBe(true)
    expect(factorDeclaresNoRange(dataFor(DEEP_RANGED_ID))).toBe(false)
  })

  it('all four rows are in the graph, so presence cannot explain any difference', () => {
    const ids = (useCanvasStore.getState().nodes as { id: string }[]).map((n) => n.id)
    for (const id of [EST_NO_RANGE_ID, EST_RANGED_ID, DEEP_NO_RANGE_ID, DEEP_RANGED_ID]) {
      expect(ids).toContain(id)
    }
  })

  /** CONTROL: the probe can see a notice when one exists. Asserted in (b). */
  it('CONTROL: both surfaces mount a value control on both of their rows', () => {
    openEstimated()
    expect(byNode(`${ESTIMATED_TID}-value-edit`, EST_NO_RANGE_ID)).toBeInTheDocument()
    expect(byNode(`${ESTIMATED_TID}-value-edit`, EST_RANGED_ID)).toBeInTheDocument()
    cleanup()
    openDeeper()
    expect(byNode(`${DEEPER_TID}-value-edit`, DEEP_NO_RANGE_ID)).toBeInTheDocument()
    expect(byNode(`${DEEPER_TID}-value-edit`, DEEP_RANGED_ID)).toBeInTheDocument()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// (b) RED-FIRST — the notice is absent at each surface at pristine
// ─────────────────────────────────────────────────────────────────────────────

describe('(b) a factor recording no range says so, before the user commits', () => {
  /**
   * ⭐ RED-FIRST SIGNATURE 1 — "What I estimated" (#1491). At pristine this
   * fails on `toBeInTheDocument`: the element does not exist at all.
   */
  it('states it on the "What I estimated" control', () => {
    openEstimated()
    beginEditing(ESTIMATED_TID, EST_NO_RANGE_ID)
    const notice = noticeOn(ESTIMATED_TID, EST_NO_RANGE_ID)
    expect(notice).toBeInTheDocument()
    expect(notice).toHaveTextContent(NOTICE)
  })

  /**
   * ⭐ RED-FIRST SIGNATURE 2 — the deeper-analysis "Add its current value."
   * rows (#1496). Same failure at pristine, at the other mount.
   */
  it('states it on the deeper-analysis gap control', () => {
    openDeeper()
    beginEditing(DEEPER_TID, DEEP_NO_RANGE_ID)
    const notice = noticeOn(DEEPER_TID, DEEP_NO_RANGE_ID)
    expect(notice).toBeInTheDocument()
    expect(notice).toHaveTextContent(NOTICE)
  })

  /**
   * ⚠ BEFORE THE COMMIT, NOT AFTER — the property the lane exists for. The
   * notice is readable at the beat where the amount can still be abandoned.
   */
  it('is readable at the editing beat, while Save is still unpressed', () => {
    openEstimated()
    beginEditing(ESTIMATED_TID, EST_NO_RANGE_ID)
    expect(noticeOn(ESTIMATED_TID, EST_NO_RANGE_ID)).toBeInTheDocument()
    expect(byNode(`${ESTIMATED_TID}-value-save`, EST_NO_RANGE_ID)).toBeInTheDocument()
    expect(sentEvents).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// (c) THE OTHER HALF OF THE PAIR — opposite direction, different assertion
// ─────────────────────────────────────────────────────────────────────────────

describe('(c) a factor that records a range is told nothing', () => {
  /** A mutant that renders the notice unconditionally REDs this. */
  it('shows no notice on the ranged "What I estimated" row', () => {
    openEstimated()
    beginEditing(ESTIMATED_TID, EST_RANGED_ID)
    expect(byNode(`${ESTIMATED_TID}-value-input`, EST_RANGED_ID)).toBeInTheDocument()
    expect(noticeOn(ESTIMATED_TID, EST_RANGED_ID)).toBeUndefined()
  })

  /** The same, at the other mount. */
  it('shows no notice on the ranged deeper-analysis row', () => {
    openDeeper()
    beginEditing(DEEPER_TID, DEEP_RANGED_ID)
    expect(byNode(`${DEEPER_TID}-value-input`, DEEP_RANGED_ID)).toBeInTheDocument()
    expect(noticeOn(DEEPER_TID, DEEP_RANGED_ID)).toBeUndefined()
  })

  /**
   * ⚠ NOT EVEN A WRAPPER on the ranged row: the common case must gain no DOM,
   * so the notice cannot regress into "rendered but empty", which reads as
   * absent to every assertion above while still occupying layout.
   */
  it('renders nothing at all, not an empty element', () => {
    openEstimated()
    beginEditing(ESTIMATED_TID, EST_RANGED_ID)
    expect(screen.queryAllByTestId(`${ESTIMATED_TID}-value-no-range`)).toHaveLength(0)
  })

  /**
   * ⛔ AND NOT BEFORE THE EDITOR IS OPEN. A warning on a row with no pending
   * amount is the same defect as a control that does nothing, inverted.
   */
  it('says nothing on a no-range row until the editor is opened', () => {
    openEstimated()
    expect(byNode(`${ESTIMATED_TID}-value-edit`, EST_NO_RANGE_ID)).toBeInTheDocument()
    expect(noticeOn(ESTIMATED_TID, EST_NO_RANGE_ID)).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// (d) IT STATES, IT DOES NOT REFUSE
// ─────────────────────────────────────────────────────────────────────────────

describe('(d) the write is not blocked', () => {
  /**
   * ⛔ THE LINE THAT GOES RED IF ANYONE TURNS THIS INTO A BLOCK. The user may
   * still have a good reason to set the value; prevention here is telling them
   * what will happen, never refusing them.
   */
  it('still dispatches the edit from a row carrying the notice', () => {
    openEstimated()
    beginEditing(ESTIMATED_TID, EST_NO_RANGE_ID)
    expect(noticeOn(ESTIMATED_TID, EST_NO_RANGE_ID)).toBeInTheDocument()
    const input = byNode(`${ESTIMATED_TID}-value-input`, EST_NO_RANGE_ID)
    if (!input) throw new Error('no input')
    fireEvent.change(input, { target: { value: '12' } })
    const save = byNode(`${ESTIMATED_TID}-value-save`, EST_NO_RANGE_ID)
    if (!save) throw new Error('no save')
    expect(save).not.toBeDisabled()
    fireEvent.click(save)
    expect(sentEvents).toHaveLength(1)
    /**
     * ⚠ ASSERTED ON THE REAL ENVELOPE, AND ON THE SCALE. Only the transport is
     * stubbed, so `buildFactorValueEditEvent` ran for real and these are the
     * bytes the product would send. `cap: 20` makes the scale load-bearing:
     * typing 12 must reach the wire as `value: 0.6` AND `raw_value: 12`, so
     * this cannot pass on a control that dispatched something malformed. The
     * notice changes nothing about any of it.
     */
    expect(sentEvents[0]).toMatchObject({
      type: 'factor_value_edit',
      payload: { target_id: EST_NO_RANGE_ID, field: 'value', value: 0.6, raw_value: 12 },
    })
  })

  /**
   * ⚠ NO RANGE IS SYNTHESISED ANYWHERE. The node the user edited must not gain
   * a `prior` as a side effect of being told it has none — inventing a bound is
   * the worse defect this notice exists instead of.
   */
  it('invents no range on the node it warned about', () => {
    openEstimated()
    beginEditing(ESTIMATED_TID, EST_NO_RANGE_ID)
    const input = byNode(`${ESTIMATED_TID}-value-input`, EST_NO_RANGE_ID)
    if (!input) throw new Error('no input')
    fireEvent.change(input, { target: { value: '12' } })
    fireEvent.click(byNode(`${ESTIMATED_TID}-value-save`, EST_NO_RANGE_ID) as HTMLElement)
    const node = (useCanvasStore.getState().nodes as { id: string; data?: { prior?: unknown } }[]).find(
      (n) => n.id === EST_NO_RANGE_ID,
    )
    expect(node?.data?.prior).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// (e) THE COPY RULES AND THE ANTI-DRIFT GUARDS
// ─────────────────────────────────────────────────────────────────────────────

describe('(e) the sentence obeys the standing copy rules', () => {
  /** #1451's rule, carried here: structural, not a convention. */
  it('the component does NOT export the string, so no spec can assert it against itself', () => {
    expect('NO_RANGE_NOTICE' in FactorValueControlModule).toBe(false)
  })

  /**
   * ⭐⭐ THE DRIFT GUARD, AND WHY IT READS SOURCE RATHER THAN IMPORTING.
   * #1451 pins that `ModelRowView` does not export its constant, so the two
   * sites CANNOT share a reference — a value assertion against an imported
   * string is unavailable by that file's own design. Reading its SOURCE is the
   * honest substitute: if either wording moves, this REDs and names both.
   */
  it('is character-identical to the sentence the Model tab already renders', () => {
    /**
     * ⚠ RESOLVED FROM `process.cwd()`, which vitest sets to the repo root — the
     * same convention `tests/ci-guards/` uses for its own source scans.
     * `import.meta.url` is NOT a `file:` URL under this config and threw
     * `ERR_INVALID_URL_SCHEME`, which would have RED-ed this guard for a reason
     * that has nothing to do with the wording it exists to watch.
     */
    const path = resolve(process.cwd(), 'src/canvas/model-tab-v2/ModelRowView.tsx')
    const modelRowView = readFileSync(path, 'utf8')
    /**
     * POSITIVE CONTROL, and it is load-bearing: a read that silently returned
     * nothing would make `toContain` fail for the wrong reason, and a read of
     * the WRONG file would make it fail for another. Both are pinned before the
     * claim is made.
     */
    expect(modelRowView.length).toBeGreaterThan(1000)
    expect(modelRowView).toContain('export function ModelRowView')
    expect(modelRowView).toContain('NO_RANGE_NOTICE')
    expect(modelRowView).toContain(NOTICE)
  })

  it('carries no em dash and no race framing, and promises no improvement', () => {
    openEstimated()
    beginEditing(ESTIMATED_TID, EST_NO_RANGE_ID)
    const text = noticeOn(ESTIMATED_TID, EST_NO_RANGE_ID)?.textContent ?? ''
    // POSITIVE CONTROL for the matcher: it can see a dash when one is present.
    expect(`a ${'—'} b`).toMatch(/—/)
    expect(text.length).toBeGreaterThan(0)
    expect(text).not.toMatch(/—/)
    for (const banned of ['winner', 'wins', 'leads', 'leading', 'beats', 'ahead of', 'better']) {
      expect(text.toLowerCase()).not.toContain(banned)
    }
  })
})
