/**
 * S4 press, tasks 2 to 4, on the real components (the lane's one editing layer, the message box, the size button and the figure opener):
 *  2. Escape with focus in the message box closes the open surface and leaves the typed words; with no surface open it is the box's own.
 *  3. A press the edit gate refuses says why in the gate's own words (a toast); a press it allows says nothing.
 *  4. Escape closes the size form and keeps what was typed in it (reopened it starts from those words); Cancel is what forgets them.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ToastProvider } from '../../../../canvas/ToastContext'
import { FigureEdit } from '../../../FigureEdit'
import { ViewComposer, useViewChat } from '../../../ViewChat'
import { LaneEditingLayer } from '../LaneEditingLayer'
import { useLaneInspector } from '../inspectorStore'
import { editGateNow } from '../editGate'
import { useViewStore } from '../../../store'
import { RISK_EDIT, SID, install, uninstall } from './harness'

vi.mock('../../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../../../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: 'u1', accessToken: null }), supabase: {} }))
const lane = vi.hoisted(() => ({ on: false }))
vi.mock('../../../../olumiCore/lane', async (real) => ({ ...(await real<object>()), isOlumiCoreLane: () => lane.on }))

beforeEach(() => { lane.on = false; install() })
afterEach(() => { cleanup(); uninstall(); useLaneInspector.getState().close(); useLaneInspector.getState().close('form'); useLaneInspector.setState({ drafts: {} }); useViewChat.setState({ text: '' }) })

const mount = () => render(<ToastProvider><FigureEdit id="slow_ramp" edit={RISK_EDIT} glyph words={false} label="Change figure" /><LaneEditingLayer /><ViewComposer /></ToastProvider>)
const held = () => act(() => { useViewStore.setState({ view: { ...useViewStore.getState().view!, model: { ...useViewStore.getState().view!.model!, edit_base: null } } as never }) })
const box = () => document.getElementById('view-chat-text') as HTMLTextAreaElement
const form = () => document.querySelector('[data-testid="lane-edit-form"]')

describe('S4 press 2: Escape in the message box', () => {
  it('E1 with the size form open and words in the box, Escape pressed in the box closes the form and keeps the words', () => {
    mount(); act(() => { useViewChat.setState({ text: 'my draft' }) })
    fireEvent.click(screen.getByTestId('lane-size-edit')); expect(form()).not.toBeNull()
    box().focus(); fireEvent.keyDown(box(), { key: 'Escape' })
    expect(form(), 'the surface is closed').toBeNull()
    expect(useViewChat.getState().text, 'the draft is untouched').toBe('my draft')
  })
  it('E2 CONTRAST: with no surface open, Escape in the box changes nothing (the words stay)', () => {
    mount(); act(() => { useViewChat.setState({ text: 'my draft' }) })
    box().focus(); fireEvent.keyDown(box(), { key: 'Escape' })
    expect(form()).toBeNull(); expect(useViewChat.getState().text).toBe('my draft')
  })
  it('E3 CONTRAST: another text field outside the surface still keeps its own Escape (the surface stays open)', () => {
    mount(); fireEvent.click(screen.getByTestId('lane-size-edit'))
    const other = document.createElement('input'); document.body.appendChild(other); other.focus()
    fireEvent.keyDown(other, { key: 'Escape' })
    expect(form()).not.toBeNull(); other.remove()
  })
})

describe('S4 press 3: a refused press says why', () => {
  it('R1 the size button, refused while Olumi\'s change is held: the press shows the gate\'s own words and opens nothing', () => {
    mount(); held()
    const why = editGateNow(); expect(why.ok).toBe(false)
    fireEvent.click(screen.getByTestId('lane-size-edit'))
    expect(screen.getByText((why as { why: string }).why)).toBeInTheDocument()
    expect(form()).toBeNull()
  })
  it('R2 the card\'s pencil on the lane, refused the same way: the same words', () => {
    lane.on = true; mount(); held()
    const why = editGateNow() as { ok: false; why: string }
    fireEvent.click(screen.getByTestId('view-figure-edit-slow_ramp'))
    expect(screen.getByText(why.why)).toBeInTheDocument()
  })
  it('R3 CONTRAST: an allowed press opens the form and shows no refusal', () => {
    mount(); fireEvent.click(screen.getByTestId('lane-size-edit'))
    expect(form()).not.toBeNull(); expect(document.querySelector('[role="alert"]')).toBeNull()
  })
})

describe('S4 press 4: Escape on the size form keeps the draft', () => {
  const key = `${SID}:size:slow_ramp`
  it('Z1 Escape closes the form, the typed words are kept, and the form opened again starts from them', () => {
    mount(); fireEvent.click(screen.getByTestId('lane-size-edit'))
    fireEvent.change(screen.getByTestId('lane-edit-chance'), { target: { value: '20%' } })
    fireEvent.keyDown(screen.getByTestId('lane-edit-chance'), { key: 'Escape' })
    expect(form()).toBeNull(); expect(useLaneInspector.getState().drafts[key]).toMatchObject({ chance: '20%' })
    fireEvent.click(screen.getByTestId('lane-size-edit'))
    expect((screen.getByTestId('lane-edit-chance') as HTMLInputElement).value).toBe('20%')
  })
  it('Z2 CONTRAST: Cancel is what forgets the words', () => {
    mount(); fireEvent.click(screen.getByTestId('lane-size-edit'))
    fireEvent.change(screen.getByTestId('lane-edit-chance'), { target: { value: '20%' } })
    fireEvent.click(screen.getByTestId('lane-edit-cancel'))
    expect(form()).toBeNull(); expect(useLaneInspector.getState().drafts[key]).toBeUndefined()
  })
})
