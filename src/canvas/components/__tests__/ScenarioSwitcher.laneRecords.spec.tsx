/**
 * G24 / G25a / G25b (state-machine inventory, 11 Nov; DL: "a control that can empty or move a board must not exist on the lane").
 * On the olumi-core lane the route names the scenario and core holds its model, so the previous product's local-record controls (Save,
 * Duplicate, Delete, the local list and its Load, Import, Export) are not drawn, and the store's duplicate and delete do nothing.
 * lane.ts declares the surface ONCE (`lanePreviousControl`). Both directions: off the lane the same controls are there.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { ScenarioSwitcher } from '../ScenarioSwitcher'
import { ToastProvider } from '../../ToastContext'
import { useCanvasStore } from '../../store'
import * as scenarios from '../../store/scenarios'

vi.mock('../../store', () => ({ useCanvasStore: vi.fn() }))
vi.mock('../../store/scenarios', () => ({
  loadScenarios: vi.fn(() => []), getScenario: vi.fn(), createScenario: vi.fn(), updateScenario: vi.fn(), deleteScenario: vi.fn(),
}))

const LOCAL = 'A local record of this scenario'
const menu = () => within(screen.getByTestId('scenario-switcher-menu'))
const open = () => {
  render(<ToastProvider><ScenarioSwitcher displayName="The open scenario" /></ToastProvider>)
  fireEvent.click(screen.getByTestId('scenario-switcher-trigger'))
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useCanvasStore).mockImplementation((selector: any) => selector({
    currentScenarioId: 'scenario-1', isDirty: false, isSaving: false, lastSavedAt: null, saveCurrentScenario: vi.fn(), loadScenario: vi.fn(),
    duplicateCurrentScenario: vi.fn(), renameCurrentScenario: vi.fn(), deleteScenario: vi.fn(),
  }))
  vi.mocked(scenarios.loadScenarios).mockReturnValue([{ id: 'scenario-1', name: LOCAL, createdAt: 1, updatedAt: 1, graph: { nodes: [], edges: [] } }] as never)
  vi.mocked(scenarios.getScenario).mockReturnValue({ id: 'scenario-1', name: LOCAL, createdAt: 1, updatedAt: 1, graph: { nodes: [], edges: [] } } as never)
})
afterEach(() => { vi.unstubAllEnvs() })

describe('the lane has no local-record controls', () => {
  it('on the lane: no Save, Duplicate, Delete, Export, Import or local list, and the menu says where scenarios are', () => {
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    open()
    expect(menu().queryByRole('menuitem', { name: /save/i })).toBeNull()
    expect(menu().queryByTitle('Duplicate')).toBeNull()
    expect(menu().queryByTitle('Delete')).toBeNull()
    expect(menu().queryByTitle('Export scenario')).toBeNull()
    expect(menu().queryByRole('menuitem', { name: /import/i })).toBeNull()
    expect(menu().queryByText(LOCAL)).toBeNull()
    expect(menu().getByText('Your scenarios are listed under My scenarios.')).toBeTruthy()
  })
  it('contrast, off the lane: the same controls are there', () => {
    open()
    expect(menu().getByRole('menuitem', { name: /save/i })).toBeTruthy()
    expect(menu().getByTitle('Delete')).toBeTruthy()
    expect(menu().getByRole('menuitem', { name: /import/i })).toBeTruthy()
    expect(menu().getAllByText(LOCAL).length).toBeGreaterThan(0)
  })
})
