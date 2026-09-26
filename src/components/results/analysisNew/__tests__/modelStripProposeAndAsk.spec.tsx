/**
 * E10 of the reasoning-V2 editability map (Bundle B).
 *
 * ⚠⚠ THE GAP, MEASURED: the mark detail offered "Show on canvas" and, for
 * factors only, "Change this value" — "no edit or ask for options, risks or
 * outcomes" (the map's own words). The prototype's `selectedHTML` (P:539)
 * offers `edit-entity` ("Propose a change to this element") and `ask-entity`
 * ("Ask Olumi about this item") for EVERY kind, and neither writes the model —
 * both stage a message in the shared composer (P:616). This file proves both
 * acts now render on a non-factor kind (the class the map found missing) and
 * that each is bound to the node the reader actually picked, not a fixed one.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

const nodes: Array<{ id: string; type?: string; data?: unknown }> = []
const setHighlightedNodes = vi.fn()

type MockState = { nodes: unknown; setHighlightedNodes: unknown }
vi.mock('../../../../canvas/store', () => {
  const read = (): MockState => ({ nodes, setHighlightedNodes })
  const useCanvasStore = (select: (s: MockState) => unknown) => select(read())
  ;(useCanvasStore as unknown as { getState: () => MockState }).getState = read
  return { useCanvasStore }
})
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn(() => true) }))
vi.mock('../../../../canvas/utils/highlightHelpers', () => ({
  highlightNode: vi.fn(),
  clearHighlight: vi.fn(),
}))
vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))

import { ModelStrip } from '../sections/ModelStrip'
import { openAskOlumi } from '../../coaching/askOlumiStore'

const TID = 'analysis-new-model-strip'

const node = (id: string, type: string, label: string, data: Record<string, unknown> = {}) => ({
  id,
  type,
  data: { label, ...data },
})

const CANVAS = [
  node('g1', 'goal', 'Adopt a new CRM within budget'),
  node('o1', 'option', 'Migrate to HubSpot'),
  node('f1', 'factor', 'Data migration risk'),
  node('r1', 'risk', 'Vendor lock-in'),
]

const setCanvas = (next: ReadonlyArray<ReturnType<typeof node>>) => {
  nodes.length = 0
  nodes.push(...next)
}

const mark = (nodeId: string) =>
  screen.getAllByTestId(`${TID}-mark`).find((el) => el.getAttribute('data-node-id') === nodeId)!

// ⚠ 26 Sep (design audit B12): a mark opens its detail on ACTIVATION, as the
// prototype's does; pointing at it only rings the node.
const openDetailFor = (nodeId: string) => {
  render(<ModelStrip isPreRun={false} />)
  fireEvent.click(screen.getByTestId(`${TID}-toggle`))
  fireEvent.click(mark(nodeId))
}

beforeEach(() => {
  vi.mocked(openAskOlumi).mockReset()
  setHighlightedNodes.mockClear()
  setCanvas(CANVAS)
})
afterEach(() => cleanup())

describe('E10: "Propose a change" and "Ask about this item" render for EVERY kind', () => {
  /**
   * ⭐⭐ THE CASE THE MAP FOUND MISSING. Before this change these two acts
   * existed nowhere for a risk (or an option, or an outcome) — only "Show on
   * canvas". A risk node is the discriminating case: if these buttons were
   * still gated to `kind === 'factor'`, this is where it would show.
   */
  it('a RISK detail carries both acts, not only "Show on canvas"', () => {
    openDetailFor('r1')
    expect(screen.getByTestId(`${TID}-detail-propose`)).toBeInTheDocument()
    expect(screen.getByTestId(`${TID}-detail-ask`)).toBeInTheDocument()
  })

  it('an OPTION detail carries both acts too', () => {
    openDetailFor('o1')
    expect(screen.getByTestId(`${TID}-detail-propose`)).toBeInTheDocument()
    expect(screen.getByTestId(`${TID}-detail-ask`)).toBeInTheDocument()
  })

  it('a FACTOR keeps both new acts ALONGSIDE its existing "Change this value" editor', () => {
    openDetailFor('f1')
    expect(screen.getByTestId(`${TID}-detail-propose`)).toBeInTheDocument()
    expect(screen.getByTestId(`${TID}-detail-ask`)).toBeInTheDocument()
    // ⛔ Regression guard: E10 must not have displaced E5 (DONE, Paul's 24 Sep
    // ruling — "Change this value" stays on every factor).
    expect(screen.getByTestId(`${TID}-detail-value-edit`)).toBeInTheDocument()
  })

  /**
   * ⚠ 26 Sep (design audit B12): the prototype's acts are ICON-ONLY, so the
   * name moved from visible text to the accessible name — which
   * `PanelIconButton` also shows as its tooltip. Still never a bare `title`:
   * the name is announced, and a title carries nothing.
   */
  it('neither act is named only in a title attribute — each carries an accessible name', () => {
    openDetailFor('r1')
    const propose = screen.getByTestId(`${TID}-detail-propose`)
    const ask = screen.getByTestId(`${TID}-detail-ask`)
    expect(propose.getAttribute('title') ?? '').toBe('')
    expect(ask.getAttribute('title') ?? '').toBe('')
    expect(propose).toHaveAccessibleName(/propose a change/i)
    expect(ask).toHaveAccessibleName(/ask olumi/i)
  })
})

describe('both acts stage a message and write NOTHING', () => {
  it('"Propose a change" opens the composer bound to the node the reader picked', () => {
    openDetailFor('r1')
    fireEvent.click(screen.getByTestId(`${TID}-detail-propose`))
    expect(openAskOlumi).toHaveBeenCalledTimes(1)
    const payload = vi.mocked(openAskOlumi).mock.calls[0][0]
    expect(payload.targetId).toBe('r1')
    expect(payload.draft).toMatch(/vendor lock-in/i)
    expect(payload.draft).toMatch(/before applying anything/i)
  })

  /**
   * ⭐⭐ THE DISCRIMINATING TWIN. A button wired to a fixed id, or to whichever
   * node rendered first, satisfies the case above and fails this one.
   */
  it('…and picking a DIFFERENT node sends a DIFFERENT targetId and draft', () => {
    openDetailFor('o1')
    fireEvent.click(screen.getByTestId(`${TID}-detail-propose`))
    const payload = vi.mocked(openAskOlumi).mock.calls[0][0]
    expect(payload.targetId).toBe('o1')
    expect(payload.draft).toMatch(/migrate to hubspot/i)
    expect(payload.draft).not.toMatch(/vendor lock-in/i)
  })

  it('"Ask Olumi about this item" carries a different draft from "Propose a change"', () => {
    openDetailFor('r1')
    fireEvent.click(screen.getByTestId(`${TID}-detail-ask`))
    const payload = vi.mocked(openAskOlumi).mock.calls[0][0]
    expect(payload.targetId).toBe('r1')
    expect(payload.draft).toMatch(/help me understand/i)
    expect(payload.draft).not.toMatch(/before applying anything/i)
  })

  it('neither act touches the canvas ring — that stays the mark/row gesture', () => {
    openDetailFor('r1')
    setHighlightedNodes.mockClear()
    fireEvent.click(screen.getByTestId(`${TID}-detail-propose`))
    fireEvent.click(screen.getByTestId(`${TID}-detail-ask`))
    expect(setHighlightedNodes).not.toHaveBeenCalled()
  })
})
