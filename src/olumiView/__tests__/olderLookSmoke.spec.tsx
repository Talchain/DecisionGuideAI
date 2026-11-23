import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../canvas/ToastContext'
import { CanvasContextMenu } from '../../canvas/contextMenu/CanvasContextMenu'
import { LeftSidebar } from '../../components/layout/LeftSidebar'
import toolbarStyles from '../../components/layout/CanvasFloatingToolbar.module.css'
import { isOlumiCoreLane } from '../../olumiCore/lane'
import { LaneEditingLayer } from '../v12/edit/LaneEditingLayer'
import { useLaneInspector } from '../v12/edit/inspectorStore'
import { install, uninstall } from '../v12/edit/__tests__/harness'

beforeEach(() => {
  vi.stubEnv('VITE_OLUMI_CORE', undefined)
  expect(isOlumiCoreLane()).toBe(false)
  install()
})

afterEach(() => {
  cleanup()
  useLaneInspector.setState({ current: null, peek: null, drafts: {} })
  uninstall()
  vi.unstubAllEnvs()
})

it('keeps the older toolbar focus recipe and 16px icons in the toolbar and context menu', () => {
  render(
    <ToastProvider>
      <LeftSidebar showUndo={false} />
      <CanvasContextMenu target={{ kind: 'pane', screenPos: { x: 100, y: 100 } }}
        onClose={vi.fn()} screenToFlowPosition={(point) => point} />
    </ToastProvider>,
  )

  const toolbar = screen.getByRole('navigation', { name: 'Canvas tools' })
  expect(toolbar).toHaveClass(toolbarStyles.sidebar)
  const select = within(toolbar).getByRole('button', { name: 'Select mode' })
  expect(select).toHaveClass(toolbarStyles.iconButtonActive)
  expect(select.querySelector('svg')).toHaveAttribute('width', '16')
  expect(select.querySelector('svg')).toHaveAttribute('height', '16')

  const menu = screen.getByRole('menu', { name: 'Canvas context menu' })
  expect(menu).toHaveClass('py-2')
  const add = within(menu).getByRole('menuitem', { name: 'Add node' })
  expect(add).toHaveClass('h-9', 'px-4', 'focus-visible:ring-primary/50')
  expect(add.querySelector('svg')).toHaveAttribute('width', '16')
  expect(add.querySelector('svg')).toHaveAttribute('height', '16')
})

it('keeps the older inspector focus and its 44px edit form controls', () => {
  useLaneInspector.getState().open({ kind: 'card', id: 'starting_customers' })
  render(<ToastProvider><LaneEditingLayer /></ToastProvider>)

  const inspector = screen.getByRole('complementary', { name: 'Details' })
  expect(inspector).toHaveClass('left-[76px]', 'top-[112px]')
  expect(within(inspector).getByTestId('inspector-figure-typed')).toHaveClass('focus-visible:ring-info/50')
  expect(within(inspector).getByRole('button', { name: 'Close details' }).querySelector('svg')).toHaveAttribute('width', '16')

  fireEvent.click(within(inspector).getByRole('button', { name: 'Rename' }))
  const form = screen.getByRole('dialog', { name: 'Rename' })
  const name = within(form).getByRole('textbox')
  expect(name).toHaveClass('focus-visible:ring-info/50', 'min-h-[44px]')
  expect(within(form).getByRole('button', { name: 'Save' })).toHaveClass('min-h-[44px]')
  expect(within(form).getByRole('button', { name: 'Cancel' })).toHaveClass('min-h-[44px]')
})
