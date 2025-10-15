import { describe, it, expect } from 'vitest'
import { resolvePlcOverride } from '../resolvePlcOverride'

const makeWin = ({
  hash = '',
  search = '',
  ls = {} as Record<string, string>,
} = {}) =>
  ({
    location: { hash, search },
    localStorage: { getItem: (k: string) => ls[k] ?? null },
  } as unknown as Window)

describe('resolvePlcOverride', () => {
  it('falls back to env when no window', () => {
    const res = resolvePlcOverride(undefined)
    expect(typeof res.usePlc).toBe('boolean')
    expect(res.source).toBe('env')
  })

  it('reads from URL (search) first', () => {
    const w = makeWin({ search: '?plc=1' })
    const res = resolvePlcOverride(w)
    expect(res).toEqual({ usePlc: true, source: 'url' })
  })

  it('reads from URL in hash routes', () => {
    const w = makeWin({ hash: '#/plot?plc=0' })
    const res = resolvePlcOverride(w)
    expect(res).toEqual({ usePlc: false, source: 'url' })
  })

  it('uses localStorage when URL missing', () => {
    const w = makeWin({ ls: { PLOT_USE_PLC: '1' } })
    const res = resolvePlcOverride(w)
    expect(res).toEqual({ usePlc: true, source: 'localStorage' })
  })

  it('ignores invalid values & falls through', () => {
    const w = makeWin({ search: '?plc=maybe', ls: { PLOT_USE_PLC: 'nope' } })
    const res = resolvePlcOverride(w)
    expect(res.source).toBe('env')
  })
})
