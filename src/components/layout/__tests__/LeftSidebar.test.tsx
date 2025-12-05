import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LeftSidebar } from '../LeftSidebar'

describe('LeftSidebar', () => {
  it('renders all primary tool buttons with accessible labels', () => {
    render(<LeftSidebar />)

    expect(screen.getByRole('navigation', { name: /canvas tools/i })).toBeInTheDocument()

    expect(screen.getByRole('button', { name: /open quick draft assistant/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add node to canvas/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /open templates panel/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /run analysis/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /open compare view/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /open evidence panel/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /fit all nodes in view/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /open help and keyboard shortcuts/i })).toBeInTheDocument()
  })

  it('invokes callbacks when buttons are clicked', () => {
    const onAiClick = vi.fn()
    const onAddNodeClick = vi.fn()
    const onTemplatesClick = vi.fn()
    const onRunClick = vi.fn()
    const onCompareClick = vi.fn()
    const onEvidenceClick = vi.fn()
    const onFitClick = vi.fn()
    const onHelpClick = vi.fn()

    render(
      <LeftSidebar
        onAiClick={onAiClick}
        onAddNodeClick={onAddNodeClick}
        onTemplatesClick={onTemplatesClick}
        onRunClick={onRunClick}
        onCompareClick={onCompareClick}
        onEvidenceClick={onEvidenceClick}
        onFitClick={onFitClick}
        onHelpClick={onHelpClick}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /open quick draft assistant/i }))
    fireEvent.click(screen.getByRole('button', { name: /add node to canvas/i }))
    fireEvent.click(screen.getByRole('button', { name: /open templates panel/i }))
    fireEvent.click(screen.getByRole('button', { name: /run analysis/i }))
    fireEvent.click(screen.getByRole('button', { name: /open compare view/i }))
    fireEvent.click(screen.getByRole('button', { name: /open evidence panel/i }))
    fireEvent.click(screen.getByRole('button', { name: /fit all nodes in view/i }))
    fireEvent.click(screen.getByRole('button', { name: /open help and keyboard shortcuts/i }))

    expect(onAiClick).toHaveBeenCalledTimes(1)
    expect(onAddNodeClick).toHaveBeenCalledTimes(1)
    expect(onTemplatesClick).toHaveBeenCalledTimes(1)
    expect(onRunClick).toHaveBeenCalledTimes(1)
    expect(onCompareClick).toHaveBeenCalledTimes(1)
    expect(onEvidenceClick).toHaveBeenCalledTimes(1)
    expect(onFitClick).toHaveBeenCalledTimes(1)
    expect(onHelpClick).toHaveBeenCalledTimes(1)
  })
})
