import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { OptionNode } from '../OptionNode'
import { useCanvasStore } from '../../store'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const baseProps = {
  type: 'option', position: { x: 0, y: 0 }, selected: false,
  isConnectable: true, positionAbsoluteX: 0, positionAbsoluteY: 0,
  dragging: false, zIndex: 0, deletable: true, selectable: true, draggable: true,
}
const option = (id: string, data: Record<string, unknown> = {}) => ({
  id, type: 'option', position: { x: 0, y: 0 }, data: { label: id, type: 'option', ...data },
})
const factor = (id: string) => ({
  id, type: 'factor', position: { x: 0, y: 0 },
  data: { label: `Recorded ${id}`, type: 'factor', observedState: { value: 0.2 } },
})

beforeEach(() => {
  useCanvasStore.setState({
    nodes: [], edges: [], ceeAnalysisReady: null,
    results: { status: 'idle', report: null }, viewMode: 'expert',
    // ⭐ THE FOURTH ABSENCE'S PRECONDITION, PINNED RATHER THAN INHERITED.
    // `useOptionLeftOutOfRun` withholds the `not_returned` sentence unless
    // `useAnalysisResultsAreCurrent` can vouch for the result on screen, so an
    // affirmative verdict is stated here rather than inherited from whatever
    // the store happens to initialise. A default is not a precondition: state
    // it, or the file silently tests a different rule the day the default moves
    // (CLAUDE.md trap 13b).
    //
    // ⚠ AND THE HONEST SCOPE OF THAT: every not-analysed assertion in THIS file
    // lands on the `no_interventions` arm, which is NOT gated — it reports the
    // graph as it is now. The seeding is a guard against a future case in this
    // file reaching the gated arm, not a load-bearing input to the ones here.
    analysisFreshness: { freshness: 'fresh' },
    analysisFreshnessDirty: false,
    importPendingServerRegistration: false,
  } as never)
})
afterEach(cleanup)

function mountOptions(options: ReturnType<typeof option>[]) {
  return render(<ReactFlowProvider>{options.map(node =>
    <OptionNode key={node.id} {...baseProps} id={node.id} data={node.data} />,
  )}</ReactFlowProvider>)
}

describe('a level-less option says WHY it was not analysed, from CEE\'s typed blocker (served BF5, 5e984a1d)', () => {
  // Served: "Keep £49 and add a paid AI add-on" read only "Not analysed"; the reason lived in a hover
  // title and screen-reader text. CEE's analysis_ready.blockers[] names it: option_id + blocker_type
  // 'missing_value' (+ factor_label). The card now says the short reason visibly, from that typed entry only.
  const addon = option('addon')
  const complete = { status: 'complete', report: { option_probabilities: { other: { status: 'computed', win_probability: 1 } } } }
  const blocker = { factor_id: 'f-rev', factor_label: 'Paid AI add-on revenue', option_id: 'addon', reason: 'needs a numeric level', blocker_type: 'missing_value' }

  it('RED: with the typed missing_value blocker, the row says "needs a value" visibly', () => {
    useCanvasStore.setState({ nodes: [addon, option('other')], results: complete, ceeAnalysisReady: { options: [], blockers: [blocker] } } as never)
    mountOptions([addon])
    expect(screen.getByTestId('option-not-analysed-addon')).toBeTruthy()
    expect(screen.getByTestId('option-not-analysed-reason-addon').textContent).toContain('needs a value')
  })

  it('CONTRAST: a blocker for ANOTHER option, or of another type, adds nothing', () => {
    useCanvasStore.setState({ nodes: [addon, option('other')], results: complete, ceeAnalysisReady: { options: [], blockers: [
      { ...blocker, option_id: 'other' }, { ...blocker, blocker_type: 'constraint_dropped' },
    ] } } as never)
    mountOptions([addon])
    expect(screen.getByTestId('option-not-analysed-addon')).toBeTruthy()
    expect(screen.queryByTestId('option-not-analysed-reason-addon')).toBeNull()
  })
})

describe('option delivery states through the real store and display selector', () => {
  it('distinguishes an absent result, a failed result and measured zero in the same graph', () => {
    const options = ['missing', 'failed', 'zero'].map(id => option(id))
    useCanvasStore.setState({
      nodes: options,
      results: { status: 'complete', report: { option_probabilities: {
        failed: { status: 'failed', win_probability: 0 },
        zero: { status: 'computed', win_probability: 0 },
      } } },
    } as never)
    mountOptions(options)
    // ⭐⭐ RE-RULED AGAIN — `missing` NOW STATES THE CAUSE, NOT THE SYMPTOM, AND
    // THIS ASSERTION IS THE RECORD OF WHY.
    //
    // It used to read `option-result-unavailable-missing` / "On the data so
    // far, no support percentage for this option", on the reasoning that
    // `zero` resolves a share so this graph is the PARTIAL case. The PARTIAL
    // reasoning is still right and it is pinned by the `outcome-only` case
    // below, which is an option the run DID analyse and simply returned no
    // share for. `missing` is not that: it has NO entry at all, so the run
    // never scored it, and the two states have OPPOSITE next steps — wait or
    // re-run, versus say what this option changes. One sentence covering both
    // is the pooling the four-absence ruling exists to prevent, and the
    // results panel has drawn this line since the no-rank ruling
    // (`NotAnalysedOptionCard`, Paul, 14 Aug 2026) while this card did not.
    // Two surfaces disagreeing about one option is trap 21 arriving as a
    // rendering difference.
    //
    // ⚠ NOTHING IS LOST BY THE YIELD: `notAnalysedReasonCopy` states the same
    // consequence in the same breath ("It has no rank and no probability") and
    // adds the ground the old sentence had no room for.
    expect(screen.getByTestId('option-not-analysed-missing'))
      .toHaveTextContent('This option has no values set yet, so it was left out of the comparison')
    expect(screen.queryByTestId('option-result-unavailable-missing')).toBeNull()
    expect(screen.queryByTestId('option-win-readout-missing')).toBeNull()
    expect(screen.queryByTestId('option-not-computed-missing')).toBeNull()
    expect(screen.getByTestId('option-not-computed-failed')).toBeInTheDocument()
    expect(screen.queryByTestId('option-result-unavailable-failed')).toBeNull()
    expect(screen.getByTestId('option-win-readout-zero')).toHaveTextContent('0%')
    expect(screen.queryByTestId('option-result-unavailable-zero')).toBeNull()
  })

  it.each([0, 0.5])('does not call a computed outcome with median %s an unavailable result', median => {
    const computed = option('outcome-only')
    // ⭐ A SIBLING THAT DID RESOLVE A SHARE KEEPS THIS IN THE PARTIAL CASE, and
    // that is the point of the test rather than an accommodation to it. When NO
    // option resolves a share the absence is a fact about the RUN, the cards
    // yield the position and the Question node states it once — so mounting
    // `outcome-only` alone would be asserting the run-wide branch while
    // claiming to test the per-option one. See
    // `OptionNode.supportShareRunWideAbsence.spec.tsx`.
    const sibling = option('has-share')
    const options = [computed, sibling]
    useCanvasStore.setState({
      nodes: options,
      results: { status: 'complete', report: { option_probabilities: {
        [computed.id]: {
          status: 'computed',
          outcome: { p10: median - 0.2, p50: median, p90: median + 0.2 },
          // The producer can supply a real outcome distribution without a
          // win share. A zero median is valid data, not a failed run.
        },
        [sibling.id]: { status: 'computed', win_probability: 0.4 },
      } } },
    } as never)
    mountOptions(options)
    // Locked Canvas design (23 Sep 2026; ED 11:52Z point 4 — never "Support",
    // results are model-relative): the same absence, in the model's own words.
    expect(screen.getByTestId('option-result-unavailable-outcome-only'))
      .toHaveTextContent('On the data so far, the model gave no share of runs for this option')
    expect(screen.getByTestId('option-result-unavailable-outcome-only').textContent).not.toMatch(/\bsupport\b/i)
    // ⭐ THE DISCRIMINATING HALF OF THE PAIR ABOVE. This option HAS an entry —
    // the run analysed it and returned an outcome distribution without a share
    // — so it is the genuine PARTIAL case and must NOT be re-badged as one the
    // run left out. Without this assertion a `leftOutOfRunReason` widened to
    // any missing share would pass every other line in this file.
    expect(screen.queryByTestId('option-not-analysed-outcome-only')).toBeNull()
    expect(screen.queryByText('Result unavailable', { exact: true })).toBeNull()
    expect(screen.queryByTestId('option-win-readout-outcome-only')).toBeNull()
    expect(screen.queryByTestId('option-not-computed-outcome-only')).toBeNull()
    expect(screen.queryByTestId('leading-option-pill-outcome-only')).toBeNull()
  })

  it('does not call an unanalysed draft a missing result', () => {
    const draft = option('draft')
    useCanvasStore.setState({ nodes: [draft] })
    mountOptions([draft])
    expect(screen.queryByTestId('option-result-unavailable-draft')).toBeNull()
  })

  it('reveals recorded baseline values even when they differ from observed factor values', () => {
    const baseline = option('baseline', { is_baseline: true, interventions: { f1: 0.8 } })
    useCanvasStore.setState({
      nodes: [baseline, factor('f1')],
      ceeAnalysisReady: { options: [{ id: baseline.id, interventions: { f1: 0.8 } }] },
      results: { status: 'complete', report: {} },
    } as never)
    mountOptions([baseline])
    expect(screen.getByText('Baseline factor values:')).toBeInTheDocument()
    expect(screen.getByText(/Recorded f1/i)).toBeInTheDocument()
    expect(screen.queryByText(/No changes to factors/)).toBeNull()
    expect(screen.queryByText(/No changes from current state/)).toBeNull()
  })

  it('offers the inspector when a draft has more values than the preview can show', async () => {
    const interventions = { f1: 0.1, f2: 0.2, f3: 0.3, f4: 0.4, f5: 0.5 }
    const draft = option('draft', { interventions })
    useCanvasStore.setState({
      nodes: [draft, ...Object.keys(interventions).map(factor)],
      ceeAnalysisReady: { options: [{ id: draft.id, interventions }] },
      viewMode: 'standard',
    } as never)
    const { container } = mountOptions([draft])
    fireEvent.mouseEnter(container.firstElementChild!)
    const more = await screen.findByRole('button', { name: '+1 more in inspector' })
    fireEvent.click(more)
    expect(useCanvasStore.getState().selection.nodeIds).toEqual(new Set([draft.id]))
  })
})
