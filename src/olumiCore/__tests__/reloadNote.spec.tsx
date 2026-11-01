/**
 * Olumi's next step, beside its card, survives a reload (olumi-core lane; the coach-note regression of tier R's last round). The read brings
 * `olumi_note`; the page applies it once the card is on the canvas, as a live turn's note is applied, and not again once shown or dismissed.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'

vi.mock('../../lib/supabase', () => ({ supabase: {}, getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))
vi.mock('../../lib/posthog', () => ({ trackEvent: () => undefined }))

import type { Node } from '@xyflow/react'
import { useCanvasStore } from '../../canvas/store'
import { useAssistantFocusStore, dismissAssistantFocus } from '../../canvas/stores/assistantFocusStore'
import { clearOlumiAttention } from '../../canvas/utils/olumiAttention'
import { ReloadNoteApplier } from '../ReloadNoteApplier'
import { markNoteShown, offerReloadNote, resetShownNotes, useReloadNoteStore } from '../reloadNote'

const SCENARIO = '00000000-0000-4000-8000-437f3c107bdd'
const NOTE = { element_id: 'per_specialist', text: 'Imagine it is three months on and the hire did not lift capacity enough. What went wrong?', turn_id: '00000000-0000-4000-8000-000000000001' }
const card = (id: string, type: string): Node => ({ id, type, position: { x: 0, y: 0 }, data: { label: id.replace('_', ' '), kind: type } }) as unknown as Node
const attention = () => (useCanvasStore.getState() as unknown as { olumiAttention: { nodeIds: string[]; note: { body: string } | null; modelVersion: string | null } | null }).olumiAttention

beforeEach(() => {
  vi.stubEnv('VITE_OLUMI_CORE', '1')
  resetShownNotes()
  useCanvasStore.setState({ olumiAttention: null, nodes: [], currentScenarioId: SCENARIO } as never)
})
afterEach(() => { cleanup(); clearOlumiAttention(); dismissAssistantFocus(); vi.unstubAllEnvs() })

describe('a reload brings Olumi\'s note back beside its card', () => {
  it('the note is held beside the card and the focus lands on it, once the card is on the canvas', () => {
    render(<ReloadNoteApplier />)
    act(() => offerReloadNote(SCENARIO, NOTE, 'rev1'))
    expect(attention()).toBeNull()   // the card is not there yet: nothing is dropped, nothing is shown
    expect(useReloadNoteStore.getState().offer).not.toBeNull()
    act(() => useCanvasStore.setState({ nodes: [card('per_specialist', 'factor')] } as never))
    expect(attention()).toMatchObject({ nodeIds: ['per_specialist'], modelVersion: 'rev1' })
    expect(attention()?.note?.body).toMatch(/three months on/)
    expect(useAssistantFocusStore.getState().target).toMatchObject({ id: 'per_specialist', scenarioId: SCENARIO })
    expect(useReloadNoteStore.getState().offer).toBeNull()
  })
  it('it is shown once: dismissed, a later read does not bring it back; one a live turn already showed is not offered', () => {
    useCanvasStore.setState({ nodes: [card('per_specialist', 'factor')] } as never)
    render(<ReloadNoteApplier />)
    act(() => offerReloadNote(SCENARIO, NOTE, null))
    expect(attention()?.nodeIds).toEqual(['per_specialist'])
    act(() => clearOlumiAttention())
    act(() => offerReloadNote(SCENARIO, NOTE, null))
    expect(attention()).toBeNull()
    resetShownNotes()
    markNoteShown(NOTE)
    act(() => offerReloadNote(SCENARIO, NOTE, null))
    expect(useReloadNoteStore.getState().offer).toBeNull()
  })
  it('another scenario\'s note is not applied; a malformed or absent note offers nothing; off the lane nothing is applied', () => {
    useCanvasStore.setState({ nodes: [card('per_specialist', 'factor')] } as never)
    render(<ReloadNoteApplier />)
    act(() => offerReloadNote('00000000-0000-4000-8000-000000000999', NOTE, null))
    expect(attention()).toBeNull()
    for (const bad of [undefined, null, 'x', { element_id: '', text: 'a', turn_id: 't' }, { element_id: 'a', text: '  ', turn_id: 't' }, { element_id: 'a', text: 'a' }]) {
      act(() => offerReloadNote(SCENARIO, bad, null))
      expect(useReloadNoteStore.getState().offer).toBeNull()
    }
    vi.stubEnv('VITE_OLUMI_CORE', '')
    act(() => offerReloadNote(SCENARIO, NOTE, null))
    expect(attention()).toBeNull()
  })
  it('a constraint card keeps its note and gets no pointer, like a live note', () => {
    useCanvasStore.setState({ nodes: [card('old_constraint', 'constraint')] } as never)
    render(<ReloadNoteApplier />)
    act(() => offerReloadNote(SCENARIO, { ...NOTE, element_id: 'old_constraint' }, null))
    expect(attention()?.nodeIds).toEqual(['old_constraint'])
    expect(useAssistantFocusStore.getState().target).toBeNull()
  })
})
