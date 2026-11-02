import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { Edge, Node } from '@xyflow/react'
import { RestsOnKey } from '../../canvas/artefacts/RestsOnKey'
import { useCanvasStore } from '../../canvas/store'
import { FactorValueFigure } from '../../canvas/nodes/shared/FactorValueFigure'
import { PresentationProvider } from '../v10'

vi.mock('../../flags', async (importOriginal) => ({ ...(await importOriginal<Record<string, unknown>>()), isGraphLensEnabled: () => true }))

afterEach(cleanup)

const at = (x: number, y: number) => ({ x, y })
const nodes: Node[] = [
  { id: 'A', type: 'option', position: at(0, 0), data: { label: 'Carry on as now' } },
  { id: 'B', type: 'option', position: at(300, 0), data: { label: 'Price cut' } },
  // Olumi's estimate nobody has checked, one the person accepted, the person's own, and one waiting for their answer.
  { id: 'f', type: 'factor', position: at(0, 150), data: { label: 'Extra books', observedState: { value: 3, source: 'cee_inference' } } },
  { id: 'a', type: 'factor', position: at(150, 150), data: { label: 'Reach', observedState: { value: 5, source: 'user_assumption', reviewed_by_user: { intent: 'confirm' } } } },
  { id: 'h', type: 'factor', position: at(300, 150), data: { label: 'Books now', observedState: { value: 400, source: 'user_override' } } },
  { id: 'm', type: 'factor', position: at(450, 150), data: { label: 'Churn', value_basis: { kind: 'waiting_for_answer', words: 'Waiting for your answer' } } },
  { id: 'g', type: 'goal', position: at(300, 300), data: { label: 'Revenue' } },
]
const link = (id: string, source: string, target: string): Edge => ({ id, source, target, data: {} })
const edges: Edge[] = [link('A-f', 'A', 'f'), link('A-a', 'A', 'a'), link('B-h', 'B', 'h'), link('B-m', 'B', 'm'),
  link('f-g', 'f', 'g'), link('a-g', 'a', 'g'), link('h-g', 'h', 'g'), link('m-g', 'm', 'g')]

function seed(graph: { nodes: Node[]; edges: Edge[]; goal: string | null } = { nodes, edges, goal: 'g' }) {
  useCanvasStore.setState({
    currentScenarioId: 's', outcomeNodeId: graph.goal, ceeAnalysisReady: null, nodes: graph.nodes, edges: graph.edges,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  } as never)
}
const key = (presentation: 'v10' | 'current', folded = false) => render(
  <MemoryRouter><PresentationProvider value={presentation}><RestsOnKey folded={folded} /></PresentationProvider></MemoryRouter>,
)

describe('v10 "Rests on": figures told apart by author', () => {
  it('tells the figures apart by author on the key\'s own numbers', () => {
    seed()
    key('v10')
    const columns = screen.getAllByTestId('rests-on-key-row').map((r) => [r.dataset.target, r.dataset.column])
    expect(columns).toContainEqual(['node:f', 'unchecked'])
    expect(columns).toContainEqual(['node:a', 'accepted'])
    expect(columns).toContainEqual(['node:h', 'yours'])
    expect(columns).toContainEqual(['node:m', 'missing'])
  })

  it('the author colours are CSS under the v10 scope: blue solid unchecked, outlined accepted, ink yours, dashed unset', () => {
    const css = readFileSync(resolve(__dirname, '../../index.css'), 'utf8')
    const start = css.indexOf('v10 "Rests on"')
    const block = css.slice(css.indexOf('*/', start) + 2)
    const rule = (column: string) => block.split('}').find((r) => r.includes(`[data-column="${column}"]`)) ?? ''
    expect(rule('unchecked')).toMatch(/border-color:\s*var\(--info\)/u)
    expect(rule('unchecked')).toMatch(/background-color:\s*var\(--info-light\)/u)
    expect(rule('accepted')).toMatch(/border-color:\s*var\(--info\)/u)
    expect(rule('accepted')).toMatch(/background-color:\s*var\(--bg-panel\)/u)
    expect(rule('yours')).toMatch(/border-color:\s*var\(--text-header\)/u)
    expect(rule('missing')).toMatch(/border-style:\s*dashed/u)
    expect(rule('unknown')).toMatch(/border-style:\s*dashed/u)
    // Every selector in the block starts at the v10 scope, so #/canvas cannot match.
    const selectors = block.replace(/\/\*[\s\S]*?\*\//gu, '').split('}').flatMap((r) => r.split('{')[0].split(/,\s*\n/u)).map((x) => x.trim()).filter(Boolean)
    expect(selectors.length).toBeGreaterThan(0)
    for (const selector of selectors) expect(selector.startsWith('[data-presentation="v10"]'), selector).toBe(true)
  })

  it('puts provenance on the figure, never the card: no card outline in v10, and the figure keeps its dotted info underline', () => {
    const css = readFileSync(resolve(__dirname, '../../index.css'), 'utf8')
    const rests = css.slice(css.indexOf('v10 "Rests on"'))
    expect(rests, 'POSITIVE CONTROL: the v10 Rests on block is in the sheet').toContain('rests-on-marker')
    expect(rests).not.toMatch(/react-flow__node/u)
    expect(rests).not.toMatch(/outline\s*:/u)
    render(<FactorValueFigure readout="3" parts={{ figure: '3', unit: null, attached: true } as never} nodeId="f" estimated />)
    const figure = screen.getByTestId('factor-value-figure-f')
    expect(figure.className).toMatch(/underline/u)
    expect(figure.className).toMatch(/decoration-dotted/u)
    expect(figure.className).toMatch(/decoration-info/u)
    cleanup()
    // CONTRAST: a figure that is not Olumi's estimate has no underline.
    render(<FactorValueFigure readout="3" parts={{ figure: '3', unit: null, attached: true } as never} nodeId="f" />)
    expect(screen.getByTestId('factor-value-figure-f').className).not.toMatch(/underline/u)
  })

  it('draws Olumi\'s figures with the Olumi mark the cards use, never Sparkles; accepted is ringed, unchecked is not', () => {
    seed()
    const folded = key('v10', true)
    const unchecked = screen.getByTestId('v10-rests-on-legend-unchecked')
    const settled = screen.getByTestId('v10-rests-on-legend-accepted')
    for (const li of [unchecked, settled]) {
      expect(li.querySelector('svg[data-icon="olumi-ai"]')).not.toBeNull()
      expect(li.querySelector('svg.lucide-sparkles')).toBeNull()
    }
    expect(unchecked.querySelector('[data-glyph="unchecked"]')).not.toBeNull()
    expect(unchecked.querySelector('.ring-info')).toBeNull()
    expect(settled.querySelector('[data-glyph="accepted"]')!.className).toContain('ring-info')
    expect(screen.getByTestId('v10-rests-on-legend-yours').textContent).toContain('Yours 1')
    folded.unmount()
    // Open, the key's own groups carry the same glyphs.
    key('v10')
    expect(document.querySelector('[data-testid="rests-on-key-group-unchecked"] svg[data-icon="olumi-ai"]')).not.toBeNull()
    expect(document.querySelector('[data-testid="rests-on-key-group-accepted"] [data-glyph="accepted"]')).not.toBeNull()
    expect(document.querySelector('[data-testid="rests-on-key"] svg.lucide-sparkles')).toBeNull()
  })

  it('says each label once: folded the legend names the authors; open the groups do, and the legend steps aside', () => {
    seed()
    const folded = key('v10', true)
    expect(screen.getByTestId('v10-rests-on-legend')).toBeTruthy()
    folded.unmount()
    key('v10')
    expect(screen.queryByTestId('v10-rests-on-legend')).toBeNull()
    expect(screen.getByTestId('rests-on-key-group-unchecked').textContent).toContain('Olumi’s estimate, not yet checked')
    expect(screen.getByTestId('rests-on-key').textContent).not.toContain('Olumi’s, unchecked')
  })

  it('draws no per-option rows or bars: they wait until a producer supplies each option\'s full upstream set', () => {
    seed()
    for (const folded of [true, false]) {
      const view = key('v10', folded)
      expect(screen.queryByTestId('v10-rests-on-reliance')).toBeNull()
      expect(screen.queryByTestId('v10-rests-on-row')).toBeNull()
      expect(screen.getByTestId('rests-on-key').textContent).not.toMatch(/What each option stands on/u)
      expect(document.querySelector('[data-segment]')).toBeNull()
      view.unmount()
    }
  })

  it('a figure of unknown origin is unset (dashed), never the person\'s and never Olumi\'s', () => {
    const unknown: Node = { id: 'u', type: 'factor', position: at(0, 150), data: { label: 'Reach', provenance: 'unverified_brief', observedState: { value: 12, source: 'brief_extraction' } } }
    seed({ nodes: [nodes[0], unknown, nodes[6]], edges: [link('A-u', 'A', 'u')], goal: 'g' })
    key('v10', true)
    expect(screen.getByTestId('v10-rests-on-legend-unset').textContent).toContain('1')
    expect(screen.queryByTestId('v10-rests-on-legend-yours')).toBeNull()
    expect(screen.queryByTestId('v10-rests-on-legend-unchecked')).toBeNull()
  })

  it('a graph with no goal still shows the legend, with the key\'s own no-goal note', () => {
    seed({ nodes: nodes.filter((n) => n.id !== 'g'), edges: edges.filter((e) => e.target !== 'g'), goal: null })
    const folded = key('v10', true)
    expect(screen.getByTestId('v10-rests-on-legend-unchecked')).toBeTruthy()
    folded.unmount()
    key('v10')
    expect(screen.getByTestId('rests-on-key').textContent).toContain('no goal yet')
  })

  it('leaves the current design as it was: no v10 parts, same sentence', () => {
    seed()
    const v10 = key('v10')
    const v10Headline = screen.getByTestId('rests-on-key-headline').textContent
    v10.unmount()
    for (const folded of [true, false]) {
      const current = render(<RestsOnKey folded={folded} />)
      expect(screen.queryByTestId('v10-rests-on-legend')).toBeNull()
      expect(document.querySelector('[data-icon="olumi-ai"]')).toBeNull()
      if (!folded) expect(screen.getByTestId('rests-on-key-headline').textContent).toBe(v10Headline)
      current.unmount()
    }
  })
})
