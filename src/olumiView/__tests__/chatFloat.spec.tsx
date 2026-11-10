import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render, within } from '@testing-library/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { setTeamFetch } from '../../olumiCore/team/api'
import { ViewChat, ViewComposer, useViewChat } from '../ViewChat'
import { useChatFloat } from '../port/ChatFloat'
import { useUIStore } from '../../stores/uiStore'

const fixture: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/session/after-find-first.view3.json'), 'utf8'))
const failed: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/j1/bookshop-v1-turn-failed.core-172e23ae.view3.json'), 'utf8'))
const show = () => useViewStore.setState({ uuid: '00000000-0000-4000-8000-cb215d057b96', sid: fixture.id, view: fixture, error: null, status: 'ready', stale: false, at: null })
const scene = () => render(<><ViewChat /><ViewComposer /></>)

beforeEach(() => {
  // Pointer coordinates are real event fields in the browser (A2 stop/float, DL 10 Nov).
  vi.stubGlobal('PointerEvent', class extends MouseEvent {
    pointerId: number
    constructor(type: string, init: PointerEventInit = {}) { super(type, init); this.pointerId = init.pointerId ?? 1 }
  })
  vi.stubGlobal('innerWidth', 1232)
  vi.stubGlobal('innerHeight', 704)
  useChatFloat.setState({ floating: false, position: { x: 52, y: 78 } })
  useViewChat.setState({ text: '', ops: new Map(), busy: false, said: null, held: null, gone: null })
  setTeamFetch((async () => new Response(JSON.stringify(fixture), { status: 200 })) as typeof fetch)
  show()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  setTeamFetch(null)
  useChatFloat.setState({ floating: false, position: { x: 52, y: 78 } })
  useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none', stale: false, at: null })
})

describe('A2 stop/float, DL 10 Nov', () => {
  it('CF1 moves the one thread and composer to a body portal and back, keeping typed words and thread state', () => {
    const { container, getByTestId, queryByTestId, getAllByTestId, getByRole } = scene()
    const thread = getByTestId('view-chat-turns')
    fireEvent.change(getByRole('textbox'), { target: { value: 'Keep this thought' } })
    const popout = getByTestId('view-chat-popout')
    expect(popout).toHaveAccessibleName('Open Olumi in floating panel')
    expect(popout).toHaveAttribute('title', 'Open in floating window')
    expect(popout).toHaveClass('min-h-[44px]', 'min-w-[44px]')
    fireEvent.click(popout)
    const panel = getByTestId('view-chat-float')
    expect(panel.parentElement).toBe(document.body)
    expect(container.contains(panel)).toBe(false)
    expect(container.querySelector('[data-testid="view-chat"]')).toBeNull()
    expect(container.querySelector('textarea')).toBeNull()
    expect(container.textContent).toBe('')
    expect(getByTestId('view-chat-return')).toHaveAccessibleName('Dock to panel')
    expect(getAllByTestId('view-chat-turns')).toHaveLength(1)
    expect(getByTestId('view-chat-turns')).toBe(thread)
    expect(getAllByTestId('view-composer')).toHaveLength(1)
    expect(within(panel).getByRole('textbox')).toHaveValue('Keep this thought')
    expect(within(panel).getByRole('textbox')).toHaveFocus()
    fireEvent.click(getByTestId('view-chat-dockback'))
    expect(queryByTestId('view-chat-float')).toBeNull()
    expect(getAllByTestId('view-chat-turns')).toHaveLength(1)
    expect(getByTestId('view-chat-turns')).toBe(thread)
    expect(container.contains(thread)).toBe(true)
    expect(getAllByTestId('view-composer')).toHaveLength(1)
    expect(getByRole('textbox')).toHaveValue('Keep this thought')
    expect(getByTestId('view-chat-popout')).toHaveFocus()
  })

  it('CF2 Escape docks, activates Olumi and keeps exactly one thread', () => {
    const { getByTestId, queryByTestId, getAllByTestId } = scene()
    fireEvent.click(getByTestId('view-chat-popout'))
    act(() => useUIStore.setState({ activeOutputTab: 'diagnostics' }))
    fireEvent.keyDown(within(getByTestId('view-chat-float')).getByRole('textbox'), { key: 'Escape' })
    expect(queryByTestId('view-chat-float')).toBeNull()
    expect(useChatFloat.getState().floating).toBe(false)
    expect(useUIStore.getState().activeOutputTab).toBe('olumi')
    expect(getAllByTestId('view-chat-turns')).toHaveLength(1)
    expect(getAllByTestId('view-composer')).toHaveLength(1)
  })

  it('CF3 a drag past every edge stays within 1232×704, and the position survives docking', () => {
    const { getByTestId } = scene()
    fireEvent.click(getByTestId('view-chat-popout'))
    const panel = getByTestId('view-chat-float'), header = getByTestId('view-chat-float-header')
    expect(panel.style.width).toBe('380px')
    expect(panel.style.height).toBe('520px')
    fireEvent.pointerDown(header, { button: 0, pointerId: 1, clientX: 70, clientY: 90 })
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 4000, clientY: 4000 })
    expect(Number.parseFloat(panel.style.left) + Number.parseFloat(panel.style.width)).toBe(1232)
    expect(Number.parseFloat(panel.style.top) + Number.parseFloat(panel.style.height)).toBe(704)
    fireEvent.pointerMove(window, { pointerId: 1, clientX: -4000, clientY: -4000 })
    expect(panel.style.left).toBe('0px')
    expect(panel.style.top).toBe('0px')
    fireEvent.pointerUp(window, { pointerId: 1 })
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 4000, clientY: 4000 })
    expect(useChatFloat.getState().position).toEqual({ x: 0, y: 0 })
    fireEvent.click(getByTestId('view-chat-dockback'))
    fireEvent.click(getByTestId('view-chat-popout'))
    expect(getByTestId('view-chat-float').style.left).toBe('0px')
    expect(getByTestId('view-chat-float').style.top).toBe('0px')
  })

  it('CF4 resizing a viewport smaller than the window keeps the whole float visible', () => {
    const { getByTestId } = scene()
    fireEvent.click(getByTestId('view-chat-popout'))
    vi.stubGlobal('innerWidth', 320)
    vi.stubGlobal('innerHeight', 400)
    fireEvent(window, new Event('resize'))
    const panel = getByTestId('view-chat-float')
    expect(panel.style.width).toBe('320px')
    expect(panel.style.height).toBe('400px')
    expect(panel.style.left).toBe('0px')
    expect(panel.style.top).toBe('0px')
  })

  it('CF5 the tab return control docks without starting a drag', () => {
    const { getByTestId, queryByTestId } = scene()
    fireEvent.click(getByTestId('view-chat-popout'))
    const dock = getByTestId('view-chat-dockback')
    expect(dock).toHaveAccessibleName('Dock to panel')
    expect(dock).toHaveClass('min-h-[44px]', 'min-w-[44px]')
    fireEvent.pointerDown(dock, { button: 0, pointerId: 1, clientX: 400, clientY: 90 })
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 1000, clientY: 600 })
    expect(useChatFloat.getState().position).toEqual({ x: 52, y: 78 })
    fireEvent.click(getByTestId('view-chat-return'))
    expect(queryByTestId('view-chat-float')).toBeNull()
  })

  it('CF6 floating sends through the same core composer once', async () => {
    const posts: { url: string; body: unknown }[] = []
    setTeamFetch((async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') posts.push({ url, body: JSON.parse(String(init.body)) })
      return new Response(JSON.stringify(init?.method === 'POST' ? {} : fixture), { status: 200 })
    }) as typeof fetch)
    const { getByTestId, getByRole } = scene()
    fireEvent.click(getByTestId('view-chat-popout'))
    fireEvent.change(getByRole('textbox'), { target: { value: 'What evidence would change this?' } })
    await act(async () => { fireEvent.click(getByTestId('view-composer-send')) })
    expect(posts).toEqual([{ url: `/api/scenarios/${fixture.id}/messages`, body: { text: 'What evidence would change this?', op: expect.any(String) } }])
    expect(getByRole('textbox')).toHaveValue('')
  })

  it('CF7 a running turn has no false stop control: core only offers draft cancellation', () => {
    useViewStore.setState({ view: { ...fixture, turn: { ...failed.turn!, status: 'answering' } } })
    const { getByTestId, queryByTestId } = scene()
    expect(queryByTestId('view-composer-stop')).toBeNull()
    expect(getByTestId('view-composer-send')).toBeDisabled()
    fireEvent.click(getByTestId('view-chat-popout'))
    expect(queryByTestId('view-composer-stop')).toBeNull()
    expect(getByTestId('view-composer-send')).toBeDisabled()
  })
})
