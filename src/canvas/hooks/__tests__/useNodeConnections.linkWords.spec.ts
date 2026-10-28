/**
 * Q1 readers (DL GO, 28 Oct 2026): a link in words carries `exists_probability: 1` on the wire, which is nobody's
 * confidence. The "Depends on" / "Influences" rows show the stated confidence word from the saved read's `link_words`
 * instead of "100% conf."; a record that holds no confidence (an unsized risk) keeps the dash. Numerical links unchanged.
 * Hand-made graph in the contract's shapes; canvas edges through the real mapper.
 */
import { describe, expect, it, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useCanvasStore } from '../../store'
import { mapDraftEdgeToCanvas, mapDraftNodeToCanvas } from '../../utils/applyDraftResult'
import words from '../../nodes/shared/__tests__/fixtures/q1-words-graph.hand-made.json'
import parallel from '../../nodes/shared/__tests__/fixtures/q1-parallel-links.hand-made.json'
import { useNodeConnections } from '../useNodeConnections'

const savedRead = vi.hoisted(() => ({ graph: null as unknown }))
vi.mock('../../nodes/shared/savedGraph', async (importOriginal) => ({ ...(await importOriginal<Record<string, unknown>>()), useSavedGraph: () => savedRead.graph }))

function seed() {
  useCanvasStore.setState({
    ...useCanvasStore.getState(),
    nodes: words.nodes.map((n) => mapDraftNodeToCanvas(n)),
    edges: words.edges.map((e, i) => mapDraftEdgeToCanvas(e, i)),
    results: { status: 'complete', report: null },
  } as never)
}
const rows = (nodeId: string) => renderHook(() => useNodeConnections(nodeId, 'inbound')).result.current
const rowFrom = (nodeId: string, from: string) => rows(nodeId).find((r) => r.connectedNodeId === from)!

afterEach(() => { savedRead.graph = null })

describe('a link in words states its confidence as a word', () => {
  it('stated "unsure" → the word, no figure', () => {
    seed()
    savedRead.graph = words
    expect(rowFrom('keep_members', 'member_mood')).toMatchObject({ confidencePct: null, confidenceWord: 'unsure' })
  })
  it('stated "likely" → the word', () => {
    seed()
    savedRead.graph = words
    expect(rowFrom('member_mood', 'evening_classes')).toMatchObject({ confidencePct: null, confidenceWord: 'likely' })
  })
  it('stated "unknown" → "not known"', () => {
    seed()
    const g = structuredClone(words) as { edges: Array<Record<string, any>> }
    g.edges.find((e) => e.id === 'member_mood__keep_members')!.link_words.confidence = 'unknown'
    savedRead.graph = g
    expect(rowFrom('keep_members', 'member_mood')).toMatchObject({ confidencePct: null, confidenceWord: 'not known' })
  })
  it('an unsized risk records no confidence → no word and no figure (the dash), never "not known"', () => {
    seed()
    savedRead.graph = words
    expect(rowFrom('keep_members', 'rent_rise')).toMatchObject({ confidencePct: null, confidenceWord: null })
  })
  it('CONTROL: a numerical link keeps its figure', () => {
    seed()
    savedRead.graph = words
    expect(rowFrom('keep_members', 'monthly_cost')).toMatchObject({ confidencePct: 100, confidenceWord: null })
  })
  it('CONTROL: with no saved words, the same link reads 100 as today', () => {
    seed()
    expect(rowFrom('keep_members', 'member_mood').confidencePct).toBe(100)
  })
})

// Q1 readers (PL BLOCK 1): two links between the same cards are two rows, each with its own record.
describe('parallel links each keep their own row', () => {
  it('word-first and numeric-first pairs: each row says its own word or figure', () => {
    useCanvasStore.setState({
      ...useCanvasStore.getState(),
      nodes: parallel.nodes.map((n) => mapDraftNodeToCanvas(n)),
      edges: parallel.edges.map((e, i) => mapDraftEdgeToCanvas(e, i)),
      results: { status: 'complete', report: null },
    } as never)
    savedRead.graph = parallel
    const byEdge = (nodeId: string, edgeId: string) => rows(nodeId).find((r) => r.edgeId === edgeId)!
    expect(byEdge('members', 'quality__members')).toMatchObject({ confidencePct: null, confidenceWord: 'likely' })
    expect(byEdge('members', 'quality__members__2')).toMatchObject({ confidencePct: 100, confidenceWord: null })
    expect(byEdge('demand', 'price__demand')).toMatchObject({ confidencePct: 100, confidenceWord: null })
    expect(byEdge('demand', 'price__demand__2')).toMatchObject({ confidencePct: null, confidenceWord: 'unsure' })
  })
})
