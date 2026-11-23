import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReactFlowProvider } from '@xyflow/react'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { KeyboardLegend, useKeyboardLegend } from '../../../canvas/help/KeyboardLegend'
import { ToastProvider } from '../../../canvas/ToastContext'
import { CanvasViewportControls } from '../../../components/layout/CanvasViewportControls'
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
  const legend = useKeyboardLegend()
  return (
    <ToastProvider>
      <AddFigure />
      {viewport && <ReactFlowProvider><CanvasViewportControls {...viewportHandlers} /></ReactFlowProvider>}
      <button type="button" onClick={() => useLaneInspector.getState().open(card)}>Inspect customers</button>
      <LaneEditingLayer />
      <KeyboardLegend isOpen={legend.isOpen} onClose={legend.close} />
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
  localStorage.removeItem('olumi_keys_seen')
  vi.unstubAllEnvs()
})

it('replaces the shared menu with the details sheet and the sheet with the edit form, then closes the dialog before the form', () => {
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

  const cancel = within(form).getByRole('button', { name: 'Cancel' })
  cancel.focus()
  fireEvent.keyDown(cancel, { key: '?' })
  const dialog = screen.getByRole('dialog', { name: 'Keyboard legend' })
  expect(dialog).toHaveAttribute('aria-modal', 'true')
  expect(nonModalSurfaces()).toEqual([form])

  escape(within(dialog).getByRole('button', { name: 'Close keyboard legend' }))
  expect(dialog).not.toBeInTheDocument()
  expect(nonModalSurfaces()).toEqual([form])
  expect(cancel).toHaveFocus()
  escape()
  expect(nonModalSurfaces()).toEqual([])
})

it('replaces the viewport menu when the details sheet opens from keyboard activation', async () => {
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
})
