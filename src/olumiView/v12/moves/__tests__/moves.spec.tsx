/**
 * V12 Olumi's moves as icons (contract section 8, Paul 17 Nov): the canvas's rail of core's questions and a card's challenges. Each press
 * sends core's own move with the object's id; ViewChat's writers are mocked, so the rows bind which writer is called and with what ids.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { View } from '../../../client'
import { useViewStore } from '../../../store'
import { useCanvasStore } from '../../../../canvas/store'
import { QUESTIONS } from '../../../../canvas/conversation/askAiQuestions'
import { sessionOf } from '../../../layout'
import { challenge, runMethod } from '../../../ViewChat'
import { CanvasMoves } from '../CanvasMoves'
import { CardMoves } from '../CardMoves'
import { RAIL_MAX } from '../registry'

// The writers are mocked (each press is bound by which writer it calls, with which ids); the rest of ViewChat is its own.
vi.mock('../../../ViewChat', async (original) => ({ ...(await original<typeof import('../../../ViewChat')>()), runMethod: vi.fn(), challenge: vi.fn(async () => true) }))

const golden = (n: string): View => JSON.parse(readFileSync(path.resolve(`src/olumiView/golden/${n}.view.json`), 'utf8'))
const SID = 's_0000000000aa', UUID = '00000000-0000-4000-8000-0000000000aa'
const show = (view: View, at: number | null = null) => useViewStore.setState({ uuid: UUID, sid: SID, view, error: null, status: 'ready', stale: false, at })
beforeEach(() => { vi.mocked(runMethod).mockClear(); vi.mocked(challenge).mockClear() })
afterEach(() => { cleanup(); useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none', stale: false, at: null }); useCanvasStore.setState({ nodes: [] }) })

describe('the canvas rail of core\'s questions', () => {
  it('core\'s first six questions in core\'s order, each named by core\'s words; a press asks THAT question (runMethod with its id)', async () => {
    const view = golden('app-launch'), methods = sessionOf(view)!.methods
    show(view)
    render(<CanvasMoves />)
    const buttons = screen.getAllByTestId('canvas-moves-method')
    expect(buttons.map((b) => [b.getAttribute('data-method'), b.getAttribute('aria-label'), b.title])).toEqual(methods.slice(0, RAIL_MAX).map((m) => [m.id, m.text, m.text]))
    await act(async () => { fireEvent.click(buttons[1]!) })
    expect(vi.mocked(runMethod).mock.calls).toEqual([[methods[1]!.id]])
    // CONTRAST: another icon asks another question.
    await act(async () => { fireEvent.click(buttons[3]!) })
    expect(vi.mocked(runMethod).mock.calls.at(-1)).toEqual([methods[3]!.id])
    expect(methods[3]!.id).not.toBe(methods[1]!.id)
    // Olumi's mark opens core's whole list; a press there asks that question too.
    await act(async () => { fireEvent.click(screen.getByTestId('canvas-moves-all')) })
    const all = screen.getAllByTestId('canvas-moves-list-method')
    expect(all.map((b) => b.getAttribute('data-method'))).toEqual(methods.map((m) => m.id))
    await act(async () => { fireEvent.click(all.at(-1)!) })
    expect(vi.mocked(runMethod).mock.calls.at(-1)).toEqual([methods.at(-1)!.id])
  })

  it('not drawn where the panel offers no ways to test the model: a past version held, or no model yet (a brief to take)', () => {
    const view = golden('app-launch')
    show(view, 1)
    render(<CanvasMoves />)
    expect(screen.queryByTestId('canvas-moves')).toBeNull()
    cleanup()
    show({ ...view, version: null, proposal: null, model: null } as unknown as View)
    render(<CanvasMoves />)
    expect(screen.queryByTestId('canvas-moves')).toBeNull()
    cleanup()
    // CONTRAST: the latest version, with its model: the rail is there.
    show(view)
    render(<CanvasMoves />)
    expect(screen.getByTestId('canvas-moves')).toBeInTheDocument()
  })
})

describe('a card\'s challenges', () => {
  it('a challenge press sends THAT kind on THAT card with the words a challenge chip sends for it; another card sends its own id', async () => {
    const view = golden('app-launch')
    const [a, b] = [view.model!.cards.find((c) => c.family === 'risk')!, view.model!.cards.find((c) => c.family === 'goal')!]
    show(view)
    // The canvas's nodes, as the lane draws them (canvas.ts: `label` is the heading); invented headings, so the words are bound exactly.
    useCanvasStore.setState({ nodes: [{ id: a.id, type: 'view-card', position: { x: 0, y: 0 }, data: { label: 'Invented risk alpha' } }, { id: b.id, type: 'view-card', position: { x: 0, y: 0 }, data: { label: 'Invented aim beta' } }] as never })
    render(<><CardMoves id={a.id} selected /><CardMoves id={b.id} selected={false} /></>)
    const [onA, onB] = screen.getAllByTestId('card-moves')
    expect([onA!.getAttribute('data-card'), onB!.getAttribute('data-card')]).toEqual([a.id, b.id])
    expect(within(onA!).getAllByRole('button').map((x) => x.getAttribute('data-challenge') ?? x.getAttribute('data-testid'))).toEqual(['assumption', 'opposite', 'disconfirming', 'outside'])
    await act(async () => { fireEvent.click(within(onA!).getByRole('button', { name: 'Challenge it' })) })
    // The assumption challenge as the product's chip asks it of a risk card (askAiQuestions QUESTIONS.challenge).
    expect(vi.mocked(challenge).mock.calls).toEqual([['assumption', a.id, QUESTIONS.challenge({ stage: 'drafted', kind: 'risk', label: 'Invented risk alpha' })]])
    expect(vi.mocked(challenge).mock.calls[0]![2]).toBe('What could make ‘Invented risk alpha’ happen, and what evidence would change how we see that risk?')
    // CONTRAST: the same press on the other card carries the other card's id and its own words.
    await act(async () => { fireEvent.click(within(onB!).getByRole('button', { name: 'Challenge it' })) })
    expect(vi.mocked(challenge).mock.calls.at(-1)).toEqual(['assumption', b.id, 'Is ‘Invented aim beta’ the outcome we actually want, or a stand-in for it?'])
    // CONTRAST: another kind on the first card is that kind.
    await act(async () => { fireEvent.click(within(onA!).getByRole('button', { name: 'What would disprove it' })) })
    expect(vi.mocked(challenge).mock.calls.at(-1)).toEqual(['disconfirming', a.id, 'What evidence or result would show that ‘Invented risk alpha’ will not happen? What would have to be true for it to fail?'])
    // At rest a card carries none of it; selected, it shows.
    expect([onA!.className.includes(' visible'), onB!.className.split(' ').includes('invisible')]).toEqual([true, true])
  })
})
