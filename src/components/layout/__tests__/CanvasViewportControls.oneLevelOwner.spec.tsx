/**
 * One owner for the level of detail per lane (Codex 07:39Z trace, 18 Nov 2026): the viewport menu's legacy "Detailed view" called the shared canvas
 * store's setViewMode, which schedules the legacy applyLayout over whatever nodes are drawn: on the core lane, the V12 cards, which then overlapped.
 * The core lane's level of detail is Layers -> Simple/Detailed (simpleStore); the legacy switch is not offered there. The older look keeps it.
 */
import { afterEach, describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'

const lane = vi.hoisted(() => ({ on: true }))
vi.mock('../../../olumiCore/lane', async (real) => ({ ...(await real<object>()), isOlumiCoreLane: () => lane.on }))

import { CanvasViewportControls } from '../CanvasViewportControls'
import { useCanvasStore } from '../../../canvas/store'

const renderControls = () => render(
  <ReactFlowProvider>
    <CanvasViewportControls onZoomIn={vi.fn()} onZoomOut={vi.fn()} onZoomReset={vi.fn()} onFitView={vi.fn()} onAutoArrange={vi.fn()} />
  </ReactFlowProvider>,
)
const openMenu = () => fireEvent.click(screen.getByRole('button', { name: 'More view options' }))

afterEach(() => { cleanup(); lane.on = true; vi.restoreAllMocks() })

describe('the level of detail has one owner per lane', () => {
  it('core lane: the viewport menu offers no legacy "Detailed view", so nothing there can run the legacy layout over V12 cards', () => {
    lane.on = true
    const setViewMode = vi.spyOn(useCanvasStore.getState(), 'setViewMode')
    renderControls(); openMenu()
    expect(screen.queryByTestId('viewport-detailed-view')).toBeNull()
    expect(screen.queryByText('Detailed view')).toBeNull()
    expect(setViewMode).not.toHaveBeenCalled()
    // CONTRAST: the rest of the menu is still there.
    expect(screen.getByTestId('viewport-auto-arrange')).toBeInTheDocument()
  })
  it('CONTRAST older look: the switch is offered and still toggles the legacy view mode, exactly as before', () => {
    lane.on = false
    useCanvasStore.setState({ viewMode: 'standard' } as never)
    const setViewMode = vi.fn()
    useCanvasStore.setState({ setViewMode } as never)
    renderControls(); openMenu()
    fireEvent.click(screen.getByTestId('viewport-detailed-view'))
    expect(setViewMode).toHaveBeenCalledWith('expert')
  })
})
