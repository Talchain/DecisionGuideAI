import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CANVAS_LAYER_CLASS } from '../../../canvas/layers'
import { ToastProvider } from '../../../canvas/ToastContext'
import { VersionsPanelHost } from '../../../canvas/versions/VersionsPanelHost'
import { useVersionsPanelStore } from '../../../canvas/versions/versionsPanelStore'
import { TopBar } from '../../../components/layout/TopBar'
import { setTeamFetch } from '../../../olumiCore/team/api'
import { typography } from '../../../styles/typography'
import { VIEW_CHIP_CLASS, VIEW_CHIP_PRIMARY_CLASS, VIEW_ICON_BUTTON_CLASS } from '../../../v5/blocks/chipClass'
import { useViewStore } from '../../store'
import { LaneHelp } from '../../v12/LaneHelp'
import { LaneEditingLayer } from '../../v12/edit/LaneEditingLayer'
import { useLaneInspector } from '../../v12/edit/inspectorStore'
import { openLaneForm } from '../../v12/edit/structuralEdits'
import { approved, BASE, install, SID, uninstall } from '../../v12/edit/__tests__/harness'

vi.mock('../../../lib/supabase', () => ({
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
  supabase: { auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) } },
}))
vi.mock('../../v12/journey/JourneyRecord', () => ({ default: () => null }))

beforeEach(() => {
  vi.stubEnv('VITE_OLUMI_CORE', '1')
  localStorage.clear()
})

afterEach(() => {
  cleanup()
  useVersionsPanelStore.getState().close()
  useLaneInspector.setState({ current: null, drafts: {}, peek: null })
  localStorage.clear()
  uninstall()
  vi.unstubAllEnvs()
})

function renderChrome() {
  render(
    <MemoryRouter>
      <ToastProvider>
        <TopBar scenarioTitle="A scenario" onTitleChange={vi.fn()} onSave={vi.fn()} onShare={vi.fn()} />
        <LaneHelp />
        <VersionsPanelHost />
      </ToastProvider>
    </MemoryRouter>,
  )
}

function expectRecipe(element: HTMLElement, recipe: string) {
  expect(element).toHaveClass(...recipe.split(/\s+/))
}

function expectTabWrap(first: HTMLElement, last: HTMLElement) {
  last.focus()
  expect(fireEvent.keyDown(last, { key: 'Tab' })).toBe(false)
  expect(first).toHaveFocus()
  expect(fireEvent.keyDown(first, { key: 'Tab', shiftKey: true })).toBe(false)
  expect(last).toHaveFocus()
}

describe('lane dialog focus and recipes', () => {
  it('focuses the scenario title, wraps Tab and returns to More options on Escape or Cancel', () => {
    install()
    renderChrome()
    const trigger = screen.getByRole('button', { name: 'More options' })
    const open = () => {
      fireEvent.click(trigger)
      const rename = screen.getByRole('menuitem', { name: 'Rename' })
      rename.focus()
      fireEvent.click(rename)
      return screen.getByRole('dialog', { name: 'Rename scenario' })
    }
    const dialog = open()
    const input = within(dialog).getByRole('textbox')
    const cancel = within(dialog).getByRole('button', { name: 'Cancel' })
    expect(input).toHaveFocus()
    expect(input).toHaveClass('min-h-7')
    expect(dialog).toHaveClass(CANVAS_LAYER_CLASS.modalBackdrop, 'bg-[var(--backdrop)]')
    expect(input.closest('form')).toHaveClass('rounded-lg', 'bg-panel', 'shadow-3')
    expectRecipe(within(dialog).getByRole('heading'), typography.panelHeader)
    expectRecipe(within(dialog).getByRole('button', { name: 'Save title' }), VIEW_CHIP_PRIMARY_CLASS)
    expectRecipe(cancel, VIEW_CHIP_CLASS)
    expectTabWrap(input, cancel)
    fireEvent.keyDown(cancel, { key: 'Escape' })
    expect(dialog).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()

    const reopened = open()
    fireEvent.click(within(reopened).getByRole('button', { name: 'Cancel' }))
    expect(reopened).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('wraps from the end of version history and restores the top bar opener on Escape or Cancel', async () => {
    install()
    setTeamFetch(vi.fn(async () => new Response(JSON.stringify({
      versions: [{ id: 1, n: 1, at: '2026-11-23T09:00:00Z', by: 'Paul', base: null }],
    }))) as unknown as typeof fetch)
    renderChrome()
    const trigger = screen.getByTestId('topbar-versions-trigger')
    trigger.focus()
    fireEvent.click(trigger)
    const dialog = screen.getByRole('dialog', { name: 'Version history' })
    const cancel = within(dialog).getByRole('button', { name: 'Cancel' })
    expect(cancel).toHaveFocus()
    expect(dialog).toHaveClass(CANVAS_LAYER_CLASS.modalBackdrop, 'bg-[var(--backdrop)]', 'right-[var(--dock-right-offset,0rem)]')
    expect(dialog.firstElementChild).toHaveClass('bg-panel', 'rounded-lg', 'shadow-3')
    expectRecipe(within(dialog).getByRole('heading'), typography.panelHeader)
    expectRecipe(cancel, VIEW_CHIP_CLASS)
    expectTabWrap(cancel, await within(dialog).findByRole('link', { name: 'Printable record' }))
    const last = within(dialog).getByRole('link', { name: 'Printable record' })
    fireEvent.keyDown(last, { key: 'Escape' })
    expect(dialog).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()

    fireEvent.click(trigger)
    const reopened = screen.getByRole('dialog', { name: 'Version history' })
    fireEvent.click(within(reopened).getByRole('button', { name: 'Cancel' }))
    expect(reopened).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('uses one Escape per layer when the legend opens over version history', () => {
    renderChrome()
    const trigger = screen.getByTestId('topbar-versions-trigger')
    trigger.focus()
    fireEvent.click(trigger)
    const history = screen.getByRole('dialog', { name: 'Version history' })
    const cancel = within(history).getByRole('button', { name: 'Cancel' })
    fireEvent.keyDown(cancel, { key: '?' })
    const legend = screen.getByRole('dialog', { name: 'Keyboard legend' })
    const close = within(legend).getByRole('button', { name: 'Close keyboard legend' })
    expect(close).toHaveFocus()
    fireEvent.keyDown(close, { key: 'Escape' })
    expect(legend).not.toBeInTheDocument()
    expect(history).toBeInTheDocument()
    expect(cancel).toHaveFocus()
    fireEvent.keyDown(cancel, { key: 'Escape' })
    expect(history).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('moves into the keyboard legend, cycles between its controls and restores More options', () => {
    renderChrome()
    const trigger = screen.getByRole('button', { name: 'More options' })
    fireEvent.click(trigger)
    const shortcuts = screen.getByRole('menuitem', { name: 'Keyboard shortcuts' })
    shortcuts.focus()
    fireEvent.click(shortcuts)
    const dialog = screen.getByRole('dialog', { name: 'Keyboard legend' })
    const close = within(dialog).getByRole('button', { name: 'Close keyboard legend' })
    const done = within(dialog).getByRole('button', { name: 'Got it' })
    expect(close).toHaveFocus()
    expect(dialog.firstElementChild).toHaveClass('bg-panel', 'rounded-lg', 'shadow-3')
    expect(dialog.querySelector('.bg-white, .text-xl, .font-semibold')).toBeNull()
    expectRecipe(within(dialog).getByRole('heading', { name: 'Keyboard legend' }), typography.panelHeader)
    expectRecipe(close, VIEW_ICON_BUTTON_CLASS)
    expectRecipe(done, VIEW_CHIP_CLASS)
    expectTabWrap(close, done)
    fireEvent.keyDown(done, { key: 'Escape' })
    expect(dialog).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it.each([true, false])('focuses the edit field and uses the correct control sizes with lane=%s', (lane) => {
    vi.stubEnv('VITE_OLUMI_CORE', lane ? '1' : '')
    install()
    render(
      <ToastProvider>
        <button type="button" onClick={(event) => openLaneForm(
          { kind: 'rename', sid: SID, base: BASE, record: 'starting_customers', current: 'Customers' },
          undefined, undefined, event.currentTarget,
        )}>Rename card</button>
        <LaneEditingLayer />
      </ToastProvider>,
    )
    const trigger = screen.getByRole('button', { name: 'Rename card' })
    fireEvent.click(trigger)
    const form = screen.getByRole('dialog', { name: 'Rename' })
    const input = within(form).getByRole('textbox') as HTMLInputElement
    const cancel = within(form).getByRole('button', { name: 'Cancel' })
    const save = within(form).getByRole('button', { name: 'Save' })
    expect(input).toHaveFocus()
    expect(input.selectionStart).toBe(0)
    expect(input.selectionEnd).toBe(input.value.length)
    expect(form).not.toHaveAttribute('aria-modal')
    if (!lane) {
      for (const control of [input, cancel, save]) expect(control).toHaveClass('min-h-[44px]')
      expect(fireEvent.keyDown(cancel, { key: 'Tab' })).toBe(true)
      return
    }
    expect(input).toHaveClass('min-h-7')
    expectRecipe(save, VIEW_CHIP_PRIMARY_CLASS)
    expectRecipe(cancel, VIEW_CHIP_CLASS)
    expectTabWrap(input, cancel)
    fireEvent.change(input, { target: { value: 'New name' } })
    fireEvent.keyDown(cancel, { key: 'Escape' })
    expect(form).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()

    fireEvent.click(trigger)
    const reopened = screen.getByRole('dialog', { name: 'Rename' })
    expect(within(reopened).getByRole('textbox')).toHaveValue('New name')
    fireEvent.click(within(reopened).getByRole('button', { name: 'Cancel' }))
    expect(reopened).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
    expect(useLaneInspector.getState().drafts).toEqual({})
  })

  it('focuses the inline Value row and uses the edit form recipes for save, try and rebase', () => {
    const view = approved()
    install(view)
    render(<ToastProvider><LaneEditingLayer /></ToastProvider>)
    act(() => { useLaneInspector.getState().openFigure({ kind: 'card', id: 'starting_customers' }) })
    const input = screen.getByTestId('inspector-figure-typed')
    expect(input).toHaveFocus()
    fireEvent.change(input, { target: { value: '130' } })
    expectRecipe(screen.getByTestId('inspector-figure-set'), VIEW_CHIP_PRIMARY_CLASS)
    expectRecipe(screen.getByTestId('inspector-figure-try'), VIEW_CHIP_CLASS)
    act(() => useViewStore.setState({ view: { ...view, model: { ...view.model!, edit_base: BASE + 1 } } }))
    expectRecipe(screen.getByTestId('inspector-figure-rebase'), VIEW_CHIP_CLASS)
  })
})
