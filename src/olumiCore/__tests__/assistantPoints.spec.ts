/**
 * Olumi points at the card its next step is about. A core turn's note (core's `coach.next` text, beside the card `next.about` names)
 * was already held beside the card; on the olumi-core lane the assistant focus (the halo, and the camera when the card is off screen)
 * now lands on it too. Only an option, factor, goal, risk or outcome card can be pointed at; any other kind keeps the note and no pointer.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../lib/supabase', () => ({ supabase: {}, getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))
vi.mock('../../lib/posthog', () => ({ trackEvent: () => undefined }))

import type { Node } from '@xyflow/react'
import { applyCoreTurnState } from '../../v5/applyCoreTurn'
import { parseCoreTurn } from '../../v5/coreTurnContract'
import { useAssistantFocusStore, dismissAssistantFocus } from '../../canvas/stores/assistantFocusStore'
import { registerAssistantFocusCamera } from '../../canvas/utils/assistantFocusCamera'
import { useCanvasStore } from '../../canvas/store'
import { turnBodyForTest } from './withdrawnDraft.helpers'

const SCENARIO = '00000000-0000-4000-8000-437f3c107bdd'
const graph = {
  nodes: [
    { id: 'per_specialist', kind: 'factor', label: 'per specialist', ref: 'F1' },
    { id: 'add_one', kind: 'option', label: 'Add one specialist', ref: 'O1' },
    { id: 'capacity_goal', kind: 'goal', label: 'At least 100 a week', ref: 'G1' },
    { id: 'new_hire_slump', kind: 'risk', label: 'New hire slump', ref: 'R1' },
    { id: 'total_capacity', kind: 'outcome', label: 'total capacity', ref: 'OC1' },
    { id: 'mp:decision', kind: 'decision', label: 'Should we add a specialist?', ref: 'D1' },
    { id: 'old_constraint', kind: 'constraint', label: 'A constraint', ref: 'C1' },
  ],
  edges: [],
}
const onCanvas = graph.nodes.map((n, i) => ({ id: n.id, type: n.kind, position: { x: 0, y: i * 100 }, data: { label: n.label, kind: n.kind } })) as unknown as Node[]
const turnWith = (element_id: string, text = 'Imagine it is three months on and the hire did not lift capacity enough. What went wrong?') => {
  const body = turnBodyForTest({}) as { model: Record<string, unknown> }
  return parseCoreTurn({ ...body, model: { ...body.model, graph }, notes: [{ element_id, text }] })!
}
/** The board holds `nodes` (the applier's snapshot and the canvas store, which the attention request reads, are the same board). */
const apply = (turn: ReturnType<typeof turnWith>, nodes: Node[] = onCanvas) => {
  useCanvasStore.setState({ nodes } as never)
  return applyCoreTurnState(turn, { nodes }, { turnScenarioId: SCENARIO })
}
const focus = () => useAssistantFocusStore.getState().target
const attention = () => (useCanvasStore.getState() as unknown as { olumiAttention: { nodeIds: string[]; note: { body: string } | null } | null }).olumiAttention

let camera: ReturnType<typeof vi.fn>
let unregister: () => void
beforeEach(() => {
  vi.stubEnv('VITE_OLUMI_CORE', '1')
  useCanvasStore.setState({ olumiAttention: null } as never)
  camera = vi.fn()
  unregister = registerAssistantFocusCamera(camera, vi.fn())
})
afterEach(() => { unregister(); dismissAssistantFocus(); vi.unstubAllEnvs() })

describe('the pointer lands on the card Olumi\'s next step names (olumi-core lane)', () => {
  it.each([['per_specialist', 'factor'], ['add_one', 'option'], ['capacity_goal', 'goal'], ['new_hire_slump', 'risk'], ['total_capacity', 'outcome']])(
    'a note on the %s %s card is held beside it AND the assistant focus lands on it, with the camera sent there', (id) => {
      const r = apply(turnWith(id))
      expect(attention()?.nodeIds).toEqual([id])
      expect(attention()?.note?.body).toMatch(/three months on/)
      expect(focus()).toMatchObject({ id, kind: 'node', scenarioId: SCENARIO })
      expect(focus()?.label).toBe(graph.nodes.find((n) => n.id === id)!.label)
      expect(camera).toHaveBeenCalledWith(id)
      expect(r.applied).toEqual(expect.arrayContaining([`note:${id}`, `focus:${id}`]))
    })
  it('a kind with no pointer (a constraint card) keeps its note and has no focus and no camera move', () => {
    apply(turnWith('old_constraint'))
    expect(attention()?.nodeIds).toEqual(['old_constraint'])
    expect(focus()).toBeNull()
    expect(camera).not.toHaveBeenCalled()
  })
  it('the question card is never pointed at: no note, no focus', () => {
    apply(turnWith('mp:decision'))
    expect(attention()).toBeNull()
    expect(focus()).toBeNull()
  })
  it('CONTRAST: a card that is not on the canvas yet holds nothing and points at nothing (fail-closed, as before)', () => {
    const r = apply(turnWith('add_one'), onCanvas.filter((n) => n.id !== 'add_one'))
    expect(attention()).toBeNull()
    expect(focus()).toBeNull()
    expect(r.deferred).toEqual([expect.objectContaining({ reason: 'ui_directive_target_not_found', detail: 'add_one' })])
  })
  it('a turn with no note moves nothing', () => {
    const body = turnBodyForTest({}) as { model: Record<string, unknown> }
    apply(parseCoreTurn({ ...body, model: { ...body.model, graph } })!)
    expect(focus()).toBeNull()
    expect(camera).not.toHaveBeenCalled()
  })
  it('a later turn\'s note moves the pointer to its card (one focus at a time)', () => {
    apply(turnWith('add_one'))
    apply(turnWith('per_specialist'))
    expect(focus()?.id).toBe('per_specialist')
  })
  it('off the lane (CEE\'s own core route) the note is held as before and the pointer is not moved by it', () => {
    vi.stubEnv('VITE_OLUMI_CORE', '')
    apply(turnWith('per_specialist'))
    expect(attention()?.nodeIds).toEqual(['per_specialist'])
    expect(focus()).toBeNull()
    expect(camera).not.toHaveBeenCalled()
  })
})
