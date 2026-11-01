/**
 * Design QA 9: approving a change shows a pulse on the card it changed. The card arrives after the turn is applied, so the pulse waits for it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/supabase', () => ({ supabase: {}, getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))
vi.mock('../../lib/posthog', () => ({ trackEvent: () => undefined }))

import type { Node } from '@xyflow/react'
import { useCanvasStore } from '../../canvas/store'
import { applyCoreTurnState } from '../../v5/applyCoreTurn'
import { parseCoreTurn } from '../../v5/coreTurnContract'
import { PULSE_COALESCE_MS } from '../../canvas/utils/appliedEditPulse'
import { arrivalsOf } from '../pulseArrivals'
import { turnBodyForTest } from './withdrawnDraft.helpers'

const SCENARIO = '00000000-0000-4000-8000-437f3c107bdd'
const graph = { nodes: [
  { id: 'mp:decision', kind: 'decision', label: 'Q', ref: 'D1' },
  { id: 'per_specialist', kind: 'factor', label: 'per specialist', ref: 'F1' },
  { id: 'staff_absence', kind: 'factor', label: 'staff absence', ref: 'F2' },
], edges: [] }
const card = (id: string): Node => ({ id, type: 'factor', position: { x: 0, y: 0 }, data: { label: id } }) as unknown as Node
const turn = (receipts: unknown[]) => { const b = turnBodyForTest({}) as { model: Record<string, unknown> }; return parseCoreTurn({ ...b, model: { ...b.model, graph }, receipts })! }
const has = (id: string) => useCanvasStore.getState().highlightedNodes.has(id)

beforeEach(() => { vi.useFakeTimers(); vi.stubEnv('VITE_OLUMI_CORE', '1'); useCanvasStore.setState({ nodes: [card('per_specialist')], edges: [], currentScenarioId: SCENARIO, highlightedNodes: new Set() } as never) })
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs() })

describe('the card an approval adds is pulsed when it arrives', () => {
  it('arrivals are the cards of the model the canvas does not hold, never the question card', () => {
    expect(arrivalsOf(graph.nodes, [card('per_specialist')])).toEqual(['staff_absence'])
  })
  it('a turn that saved a version names the arriving card; once it is on the canvas it is highlighted', () => {
    const r = applyCoreTurnState(turn([{ authorised_by: 'person' }]), { nodes: useCanvasStore.getState().nodes }, { turnScenarioId: SCENARIO })
    expect(r.applied).toContain('pulse:staff_absence')
    expect(has('staff_absence')).toBe(false)   // not on the canvas yet
    useCanvasStore.setState({ nodes: [card('per_specialist'), card('staff_absence')] } as never)
    vi.advanceTimersByTime(PULSE_COALESCE_MS + 20)
    expect(has('staff_absence')).toBe(true)
  })
  it('CONTRAST: a turn that saved nothing (a held change, a reply) pulses nothing', () => {
    const r = applyCoreTurnState(turn([]), { nodes: useCanvasStore.getState().nodes }, { turnScenarioId: SCENARIO })
    expect(r.applied.some((a) => a.startsWith('pulse:'))).toBe(false)
  })
  it('a card that never arrives is never pulsed, and the wait ends', () => {
    applyCoreTurnState(turn([{ authorised_by: 'person' }]), { nodes: useCanvasStore.getState().nodes }, { turnScenarioId: SCENARIO })
    vi.advanceTimersByTime(11_000)
    useCanvasStore.setState({ nodes: [card('per_specialist'), card('staff_absence')] } as never)
    vi.advanceTimersByTime(500)
    expect(has('staff_absence')).toBe(false)
  })
})
