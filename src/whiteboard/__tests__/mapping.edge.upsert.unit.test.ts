// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { createDomainMapping } from '@/whiteboard/domainMapping'
import type { Node, Edge } from '@/domain/graph'

function makeEditor() {
  const calls: any[] = []
  return {
    calls,
    createShape: (args: any) => { calls.push({ op: 'create', args }) },
    updateShape: (args: any) => { calls.push({ op: 'update', args }) },
    deleteShape: (args: any) => { calls.push({ op: 'delete', args }) },
  }
}

describe('domainMapping edges', () => {
  it('upsert edge creates connector bound to node shapes and updates on repeat; reattach notifies', () => {
    const editor = makeEditor()
    const track = vi.fn()
    const onEdgeChange = vi.fn()
    const mapping = createDomainMapping({ editor, decisionId: 'demo', sessionId: 's', track, onEdgeChange })

    const A: Node = { id: 'A', type: 'Problem', title: 'A' }
    const B: Node = { id: 'B', type: 'Option', title: 'B' }
    mapping.upsertShapeFromNode(A)
    mapping.upsertShapeFromNode(B)
    mapping._flushNow?.()

    const e1: Edge = { id: 'E1', from: 'A', to: 'B', kind: 'supports' }
    const sid = mapping.upsertConnectorFromEdge(e1)
    mapping._flushNow?.()
    expect(sid).toBe('edge-E1')

    // First call is create arrow
    expect(editor.calls[editor.calls.length - 1].op).toBe('create')
    expect(editor.calls[editor.calls.length - 1].args.type).toBe('arrow')
    expect(editor.calls[editor.calls.length - 1].args.meta).toMatchObject({ edgeId: 'E1', kind: 'supports' })

    // Second call updates same connector
    mapping.upsertConnectorFromEdge({ ...e1, kind: 'causes' })
    mapping._flushNow?.()
    const last = editor.calls[editor.calls.length - 1]
    expect(last.op).toBe('update')
    expect(last.args.meta.kind).toBe('causes')

    // Reattach should notify domain
    mapping.onConnectorReattach('E1', 'B', 'A')
    expect(onEdgeChange).toHaveBeenCalled()

    // Telemetry emitted
    expect(track).toHaveBeenCalledWith('sandbox_graph_edge_add', expect.any(Object))
    expect(track).toHaveBeenCalledWith('sandbox_graph_edge_update', expect.any(Object))
  })
})
