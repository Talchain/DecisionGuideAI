import '@testing-library/jest-dom/vitest'
import { readFileSync } from 'node:fs'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../../canvas/ToastContext'
import { CanvasViewportControls } from '../../../components/layout/CanvasViewportControls'
import { TopBar } from '../../../components/layout/TopBar'
import { useUIStore } from '../../../stores/uiStore'
import { typography } from '../../../styles/typography'
import type { View } from '../../client'
import { ViewComposer } from '../../ViewChat'
import { ViewLensBar } from '../../ViewLensBar'
import { install, uninstall } from '../../v12/edit/__tests__/harness'

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { email: 'ana@example.test' }, profile: null, signOut: vi.fn() }),
}))

const viewportHandlers = {
  onZoomIn: vi.fn(),
  onZoomOut: vi.fn(),
  onZoomReset: vi.fn(),
  onFitView: vi.fn(),
  onAutoArrange: vi.fn(),
}

function renderChrome() {
  return render(
    <MemoryRouter>
      <ReactFlowProvider>
        <ToastProvider>
          <TopBar scenarioTitle="Team plan" onTitleChange={vi.fn()} />
          <CanvasViewportControls {...viewportHandlers} />
        </ToastProvider>
      </ReactFlowProvider>
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  uninstall()
  useUIStore.setState({ activeOverlaySurface: null, overlaySurfaceOrigin: null })
  vi.unstubAllEnvs()
})

describe('overnight lane menu and typography tidy-up', () => {
  it('keeps lane menu rows available through a pointer press and replaces the menu through the arbiter', () => {
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    install()
    renderChrome()

    const kebab = screen.getByRole('button', { name: 'More options' })
    fireEvent.click(kebab)
    const menu = screen.getByRole('menu', { name: 'More options' })
    const settings = within(menu).getByRole('menuitem', { name: 'Canvas settings' })
    fireEvent.pointerDown(settings)
    fireEvent.mouseDown(settings)
    expect(settings).toBeInTheDocument()
    fireEvent.click(settings)
    expect(screen.getByRole('form', { name: 'Canvas settings' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Close canvas settings' }))

    fireEvent.click(kebab)
    const viewport = screen.getByRole('button', { name: 'More view options' })
    fireEvent.click(viewport)
    expect(screen.getAllByRole('menu')).toEqual([screen.getByRole('menu', { name: 'More view options' })])
    expect(kebab).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(viewport)
    expect(screen.queryByRole('menu')).toBeNull()
    expect(viewport).toHaveFocus()
  })

  it('replaces older chrome menus even when there is no outside pointer press', () => {
    vi.stubEnv('VITE_OLUMI_CORE', '0')
    renderChrome()

    const viewport = screen.getByRole('button', { name: 'More view options' })
    const account = screen.getByRole('button', { name: 'Account menu' })
    fireEvent.click(viewport)
    expect(viewport).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(account)
    expect(viewport).toHaveAttribute('aria-expanded', 'false')
    expect(account).toHaveAttribute('aria-expanded', 'true')

    act(() => { useUIStore.getState().requestOverlaySurface('top_bar_menu') })
    const kebab = screen.getByRole('button', { name: 'More options' })
    expect(account).toHaveAttribute('aria-expanded', 'false')
    expect(kebab).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(viewport)
    expect(kebab).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getAllByRole('menu')).toEqual([screen.getByRole('menu', { name: 'More view options' })])
  })

  it('applies the 12px label token to all six screen-reader lens labels', () => {
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    install()
    render(<ViewLensBar />)

    const labels = screen.getByTestId('lens-bar').querySelectorAll('[data-lens-label]')
    expect(labels).toHaveLength(6)
    for (const label of labels) expect(label).toHaveClass('sr-only', typography.viewPanelMeta)
  })

  it('renders the session goal choices with the card radius and 12px panel text', () => {
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    const view: View = JSON.parse(readFileSync('src/olumiView/fixtures/session/no-goal.view3.json', 'utf8'))
    install(view)
    render(<ViewComposer />)
    fireEvent.click(screen.getByTestId('view-actions-button'))

    const tiles = screen.getAllByTestId('view-session-goal-option')
    expect(tiles).toHaveLength(4)
    for (const tile of tiles) {
      expect(tile).toHaveClass('rounded-md', typography.viewPanelBody)
      expect(tile).not.toHaveClass('rounded-lg')
    }
  })
})
