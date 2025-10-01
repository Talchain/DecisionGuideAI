import { describe, it, expect } from 'vitest'
import { encodeSnapshotToUrlParam, tryDecodeSnapshotParam } from '../../lib/snapshotShare'

describe('snapshot share codec', () => {
  it('round-trips small payload without compression', () => {
    const payload = { v: 1 as const, seed: 'abc', model: 'local-sim', data: { nodes: [], edges: [{ id: 'e1' }] } }
    const param = encodeSnapshotToUrlParam(payload)
    expect(param.startsWith('z:')).toBe(false)
    const dec = tryDecodeSnapshotParam(param)!
    expect(dec.v).toBe(1)
    expect(dec.seed).toBe('abc')
    expect(dec.model).toBe('local-sim')
    expect(Array.isArray(dec.data.edges)).toBe(true)
  })

  it('uses compression for larger payload (z:)', () => {
    // 800 edges is large enough to exceed the compression threshold, but under 8 kB after compression
    const bigEdges = Array.from({ length: 800 }).map((_, i) => ({ id: `e${i+1}`, from: 'n1', to: 'n2', weight: 0.5 }))
    const payload = { v: 1 as const, seed: 'abc', model: 'local-sim', data: { nodes: [], edges: bigEdges } }
    const param = encodeSnapshotToUrlParam(payload)
    expect(param.startsWith('z:')).toBe(true)
    const dec = tryDecodeSnapshotParam(param)!
    expect(dec.data.edges.length).toBe(bigEdges.length)
  })

  it('throws a friendly error beyond ~8 kB', () => {
    // Construct a deterministic pseudo-random ASCII string that resists compression
    const makePseudo = (n: number) => {
      let s = ''
      let x = 123456789
      for (let i = 0; i < n; i++) {
        x = (1103515245 * x + 12345) >>> 0
        const ch = 33 + (x % 94) // printable ASCII 33..126
        s += String.fromCharCode(ch)
      }
      return s
    }
    const huge = makePseudo(20000)
    const payload = { v: 1 as const, seed: 'abc', model: 'm', data: { blob: huge } as any }
    expect(() => encodeSnapshotToUrlParam(payload)).toThrowError(/Link too large/i)
  })
})
