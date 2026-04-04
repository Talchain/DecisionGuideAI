import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LeftSidebar } from '../LeftSidebar'

// Disable graph lens feature flag so LensDropdown doesn't render
vi.mock('../../../flags', () => ({
  isGraphLensEnabled: () => false,
}))

// Mock canvas store for viewMode
const mockSetViewMode = vi.fn()
vi.mock('../../../canvas/store', () => ({
  useCanvasStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      viewMode: 'standard',
      setViewMode: mockSetViewMode,
      comparisonMode: { active: false },
    }),
}))

describe('LeftSidebar', () => {
  it('renders navigation with core tool buttons', () => {
    render(<LeftSidebar />)

    expect(screen.getByRole('navigation', { name: /canvas tools/i })).toBeInTheDocument()
    // Default mode is 'select', so button shows "Switch to Hand mode"
    expect(screen.getByRole('button', { name: /switch to hand mode/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /undo/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /redo/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /standard view/i })).toBeInTheDocument()
  })

  it('invokes onSelectClick when mode toggle button is clicked', () => {
    const onSelectClick = vi.fn()
    render(<LeftSidebar onSelectClick={onSelectClick} />)

    fireEvent.click(screen.getByRole('button', { name: /switch to hand mode/i }))
    expect(onSelectClick).toHaveBeenCalledTimes(1)
  })

  it('invokes undo/redo callbacks when buttons are clicked', () => {
    const onUndoClick = vi.fn()
    const onRedoClick = vi.fn()

    render(
      <LeftSidebar
        onUndoClick={onUndoClick}
        onRedoClick={onRedoClick}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /undo/i }))
    fireEvent.click(screen.getByRole('button', { name: /redo/i }))

    expect(onUndoClick).toHaveBeenCalledTimes(1)
    expect(onRedoClick).toHaveBeenCalledTimes(1)
  })

  it('disables undo/redo when canUndo/canRedo are false', () => {
    render(<LeftSidebar canUndo={false} canRedo={false} />)

    expect(screen.getByRole('button', { name: /undo/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /redo/i })).toBeDisabled()
  })

  describe('Mode toggle — icon and aria state', () => {
    it('shows pointer icon and aria-pressed=true in select mode', () => {
      render(<LeftSidebar interactionMode="select" />)

      const btn = screen.getByRole('button', { name: /switch to hand mode/i })
      expect(btn).toHaveAttribute('aria-pressed', 'true')
    })

    it('shows hand icon and aria-pressed=false in hand mode', () => {
      render(<LeftSidebar interactionMode="hand" />)

      const btn = screen.getByRole('button', { name: /switch to select mode/i })
      expect(btn).toHaveAttribute('aria-pressed', 'false')
    })
  })

  it('toggles view mode when Standard/Detailed button is clicked', () => {
    render(<LeftSidebar />)

    fireEvent.click(screen.getByRole('button', { name: /standard view/i }))
    expect(mockSetViewMode).toHaveBeenCalledWith('expert')
  })
})
