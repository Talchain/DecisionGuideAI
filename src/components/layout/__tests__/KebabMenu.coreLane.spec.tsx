/**
 * More options on the olumi-core lane: every item offered has a working path, and nothing else is drawn (Paul, 16 Nov).
 *   Rename (core's own-title route: the title is not pressable on the lane, so this is its only route), Start new scenario (a blank brief),
 *   Fullscreen, Keyboard shortcuts, How influence works, and the canvas settings the V12 canvas reads. Not drawn, because the bar already has the
 *   control: Export summary (the Summary's own Download Markdown) and Version history (the bar's history control). Not offered, for want of a
 *   route: Import. Off the lane nothing changes.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createRef } from 'react'
import { KebabMenu } from '../KebabMenu'
import { ToastProvider } from '../../../canvas/ToastContext'
import { useViewStore } from '../../../olumiView/store'

const startFresh = vi.fn()
const retitle = vi.fn()
const refresh = vi.fn()
vi.mock('../../../olumiCore/accounts/MyScenariosPage', () => ({ startFreshScenario: () => startFresh(), default: () => null }))
vi.mock('../../../olumiCore/accounts/api', () => ({ accountsApi: { retitle: (...a: unknown[]) => retitle(...a) } }))
vi.mock('../../../canvas/settingsStore', () => ({
  useSettingsStore: () => ({ showGrid: true, gridSize: 16, snapToGrid: false, showAlignmentGuides: false, highContrastMode: false,
    setShowGrid: vi.fn(), setGridSize: vi.fn(), setSnapToGrid: vi.fn(), setShowAlignmentGuides: vi.fn(), setHighContrastMode: vi.fn() }),
}))
vi.mock('../../../canvas/store', () => ({ useCanvasStore: (sel: (s: Record<string, unknown>) => unknown) => sel({ resetCanvas: vi.fn(), nodes: [], edges: [] }) }))
vi.mock('../../../canvas/components/ImportExportDialog', () => ({ ImportExportDialog: () => null }))
vi.mock('../../../canvas/components/SnapshotManager', () => ({ SnapshotManager: () => null }))

const SID = 's_a00000000001'
const show = (over: Record<string, unknown> = {}) => useViewStore.setState({ sid: SID, at: null, view: { title: 'Hire or not', version: { label: 'version 2' } } as never, refresh, ...over } as never)
const renderKebab = (onClose = vi.fn()) => render(
  <ToastProvider><KebabMenu isOpen onToggle={vi.fn()} onClose={onClose} onStartRename={vi.fn()} onShowKeyboardLegend={vi.fn()} onShowInfluenceExplainer={vi.fn()} menuRef={createRef<HTMLDivElement>()} /></ToastProvider>,
)
const names = () => screen.getAllByRole('menuitem').map((e) => e.textContent)

beforeEach(() => { startFresh.mockReset(); retitle.mockReset(); refresh.mockReset(); window.location.hash = '' })
afterEach(() => { cleanup(); vi.unstubAllEnvs(); useViewStore.setState({ sid: null, at: null, view: null } as never) })

describe('on the lane', () => {
  beforeEach(() => { vi.stubEnv('VITE_OLUMI_CORE', '1') })

  it('offers exactly the items with no other route: no Import, no Export summary or Version history (the bar has both); Canvas settings with only what the V12 canvas reads (grid, its size, snap)', () => {
    show(); renderKebab()
    expect(names()).toEqual(['Rename', 'Start new scenario', 'Fullscreen', 'Keyboard shortcuts', 'How influence works', 'Canvas settings'])
    const menu = screen.getByRole('menu', { name: 'More options' })
    expect(menu.querySelector('input')).toBeNull()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Canvas settings' }))
    expect(screen.queryByRole('menu')).toBeNull()
    expect(screen.getByRole('form', { name: 'Canvas settings' })).toBeInTheDocument()
    expect(screen.getByLabelText('Show grid')).toHaveFocus()
    expect(screen.getByLabelText(/Grid size/)).toBeInTheDocument()
    expect(screen.getByLabelText('Snap to grid')).toBeInTheDocument()
    expect(screen.queryByLabelText('Alignment guides')).toBeNull()
    expect(screen.queryByLabelText('High contrast mode')).toBeNull()
  })

  it('with a saved model, Export summary and Version history are still not rows here, at the latest or at a viewed version', () => {
    show(); renderKebab()
    expect(screen.queryByTestId('kebab-export-core')).toBeNull()
    expect(screen.queryByTestId('kebab-snapshots-core')).toBeNull()
    cleanup(); show({ at: 1 }); renderKebab()
    expect(screen.queryByRole('menuitem', { name: /export summary|version history/i })).toBeNull()
  })

  it('with no saved model the menu is the same; with no scenario there is no Rename; Start new scenario stays', () => {
    show({ view: { title: 'x', version: null } as never }); renderKebab()
    expect(names()).toEqual(['Rename', 'Start new scenario', 'Fullscreen', 'Keyboard shortcuts', 'How influence works', 'Canvas settings'])
    cleanup(); show({ sid: null, view: null }); renderKebab()
    expect(names()).toEqual(['Start new scenario', 'Fullscreen', 'Keyboard shortcuts', 'How influence works', 'Canvas settings'])
  })

  it('Start new scenario forgets the shown scenario and goes to the blank brief, with no confirmation', async () => {
    show(); const onClose = vi.fn(); renderKebab(onClose)
    fireEvent.click(screen.getByTestId('kebab-start-new-core'))
    await waitFor(() => expect(startFresh).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(window.location.hash).toBe('#/canvas'))
    expect(onClose).toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('Rename posts the person\'s own title to core, then re-reads the View', async () => {
    show(); refresh.mockResolvedValue(true); retitle.mockResolvedValue({ id: SID, title: 'Move to Leeds' })
    renderKebab()
    fireEvent.click(screen.getByTestId('kebab-rename-core'))
    const input = await screen.findByTestId('scenario-title-input')
    expect(input).toHaveValue('Hire or not')
    fireEvent.change(input, { target: { value: '  Move to Leeds ' } })
    fireEvent.click(screen.getByTestId('scenario-title-save'))
    await waitFor(() => expect(retitle).toHaveBeenCalledWith(SID, 'Move to Leeds'))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    await waitFor(() => expect(screen.queryByTestId('scenario-title-dialog')).toBeNull())
  })

  it('a refused rename shows core\'s words and keeps the dialog open', async () => {
    const { TeamApiError } = await import('../../../olumiCore/team/api')
    show(); retitle.mockRejectedValue(new TeamApiError(400, 'That title is too long.'))
    renderKebab()
    fireEvent.click(screen.getByTestId('kebab-rename-core'))
    fireEvent.click(await screen.findByTestId('scenario-title-save'))
    expect(await screen.findByTestId('scenario-title-error')).toHaveTextContent('That title is too long.')
    expect(refresh).not.toHaveBeenCalled()
  })
})

describe('off the lane the menu is as it was', () => {
  beforeEach(() => { vi.stubEnv('VITE_OLUMI_CORE', '') })
  it('keeps Import, the local Snapshots and the Canvas settings, and none of the core items', () => {
    show(); renderKebab()
    expect(names()).toEqual(['Rename', 'Export', 'Import', 'Snapshots', 'Start new scenario', 'Fullscreen', 'Keyboard shortcuts', 'How influence works'])
    expect(screen.getByText('Canvas settings')).toBeInTheDocument()
    expect(screen.queryByTestId('kebab-export-core')).toBeNull()
    expect(screen.queryByTestId('kebab-rename-core')).toBeNull()
  })
})
