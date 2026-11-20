/**
 * G24 / G25a / G25b (state-machine inventory, 11 Nov; DL: "a control that can empty or move a board must not exist on the lane").
 * On the olumi-core lane the route names the scenario and core holds its model, so the previous product's local-record controls (Save,
 * Duplicate, Delete, the local list and its Load, Import, Export) are not drawn, and the store's duplicate and delete do nothing.
 * lane.ts declares the surface ONCE (`lanePreviousControl`). Both directions: off the lane the same controls are there.
 */
import '@testing-library/jest-dom/vitest'
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
const show = () => render(<ToastProvider><ScenarioSwitcher displayName="The open scenario" /></ToastProvider>)
const open = () => {
  show()
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
  it('on the lane there is no chevron and no menu (it would hold one pointer to My scenarios): the name stays, and nothing local is drawn', () => {
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    show()
    expect(screen.queryByTestId('scenario-switcher-trigger')).toBeNull()
    expect(screen.queryByLabelText('Open model menu')).toBeNull()
    expect(screen.queryByTestId('scenario-switcher-menu')).toBeNull()
    expect(screen.queryByText('Your scenarios are listed under My scenarios.')).toBeNull()
    expect(screen.getByTestId('scenario-name-text')).toHaveTextContent('The open scenario')
    expect(screen.queryByText(LOCAL)).toBeNull()
  })
  it('contrast, off the lane: the chevron, the menu and the same controls are there', () => {
    vi.stubEnv('VITE_OLUMI_CORE', '')
    open()
    expect(menu().getByRole('menuitem', { name: /save/i })).toBeTruthy()
    expect(menu().getByTitle('Delete')).toBeTruthy()
    expect(menu().getByRole('menuitem', { name: /import/i })).toBeTruthy()
    expect(menu().getAllByText(LOCAL).length).toBeGreaterThan(0)
  })
})
