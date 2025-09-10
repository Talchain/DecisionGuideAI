import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const enableBridge = async () => {
  vi.doMock('@/lib/config', async () => {
    const actual = await vi.importActual<typeof import('@/lib/config')>('@/lib/config')
    return { ...actual, isStrategyBridgeEnabled: () => true }
  })
}
const disableBridge = async () => {
  vi.doMock('@/lib/config', async () => {
    const actual = await vi.importActual<typeof import('@/lib/config')>('@/lib/config')
    return { ...actual, isStrategyBridgeEnabled: () => false }
  })
}

describe('bridge/contracts', () => {
  beforeEach(() => {/* no module resets */})
  afterEach(() => vi.resetAllMocks())

  it('loadSeed returns idempotent structure with stable IDs', async () => {
    await enableBridge()
    const { loadSeed } = await import('@/sandbox/bridge/contracts')
    const a = loadSeed('d1')
    const b = loadSeed('d1')
    // basic shape
    expect(Array.isArray(a.goals)).toBe(true)
    expect(a.goals.length).toBeGreaterThan(0)
    // stable IDs
    expect(a.goals[0].id).toBe(b.goals[0].id)
    expect(a.keyResults[0].id).toBe(b.keyResults[0].id)
  })

  it('writeBack: accepts allow-listed keys and rejects unknown; is no-op with flag off', async () => {
    await enableBridge()
    const { writeBack } = await import('@/sandbox/bridge/contracts')
    // Accepts
    expect(writeBack('d1', { linkKRToTile: { krId: 'kr1', tileId: 'tile1' } })).toEqual({ ok: true })
    expect(writeBack('d1', { addRequiredDecision: { title: 'Need pricing decision' } })).toEqual({ ok: true })
    // Rejects
    // @ts-expect-error
    expect(() => writeBack('d1', { unknownOp: 1 })).toThrowError()

    // Flag off → no-op
    await disableBridge()
    const { writeBack: wb2 } = await import('@/sandbox/bridge/contracts')
    // @ts-expect-error allow-listed check bypassed, returns ok
    expect(wb2('d1', { unknownOp: 1 })).toEqual({ ok: true })
  })
})
