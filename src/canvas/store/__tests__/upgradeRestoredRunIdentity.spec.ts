/**
 * The identity upgrade never costs the reader their restored result.
 *
 * Every arm asserts the OUTCOME by name, because a boolean would collapse a
 * guest, a failed read and a genuine non-match into one answer (trap 21) — and
 * those need to be distinguishable in telemetry and here.
 */
import { describe, expect, it, vi } from 'vitest'
import { upgradeRestoredRunIdentity } from '../upgradeRestoredRunIdentity'

const AT = '2026-09-18T12:58:15.960Z'
const row = (id: string, computed_at: string) => ({
  id,
  payload: { fact_type: 'run_analysis', result: { computed_at } },
})

const deps = (over: Partial<Parameters<typeof upgradeRestoredRunIdentity>[0]> = {}) => ({
  scenarioId: 'sc_1',
  computedAt: AT,
  hasSession: vi.fn(async () => true),
  readFacts: vi.fn(async () => [row('f_real', AT)]),
  stamp: vi.fn(),
  ...over,
})

describe('upgradeRestoredRunIdentity', () => {
  it('⭐ stamps the durable id when the fact joins', async () => {
    const d = deps()
    expect(await upgradeRestoredRunIdentity(d)).toBe('stamped')
    expect(d.stamp).toHaveBeenCalledWith('f_real')
  })

  it('⛔ a guest never reads, and is never stamped', async () => {
    const d = deps({ hasSession: vi.fn(async () => false) })
    expect(await upgradeRestoredRunIdentity(d)).toBe('guest')
    expect(d.readFacts).not.toHaveBeenCalled()
    expect(d.stamp).not.toHaveBeenCalled()
  })

  it('⛔ a failed read leaves the restored result alone', async () => {
    const d = deps({
      readFacts: vi.fn(async () => {
        throw new Error('RLS')
      }),
    })
    expect(await upgradeRestoredRunIdentity(d)).toBe('read_failed')
    expect(d.stamp).not.toHaveBeenCalled()
  })

  it('⛔ an ambiguous join declines rather than guessing', async () => {
    const d = deps({ readFacts: vi.fn(async () => [row('a', AT), row('b', AT)]) })
    expect(await upgradeRestoredRunIdentity(d)).toBe('unresolved')
    expect(d.stamp).not.toHaveBeenCalled()
  })

  it('costs no round trip when there is nothing to join on', async () => {
    const d = deps({ computedAt: null })
    expect(await upgradeRestoredRunIdentity(d)).toBe('no_computed_at')
    expect(d.hasSession).not.toHaveBeenCalled()
    expect(d.readFacts).not.toHaveBeenCalled()
  })

  it('costs no round trip without a scenario', async () => {
    const d = deps({ scenarioId: null })
    expect(await upgradeRestoredRunIdentity(d)).toBe('no_scenario')
    expect(d.hasSession).not.toHaveBeenCalled()
  })

  it('⭐ no path throws — the reader keeps their result whatever happens', async () => {
    const hostile = deps({
      hasSession: vi.fn(async () => {
        throw new Error('boom')
      }),
    })
    await expect(upgradeRestoredRunIdentity(hostile)).resolves.toBe('read_failed')
    expect(hostile.stamp).not.toHaveBeenCalled()
  })
})
