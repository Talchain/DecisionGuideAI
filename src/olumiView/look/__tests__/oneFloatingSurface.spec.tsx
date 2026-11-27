import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReactFlowProvider } from '@xyflow/react'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { accountsApi } from '../../../olumiCore/accounts/api'
import { useWrites } from '../../../olumiCore/team/writes'
import { useViewStore } from '../../store'
import { ToastProvider } from '../../../canvas/ToastContext'
import { CanvasViewportControls } from '../../../components/layout/CanvasViewportControls'
import { useState } from 'react'
import { HoverButton } from '../Hover'
import { TIP_DELAY } from '../Tip'
import { registerEscapeLayer } from '../../v12/edit/escapeLayers'
import { ScenarioTitleDialog } from '../../ScenarioTitleDialog'
import { AddFigure } from '../../AddFigure'
import { LaneEditingLayer } from '../../v12/edit/LaneEditingLayer'
import { useLaneInspector } from '../../v12/edit/inspectorStore'
import { install, uninstall } from '../../v12/edit/__tests__/harness'

const card = { kind: 'card', id: 'starting_customers' } as const
const viewportHandlers = {
  onZoomIn: vi.fn(),
  onZoomOut: vi.fn(),
  onZoomReset: vi.fn(),
  onFitView: vi.fn(),
  onAutoArrange: vi.fn(),
}

function Surfaces({ viewport = false }: { viewport?: boolean }) {
  const [rename, setRename] = useState(false)
  return (
    <ToastProvider>
      <HoverButton words="Toolbar note">Tips</HoverButton>
      <button type="button" onClick={() => setRename(true)}>Open rename</button>
      {rename && <ScenarioTitleDialog onClose={() => setRename(false)} />}
      <AddFigure />
      {viewport && <ReactFlowProvider><CanvasViewportControls {...viewportHandlers} /></ReactFlowProvider>}
      <button type="button" onClick={() => useLaneInspector.getState().open(card)}>Inspect customers</button>
      <LaneEditingLayer />
    </ToastProvider>
  )
}

const nonModalSurfaces = () => Array.from(document.querySelectorAll(
  '[data-olumi-menu], [data-testid="lane-inspector"], [data-testid="lane-edit-form"]',
))
const escape = (target: Element = document.activeElement ?? document.body) => fireEvent.keyDown(target, { key: 'Escape' })

beforeEach(() => {
  vi.stubEnv('VITE_OLUMI_CORE', '1')
  install()
})

afterEach(() => {
  cleanup()
  useLaneInspector.setState({ current: null, peek: null, drafts: {} })
  uninstall()
  vi.unstubAllEnvs()
})

it('replaces the shared menu with the details sheet and the sheet with the edit form, then gives the dialog precedence', () => {
  render(<Surfaces />)
  const add = screen.getByTestId('canvas-add-to-model')
  const inspect = screen.getByRole('button', { name: 'Inspect customers' })

  fireEvent.click(add)
  const menu = screen.getByRole('menu', { name: 'Add to model' })
  expect(menu).toHaveAttribute('data-olumi-menu')
  expect(nonModalSurfaces()).toEqual([menu])
  escape()
  expect(nonModalSurfaces()).toEqual([])
  expect(add).toHaveFocus()

  fireEvent.click(add)
  fireEvent.click(within(screen.getByRole('menu', { name: 'Add to model' })).getByRole('menuitem', { name: 'Figure' }))
  expect(nonModalSurfaces()).toEqual([screen.getByTestId('lane-edit-form')])
  escape()
  expect(nonModalSurfaces()).toEqual([])

  fireEvent.click(add)
  // Click activation without an outside pointer press exercises the surface store.
  fireEvent.click(inspect)
  const sheet = screen.getByRole('complementary', { name: 'Details' })
  expect(nonModalSurfaces()).toEqual([sheet])
  escape(within(sheet).getByRole('button', { name: 'Close details' }))
  expect(nonModalSurfaces()).toEqual([])

  fireEvent.click(inspect)
  const details = within(screen.getByRole('complementary', { name: 'Details' }))
  fireEvent.click(details.getByTestId('lane-inspector-more'))
  fireEvent.click(details.getByRole('button', { name: 'Add a claim about this' }))
  const form = screen.getByTestId('lane-edit-form')
  expect(form).not.toHaveAttribute('aria-modal')
  expect(nonModalSurfaces()).toEqual([form])

  const rename = screen.getByRole('button', { name: 'Open rename' })
  rename.focus()
  fireEvent.click(rename)
  const dialog = screen.getByRole('dialog', { name: 'Rename scenario' })
  expect(nonModalSurfaces()).toEqual([])
  escape(within(dialog).getByRole('textbox'))
  expect(dialog).not.toBeInTheDocument()
  expect(rename).toHaveFocus()
  expect(nonModalSurfaces()).toEqual([])
})

it('a sheet replaces a chrome menu opened before it and blocks that menu from reopening', async () => {
  const user = userEvent.setup()
  render(<Surfaces viewport />)
  const viewportMenu = screen.getByRole('button', { name: 'More view options' })
  await user.click(viewportMenu)
  expect(nonModalSurfaces()).toEqual([screen.getByRole('menu', { name: 'More view options' })])

  // Focus the inspection control directly so the menu is still open when Enter activates it.
  screen.getByRole('button', { name: 'Inspect customers' }).focus()
  await user.keyboard('{Enter}')
  expect(nonModalSurfaces()).toEqual([screen.getByRole('complementary', { name: 'Details' })])
  expect(viewportMenu).toHaveAttribute('aria-expanded', 'false')
  fireEvent.click(viewportMenu)
  expect(screen.queryByRole('menu')).toBeNull()
  expect(screen.getByRole('complementary', { name: 'Details' })).toBeVisible()
})

it('a menu dismisses an existing standalone tip and blocks standalone tips while it is open', () => {
  vi.useFakeTimers()
  try {
    render(<Surfaces viewport />)
    const tip = screen.getByRole('button', { name: 'Tips' })
    fireEvent.pointerEnter(tip)
    act(() => { vi.advanceTimersByTime(TIP_DELAY) })
    expect(screen.getByRole('tooltip')).toHaveTextContent('Toolbar note')

    fireEvent.click(screen.getByRole('button', { name: 'More view options' }))
    expect(screen.getByRole('menu')).toBeVisible()
    expect(screen.queryByRole('tooltip')).toBeNull()
    fireEvent.pointerLeave(tip)
    fireEvent.pointerEnter(tip)
    act(() => { vi.advanceTimersByTime(TIP_DELAY) })
    expect(screen.queryByRole('tooltip')).toBeNull()
  } finally { vi.useRealTimers() }
})

it('a sheet replaces an existing tip and outside press returns focus to the opener', () => {
  vi.useFakeTimers()
  try {
    render(<Surfaces />)
    const inspect = screen.getByRole('button', { name: 'Inspect customers' })
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'Tips' }))
    act(() => { vi.advanceTimersByTime(TIP_DELAY) })
    expect(screen.getByRole('tooltip')).toBeVisible()

    inspect.focus()
    fireEvent.click(inspect)
    expect(screen.queryByRole('tooltip')).toBeNull()
    const sheet = screen.getByRole('complementary', { name: 'Details' })
    within(sheet).getByRole('button', { name: 'Close details' }).focus()
    fireEvent.pointerDown(document.body)
    expect(sheet).not.toBeInTheDocument()
    expect(inspect).toHaveFocus()
  } finally { vi.useRealTimers() }
})

it('a single Escape dismisses only the newest registered layer', () => {
  const older = vi.fn(), newer = vi.fn()
  const removeOlder = registerEscapeLayer(older)
  const removeNewer = registerEscapeLayer(() => { newer(); removeNewer() })
  try {
    escape(document.body)
    expect(newer).toHaveBeenCalledTimes(1)
    expect(older).not.toHaveBeenCalled()
    escape(document.body)
    expect(older).toHaveBeenCalledTimes(1)
  } finally {
    removeOlder()
    removeNewer()
  }
})

it('keeps a saving sheet open on Escape and outside press', () => {
  render(<Surfaces />)
  const inspect = screen.getByRole('button', { name: 'Inspect customers' })
  fireEvent.click(inspect)
  const sheet = screen.getByRole('complementary', { name: 'Details' })
  const close = within(sheet).getByRole('button', { name: 'Close details' })
  const { sending } = useWrites.getState()
  const key = `${useViewStore.getState().sid}:edit:${card.id}`
  try {
    act(() => useWrites.setState({ sending: { ...sending, [key]: true } }))
    escape(close)
    fireEvent.pointerDown(document.body)
    fireEvent.click(close)
    expect(sheet).toBeVisible()
    expect(close).toHaveAttribute('aria-disabled', 'true')
  } finally {
    act(() => useWrites.setState({ sending }))
  }
})

it('dismisses a saving dialog and blocks a repeat write when reopened', async () => {
  const sid = useViewStore.getState().sid!
  let finish!: (value: { id: string; title: string }) => void
  const pending = new Promise<{ id: string; title: string }>((resolve) => { finish = resolve })
  const retitle = vi.spyOn(accountsApi, 'retitle').mockReturnValue(pending)
  const { refresh } = useViewStore.getState()
  useViewStore.setState({ refresh: vi.fn().mockResolvedValue(true) })
  try {
    render(<Surfaces />)
    const opener = screen.getByRole('button', { name: 'Open rename' })
    opener.focus()
    fireEvent.click(opener)
    const dialog = screen.getByRole('dialog', { name: 'Rename scenario' })
    fireEvent.submit(dialog)
    expect(retitle).toHaveBeenCalledTimes(1)

    escape(within(dialog).getByRole('button', { name: 'Close' }))
    expect(dialog).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
    fireEvent.click(opener)
    const reopened = screen.getByRole('dialog', { name: 'Rename scenario' })
    expect(within(reopened).getByRole('button', { name: 'Save title' })).toBeDisabled()
    fireEvent.submit(reopened)
    expect(retitle).toHaveBeenCalledTimes(1)
    await act(async () => { finish({ id: sid, title: 'A saved title' }); await pending })
    expect(reopened).toBeInTheDocument()
    expect(within(reopened).getByRole('button', { name: 'Save title' })).toBeEnabled()
  } finally {
    await act(async () => { finish({ id: sid, title: 'A saved title' }); await pending })
    retitle.mockRestore()
    useViewStore.setState({ refresh })
  }
})
