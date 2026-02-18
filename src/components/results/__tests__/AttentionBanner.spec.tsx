import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AttentionBanner } from '../AttentionBanner'
import type { HumanisedCritique } from '../utils/humaniseCritique'

const mockItem = (overrides: Partial<HumanisedCritique> = {}): HumanisedCritique => ({
  title: 'Customer churn is missing a current value',
  description: 'A default was assumed, so results may be less reliable.',
  suggestion: 'Add your current estimate for Customer churn',
  factorId: 'fac_churn',
  ...overrides,
})

describe('AttentionBanner', () => {
  it('renders nothing when items is empty', () => {
    const { container } = render(<AttentionBanner items={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders inline for single item', () => {
    render(<AttentionBanner items={[mockItem()]} />)
    expect(screen.getByTestId('attention-banner')).toBeInTheDocument()
    expect(screen.getByText('Customer churn is missing a current value')).toBeInTheDocument()
    expect(screen.getByText(/default was assumed/)).toBeInTheDocument()
    // No collapse button for single item
    expect(screen.queryByText(/items to review/)).not.toBeInTheDocument()
  })

  it('renders collapsed for 2+ items', () => {
    const items = [mockItem(), mockItem({ title: 'Revenue target issue', factorId: 'fac_rev' })]
    render(<AttentionBanner items={items} />)
    expect(screen.getByTestId('attention-banner')).toBeInTheDocument()
    expect(screen.getByText('A few inputs would sharpen these results')).toBeInTheDocument()
    expect(screen.getByText('2 items to review')).toBeInTheDocument()
    // Items hidden by default
    expect(screen.queryByText('Customer churn is missing a current value')).not.toBeInTheDocument()
  })

  it('expands to show items when clicked', () => {
    const items = [mockItem(), mockItem({ title: 'Revenue target issue', factorId: 'fac_rev' })]
    render(<AttentionBanner items={items} />)
    fireEvent.click(screen.getByText('A few inputs would sharpen these results'))
    expect(screen.getByText('Customer churn is missing a current value')).toBeInTheDocument()
    expect(screen.getByText('Revenue target issue')).toBeInTheDocument()
  })

  it('renders suggestion as GraphLink CTA when factorId present', () => {
    const onFocusNode = vi.fn()
    render(<AttentionBanner items={[mockItem()]} onFocusNode={onFocusNode} />)
    const cta = screen.getByText('Add your current estimate for Customer churn')
    expect(cta.tagName).toBe('BUTTON')
    fireEvent.click(cta)
    expect(onFocusNode).toHaveBeenCalledWith('fac_churn')
  })

  it('omits CTA button when no factorId', () => {
    render(
      <AttentionBanner
        items={[mockItem({ factorId: undefined, suggestion: 'General suggestion' })]}
      />,
    )
    // Suggestion shows but NOT as a clickable button
    const buttons = screen.queryAllByRole('button')
    expect(buttons).toHaveLength(0)
  })

  it('shows correct count for 4+ items', () => {
    const items = Array.from({ length: 5 }, (_, i) =>
      mockItem({ title: `Issue ${i + 1}`, factorId: `fac_${i}` }),
    )
    render(<AttentionBanner items={items} />)
    expect(screen.getByText('5 items to review')).toBeInTheDocument()
  })

  it('does not render raw internal strings', () => {
    render(
      <AttentionBanner
        items={[mockItem({
          title: "Review this factor's inputs",
          description: "Some information isn't available yet.",
        })]}
      />,
    )
    expect(screen.queryByText(/constraint_fac/)).not.toBeInTheDocument()
    expect(screen.queryByText(/observed_state/)).not.toBeInTheDocument()
    expect(screen.queryByText(/intercept=0/)).not.toBeInTheDocument()
  })
})
