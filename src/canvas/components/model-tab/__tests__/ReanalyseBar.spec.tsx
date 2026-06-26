/**
 * ReanalyseBar — unit tests.
 *
 * The bar now derives visibility from the CEE freshness slice + local dirty
 * overlay (shared `classifyFreshnessForDisplay` === 'changed'), NOT the local
 * `graphEditedSinceLastRun` flag. The real classifier runs against the mocked
 * store slices.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ReanalyseBar } from '../ReanalyseBar'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockFreshness: any = null
let mockDirty = false

vi.mock('../../../store', () => ({
  useCanvasStore: vi.fn((selector: (s: unknown) => unknown) =>
    selector({ analysisFreshness: mockFreshness, analysisFreshnessDirty: mockDirty })
  ),
}))

describe('ReanalyseBar', () => {
  it('renders nothing when the analysis is confirmed current (fresh, clean)', () => {
    mockFreshness = { freshness: 'fresh' }
    mockDirty = false
    const { container } = render(<ReanalyseBar />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when there is no freshness verdict', () => {
    mockFreshness = null
    mockDirty = false
    const { container } = render(<ReanalyseBar />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing for a CEE cannot-confirm (unknown) verdict — never fabricates "changed"', () => {
    mockFreshness = { freshness: 'unknown' }
    mockDirty = false
    const { container } = render(<ReanalyseBar />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the bar on a genuine CEE stale verdict', () => {
    mockFreshness = { freshness: 'stale' }
    mockDirty = false
    render(<ReanalyseBar />)
    expect(screen.getByTestId('reanalyse-bar')).toBeInTheDocument()
    expect(screen.getByText(/Model changed/)).toBeInTheDocument()
  })

  it('renders the bar when a retained fresh verdict is dirtied by a local edit (changed)', () => {
    mockFreshness = { freshness: 'fresh' }
    mockDirty = true
    render(<ReanalyseBar />)
    expect(screen.getByTestId('reanalyse-bar')).toBeInTheDocument()
  })

  it('calls onReanalyse when button is clicked', () => {
    mockFreshness = { freshness: 'stale' }
    mockDirty = false
    const onReanalyse = vi.fn()
    render(<ReanalyseBar onReanalyse={onReanalyse} />)

    fireEvent.click(screen.getByTestId('reanalyse-button'))
    expect(onReanalyse).toHaveBeenCalledOnce()
  })

  it('re-analyse button is disabled when onReanalyse is not provided', () => {
    mockFreshness = { freshness: 'stale' }
    mockDirty = false
    render(<ReanalyseBar />)
    const btn = screen.getByTestId('reanalyse-button')
    expect(btn).toBeDisabled()
  })
})
