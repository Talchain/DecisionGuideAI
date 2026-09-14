/**
 * The withheld-designation act does not send a reader away from an estimate
 * they can correct where they are.
 *
 * ── THE DEFECT ─────────────────────────────────────────────────────────────
 * `#1411` (merged 10 Sep) put an act beside CEE's withheld-designation refusal
 * and routed it to the MODEL TAB, on the stated rationale that *"the estimates
 * live on the Model tab, which is a different surface in a dock this panel does
 * not control"*. That was true on 10 Sep.
 *
 * It became false on 11 Sep. `#1491` (squash `29e19b9e`) put an inline value
 * control on each estimated factor under **"What I estimated"** — the same act,
 * on the SAME tab, about two sections below that button. From then on the
 * product sent a reader to another surface to do something available where they
 * already were.
 *
 * ⚠⚠ NEITHER CHANGE WAS WRONG, AND NEITHER CHANGE'S TESTS COULD SEE IT. Each is
 * correct in isolation: #1411's suite asserts the route reaches a real Model-tab
 * section, #1491's asserts the control reaches the Reasoning tab. The defect
 * lives only at the seam, and nothing was pointed at the seam — CLAUDE.md trap
 * 21, arriving through a RATIONALE going stale underneath a correct-looking
 * control. This file is that instrument.
 *
 * ── ⚠ THE TWO STATES, AND WHY BOTH ARE REACHABLE ───────────────────────────
 * The in-page act is NOT always there, so "always act in page" would be as
 * wrong as "always route away". The manifest behind "what I estimated" is
 * written ONLY on the cold read: `serverGraphHydration` reaches
 * `setContextIntegrity` only on `status === 'graph'` (`:238`), and a
 * freshly-drafted decision records its brief through `recordBriefForFreshDraft`
 * with `manifest: null`. On that path the register renders and lists NO
 * estimated factors at all. The act also goes when the canvas no longer holds
 * the node the manifest names — a refused merge, a structural delete, or the
 * `unchanged` short-circuit, all WITHIN one scenario — and when there is no
 * conversation to carry the edit.
 *
 * So the pair below is the evidence, and it is deliberately asymmetric in its
 * ASSERTIONS as well as its direction (CLAUDE.md trap 22b — one biting mutant
 * proves sensitivity to something, not to the named condition):
 *
 *   · node RESOLVABLE   → the register opens on the act, and the dock's route
 *                         is NOT taken. Mutant: drop the composition and pass
 *                         the dock handler through. REDs here.
 *   · node UNRESOLVABLE → the dock's route IS taken, exactly once, and the
 *                         register stays shut. Mutant: force the in-page act
 *                         (`revealEstimatedValueAct` answers `true` always).
 *                         REDs here, and the first case stays GREEN.
 *
 * ── WHAT IS NOT MINTED ─────────────────────────────────────────────────────
 * No second control, writer, validation or policy. The in-page act IS #1491's
 * control, revealed; the route IS #1411's, kept as the fallback. The label is
 * unchanged, because it names the ACT and never the destination.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

/**
 * ⚠ ONLY THE TRANSPORT IS STUBBED, as in `#1491`'s own suite. The carrier's
 * PRESENCE is one of the two conjuncts the act is gated on, so a spec that
 * mocked it away would be testing a state the product never reaches.
 */
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

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { decisionWithLeaderWithheld } from './analysisNewFixtures'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import { useCanvasStore } from '@/canvas/store'
import { useContextIntegrityStore } from '@/canvas/stores/contextIntegrityStore'
import { parseNotModelled } from '@/adapters/cee/notModelled'
import b1Fixture from '../../contextIntegrity/__tests__/fixtures/b1-cold-read.not-modelled.json'

/** The refusal's own two testids, as `withheldReasonHasAMove.spec.tsx` names them. */
const SENTENCE = 'analysis-new-glance-withheld-reason'
const CONTROL = 'analysis-new-glance-withheld-review-estimates'
/** The register, and the per-row control `#1491` put on it. */
const TOGGLE = 'what-i-was-given-toggle'
const ESTIMATED = 'what-i-was-given-estimated'

const LIVE_SCENARIO_ID = '11111111-1111-4111-8111-111111111111'

/**
 * ── IDENTITY ANCHORS, HAND-PINNED ──────────────────────────────────────────
 * Read out of the fixture by hand, never derived at runtime inside the test: a
 * value read from the fixture by the assertion is an oracle agreeing with
 * itself. `TARGET_NODE_ID` is a `not_modelled.inferred_factors[]` entry of
 * `b1-cold-read`, the same anchor `#1491`'s suite uses.
 */
const TARGET_NODE_ID = 'fac_cash_runway'

/** A canvas that HOLDS the estimated factor — the in-page act is available. */
const CANVAS_HOLDS_THE_FACTOR = [
  { id: 'g1', type: 'goal', data: { label: 'Protect the runway' } },
  {
    id: TARGET_NODE_ID,
    type: 'factor',
    data: {
      label: 'Cash Runway',
      observedState: { value: 0.4, raw_value: 8, cap: 20, unit: 'months', source: 'cee_inference' },
    },
  },
]

/**
 * ⭐ A canvas that holds NONE of the manifest's estimated factors, inside the
 * SAME scenario — the divergence `#1491` measured and pinned, staged here as
 * the state that keeps the Model-tab route honest. The scenario gate passes
 * straight through it: matching the decision does not imply matching the node.
 */
const CANVAS_HOLDS_NO_ESTIMATED_FACTOR = [
  { id: 'g1', type: 'goal', data: { label: 'Protect the runway' } },
  { id: 'opt_stay', type: 'option', data: { label: 'Stay the course' } },
]

/**
 * The producer's withheld-designation refusal, as `withheldReasonHasAMove`
 * captured it. Copied from that file rather than re-voiced, so the two suites
 * cannot drift on what CEE actually said.
 *
 * ⚠ `Olumi’s` IS U+2019, NOT AN ASCII APOSTROPHE — copied, not retyped.
 */
const CAPTURED_REFUSAL = {
  structurally_analysable: true,
  missing_important_inputs: [],
  semantic_quality_sufficient: false,
  permitted_analysis_mode: 'quantified_provisional',
  reasons: [
    {
      field: 'structurally_analysable',
      code: 'READY_TO_COMPARE',
      message: 'Analysis can run on this model as it stands.',
    },
    {
      field: 'permitted_analysis_mode',
      code: 'CONFIDENCE_PARAMETERS_ALL_MACHINE_AUTHORED',
      message:
        'Every estimate this comparison rests on is Olumi’s, not yours. Figures can be shown as provisional, but no option can be called the leader and no result can be called stable or robust until you have set at least one of them.',
    },
  ],
}

const withheld = (): ResultsSectionDataReturn => {
  const data = decisionWithLeaderWithheld()
  return {
    ...data,
    recommendation: { ...data.recommendation, analysisAdmission: CAPTURED_REFUSAL },
  } as ResultsSectionDataReturn
}

const seedManifest = () => {
  useContextIntegrityStore.getState().setContextIntegrity({
    scenarioId: LIVE_SCENARIO_ID,
    briefText: (b1Fixture as { brief_text: string }).brief_text,
    // ⚠ THROUGH THE REAL BOUNDARY PARSER, never a hand-built manifest — a
    // hand-built object encodes my model of the manifest rather than the
    // manifest (`#1491`'s suite states the same rule).
    manifest: parseNotModelled((b1Fixture as { not_modelled: unknown }).not_modelled),
  })
}

/**
 * ⚠⚠ RENDERED AT `AnalysisNewTabBody` — THE SURFACE THE DEPLOYED FLAGS MOUNT,
 * and the only one that holds BOTH halves of this seam. `OutputsDock` mounts
 * this component for the Reasoning tab, and it is the tab that opts in to the
 * value control. A harness that rendered `AtAGlance` alone could not observe
 * the defect at all: the register would not be there to act in (CLAUDE.md trap
 * 3b — this estate has twice shipped a feature dark by proving it against a
 * component the deployment does not render).
 */
const renderTab = (onReviewEstimates?: () => void) =>
  render(
    <AnalysisNewTabBody
      resultsSectionData={withheld()}
      isPreRun={false}
      isRunning={false}
      isStale={false}
      responseHash="run_abc123"
      canRunAnalysis
      runBlockedReason={null}
      onReviewEstimates={onReviewEstimates}
    />,
  )

const registerIsOpen = (): boolean =>
  screen.getByTestId(TOGGLE).getAttribute('aria-expanded') === 'true'

/** A value control on one row, found BY NODE ID — never by position. */
const valueControlFor = (nodeId: string): HTMLElement | undefined =>
  screen.queryAllByTestId(`${ESTIMATED}-value-edit`).find((el) => el.getAttribute('data-node-id') === nodeId)

beforeEach(() => {
  showToast.mockReset()
  conversation = { sendSystemEvent: () => Promise.resolve(undefined) }
  useContextIntegrityStore.getState().reset()
  useCanvasStore.setState({
    currentScenarioId: LIVE_SCENARIO_ID,
    nodes: CANVAS_HOLDS_THE_FACTOR,
  } as never)
  seedManifest()
})

afterEach(() => {
  useContextIntegrityStore.getState().reset()
  useCanvasStore.setState({ currentScenarioId: null, nodes: [] } as never)
  cleanup()
})

/**
 * ⚠ THE PRECONDITIONS, PINNED IN-TEST. Without these the whole file could pass
 * by testing nothing: a fixture that stopped withholding, or a manifest that
 * stopped listing this factor, would make every case below an assertion about a
 * state the surface never reaches (CLAUDE.md trap 13b — a guard whose
 * discrimination depends on a fixture nothing pins).
 */
describe('the fixtures reproduce the state this file is about', () => {
  it('the run withholds the designation AND asks for an estimate', () => {
    const glance = buildAnalysisNewViewModel({
      data: withheld(),
      recommendations: [],
      isPreRun: false,
      isRunning: false,
      isStale: false,
    }).atAGlance
    expect(glance.headline, 'this run named a leader, so no refusal renders').toBeNull()
    expect(glance.designationWithheldReason).toBeTruthy()
    expect(
      glance.designationWithheldRemedy,
      'the act only renders on an estimate remedy; this fixture must carry one',
    ).toBe('estimate')
  })

  it('the manifest lists the target factor, and the canvas holds it', () => {
    const manifest = parseNotModelled((b1Fixture as { not_modelled: unknown }).not_modelled)
    expect(
      manifest?.inferredFactors.items.map((f) => f.nodeId),
      'the anchor left the fixture — every case below would be about an absent row',
    ).toContain(TARGET_NODE_ID)
    expect(CANVAS_HOLDS_THE_FACTOR.map((n) => n.id)).toContain(TARGET_NODE_ID)
    expect(
      CANVAS_HOLDS_NO_ESTIMATED_FACTOR.map((n) => n.id),
      'the unresolvable canvas must hold NONE of them, or the pair collapses',
    ).not.toContain(TARGET_NODE_ID)
  })
})

describe('when the reader can correct an estimate here, the act stays here', () => {
  /**
   * ⭐⭐ RED-FIRST SIGNATURE 1 — at pristine the press calls the dock's route
   * and the register stays shut, so BOTH assertions below fail.
   *
   * This is the defect in one line: the product sent a reader to another tab to
   * do something available two sections below the button they pressed.
   */
  it('opens "What I estimated" on the act, rather than routing to the Model tab', () => {
    const routeToModelTab = vi.fn()
    renderTab(routeToModelTab)

    expect(screen.getByTestId(SENTENCE)).toBeInTheDocument()
    expect(registerIsOpen(), 'the register must start shut, or this proves nothing').toBe(false)

    fireEvent.click(screen.getByTestId(CONTROL))

    // ⚠ THE DEFECT IS ASSERTED FIRST, so the pristine failure message names it
    // rather than naming a symptom of it.
    expect(
      routeToModelTab,
      'the reader was sent to the Model tab while the estimate was editable here',
    ).not.toHaveBeenCalled()
    expect(registerIsOpen()).toBe(true)
    expect(
      valueControlFor(TARGET_NODE_ID),
      'the act landed somewhere with no control on it',
    ).toBeInTheDocument()
  })

  /**
   * ⭐ THE CAPABILITY HALF. A host that can route NOWHERE now still carries the
   * act, because this tab holds one of its own. At pristine `AtAGlance` is
   * fail-closed on the handler alone, so no control renders at all and this
   * fails on `toBeInTheDocument`.
   */
  it('offers the act even where the host has no route at all', () => {
    renderTab(undefined)
    expect(screen.getByTestId(SENTENCE)).toBeInTheDocument()
    expect(screen.getByTestId(CONTROL)).toBeInTheDocument()

    fireEvent.click(screen.getByTestId(CONTROL))
    expect(registerIsOpen()).toBe(true)
    expect(valueControlFor(TARGET_NODE_ID)).toBeInTheDocument()
  })
})

describe('when the reader cannot correct an estimate here, the route holds', () => {
  /**
   * ⭐⭐ THE OPPOSITE-DIRECTION TWIN, and the half that makes the pair
   * discriminating. It PASSES at pristine — that is the point: it pins the
   * behaviour that must survive the fix.
   *
   * ⚠ MUTANT: make `revealEstimatedValueAct` answer `true` unconditionally, or
   * make `useEstimatedValueActIsAvailable` return `true`. This REDs and the two
   * cases above stay GREEN — sensitivity to the NAMED condition, not to the
   * change in general (CLAUDE.md trap 19's discriminating pair).
   */
  it('routes to the Model tab when the canvas does not hold the estimated factor', () => {
    useCanvasStore.setState({
      currentScenarioId: LIVE_SCENARIO_ID,
      nodes: CANVAS_HOLDS_NO_ESTIMATED_FACTOR,
    } as never)
    const routeToModelTab = vi.fn()
    renderTab(routeToModelTab)

    expect(screen.getByTestId(SENTENCE)).toBeInTheDocument()
    fireEvent.click(screen.getByTestId(CONTROL))

    expect(routeToModelTab).toHaveBeenCalledTimes(1)
    expect(
      registerIsOpen(),
      'the register was opened on a state that offers no act in it',
    ).toBe(false)
  })

  /**
   * ⭐ THE FRESH-DECISION STATE, which is not an edge case. The manifest is
   * written only on the cold read, so a decision drafted in this session has
   * `manifest: null` and the register lists no estimated factor at all. The
   * Model tab is the only place to go, and the act must go there.
   */
  it('routes to the Model tab on a decision whose manifest was never written', () => {
    useContextIntegrityStore.getState().setContextIntegrity({
      scenarioId: LIVE_SCENARIO_ID,
      briefText: (b1Fixture as { brief_text: string }).brief_text,
      manifest: null,
    })
    const routeToModelTab = vi.fn()
    renderTab(routeToModelTab)

    fireEvent.click(screen.getByTestId(CONTROL))
    expect(routeToModelTab).toHaveBeenCalledTimes(1)
  })

  /**
   * ⚠ NO CARRIER, NO IN-PAGE ACT — the second conjunct of the one rule, pinned
   * separately from the first. Without a conversation `#1491`'s control does not
   * render, so revealing the register would show a reader a list with nothing
   * to press on it.
   */
  it('routes to the Model tab when there is no conversation to carry an edit', () => {
    conversation = null
    const routeToModelTab = vi.fn()
    renderTab(routeToModelTab)

    fireEvent.click(screen.getByTestId(CONTROL))
    expect(routeToModelTab).toHaveBeenCalledTimes(1)
    expect(registerIsOpen()).toBe(false)
  })

  /**
   * ⛔⛔ FAIL-CLOSED, AND IT IS THE ASSERTION THAT STOPS THIS LANE SHIPPING A
   * DEAD BUTTON. Neither an in-page act nor a route: the refusal must render
   * its sentence ALONE. `AtAGlance`'s own rule — "a staleness sentence with a
   * dead button beside it is worse than the sentence alone" — is what this
   * composition may not quietly defeat by always passing a handler down.
   */
  it('renders the sentence alone when there is neither an act here nor a route', () => {
    useCanvasStore.setState({
      currentScenarioId: LIVE_SCENARIO_ID,
      nodes: CANVAS_HOLDS_NO_ESTIMATED_FACTOR,
    } as never)
    renderTab(undefined)

    expect(screen.getByTestId(SENTENCE)).toBeInTheDocument()
    expect(screen.queryByTestId(CONTROL)).not.toBeInTheDocument()
  })
})
