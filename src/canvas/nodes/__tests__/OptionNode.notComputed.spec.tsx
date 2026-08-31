/**
 * OptionNode — the option the analysis RAN ON and could not compute.
 *
 * ## Why this spec does NOT mock `useNodeDisplayMetadata`
 *
 * `OptionNode.spec.tsx` mocks the hook and drives the component off the mock's
 * return value. That is the right shape for testing what the card RENDERS, and
 * the wrong shape for this defect, because the defect lives in the SEAM: the
 * producer put `status` on `option_probabilities[id]` and the canvas never
 * consulted it. A test that hands the component a pre-computed
 * `winComputationFailed: true` proves the render and asserts nothing about
 * whether anything ever sets it — a guard agreeing with itself (CLAUDE.md trap
 * 13b), and it would stay green if the hook's gate were deleted outright.
 *
 * So every case below writes a REAL report into the REAL store and lets the
 * REAL hook derive from it. The only thing asserted is what a user would see.
 *
 * ## The binding is by IDENTITY, not by a value predicate
 *
 * Each assertion targets `option-not-computed-${id}` / `option-win-readout-${id}`
 * for a NAMED option, and every fixture below carries a SECOND option in the
 * same render whose status differs. A test that merely found "a card with no
 * percentage" could be satisfied by the wrong card (trap 19); binding to the id
 * means the failed option and its computed sibling must diverge in the same DOM.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { OptionNode } from '../OptionNode'
import { useCanvasStore } from '../../store'
import { NOT_COMPUTED_BADGE, NOT_COMPUTED_REASON_COPY } from '../../../components/results/utils/notAnalysedCopy'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const FAILED = 'opt-failed'
const COMPUTED_TRUE_ZERO = 'opt-true-zero'

// React Flow's `NodeProps` requires the full plumbing set — `deletable`,
// `selectable` and `draggable` included. Omitting them is a TS2739 in exactly
// the shape that made #1037 red on three checks, so they are here rather than
// discovered by the ratchet.
const baseProps = {
  type: 'option',
  position: { x: 0, y: 0 },
  selected: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
  deletable: true,
  selectable: true,
  draggable: true,
}

/**
 * A report carrying BOTH shapes at once.
 *
 * ⚠ `win_probability: 0` IS PRESENT ON THE FAILED OPTION ON PURPOSE, and it is
 * the whole point of the fixture. The producer really does send a finite `0`
 * there (`n_valid === 0` means the share is not a measurement, not that the
 * field is absent), so a fix that only handled a MISSING share would pass a
 * fixture that omitted it while leaving the live defect untouched. The genuine
 * measured zero beside it carries the identical number — the two are
 * distinguishable ONLY by `status`, which is exactly the claim under test.
 */
const twoOptionReport = (opts: { failedReason?: string } = {}) => ({
  status: 'complete' as const,
  report: {
    option_probabilities: {
      [FAILED]: {
        confidence: 0.5,
        win_probability: 0,
        status: 'failed',
        ...(opts.failedReason !== undefined ? { status_reason: opts.failedReason } : {}),
      },
      [COMPUTED_TRUE_ZERO]: {
        confidence: 0.9,
        win_probability: 0,
        status: 'computed',
      },
    },
  },
})

const renderBoth = (results: ReturnType<typeof twoOptionReport>) => {
  useCanvasStore.setState({
    nodes: [
      { id: FAILED, type: 'option', position: { x: 0, y: 0 }, data: { label: 'Hold the current plan', type: 'option' } },
      { id: COMPUTED_TRUE_ZERO, type: 'option', position: { x: 200, y: 0 }, data: { label: 'Double the spend', type: 'option' } },
    ],
    edges: [],
    results,
  } as never)
  return render(
    <ReactFlowProvider>
      <OptionNode {...baseProps} id={FAILED} data={{ label: 'Hold the current plan', type: 'option' }} />
      <OptionNode {...baseProps} id={COMPUTED_TRUE_ZERO} data={{ label: 'Double the spend', type: 'option' }} />
    </ReactFlowProvider>,
  )
}

describe('OptionNode — a failed computation is not a measured zero', () => {
  beforeEach(() => {
    useCanvasStore.setState({ results: { status: 'idle', report: null } } as never)
  })

  it('renders NO win readout for an option the producer marked failed', () => {
    renderBoth(twoOptionReport())
    // The defect: this used to render a hard `0%` with a zero-width fill bar,
    // in the slot that answers how often the option came out ahead.
    expect(screen.queryByTestId(`option-win-readout-${FAILED}`)).toBeNull()
    expect(screen.queryByTestId(`option-win-anchor-${FAILED}`)).toBeNull()
  })

  it('says WHY, rather than falling silent', () => {
    renderBoth(twoOptionReport())
    // Silence in a row of bars reads as a rendering gap, or as "it came last".
    expect(screen.getByTestId(`option-not-computed-${FAILED}`)).toBeInTheDocument()
    expect(screen.getByTestId(`option-not-computed-${FAILED}`)).toHaveTextContent(NOT_COMPUTED_BADGE)
  })

  it('gives the full sanctioned sentence to assistive technology, not only to `title`', () => {
    renderBoth(twoOptionReport())
    const row = screen.getByTestId(`option-not-computed-${FAILED}`)
    // A `title` is unreachable by keyboard here (the row is not focusable) and
    // absent on touch, so the sentence has to be in the accessible tree too.
    expect(row.textContent).toContain(NOT_COMPUTED_REASON_COPY)
    expect(row.getAttribute('title')).toContain(NOT_COMPUTED_REASON_COPY)
  })

  it('appends the producer’s own reason when it sent one, never substituting for the sentence', () => {
    renderBoth(twoOptionReport({ failedReason: 'Blocked by: DEGENERATE_DISTRIBUTION' }))
    const row = screen.getByTestId(`option-not-computed-${FAILED}`)
    expect(row.textContent).toContain(NOT_COMPUTED_REASON_COPY)
    expect(row.textContent).toContain('Blocked by: DEGENERATE_DISTRIBUTION')
  })

  // ── THE OPPOSITE DIRECTION, IN THE SAME RENDER ──────────────────────────────
  // Without these, a change that suppressed EVERY option's readout would pass
  // every assertion above.

  it('a GENUINE measured zero keeps its readout and gets no disclosure', () => {
    renderBoth(twoOptionReport())
    expect(screen.getByTestId(`option-win-readout-${COMPUTED_TRUE_ZERO}`)).toBeInTheDocument()
    expect(screen.queryByTestId(`option-not-computed-${COMPUTED_TRUE_ZERO}`)).toBeNull()
  })

  it("a 'partial' option is a DISCLOSURE with a distribution behind it and keeps its readout", () => {
    // ISL emits a full outcome block for `partial` (0 < n_valid/n_total < 0.8)
    // and raises LOW_EFFECTIVE_SAMPLES. A `status !== 'computed'` gate would
    // discard a result the producer honestly computed.
    const r = twoOptionReport()
    ;(r.report.option_probabilities[FAILED] as { status: string }).status = 'partial'
    renderBoth(r)
    expect(screen.getByTestId(`option-win-readout-${FAILED}`)).toBeInTheDocument()
    expect(screen.queryByTestId(`option-not-computed-${FAILED}`)).toBeNull()
  })

  it('an ABSENT status is the legacy V1 shape and stays on the ordinary path', () => {
    // ISL's V1 `OptionResult` has no `status` field at all. Reading silence as
    // failure would suppress a result that WAS computed.
    const r = twoOptionReport()
    delete (r.report.option_probabilities[FAILED] as { status?: string }).status
    renderBoth(r)
    expect(screen.getByTestId(`option-win-readout-${FAILED}`)).toBeInTheDocument()
    expect(screen.queryByTestId(`option-not-computed-${FAILED}`)).toBeNull()
  })

  it('an UNRECOGNISED token is not read as failure', () => {
    // The shared contract types `status` as a bare `z.ZodOptional<z.ZodString>`,
    // so a token this UI has never heard of is a legal payload.
    const r = twoOptionReport()
    ;(r.report.option_probabilities[FAILED] as { status: string }).status = 'some_future_token'
    renderBoth(r)
    expect(screen.getByTestId(`option-win-readout-${FAILED}`)).toBeInTheDocument()
    expect(screen.queryByTestId(`option-not-computed-${FAILED}`)).toBeNull()
  })

  // ── THE SECOND SURFACE BUILT FROM THE SAME NUMBER ──────────────────────────

  it('makes no COMPARATIVE claim about an option that was never scored', () => {
    // The readout is not the only reader of `win_probability`. `closeCallGapPp`
    // computes a gap against the leader and, inside 5pp, renders "Close call
    // with the leading option". A failed option's finite `0` yields a
    // perfectly well-formed 3pp gap — so before the gate, suppressing the
    // number left a claim about the option's RELATIONSHIP to the leader
    // standing on the same non-measurement. That is the worse falsehood of the
    // two, because it carries no number and so reads as a judgement.
    useCanvasStore.setState({
      nodes: [
        { id: FAILED, type: 'option', position: { x: 0, y: 0 }, data: { label: 'Hold the current plan', type: 'option' } },
        { id: COMPUTED_TRUE_ZERO, type: 'option', position: { x: 200, y: 0 }, data: { label: 'Double the spend', type: 'option' } },
      ],
      edges: [],
      results: {
        status: 'complete',
        report: {
          // The producer's own leader designation — `deriveDecisionVerdict`
          // RENDERS a claim, it does not derive one, so without this the
          // close-call line cannot render for EITHER option and the assertion
          // below would pass by testing nothing (trap 13).
          //
          // ⚠ IT LIVES UNDER `robustness`, NOT AT THE REPORT ROOT
          // (`decisionVerdict.ts:352`). Placed at the root it is silently
          // ignored, `hasLeadingOption` stays false, and the close-call line
          // cannot render — which is exactly how the first draft of this test
          // passed while proving nothing. The positive control below is what
          // caught it.
          robustness: { near_tie: { is_tie: false, top_option_id: COMPUTED_TRUE_ZERO } },
          option_probabilities: {
            [FAILED]: { confidence: 0.5, win_probability: 0, status: 'failed' },
            [COMPUTED_TRUE_ZERO]: { confidence: 0.9, win_probability: 0.03, status: 'computed' },
          },
        },
      },
    } as never)
    render(
      <ReactFlowProvider>
        <OptionNode {...baseProps} id={FAILED} data={{ label: 'Hold the current plan', type: 'option' }} />
      </ReactFlowProvider>,
    )
    expect(screen.queryByText(/Close call/i)).toBeNull()
  })

  it('POSITIVE CONTROL: the same 3pp gap DOES render the close-call line for a COMPUTED option', () => {
    // Without this, the assertion above would pass if the close-call line were
    // simply unreachable in this harness — an absence proven by an instrument
    // that can never show a presence (CLAUDE.md trap 13). Same fixture, same
    // gap, same leader; only `status` differs.
    useCanvasStore.setState({
      nodes: [
        { id: FAILED, type: 'option', position: { x: 0, y: 0 }, data: { label: 'Hold the current plan', type: 'option' } },
        { id: COMPUTED_TRUE_ZERO, type: 'option', position: { x: 200, y: 0 }, data: { label: 'Double the spend', type: 'option' } },
      ],
      edges: [],
      results: {
        status: 'complete',
        report: {
          robustness: { near_tie: { is_tie: false, top_option_id: COMPUTED_TRUE_ZERO } },
          option_probabilities: {
            [FAILED]: { confidence: 0.5, win_probability: 0, status: 'computed' },
            [COMPUTED_TRUE_ZERO]: { confidence: 0.9, win_probability: 0.03, status: 'computed' },
          },
        },
      },
    } as never)
    render(
      <ReactFlowProvider>
        <OptionNode {...baseProps} id={FAILED} data={{ label: 'Hold the current plan', type: 'option' }} />
      </ReactFlowProvider>,
    )
    expect(screen.getByText(/Close call/i)).toBeInTheDocument()
  })

  it('renders nothing at all outside results mode', () => {
    useCanvasStore.setState({
      nodes: [{ id: FAILED, type: 'option', position: { x: 0, y: 0 }, data: { label: 'Hold', type: 'option' } }],
      edges: [],
      results: { status: 'idle', report: null },
    } as never)
    render(
      <ReactFlowProvider>
        <OptionNode {...baseProps} id={FAILED} data={{ label: 'Hold', type: 'option' }} />
      </ReactFlowProvider>,
    )
    expect(screen.queryByTestId(`option-not-computed-${FAILED}`)).toBeNull()
    expect(screen.queryByTestId(`option-win-readout-${FAILED}`)).toBeNull()
  })
})
