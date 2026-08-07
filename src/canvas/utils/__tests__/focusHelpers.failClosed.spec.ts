/**
 * Fail-closed focus for AI-to-graph passthrough highlighting.
 *
 * Result payloads and guidance items may reference elements that no longer
 * exist on the canvas (deleted nodes, recovered sessions with different
 * ids). focusExistingTarget must verify existence and do nothing for
 * unknown targets — never pan to nowhere, never warn-spam.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  registerFocusHelpers,
  unregisterFocusHelpers,
  focusExistingTarget,
} from '../focusHelpers'
import { useCanvasStore } from '../../store'

describe('focusExistingTarget', () => {
  const focusNode = vi.fn()
  const focusEdge = vi.fn()

  beforeEach(() => {
    focusNode.mockClear()
    focusEdge.mockClear()
    registerFocusHelpers(focusNode, focusEdge)
    useCanvasStore.setState({
      nodes: [{ id: 'n1', type: 'factor', position: { x: 0, y: 0 }, data: {} } as any],
      edges: [{ id: 'e1', source: 'n1', target: 'n1' } as any],
    })
  })

  afterEach(() => {
    unregisterFocusHelpers()
  })

  it('focuses an existing node and returns true', () => {
    expect(focusExistingTarget('n1', 'node')).toBe(true)
    expect(focusNode).toHaveBeenCalledWith('n1')
  })

  it('focuses an existing edge and returns true', () => {
    expect(focusExistingTarget('e1', 'edge')).toBe(true)
    expect(focusEdge).toHaveBeenCalledWith('e1')
  })

  it('fails closed for an unknown node id', () => {
    expect(focusExistingTarget('ghost', 'node')).toBe(false)
    expect(focusNode).not.toHaveBeenCalled()
    expect(focusEdge).not.toHaveBeenCalled()
  })

  it('fails closed for an unknown edge id', () => {
    expect(focusExistingTarget('ghost-edge', 'edge')).toBe(false)
    expect(focusEdge).not.toHaveBeenCalled()
  })

  it('fails closed for an empty id', () => {
    expect(focusExistingTarget('', 'node')).toBe(false)
    expect(focusNode).not.toHaveBeenCalled()
  })

  it('treats factor/option target types as node lookups', () => {
    expect(focusExistingTarget('n1', 'factor')).toBe(true)
    expect(focusNode).toHaveBeenCalledWith('n1')
  })
})
