import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  executeCanonicalRun,
  registerCanonicalRunner,
  getCanonicalRunner,
  __resetCanonicalRunnerForTests,
  type CanonicalRunner,
} from '../canonicalRunRegistry'

const runner = (tag: string): CanonicalRunner => {
  const fn: CanonicalRunner = async () => ({ status: 'dispatched' })
  ;(fn as any).tag = tag
  return fn
}

describe('canonicalRunRegistry', () => {
  beforeEach(() => {
    __resetCanonicalRunnerForTests()
  })

  it('starts empty', () => {
    expect(getCanonicalRunner()).toBeNull()
  })

  it('registers and returns the runner', () => {
    const a = runner('a')
    registerCanonicalRunner(a)
    expect(getCanonicalRunner()).toBe(a)
  })

  it('unregister clears only when still the active registration', () => {
    const a = runner('a')
    const unregisterA = registerCanonicalRunner(a)
    unregisterA()
    expect(getCanonicalRunner()).toBeNull()
  })

  it('a stale unregister does not clobber a newer registration', () => {
    const a = runner('a')
    const b = runner('b')
    const unregisterA = registerCanonicalRunner(a)
    registerCanonicalRunner(b)
    unregisterA() // A's cleanup fires after B took over (remount ordering)
    expect(getCanonicalRunner()).toBe(b)
  })
})

describe('Wave F-B — run parameters passthrough', () => {
  it('executeCanonicalRun forwards opts.parameters to the registered runner', async () => {
    const runner = vi.fn(async () => ({ status: 'dispatched' as const }))
    registerCanonicalRunner(runner)
    await executeCanonicalRun({ source: 'apply-threshold', parameters: { goal_threshold: 42 } })
    expect(runner).toHaveBeenCalledWith(
      expect.objectContaining({ parameters: { goal_threshold: 42 } }),
    )
  })
})
