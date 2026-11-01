/**
 * Renaming the model is a visible write, and olumi-core has no route for it: the new name would show and be lost on the next reload.
 * On the olumi-core lane the rename controls are not offered (as OptionStatusControl is not): the name is plain text, and the
 * dropdown's rename button, the kebab's "Rename" and the rename request event all do nothing. Off the lane nothing changes.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { ScenarioSwitcher } from '../../canvas/components/ScenarioSwitcher'
import { KebabMenu } from '../../components/layout/KebabMenu'
import { ToastProvider } from '../../canvas/ToastContext'
import { SCENARIO_RENAME_REQUEST_EVENT } from '../../canvas/components/scenarioRenameEvent'
import { useCanvasStore } from '../../canvas/store'
import * as scenarios from '../../canvas/store/scenarios'

vi.mock('../../canvas/store', () => ({ useCanvasStore: vi.fn() }))
vi.mock('../../canvas/store/scenarios', () => ({
  loadScenarios: vi.fn(() => []), getScenario: vi.fn(), createScenario: vi.fn(), updateScenario: vi.fn(), deleteScenario: vi.fn(),
}))
vi.mock('../../canvas/settingsStore', () => ({
  useSettingsStore: () => ({ showGrid: false, gridSize: 20, snapToGrid: false, showAlignmentGuides: false, highContrastMode: false,
    setShowGrid: vi.fn(), setGridSize: vi.fn(), setSnapToGrid: vi.fn(), setShowAlignmentGuides: vi.fn(), setHighContrastMode: vi.fn() }),
}))
vi.mock('../../canvas/components/ImportExportDialog', () => ({ ImportExportDialog: () => null }))
vi.mock('../../canvas/components/SnapshotManager', () => ({ SnapshotManager: () => null }))

const NAME = 'Keep current staffing or add one specialist?'
const onRename = vi.fn()

function renderSwitcher() {
  return render(<ToastProvider><ScenarioSwitcher displayName={NAME} onRename={onRename} /></ToastProvider>)
}
function renderKebab() {
  const onStartRename = vi.fn()
  render(<ToastProvider><KebabMenu isOpen onToggle={vi.fn()} onClose={vi.fn()} onStartRename={onStartRename} onShowKeyboardLegend={vi.fn()} onShowInfluenceExplainer={vi.fn()} menuRef={createRef<HTMLDivElement>()} /></ToastProvider>)
  return onStartRename
}

beforeEach(() => {
  vi.mocked(useCanvasStore).mockImplementation(((selector: (s: Record<string, unknown>) => unknown) => selector({
    currentScenarioId: 'scenario-1', isDirty: false, isSaving: false, lastSavedAt: null, saveCurrentScenario: vi.fn(), loadScenario: vi.fn(),
    duplicateCurrentScenario: vi.fn(), renameCurrentScenario: vi.fn(), deleteScenario: vi.fn(), resetCanvas: vi.fn(), nodes: [], edges: [],
  })) as never)
  vi.mocked(scenarios.getScenario).mockReturnValue({ id: 'scenario-1', name: NAME, createdAt: 1, updatedAt: 1, graph: { nodes: [], edges: [] } } as never)
})
afterEach(() => { cleanup(); vi.unstubAllEnvs(); onRename.mockClear() })

describe('on the olumi-core lane the model\'s name cannot be edited (it would be a write core never receives)', () => {
  beforeEach(() => { vi.stubEnv('VITE_OLUMI_CORE', '1') })
  it('the name is shown, and is not a rename button', () => {
    renderSwitcher()
    expect(screen.getByText(NAME)).toBeInTheDocument()
    expect(screen.queryByTestId('scenario-name-button')).toBeNull()
    expect(screen.queryByRole('button', { name: /Rename model/ })).toBeNull()
  })
  it('the dropdown has no rename button, and the rename request opens no editor', () => {
    renderSwitcher()
    fireEvent.click(screen.getByTestId('scenario-switcher-trigger'))
    expect(screen.queryByTitle('Rename')).toBeNull()
    fireEvent(window, new CustomEvent(SCENARIO_RENAME_REQUEST_EVENT))
    expect(screen.queryByTestId('scenario-name-input')).toBeNull()
    expect(onRename).not.toHaveBeenCalled()
  })
  it('the kebab menu has no Rename', () => {
    renderKebab()
    expect(screen.queryByRole('menuitem', { name: 'Rename' })).toBeNull()
  })
})

describe('off the lane renaming is as it was', () => {
  beforeEach(() => { vi.stubEnv('VITE_OLUMI_CORE', '') })
  it('the name is a button that opens the editor, the dropdown and kebab rename are there', () => {
    renderSwitcher()
    expect(screen.getByTestId('scenario-name-button')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('scenario-switcher-trigger'))
    expect(screen.getByTitle('Rename')).toBeInTheDocument()
    cleanup()
    renderKebab()
    expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeInTheDocument()
  })
})
