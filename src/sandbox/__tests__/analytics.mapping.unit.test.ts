import { describe, it, expect, beforeEach, vi } from 'vitest'

const decisionId = 'dec-1'
const ts = 1730000000000

describe('analytics mapping (dev → PRD)', () => {
  beforeEach(async () => {
    const a = await vi.importActual<typeof import('@/lib/analytics')>('@/lib/analytics')
    a.__clearTestBuffer()
    a.__setProdSchemaForTest(false)
    a.__setProdSchemaModeForTest(null)
  })

  it('mirror mode: emits dev and mapped PRD event with snake-case fields', async () => {
    const a = await vi.importActual<typeof import('@/lib/analytics')>('@/lib/analytics')
    a.__clearTestBuffer()
    a.__setProdSchemaForTest(true)
    a.__setProdSchemaModeForTest('mirror')

    a.track('sandbox_trigger', { decisionId, ts })

    const buf = a.__getTestBuffer()
    const names = buf.map(e => e.event)
    expect(names).toContain('sandbox_trigger')
    expect(names).toContain('decision_trigger_fired')

    const mapped = buf.find(e => e.event === 'decision_trigger_fired')!
    expect(mapped.props).toMatchObject({ decision_id: decisionId, board_id: decisionId, client_ts: ts })
    expect('user_id' in (mapped.props as any)).toBe(true)
  })

  it('replace mode: emits only PRD mapped event (no dev)', async () => {
    const a = await vi.importActual<typeof import('@/lib/analytics')>('@/lib/analytics')
    a.__clearTestBuffer()
    a.__setProdSchemaForTest(true)
    a.__setProdSchemaModeForTest('replace')
    a.track('sandbox_alignment', { decisionId, ts })
    const buf = a.__getTestBuffer()
    const names = buf.map(e => e.event)
    expect(names).toContain('alignment_updated')
    expect(names).not.toContain('sandbox_alignment')
  })

  it('dedupe: same event+decision+ts only recorded once per name', async () => {
    const a = await vi.importActual<typeof import('@/lib/analytics')>('@/lib/analytics')
    a.__clearTestBuffer()
    a.__setProdSchemaForTest(true)
    a.__setProdSchemaModeForTest('mirror')
    a.track('sandbox_delta_reapply', { decisionId, ts })
    a.track('sandbox_delta_reapply', { decisionId, ts })
    const buf = a.__getTestBuffer()
    const mappedCount = buf.filter(e => e.event === 'delta_reapplied').length
    const devCount = buf.filter(e => e.event === 'sandbox_delta_reapply').length
    expect(mappedCount).toBe(1)
    expect(devCount).toBe(1)
  })

  it('additional mappings: projection, rival_edit, panel, history (mirror)', async () => {
    const a = await vi.importActual<typeof import('@/lib/analytics')>('@/lib/analytics')
    a.__clearTestBuffer()
    a.__setProdSchemaForTest(true)
    a.__setProdSchemaModeForTest('mirror')

    a.track('sandbox_projection', { decisionId, ts })
    a.track('sandbox_rival_edit', { decisionId, ts })
    a.track('sandbox_panel', { decisionId, op: 'tab_select', tab: 'goals', ts })
    a.track('history_archived', { decisionId, ts, archived_count: 2 })

    const buf = a.__getTestBuffer()
    const names = buf.map(e => e.event)
    expect(names).toContain('kr_projection_updated')
    expect(names).toContain('rival_edit')
    expect(names).toContain('panel_view_changed')
    expect(names).toContain('projections_history_archived')
  })

  it('lifecycle events map to themselves and replace mode suppresses dev names for mapped events', async () => {
    const a = await vi.importActual<typeof import('@/lib/analytics')>('@/lib/analytics')
    a.__clearTestBuffer()
    a.__setProdSchemaForTest(true)
    a.__setProdSchemaModeForTest('replace')

    // lifecycle
    a.track('trigger_evaluation_cycle', { decisionId, ts })
    a.track('trigger_debounced', { decisionId, window_ms: 30000, ts })
    a.track('trigger_cooldown_started', { decisionId, cooldown_ms: 86400000, override_allowed: false, ts })
    // mapped event in replace → only PRD
    a.track('sandbox_projection', { decisionId, ts })

    const buf = a.__getTestBuffer()
    const names = buf.map(e => e.event)
    expect(names).toContain('trigger_evaluation_cycle')
    expect(names).toContain('trigger_debounced')
    expect(names).toContain('trigger_cooldown_started')
    expect(names).toContain('kr_projection_updated')
    expect(names).not.toContain('sandbox_projection')
  })
})
