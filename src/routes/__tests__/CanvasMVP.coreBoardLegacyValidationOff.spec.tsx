/**
 * The route sets the core-board switch from `useLegacyValidationOff` (its own rows: `legacyValidationOff.spec.tsx`): a core board switches the
 * legacy client validator off (CEE's admission decides readiness), a board that is not core keeps it (Paul's test,
 * 25 Oct 2026). Same harness as `CanvasMVP.starterModelName.spec.tsx`: the real route, heavy children stubbed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

const core = vi.hoisted(() => ({ value: false }))
vi.mock('../../canvas/nodes/shared/savedModelIsCore', () => ({ useSavedModelIsCore: () => core.value, useLegacyValidationOff: () => core.value }))
vi.mock('../../components/layout/TopBar', () => ({ TopBar: () => <div data-testid="topbar-stub" /> }))
vi.mock('../../canvas/ReactFlowGraph', () => ({ default: () => <div data-testid="rfg-stub" /> }))
vi.mock('../../components/DebugTray', () => ({ DebugTray: () => <div /> }))
vi.mock('../../canvas/hooks/useDebugShortcut', () => ({ useDebugShortcut: () => ({ showDebug: false }) }))
vi.mock('../../canvas/utils/sandboxTelemetry', () => ({ trackCanvasOpened: vi.fn() }))
vi.mock('../../canvas/hooks/useServerGraphHydration', () => ({ useServerGraphHydration: vi.fn() }))
vi.mock('../../hooks/useScenario', () => ({
  useScenario: () => ({ loadScenario: vi.fn(), saveStatus: 'saved', lastSavedAt: null, saveError: null, isPersistenceActive: false, createSharedBrief: vi.fn() }),
}))
vi.mock('react-router-dom', () => ({ useParams: () => ({ id: undefined }) }))

import CanvasMVP from '../CanvasMVP'
import { useCanvasStore } from '../../canvas/store'

beforeEach(() => { useCanvasStore.setState({ currentScenarioId: null, nodes: [] as never, legacyValidationOff: false } as never) })

describe('the route switches the legacy validator off on a core board', () => {
  it('⭐ a core board: switched off', () => {
    core.value = true
    render(<CanvasMVP />)
    expect(useCanvasStore.getState().legacyValidationOff).toBe(true)
  })

  it('CONTRAST: a board that is not core keeps the validator', () => {
    core.value = false
    render(<CanvasMVP />)
    expect(useCanvasStore.getState().legacyValidationOff).toBe(false)
  })
})
