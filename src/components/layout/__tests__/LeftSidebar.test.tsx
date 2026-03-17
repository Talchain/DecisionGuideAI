import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LeftSidebar } from '../LeftSidebar'

describe('LeftSidebar', () => {
  it('renders navigation with canvas tool buttons', () => {
    render(<LeftSidebar />)

    expect(screen.getByRole('navigation', { name: /canvas tools/i })).toBeInTheDocument()

    // Core buttons in the current component
    expect(screen.getByRole('button', { name: /add node to canvas/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /open templates panel/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /run analysis/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /open compare view/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /open evidence panel/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /fit all nodes in view/i })).toBeInTheDocument()
  })

  it('invokes callbacks when buttons are clicked', () => {
    const onAddNodeClick = vi.fn()
    const onTemplatesClick = vi.fn()
    const onRunClick = vi.fn()
    const onCompareClick = vi.fn()
    const onEvidenceClick = vi.fn()
    const onFitClick = vi.fn()

    render(
      <LeftSidebar
        onAddNodeClick={onAddNodeClick}
        onTemplatesClick={onTemplatesClick}
        onRunClick={onRunClick}
        onCompareClick={onCompareClick}
        onEvidenceClick={onEvidenceClick}
        onFitClick={onFitClick}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /add node to canvas/i }))
    fireEvent.click(screen.getByRole('button', { name: /open templates panel/i }))
    fireEvent.click(screen.getByRole('button', { name: /run analysis/i }))
    fireEvent.click(screen.getByRole('button', { name: /open compare view/i }))
    fireEvent.click(screen.getByRole('button', { name: /open evidence panel/i }))
    fireEvent.click(screen.getByRole('button', { name: /fit all nodes in view/i }))

    expect(onAddNodeClick).toHaveBeenCalledTimes(1)
    expect(onTemplatesClick).toHaveBeenCalledTimes(1)
    expect(onRunClick).toHaveBeenCalledTimes(1)
    expect(onCompareClick).toHaveBeenCalledTimes(1)
    expect(onEvidenceClick).toHaveBeenCalledTimes(1)
    expect(onFitClick).toHaveBeenCalledTimes(1)
  })
})
