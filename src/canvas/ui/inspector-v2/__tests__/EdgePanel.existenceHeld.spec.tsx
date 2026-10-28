/**
 * ⭐ D3 cut 6 HOLD-AT-1.0 (DL 0df0e1: UI in scope; words c6): the edge inspector shows the existence the Run USES. A link
 * CEE holds at 1.0 (the user's own range excludes zero) reads as held ("Very likely to exist", 1.0) with c6's note; the twin
 * keeps its stored 0.8 ("Likely to exist") and no note.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EdgePanel } from '../panels/EdgePanel'
import { useCanvasStore } from '../../../store'
import { EDGE_COPY } from '../inspectorStrings'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { normalisePersistedGraph } from '../../../utils/normalisePersistedGraph'
import { mapDraftEdgeToCanvas, mapDraftNodeToCanvas } from '../../../utils/applyDraftResult'
import words from '../../../nodes/shared/__tests__/fixtures/q1-words-graph.hand-made.json'
import parallel from '../../../nodes/shared/__tests__/fixtures/q1-parallel-links.hand-made.json'

// Q1 readers: the saved read a link's words come from; none unless a row sets one (as before this mock).
const savedRead = vi.hoisted(() => ({ graph: null as unknown }))
vi.mock('../../../nodes/shared/savedGraph', async (importOriginal) => ({ ...(await importOriginal<Record<string, unknown>>()), useSavedGraph: () => savedRead.graph }))

const panelProps = { edgeId: 'e1', techMode: false, onClose: vi.fn(), onNavigate: vi.fn() }
function seedEdge(data: Record<string, unknown>) {
  useCanvasStore.setState({
    ...useCanvasStore.getState(),
    nodes: [
      { id: 'fac1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Price' } },
      { id: 'out1', type: 'outcome', position: { x: 100, y: 0 }, data: { label: 'Subscribers' } },
    ],
    edges: [{ id: 'e1', source: 'fac1', target: 'out1', type: 'styled', data }],
    results: { status: 'none', report: null },
  } as never)
}
const STORED = { weight: 0.4, beliefExists: 0.8, exists_probability: 0.8 }

describe('the inspector shows the existence the Run uses', () => {
  it('HELD: 100% and c6\'s note, exactly', () => {
    seedEdge({ ...STORED, existenceHeld: true })
    render(<EdgePanel {...panelProps} />)
    // Default (human) label mode says the band in words: 1.0 → "Very likely to exist".
    expect(screen.getByTestId('edge-existence-readout').textContent).toContain('Very likely to exist')
    expect(screen.getByTestId('edge-existence-held-note').textContent).toBe(EDGE_COPY.existenceHeldNote)
    expect(EDGE_COPY.existenceHeldNote).toBe('Held at 100%: your own range for this link’s effect doesn’t include zero, so the analysis treats the link as existing.')
  })
  it('TWIN (not held): its stored 80%, no note', () => {
    seedEdge({ ...STORED })
    render(<EdgePanel {...panelProps} />)
    const readout = screen.getByTestId('edge-existence-readout').textContent ?? ''
    expect(readout).toContain('Likely to exist')
    expect(readout).not.toContain('Very likely')
    expect(screen.queryByTestId('edge-existence-held-note')).toBeNull()
  })
})

/**
 * S-DEF (Science 393023, 7 Oct): the SERVED Wave B9 T1b graph (CEE df15c8c1 + UI 19e4dd53). Its Olumi-drawn identity
 * "Starter-tier monthly recurring revenue" → "monthly recurring revenue" showed "By definition, this connection always
 * exists" beside a "Likely to exist" slider. A held definition has no likelihood to show.
 */
describe('S-DEF: a link held by definition says so, with no likelihood', () => {
  const served = JSON.parse(readFileSync(resolve(process.cwd(), 'src/canvas/domain/__tests__/fixtures/waveB9-t1b-df15c8c-graph.json'), 'utf8')) as { graph: unknown }
  const seedServed = (from: string, to: string): string => {
    const { nodes, edges } = normalisePersistedGraph(served.graph)
    useCanvasStore.setState({ ...useCanvasStore.getState(), nodes, edges, results: { status: 'none', report: null } } as never)
    const e = edges.find((x) => x.source === from && x.target === to)
    if (!e) throw new Error(`no served edge ${from}->${to}`)
    return e.id
  }
  it('RED at base: the identity shows one sentence: no slider, no readout, no "likely to exist"', () => {
    const id = seedServed('starter_tier_monthly_recurring_revenue', 'monthly_recurring_revenue')
    const { container } = render(<EdgePanel {...panelProps} edgeId={id} />)
    expect(screen.getByTestId('edge-existence-held-by-definition').textContent).toBe(EDGE_COPY.existenceHeldByDefinitionNote)
    expect(screen.queryByTestId('edge-existence-readout')).toBeNull()
    expect(screen.queryByLabelText('Connection existence probability')).toBeNull()
    expect(screen.queryByTestId('edge-existence-held-note')).toBeNull()
    expect(container.textContent ?? '').not.toMatch(/likely to exist/i)
  })
  it('Codex r1 #2602 P1: a flagged link held only by the USER\'s range shows the range note, never the definition sentence', () => {
    const g = structuredClone(served.graph) as { nodes: Array<Record<string, any>>; edges: Array<Record<string, any>> }
    g.nodes.find((n) => n.id === 'starter_tier_monthly_recurring_revenue')!.label = 'Pipeline value'
    const e = g.edges.find((x) => x.from === 'starter_tier_monthly_recurring_revenue' && x.to === 'monthly_recurring_revenue')!
    e.provenance = { ...e.provenance, source: 'brief_extraction', source_quote: 'between 0.5 and 1.5 per pound',
      natural_effect: { ...e.provenance.natural_effect, stated_range: { low: 0.5, high: 1.5, text: 'between 0.5 and 1.5', end: 'low' } } }
    const { nodes, edges } = normalisePersistedGraph(g)
    useCanvasStore.setState({ ...useCanvasStore.getState(), nodes, edges, results: { status: 'none', report: null } } as never)
    const id = edges.find((x) => x.source === 'starter_tier_monthly_recurring_revenue' && x.target === 'monthly_recurring_revenue')!.id
    render(<EdgePanel {...panelProps} edgeId={id} />)
    expect(screen.getByTestId('edge-existence-held-note').textContent).toBe(EDGE_COPY.existenceHeldNote)
    expect(screen.queryByTestId('edge-existence-held-by-definition')).toBeNull()
  })
  it('CONTROL (same graph): the causal link into the part keeps its slider and Olumi\'s 80%', () => {
    const id = seedServed('starter_subscribers', 'starter_tier_monthly_recurring_revenue')
    render(<EdgePanel {...panelProps} edgeId={id} />)
    const readout = screen.getByTestId('edge-existence-readout').textContent ?? ''
    expect(readout).toContain('Likely to exist')
    expect(screen.queryByTestId('edge-existence-held-by-definition')).toBeNull()
  })
})

/**
 * Q1 readers (DL GO, 28 Oct): a link in words has no likelihood figure. Its wire `exists_probability: 1` read as "Very
 * likely to exist"; the inspector now says the stated confidence in words, with no slider and no readout. A record with
 * no confidence (an unsized risk) says it is not stated. Hand-made graph; the saved read is mocked at its seam.
 */
describe('Q1: a link in words states its confidence in words', () => {
  const seedWords = (id: string) => {
    useCanvasStore.setState({ ...useCanvasStore.getState(), nodes: words.nodes.map((n) => mapDraftNodeToCanvas(n)),
      edges: words.edges.map((e, i) => mapDraftEdgeToCanvas(e, i)), results: { status: 'none', report: null } } as never)
    savedRead.graph = words
    render(<EdgePanel {...panelProps} edgeId={id} />)
  }
  afterEach(() => { savedRead.graph = null })
  // (An option's link opens the intervention-link panel, which has no existence row: the factor → goal link is used.)
  it.each([
    ['member_mood__keep_members', 'In words: unsure. No figure is set.'],
    ['rent_rise__keep_members', 'Not stated. No figure is set.'],
  ])('%s → "%s", no slider, no readout', (id, sentence) => {
    seedWords(id)
    expect(screen.getByTestId('edge-existence-in-words').textContent).toBe(sentence)
    expect(screen.queryByTestId('edge-existence-readout')).toBeNull()
    expect(screen.queryByLabelText('Connection existence probability')).toBeNull()
  })
  it('CONTROL: the numerical link keeps its slider and readout', () => {
    seedWords('monthly_cost__keep_members')
    expect(screen.getByTestId('edge-existence-readout')).toBeDefined()
    expect(screen.queryByTestId('edge-existence-in-words')).toBeNull()
  })
})

// Q1 readers (PL BLOCK 1): the inspector on each of two parallel links shows that link's own record.
describe('Q1: parallel links each open their own existence row', () => {
  afterEach(() => { savedRead.graph = null })
  it.each([
    ['quality__members', 'In words: likely. No figure is set.'],
    ['quality__members__2', null],
    ['price__demand', null],
    ['price__demand__2', 'In words: unsure. No figure is set.'],
  ])('%s', (id, sentence) => {
    useCanvasStore.setState({ ...useCanvasStore.getState(), nodes: parallel.nodes.map((n) => mapDraftNodeToCanvas(n)),
      edges: parallel.edges.map((e, i) => mapDraftEdgeToCanvas(e, i)), results: { status: 'none', report: null } } as never)
    savedRead.graph = parallel
    render(<EdgePanel {...panelProps} edgeId={id} />)
    if (sentence === null) {
      expect(screen.queryByTestId('edge-existence-in-words')).toBeNull()
      expect(screen.getByTestId('edge-existence-readout')).toBeDefined()
    } else {
      expect(screen.getByTestId('edge-existence-in-words').textContent).toBe(sentence)
    }
  })
})
