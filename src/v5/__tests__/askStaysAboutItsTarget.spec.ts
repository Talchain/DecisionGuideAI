// Immediate chip asks keep their target; editable-template sends retain the existing binding rules.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Node } from '@xyflow/react'

import { buildV5Payload } from '../buildPayload'
import { useCanvasStore } from '../../canvas/store'
import { useGuidanceStore } from '../../canvas/stores/guidanceStore'
import { requestAsk } from '../../canvas/ui/inspector-v2/askSemantic'
import { clearAskTargetBinding } from '../../canvas/ui/inspector-v2/askTargetBinding'
import type { NodeData } from '../../canvas/domain/nodes'

const TURN_ID = '11111111-1111-4111-8111-111111111111'
const SCENARIO_ID = '22222222-2222-4222-8222-222222222222'

function node(id: string, type: string, label: string): Node<NodeData> {
  return { id, type, position: { x: 0, y: 0 }, data: { label, type } as unknown as NodeData } as Node<NodeData>
}
const A = node('factor_a', 'factor', 'Adoption friction')
const B = node('factor_b', 'factor', 'Churn rate')
const ASK_A = 'What does ‘Adoption friction’ do in this decision, and what is it assumed to depend on?'

function select(...ids: string[]) {
  useCanvasStore.setState({ selection: { nodeIds: new Set(ids), edgeIds: new Set<string>(), anchorPosition: null } })
}
function selectedIds(message: string): string[] {
  const r = buildV5Payload({ turnId: TURN_ID, scenarioId: SCENARIO_ID, stage: 'analyse', turnClass: 'clarify', mode: 'user', message })
  if (!r.ok) throw new Error(`expected ok; got ${r.reason}`)
  const p = r.payload as { selected_elements?: Array<{ id: string }> }
  return (p.selected_elements ?? []).map(e => e.id)
}

beforeEach(() => {
  useCanvasStore.setState({ nodes: [A, B] as never, edges: [], hasCompletedFirstRun: false, results: { status: 'idle' }, v5AnalysisFact: null } as never)
  select()
  useGuidanceStore.setState({ _prefillChat: vi.fn(), _dispatchAction: vi.fn(), _isConversationBusy: () => false } as never)
  clearAskTargetBinding()
})

describe('an Ask carries its own target to Send', () => {
  it('⭐ Ask about A, select B, Send the question → grounds in A, not B', () => {
    select('factor_a')
    expect(requestAsk({ text: ASK_A, label: 'Ask Olumi about Adoption friction', targetId: 'factor_a', source: 'context-menu' })).toBe('sent')
    select('factor_b')
    expect(selectedIds(ASK_A)).toEqual(['factor_a'])
  })

  it('the person EXTENDED the question → still about A', () => {
    requestAsk({ text: ASK_A, label: 'Ask Olumi about Adoption friction', targetId: 'factor_a', source: 'hover-ask', editable: true })
    select('factor_b')
    expect(selectedIds(`${ASK_A} Focus on the enterprise segment.`)).toEqual(['factor_a'])
  })

  it('CONTRAST — the person REPLACED the question → the live selection, as for any typed question', () => {
    requestAsk({ text: ASK_A, label: 'Ask Olumi about Adoption friction', targetId: 'factor_a', source: 'hover-ask', editable: true })
    select('factor_b')
    expect(selectedIds('What drives churn here?')).toEqual(['factor_b'])
  })

  it('the binding is consumed by the send it applied to — the next send follows the live selection', () => {
    requestAsk({ text: ASK_A, label: 'Ask Olumi about Adoption friction', targetId: 'factor_a', source: 'hover-ask', editable: true })
    select('factor_b')
    expect(selectedIds(ASK_A)).toEqual(['factor_a'])
    expect(selectedIds(ASK_A)).toEqual(['factor_b'])
  })

  it('CONTRAST — with no Ask pending, a typed question follows the live selection', () => {
    select('factor_b')
    expect(selectedIds('Why does this matter?')).toEqual(['factor_b'])
  })
})
