/**
 * RiskProfileBadge Unit Tests
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RiskProfileBadge, RiskProfileInline } from '../RiskProfileBadge'
import type { RiskProfile } from '../../../adapters/plot/types'

describe('RiskProfileBadge', () => {
  const mockProfile: RiskProfile = {
    profile: 'risk_averse',
    label: 'Risk Averse',
    score: 0.2,
    confidence: 'high',
    reasoning: 'You prefer certainty over higher potential gains',
  }

  describe('empty state', () => {
    it('renders "Set risk tolerance" when no profile', () => {
      render(<RiskProfileBadge profile={null} />)

      expect(screen.getByTestId('risk-profile-badge-empty')).toBeInTheDocument()
      expect(screen.getByText('Set risk tolerance')).toBeInTheDocument()
    })

    it('calls onEdit when empty badge is clicked', () => {
      const onEdit = vi.fn()
      render(<RiskProfileBadge profile={null} onEdit={onEdit} />)

      fireEvent.click(screen.getByTestId('risk-profile-badge-empty'))
      expect(onEdit).toHaveBeenCalled()
    })
  })

  describe('with profile', () => {
    it('renders profile label', () => {
      render(<RiskProfileBadge profile={mockProfile} />)

      expect(screen.getByTestId('risk-profile-badge')).toBeInTheDocument()
      expect(screen.getByText('Risk Averse')).toBeInTheDocument()
    })

    it('renders profile icon', () => {
      render(<RiskProfileBadge profile={mockProfile} />)

      expect(screen.getByText('🛡️')).toBeInTheDocument()
    })

    it('calls onEdit when badge is clicked', () => {
      const onEdit = vi.fn()
      render(<RiskProfileBadge profile={mockProfile} onEdit={onEdit} />)

      fireEvent.click(screen.getByTestId('risk-profile-badge'))
      expect(onEdit).toHaveBeenCalled()
    })

    it('has correct aria-label', () => {
      render(<RiskProfileBadge profile={mockProfile} />)

      const badge = screen.getByTestId('risk-profile-badge')
      expect(badge).toHaveAttribute('aria-label', 'Risk tolerance: Risk Averse. Click to change.')
    })
  })

  describe('compact mode', () => {
    it('shows short label in compact mode', () => {
      render(<RiskProfileBadge profile={mockProfile} compact />)

      // Should show "Cautious" instead of "Risk Averse"
      expect(screen.getByText('Cautious')).toBeInTheDocument()
      expect(screen.queryByText('Risk Averse')).not.toBeInTheDocument()
    })
  })

  describe('different profiles', () => {
    it('shows neutral icon and label', () => {
      const neutralProfile: RiskProfile = {
        ...mockProfile,
        profile: 'neutral',
        label: 'Neutral',
      }
      render(<RiskProfileBadge profile={neutralProfile} />)

      expect(screen.getByText('⚖️')).toBeInTheDocument()
      expect(screen.getByText('Neutral')).toBeInTheDocument()
    })

    it('shows risk seeking icon and label', () => {
      const seekingProfile: RiskProfile = {
        ...mockProfile,
        profile: 'risk_seeking',
        label: 'Risk Seeking',
      }
      render(<RiskProfileBadge profile={seekingProfile} />)

      expect(screen.getByText('🎲')).toBeInTheDocument()
      expect(screen.getByText('Risk Seeking')).toBeInTheDocument()
    })
  })
})

describe('RiskProfileInline', () => {
  const mockProfile: RiskProfile = {
    profile: 'neutral',
    label: 'Neutral',
    score: 0.5,
    confidence: 'high',
    reasoning: 'Balanced approach',
  }

  it('renders "Not set" when no profile', () => {
    render(<RiskProfileInline profile={null} />)

    expect(screen.getByText('Not set')).toBeInTheDocument()
  })

  it('renders short label with icon when profile set', () => {
    render(<RiskProfileInline profile={mockProfile} />)

    expect(screen.getByTestId('risk-profile-inline')).toBeInTheDocument()
    expect(screen.getByText('⚖️')).toBeInTheDocument()
    expect(screen.getByText('Balanced')).toBeInTheDocument()
  })

  it('has title with full reasoning', () => {
    render(<RiskProfileInline profile={mockProfile} />)

    const inline = screen.getByTestId('risk-profile-inline')
    expect(inline).toHaveAttribute('title', 'Neutral: Balanced approach')
  })
})
