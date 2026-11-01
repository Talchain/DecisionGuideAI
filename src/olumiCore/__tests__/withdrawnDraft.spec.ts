/**
 * "Not now" on a FIRST draft: olumi-core holds nothing for the scenario (no saved model, no held one), but the draft was drawn on
 * the canvas the moment it arrived and the canvas kept it, so a figure edit there answered "no saved model to edit yet", and a
 * reload brought it back as "Recovered unsaved changes" with controls that post to core. When core's answer says there is no
 * model, the canvas lets go of the draft, and so does the autosave the reload would have recovered.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Node } from '@xyflow/react'

vi.mock('../../lib/supabase', () => ({ supabase: {}, getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))
vi.mock('../../lib/posthog', () => ({ trackEvent: () => undefined }))

import { applyCoreTurnState, type CoreTurnApplicatorStore } from '../../v5/applyCoreTurn'
import { parseCoreTurn, type CoreTurn } from '../../v5/coreTurnContract'
import { withdrawGraphFromCanvas } from '../withdrawGraph'
import { useCanvasStore } from '../../canvas/store'
import { saveAutosave, loadAutosave } from '../../canvas/store/scenarios'
import { turnBodyForTest } from './withdrawnDraft.helpers'

const nodes = [{ id: 'a', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'a' } }] as unknown as Node[]
const declined = (): CoreTurn => parseCoreTurn(turnBodyForTest({ model: null, assistant_text: 'Okay, I have left it as it was.' }))!
const stillThere = (): CoreTurn => parseCoreTurn(turnBodyForTest({}))!
const storeWith = (n: Node[]) => { const withdrawGraph = vi.fn(); const store: CoreTurnApplicatorStore = { nodes: n, withdrawGraph }; return { store, withdrawGraph } }

beforeEach(() => { vi.stubEnv('VITE_OLUMI_CORE', '1') })
afterEach(() => { vi.unstubAllEnvs(); localStorage.clear() })

describe('a core turn that says there is no model lets go of the draft on the canvas', () => {
  it('the declined first draft (model null, no error) withdraws the graph', () => {
    const { store, withdrawGraph } = storeWith(nodes)
    const r = applyCoreTurnState(declined(), store)
    expect(withdrawGraph).toHaveBeenCalledTimes(1)
    expect(r.applied).toContain('graph:withdrawn')
  })
  it('a turn that carries a model (a change set aside leaves the saved model; a first draft still held) withdraws nothing', () => {
    const { store, withdrawGraph } = storeWith(nodes)
    applyCoreTurnState(stillThere(), store)
    expect(withdrawGraph).not.toHaveBeenCalled()
  })
  it('an empty canvas has nothing to let go of', () => {
    const { store, withdrawGraph } = storeWith([])
    applyCoreTurnState(declined(), store)
    expect(withdrawGraph).not.toHaveBeenCalled()
  })
  it('off the olumi-core lane nothing changes (CEE\'s own turns keep their canvas)', () => {
    vi.stubEnv('VITE_OLUMI_CORE', '')
    const { store, withdrawGraph } = storeWith(nodes)
    applyCoreTurnState(declined(), store)
    expect(withdrawGraph).not.toHaveBeenCalled()
  })
})

describe('withdrawGraphFromCanvas', () => {
  it('empties the canvas and the autosave a reload would recover, and nothing else of the scenario is touched', () => {
    useCanvasStore.setState({ nodes, edges: [], currentScenarioId: '00000000-0000-4000-8000-437f3c107bdd' } as never)
    expect(saveAutosave({ nodes, edges: [], scenarioId: '00000000-0000-4000-8000-437f3c107bdd' } as never)).toBe(true)
    expect(localStorage.getItem('olumi-canvas-autosave')).not.toBeNull()
    withdrawGraphFromCanvas()
    expect(useCanvasStore.getState().nodes).toEqual([])
    expect(useCanvasStore.getState().edges).toEqual([])
    expect(useCanvasStore.getState().currentScenarioId).toBe('00000000-0000-4000-8000-437f3c107bdd')
    expect(localStorage.getItem('olumi-canvas-autosave')).toBeNull()
    expect(loadAutosave()).toBeNull()
  })
})
