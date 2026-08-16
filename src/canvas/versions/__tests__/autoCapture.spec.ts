/**
 * Pre-ingest auto-capture — behaviour pinned.
 *
 * The governing requirement is that this NEVER breaks the ingest it guards.
 * A version is a safety net; a net that can take down the canvas is worse than
 * no net at all.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { Edge, Node } from '@xyflow/react'
import { captureBeforeIngest } from '../autoCapture'
import { loadVersions } from '../versionStorage'

function rfNode(id: string, label: string): Node {
  return { id, type: 'factor', position: { x: 0, y: 0 }, data: { label } } as Node
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('captureBeforeIngest', () => {
  it('stores a version of the graph it was given', () => {
    captureBeforeIngest([rfNode('n1', 'Price'), rfNode('n2', 'Revenue')], [])

    const stored = loadVersions()
    expect(stored).toHaveLength(1)
    expect(stored[0]!.nodes.map((n) => n.id)).toEqual(['n1', 'n2'])
  })

  it('marks the version as pre-ingest, distinguishing it from a manual save', () => {
    captureBeforeIngest([rfNode('n1', 'Price')], [])

    expect(loadVersions()[0]!.origin).toBe('pre-ingest')
  })

  it('names the version after what happened, claiming nothing about quality', () => {
    captureBeforeIngest([rfNode('n1', 'Price')], [])

    const name = loadVersions()[0]!.name.toLowerCase()
    expect(name).toContain('redraft')
    for (const forbidden of ['better', 'worse', 'improved', 'lost']) {
      expect(name).not.toContain(forbidden)
    }
  })

  it('does NOT capture an empty canvas — replacing nothing is not a loss', () => {
    captureBeforeIngest([], [])

    expect(loadVersions()).toEqual([])
  })

  it('captures edges alongside nodes', () => {
    const edges = [{ id: 'e1', source: 'n1', target: 'n2', data: { weight: 0.7 } } as Edge]

    captureBeforeIngest([rfNode('n1', 'Price'), rfNode('n2', 'Revenue')], edges)

    expect(loadVersions()[0]!.edges[0]).toMatchObject({ id: 'e1', from: 'n1', to: 'n2' })
    expect(loadVersions()[0]!.edges[0]!.fields.weight).toBe(0.7)
  })

  it('never throws when storage rejects the write', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      const error = new Error('quota')
      error.name = 'QuotaExceededError'
      throw error
    })

    expect(() => captureBeforeIngest([rfNode('n1', 'Price')], [])).not.toThrow()
    expect(warn).toHaveBeenCalled()
  })

  it('never throws when storage reads throw outright', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled')
    })

    expect(() => captureBeforeIngest([rfNode('n1', 'Price')], [])).not.toThrow()
    expect(warn).toHaveBeenCalled()
  })

  it('never throws on a malformed node', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const broken = { id: 'n1' } as Node

    expect(() => captureBeforeIngest([broken], [])).not.toThrow()
  })

  it('keeps successive captures as separate versions', () => {
    captureBeforeIngest([rfNode('n1', 'First')], [])
    captureBeforeIngest([rfNode('n1', 'Second')], [])

    expect(loadVersions()).toHaveLength(2)
  })
})
