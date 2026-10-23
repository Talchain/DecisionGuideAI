/**
 * Pointing into the model: the canvas marks the link and options the reply's test was about (`_method_result` v:1).
 * Corpus: #2637's fixtures. Rows are CEE composer lines (structural-challenge-turn.ts / what-changes-turn.test.ts at
 * e80586d8), and the replies are the texts those rows sit in.
 */
import { act, cleanup, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { Circle } from 'lucide-react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { OlumiResponse } from '@talchain/schemas/boundary'
import testLink from './fixtures/method-result-v1-test-link.json'
import whatChanges from './fixtures/method-result-v1-what-changes.json'
import { readMethodPointing, recordMethodPointing, useMethodPointingStore } from '../methodResultPointing'
import { applyV5State, type V5ApplicatorStore } from '../../../v5/applyV5State'
import { BaseNode } from '../../nodes/BaseNode'
import { useCanvasStore } from '../../store'

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const methodOf = (r: Record<string, unknown>) => (r.__additive__ as { _method_result: Record<string, unknown> })._method_result

beforeEach(() => recordMethodPointing(null))
afterEach(() => { cleanup(); recordMethodPointing(null) })

describe('readMethodPointing: what the reply points at', () => {
  it('test_link: the tested link and the options its rows name', () => {
    const p = readMethodPointing(testLink.response)!
    expect(p.actionId).toBe('test_link')
    expect(p.scenarioId).toBe('d65a2748-c05b-4545-9418-31bdd6f823c9')
    expect([...p.links]).toEqual(['fac_price_rise->out_customers_lost'])
    expect([...p.optionIds].sort()).toEqual(['opt_keep', 'opt_raise', 'opt_starter'])
  })
  it('what_changes: the link and the option of the quoted sentence', () => {
    const p = readMethodPointing(whatChanges.response)!
    expect([...p.links]).toEqual(['monthly_cloud_savings->monthly_spend'])
    expect([...p.optionIds]).toEqual(['stay_aws'])
  })
  it('CONTRAST: a row the reply does not say marks nothing of its own', () => {
    const r = clone(testLink.response) as Record<string, unknown>
    const rows = methodOf(r).rows as { text: string; item_refs: unknown[] }[]
    const starterRow = rows.find(row => JSON.stringify(row.item_refs).includes('opt_starter'))!
    r.assistant_text = (r.assistant_text as string).replace(starterRow.text, '')
    expect([...readMethodPointing(r)!.optionIds].sort()).toEqual(['opt_keep', 'opt_raise'])
  })
  it('nothing for a refused outcome, another method, an unknown version or a malformed ref', () => {
    const variant = (patch: Record<string, unknown>) => {
      const r = clone(testLink.response) as Record<string, unknown>
      Object.assign(methodOf(r), patch)
      return readMethodPointing(r)
    }
    expect(variant({ outcome: 'refused' })).toBeNull()
    expect(variant({ action_id: 'pre_mortem' })).toBeNull()
    expect(variant({ v: 2 })).toBeNull()
    expect(variant({ rows: [{ row_id: 'x', item_refs: [{ kind: 'link', from_id: 'a' }], text: 'x', provenance: 'server_built' }] })).toBeNull()
  })
})

function applyTurn(response: Record<string, unknown>) {
  const store = {
    setCurrentStage: vi.fn(), updateNode: vi.fn(), updateEdgeData: vi.fn(), setRunMeta: vi.fn(), setCeeAnalysisReady: vi.fn(),
    setAnalysisFreshness: vi.fn(), resultsComplete: vi.fn(), nodes: [], edges: [], currentResultsHash: null,
  } as unknown as V5ApplicatorStore
  applyV5State({ response_version: 2, blocks: [], suggested_actions: [], insights: [], stage_indicator: 'evaluate', ...response } as unknown as OlumiResponse, store)
}

describe('the real path: each applied reply replaces the last reply\'s marks', () => {
  it('a test_link reply marks; the next reply without a result clears', () => {
    applyTurn(testLink.response)
    expect([...(useMethodPointingStore.getState().pointing?.links ?? [])]).toEqual(['fac_price_rise->out_customers_lost'])
    applyTurn({ assistant_text: 'Anything else?' })
    expect(useMethodPointingStore.getState().pointing).toBeNull()
  })
})

describe('the option card wears the halo (real store, real BaseNode)', () => {
  const SCN = testLink.response.__additive__._method_result.scenario_id
  const optionProps = (id: string, label: string) => ({
    id, type: 'option', position: { x: 0, y: 0 }, selected: false, isConnectable: true,
    positionAbsoluteX: 0, positionAbsoluteY: 0, dragging: false, zIndex: 0, data: { label, type: 'option' },
  })
  beforeEach(() => {
    useCanvasStore.setState({ currentScenarioId: SCN, nodes: [optionProps('opt_raise', 'Raise prices 10%')] as never, edges: [],
      highlightedNodes: new Set<string>(), dimmedNodeIds: new Set<string>() } as never)
  })
  afterEach(() => useCanvasStore.setState({ currentScenarioId: null } as never))

  it('an option the reply\'s test names gets the halo; contrast: none before the reply, none in another scenario', () => {
    render(<ReactFlowProvider><BaseNode {...(optionProps('opt_raise', 'Raise prices 10%') as any)} nodeType="option" icon={Circle} /></ReactFlowProvider>)
    expect(screen.queryByTestId('pointing-node-halo-opt_raise')).toBeNull()
    act(() => applyTurn(testLink.response))
    expect(screen.getByTestId('pointing-node-halo-opt_raise')).toHaveAttribute('data-method-pointed', 'test_link')
    act(() => useCanvasStore.setState({ currentScenarioId: 'another-scenario' } as never))
    expect(screen.queryByTestId('pointing-node-halo-opt_raise')).toBeNull()
  })
})
