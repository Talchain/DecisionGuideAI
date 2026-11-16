/**
 * More options on the olumi-core lane: every item offered has a working path, and nothing else is drawn (Paul, 16 Nov).
 *   Rename (core's own-title route), Export (the Summary as Markdown), Snapshots (core's versions panel), Start new scenario (a blank brief),
 *   Fullscreen, Keyboard shortcuts, How influence works. Not offered, for want of a route or an effect on the lane's canvas: Import,
 *   Canvas settings. Off the lane nothing changes.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createRef } from 'react'
import { KebabMenu } from '../KebabMenu'
import { ToastProvider } from '../../../canvas/ToastContext'
import { useViewStore } from '../../../olumiView/store'
import { useVersionsPanelStore } from '../../../canvas/versions/versionsPanelStore'

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
afterEach(() => { cleanup(); vi.unstubAllEnvs(); useViewStore.setState({ sid: null, at: null, view: null } as never); useVersionsPanelStore.getState().close() })

describe('on the lane', () => {
  beforeEach(() => { vi.stubEnv('VITE_OLUMI_CORE', '1') })

  it('offers exactly the items with a working path, and no Import or Canvas settings', () => {
    show(); renderKebab()
    expect(names()).toEqual(['Rename', 'Export summary', 'Version history', 'Start new scenario', 'Fullscreen', 'Keyboard shortcuts', 'How influence works'])
    expect(screen.queryByText('Canvas settings')).toBeNull()
    expect(screen.queryByLabelText('Show grid')).toBeNull()
  })

  it('Export is the saved version\'s Markdown Summary (the viewed version when one is looked at)', () => {
    show(); renderKebab()
    expect(screen.getByTestId('kebab-export-core')).toHaveAttribute('href', `/api/scenarios/${SID}/summary?format=md`)
    cleanup(); show({ at: 1 }); renderKebab()
    expect(screen.getByTestId('kebab-export-core')).toHaveAttribute('href', `/api/scenarios/${SID}/summary?at=1&format=md`)
  })

  it('with no saved model there is no Export or Snapshots, and with no scenario no Rename; Start new scenario stays', () => {
    show({ view: { title: 'x', version: null } as never }); renderKebab()
    expect(names()).toEqual(['Rename', 'Start new scenario', 'Fullscreen', 'Keyboard shortcuts', 'How influence works'])
    cleanup(); show({ sid: null, view: null }); renderKebab()
    expect(names()).toEqual(['Start new scenario', 'Fullscreen', 'Keyboard shortcuts', 'How influence works'])
  })

  it('Snapshots opens the version history panel', () => {
    show(); renderKebab()
    fireEvent.click(screen.getByTestId('kebab-snapshots-core'))
    expect(useVersionsPanelStore.getState().isOpen).toBe(true)
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
