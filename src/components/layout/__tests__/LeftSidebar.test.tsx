import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LeftSidebar } from '../LeftSidebar'

describe('LeftSidebar', () => {
  it('renders navigation with canvas tool buttons', () => {
    render(<LeftSidebar />)

    expect(screen.getByRole('navigation', { name: /canvas tools/i })).toBeInTheDocument()

    expect(screen.getByRole('button', { name: /select mode/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /hand mode/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add node to canvas/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /templates are coming soon/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /templates are coming soon/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /fit all nodes in view/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /auto-arrange layout/i })).toBeInTheDocument()
  })

  it('invokes callbacks when buttons are clicked', () => {
    const onAddNodeClick = vi.fn()
    const onFitClick = vi.fn()
    const onAutoArrangeClick = vi.fn()

    render(
      <LeftSidebar
        onAddNodeClick={onAddNodeClick}
        onFitClick={onFitClick}
        onAutoArrangeClick={onAutoArrangeClick}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /add node to canvas/i }))
    fireEvent.click(screen.getByRole('button', { name: /fit all nodes in view/i }))
    fireEvent.click(screen.getByRole('button', { name: /auto-arrange layout/i }))

    expect(onAddNodeClick).toHaveBeenCalledTimes(1)
    expect(onFitClick).toHaveBeenCalledTimes(1)
    expect(onAutoArrangeClick).toHaveBeenCalledTimes(1)
  })

  describe('Mode toggle — active state and aria-pressed', () => {
    it('marks select button as pressed when in select mode', () => {
      render(<LeftSidebar interactionMode="select" />)

      const selectBtn = screen.getByRole('button', { name: /select mode/i })
      const handBtn = screen.getByRole('button', { name: /hand mode/i })

      expect(selectBtn).toHaveAttribute('aria-pressed', 'true')
      expect(handBtn).toHaveAttribute('aria-pressed', 'false')
    })

    it('marks hand button as pressed when in hand mode', () => {
      render(<LeftSidebar interactionMode="hand" />)

      const selectBtn = screen.getByRole('button', { name: /select mode/i })
      const handBtn = screen.getByRole('button', { name: /hand mode/i })

      expect(selectBtn).toHaveAttribute('aria-pressed', 'false')
      expect(handBtn).toHaveAttribute('aria-pressed', 'true')
    })

    it('calls onModeChange with "select" when select button clicked', () => {
      const onModeChange = vi.fn()
      render(<LeftSidebar interactionMode="hand" onModeChange={onModeChange} />)

      fireEvent.click(screen.getByRole('button', { name: /select mode/i }))
      expect(onModeChange).toHaveBeenCalledWith('select')
    })

    it('calls onModeChange with "hand" when hand button clicked', () => {
      const onModeChange = vi.fn()
      render(<LeftSidebar interactionMode="select" onModeChange={onModeChange} />)

      fireEvent.click(screen.getByRole('button', { name: /hand mode/i }))
      expect(onModeChange).toHaveBeenCalledWith('hand')
    })
  })
})
