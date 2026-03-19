/**
 * ReanalyseBar — unit tests
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ReanalyseBar } from '../ReanalyseBar'

let mockGraphEditedSinceLastRun = false

vi.mock('../../../store', () => ({
  useCanvasStore: vi.fn((selector: (s: unknown) => unknown) =>
    selector({ graphEditedSinceLastRun: mockGraphEditedSinceLastRun })
  ),
}))

describe('ReanalyseBar', () => {
  it('renders nothing when graphEditedSinceLastRun is false', () => {
    mockGraphEditedSinceLastRun = false
    const { container } = render(<ReanalyseBar />)
    expect(container.firstChild).toBeNull()
  })

  it('renders bar when graphEditedSinceLastRun is true', () => {
    mockGraphEditedSinceLastRun = true
    render(<ReanalyseBar />)
    expect(screen.getByTestId('reanalyse-bar')).toBeInTheDocument()
    expect(screen.getByText(/Model changed/)).toBeInTheDocument()
  })

  it('calls onReanalyse when button is clicked', () => {
    mockGraphEditedSinceLastRun = true
    const onReanalyse = vi.fn()
    render(<ReanalyseBar onReanalyse={onReanalyse} />)

    fireEvent.click(screen.getByTestId('reanalyse-button'))
    expect(onReanalyse).toHaveBeenCalledOnce()
  })

  it('re-analyse button is disabled when onReanalyse is not provided', () => {
    mockGraphEditedSinceLastRun = true
    render(<ReanalyseBar />)
    const btn = screen.getByTestId('reanalyse-button')
    expect(btn).toBeDisabled()
  })
})
