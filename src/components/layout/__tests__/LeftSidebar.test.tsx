import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LeftSidebar } from '../LeftSidebar'

describe('LeftSidebar', () => {
  it('renders navigation with 4 tool buttons (select, undo, redo + view when lens enabled)', () => {
    render(<LeftSidebar />)

    expect(screen.getByRole('navigation', { name: /canvas tools/i })).toBeInTheDocument()

    expect(screen.getByRole('button', { name: /select mode/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /undo/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /redo/i })).toBeInTheDocument()
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

  describe('Mode toggle — active state and aria-pressed', () => {
    it('marks select button as pressed when in select mode', () => {
      render(<LeftSidebar interactionMode="select" />)

      const selectBtn = screen.getByRole('button', { name: /select mode/i })
      expect(selectBtn).toHaveAttribute('aria-pressed', 'true')
    })

    it('does not mark select as pressed when in hand mode', () => {
      render(<LeftSidebar interactionMode="hand" />)

      const selectBtn = screen.getByRole('button', { name: /select mode/i })
      expect(selectBtn).toHaveAttribute('aria-pressed', 'false')
    })
  })
})
