import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { Edge, Node } from '@xyflow/react'
import { RestsOnKey } from '../../canvas/artefacts/RestsOnKey'
import { assumptionMapOf } from '../../canvas/artefacts/assumptionMapModel'
import { useCanvasStore } from '../../canvas/store'
import { PresentationProvider } from '../v10'
import { relianceByOption } from '../restsOnReliance'

vi.mock('../../flags', async (importOriginal) => ({ ...(await importOriginal<Record<string, unknown>>()), isGraphLensEnabled: () => true }))

afterEach(cleanup)

const at = (x: number, y: number) => ({ x, y })
const nodes: Node[] = [
  { id: 'A', type: 'option', position: at(0, 0), data: { label: 'Carry on as now' } },
  { id: 'B', type: 'option', position: at(300, 0), data: { label: 'Price cut' } },
  { id: 'C', type: 'option', position: at(600, 0), data: { label: 'Newsletter' } },
  // Olumi's estimate nobody has checked.
  { id: 'f', type: 'factor', position: at(0, 150), data: { label: 'Extra books', observedState: { value: 3, source: 'cee_inference' } } },
  // The person's own figure, and a figure still waiting for their answer.
  { id: 'h', type: 'factor', position: at(300, 150), data: { label: 'Books now', observedState: { value: 400, source: 'user_override' } } },
  { id: 'm', type: 'factor', position: at(450, 150), data: { label: 'Churn', value_basis: { kind: 'waiting_for_answer', words: 'Waiting for your answer' } } },
  { id: 'g', type: 'goal', position: at(300, 300), data: { label: 'Revenue' } },
]
const edge = (id: string, source: string, target: string): Edge => ({ id, source, target, data: {} })
const edges: Edge[] = [
  edge('A-f', 'A', 'f'), edge('B-h', 'B', 'h'), edge('B-m', 'B', 'm'),
  edge('f-g', 'f', 'g'), edge('h-g', 'h', 'g'), edge('m-g', 'm', 'g'),
]

function seed() {
  useCanvasStore.setState({
    currentScenarioId: 's', outcomeNodeId: 'g', ceeAnalysisReady: null, nodes, edges,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  } as never)
}
const key = (presentation: 'v10' | 'current', folded = false) => render(
  <MemoryRouter><PresentationProvider value={presentation}><RestsOnKey folded={folded} /></PresentationProvider></MemoryRouter>,
)

describe('v10 "Rests on": what each option stands on, counted by author', () => {
  it('counts the lens\'s own figures on each option\'s path, and nothing else', () => {
    const map = assumptionMapOf(nodes, edges, 'g')
    const rows = relianceByOption(nodes, edges, map.items, map.hasGoal)
    const by = Object.fromEntries(rows.map((r) => [r.optionId, r.counts]))
    // The route A -> f -> g: Olumi's unchecked value, and the link f -> g that has no strength yet.
    expect(by.A).toEqual({ yours: 0, accepted: 0, unchecked: 1, unknown: 0, missing: 1 })
    // B -> h -> g and B -> m -> g: one of the person's, three with no figure yet. None of A's figures leaks in.
    expect(by.B).toEqual({ yours: 1, accepted: 0, unchecked: 0, unknown: 0, missing: 3 })
    // CONTRAST: an option wired to nothing has nothing on its path.
    expect(rows.find((r) => r.optionId === 'C')!.total).toBe(0)
  })

  it('draws the bar, the key and a row for every option (a card is never blank), by author', () => {
    seed()
    key('v10')
    const reliance = screen.getByTestId('v10-rests-on-reliance')
    const rowOf = (id: string) => reliance.querySelector(`[data-option="${id}"]`) as HTMLElement
    // At rest the row is glyphs and counts; the words are the mark's name (hover and focus), said once in the key.
    const countsA = within(rowOf('A')).getAllByTestId(/^v10-rests-on-count-/u)
    expect(countsA.map((c) => [c.getAttribute('aria-label'), c.textContent])).toEqual([['Olumi’s, unchecked 1', '1'], ['No figure yet or origin not known 1', '1']])
    const segments = [...rowOf('A').querySelectorAll<HTMLElement>('[data-segment]')]
    expect(segments.map((s) => [s.dataset.segment, s.style.width])).toEqual([['unchecked', '50%'], ['unset', '50%']])
    expect(rowOf('B').querySelector('[data-segment="yours"]')).not.toBeNull()
    expect(rowOf('C').textContent).toContain('No figure on its path yet')
    expect(screen.getByTestId('v10-rests-on-legend-unchecked').textContent).toContain('Olumi’s, unchecked 1')
    expect(screen.getByTestId('v10-rests-on-legend-yours').textContent).toContain('Yours 1')
    // Never worded as a share of the uncertainty, and never a recommendation.
    expect(reliance.textContent).not.toMatch(/%|uncertainty comes|best|winner|recommend|should/iu)
  })

  it('tells the figures apart by author on the key\'s own numbers', () => {
    seed()
    key('v10')
    const columns = screen.getAllByTestId('rests-on-key-row').map((r) => [r.dataset.target, r.dataset.column])
    expect(columns).toContainEqual(['node:f', 'unchecked'])
    expect(columns).toContainEqual(['node:h', 'yours'])
    expect(columns).toContainEqual(['node:m', 'missing'])
  })

  it('shows the key folded too, so the model stays in view', () => {
    seed()
    key('v10', true)
    expect(screen.getByTestId('v10-rests-on-legend')).toBeTruthy()
    expect(screen.queryByTestId('v10-rests-on-reliance')).toBeNull()
  })

  it('leaves the current design as it was: no v10 parts, same sentence', () => {
    seed()
    const v10 = key('v10', true)
    const v10Headline = screen.getByTestId('rests-on-key-headline').textContent
    v10.unmount()
    for (const folded of [true, false]) {
      const current = render(<RestsOnKey folded={folded} />)
      expect(screen.queryByTestId('v10-rests-on-legend')).toBeNull()
      expect(screen.queryByTestId('v10-rests-on-reliance')).toBeNull()
      if (!folded) expect(screen.getByTestId('rests-on-key-headline').textContent).toBe(v10Headline)
      current.unmount()
    }
  })
})
