// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { createDomainMapping } from '@/whiteboard/domainMapping'
import type { Node } from '@/domain/graph'

function makeEditor() {
  const calls: any[] = []
  return {
    calls,
    createShape: (args: any) => { calls.push({ op: 'create', args }) },
    updateShape: (args: any) => { calls.push({ op: 'update', args }) },
    deleteShape: (args: any) => { calls.push({ op: 'delete', args }) },
  }
}

describe('domainMapping nodes', () => {
  it('upsert node creates and then updates TL shape with meta and badge', () => {
    const editor = makeEditor()
    const track = vi.fn()
    const mapping = createDomainMapping({ editor, decisionId: 'demo', sessionId: 's', track })

    const n1: Node = { id: 'A', type: 'Problem', title: 'P1' }
    const shapeId = mapping.upsertShapeFromNode(n1)
    expect(shapeId).toBe('node-A')
    expect(editor.calls[0].op).toBe('create')
    expect(editor.calls[0].args.meta).toMatchObject({ nodeId: 'A', type: 'Problem' })

    const n1b: Node = { id: 'A', type: 'Problem', title: 'P1 updated', krImpacts: [{ krId: 'kr1', deltaP50: 0.5, confidence: 0.9 }] }
    mapping.upsertShapeFromNode(n1b)
    const last = editor.calls[editor.calls.length - 1]
    expect(last.op).toBe('update')
    expect(last.args.props.text).toContain('P1 updated')
    expect(last.args.meta.krBadge).toBeTruthy()

    // telemetry
    expect(track).toHaveBeenCalledWith('sandbox_graph_node_add', expect.any(Object))
    expect(track).toHaveBeenCalledWith('sandbox_graph_node_update', expect.any(Object))
  })
})
