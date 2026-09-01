/**
 * Clicking a factor tells you what data is behind it, whose it is, and lets you
 * change it — without ever claiming an outcome it did not observe.
 *
 * ⭐ THE ASK THIS ANSWERS, in the founder's words: *"If you clicked on a certain
 * factor, you could see the exact data that's been identified as AI-generated
 * and enable the users to investigate and analyse it, and then edit it right
 * there and then."* Before this, the detail named the node and offered a route
 * to the canvas; it said nothing at all about the number the run was computed
 * from, and the tab could dispatch no durable edit of any kind.
 *
 * ⚠⚠ THE OUTCOME IS THE LOAD-BEARING PART, NOT THE FIELD.
 * `proposeFactorValue` answers `dispatched | local_only | not_encodable`, and
 * the type carries that three-way split precisely so a caller CANNOT report a
 * server acceptance it did not get. A single "Saved" over all three would be
 * this estate's signature defect wearing a new coat. Each arm is pinned
 * separately below, and each on a DIFFERENT sentence, so collapsing any two
 * REDs here.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

const nodes: unknown[] = []
const showToast = vi.fn()
const proposeFactorValue = vi.fn()

type MockState = { nodes: unknown; setHighlightedNodes: unknown }
vi.mock('../../../../canvas/store', () => {
  const read = (): MockState => ({ nodes, setHighlightedNodes: vi.fn() })
  const useCanvasStore = (select: (s: MockState) => unknown) => select(read())
  ;(useCanvasStore as unknown as { getState: () => MockState }).getState = read
  return { useCanvasStore }
})
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: () => true }))
vi.mock('../../../../canvas/utils/highlightHelpers', () => ({
  highlightNode: vi.fn(),
  clearHighlight: vi.fn(),
}))
vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/ToastContext', () => ({ useShowToastSafe: () => showToast }))
vi.mock('../../../../canvas/hooks/useModelEditAuthority', () => ({
  useModelEditAuthority: () => ({
    proposeFactorValue,
    proposeOptionIntervention: vi.fn(),
    proposeFactorConfirmation: vi.fn(),
  }),
}))

import { ModelStrip } from '../sections/ModelStrip'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'

const TID = 'analysis-new-model-strip'

const CANVAS = [
  { id: 'g1', type: 'goal', data: { label: 'Protect net revenue retention' } },
  { id: 'o1', type: 'option', data: { label: 'A full switch at renewal' } },
  {
    id: 'f_ai',
    type: 'factor',
    data: {
      label: 'Vendor licensing cost',
      observedState: { value: 0.49, raw_value: 49, unit: '£', source: 'cee_inference' },
    },
  },
  { id: 'f_bare', type: 'factor', data: { label: 'Competitive pressure' } },
]

/** Open the strip and the detail for one node, by identity. */
const openDetailFor = (nodeId: string) => {
  render(<ModelStrip isPreRun={false} />)
  fireEvent.click(screen.getByTestId(`${TID}-toggle`))
  const m = screen
    .getAllByTestId(`${TID}-mark`)
    .find((el) => el.getAttribute('data-node-id') === nodeId)
  if (!m) throw new Error(`no mark for ${nodeId} — the fixture, not the component, is wrong`)
  fireEvent.click(m)
}

beforeEach(() => {
  nodes.length = 0
  nodes.push(...CANVAS)
  showToast.mockReset()
  proposeFactorValue.mockReset().mockReturnValue('dispatched')
})
afterEach(cleanup)

describe('the detail says what the data behind a factor is', () => {
  it("shows the factor's value AS THE CANVAS RENDERS IT, and names whose it is", () => {
    openDetailFor('f_ai')
    const shown = screen.getByTestId(`${TID}-detail-value-text`)
    // £49 is `factorDisplayText`'s rendering of raw_value + unit — the same
    // formatter FactorNode calls. Asserting the STRING pins that this surface
    // did not mint a second formatter and start disagreeing with the node.
    expect(shown).toHaveTextContent('£49')
    expect(shown).toHaveAttribute('data-has-value', 'true')
    expect(screen.getByTestId(`${TID}-detail-value-source`)).toHaveTextContent('AI estimate')
  })

  /**
   * ⭐ THE TWO EMPTY STATES ARE DIFFERENT, and the panel's glance line already
   * uses the other one. "No value set" is about the absence of a NUMBER;
   * "whose source Olumi could not establish" is about our knowledge of a
   * SOURCE. A factor with no value has no source to establish, so rendering
   * the second over it sends the reader hunting for a provenance problem
   * behind a figure that was never there.
   */
  it('a factor with no number says so, and claims nothing about a source', () => {
    openDetailFor('f_bare')
    const shown = screen.getByTestId(`${TID}-detail-value-text`)
    expect(shown).toHaveTextContent(COPY.modelStrip.noValue)
    expect(shown).toHaveAttribute('data-has-value', 'false')
    expect(screen.queryByTestId(`${TID}-detail-value-source`)).not.toBeInTheDocument()
  })

  /** An option has no observed value; a value row over one would be a lie. */
  it('does not render a value row on a non-factor', () => {
    openDetailFor('o1')
    expect(screen.queryByTestId(`${TID}-detail-value`)).not.toBeInTheDocument()
  })
})

describe('the edit dispatches through the one write authority, and reports what happened', () => {
  const type = (v: string) => {
    fireEvent.click(screen.getByTestId(`${TID}-detail-value-edit`))
    fireEvent.change(screen.getByTestId(`${TID}-detail-value-input`), { target: { value: v } })
    fireEvent.click(screen.getByTestId(`${TID}-detail-value-save`))
  }

  it('sends the typed number to proposeFactorValue', () => {
    openDetailFor('f_ai')
    type('72')
    expect(proposeFactorValue).toHaveBeenCalledWith(72)
  })

  it('a dispatched edit says it was SENT, never that it was saved', () => {
    proposeFactorValue.mockReturnValue('dispatched')
    openDetailFor('f_ai')
    type('72')
    expect(showToast).toHaveBeenCalledWith(COPY.modelStrip.valueDispatched)
    // The editor closes: something did happen.
    expect(screen.queryByTestId(`${TID}-detail-value-input`)).not.toBeInTheDocument()
  })

  it('a local-only edit says the shared model still has the old value', () => {
    proposeFactorValue.mockReturnValue('local_only')
    openDetailFor('f_ai')
    type('72')
    expect(showToast).toHaveBeenCalledWith(COPY.modelStrip.valueLocalOnly)
  })

  /**
   * ⚠ AND THE EDITOR STAYS OPEN. Nothing was written anywhere, so closing it
   * would read as a success — the silent-failure shape this file's siblings
   * (#1078, #1084) exist to end.
   */
  it('an unencodable edit says nothing changed, and leaves the field open to correct', () => {
    proposeFactorValue.mockReturnValue('not_encodable')
    openDetailFor('f_ai')
    type('72')
    expect(showToast).toHaveBeenCalledWith(COPY.modelStrip.valueNotEncodable)
    expect(screen.getByTestId(`${TID}-detail-value-input`)).toBeInTheDocument()
  })

  /**
   * ⚠ THE AUTHORITY IS NEVER ASKED TO ENCODE A NON-NUMBER. Refusing at the
   * boundary keeps the "nothing changed" sentence true of the whole gesture
   * rather than only of the hop that refused it.
   */
  it('an empty or non-numeric entry never reaches the authority', () => {
    openDetailFor('f_ai')
    fireEvent.click(screen.getByTestId(`${TID}-detail-value-edit`))
    fireEvent.click(screen.getByTestId(`${TID}-detail-value-save`))
    expect(proposeFactorValue).not.toHaveBeenCalled()
    expect(showToast).toHaveBeenCalledWith(COPY.modelStrip.valueNotEncodable)
  })

  /**
   * ⭐ THE OPEN EDITOR BELONGS TO ONE FACTOR. A boolean would survive the
   * reader moving to another mark and offer them a field over a different
   * factor's value — the wrong-object binding this estate's trap 19 is about.
   */
  it('moving to another factor closes the editor rather than carrying it across', () => {
    openDetailFor('f_ai')
    fireEvent.click(screen.getByTestId(`${TID}-detail-value-edit`))
    expect(screen.getByTestId(`${TID}-detail-value-input`)).toBeInTheDocument()
    const other = screen
      .getAllByTestId(`${TID}-mark`)
      .find((el) => el.getAttribute('data-node-id') === 'f_bare')!
    fireEvent.click(other)
    expect(screen.queryByTestId(`${TID}-detail-value-input`)).not.toBeInTheDocument()
    expect(screen.getByTestId(`${TID}-detail-value-text`)).toHaveTextContent(COPY.modelStrip.noValue)
  })
})
