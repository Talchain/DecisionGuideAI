import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LeftSidebar } from '../LeftSidebar'

describe('LeftSidebar', () => {
  it('renders navigation with canvas tool buttons', () => {
    render(<LeftSidebar />)

    expect(screen.getByRole('navigation', { name: /canvas tools/i })).toBeInTheDocument()

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
})
