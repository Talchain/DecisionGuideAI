/**
 * RiskTolerancePanel Unit Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { RiskTolerancePanel, useStoredRiskProfile } from '../RiskTolerancePanel'
import { renderHook } from '@testing-library/react'
import type { RiskProfile } from '../../../adapters/plot/types'

// Mock the httpV1Adapter - reject calls to avoid async loading
vi.mock('../../../adapters/plot/httpV1Adapter', () => ({
  httpV1Adapter: {
    getRiskQuestions: vi.fn().mockRejectedValue(new Error('Not implemented')),
    submitRiskAnswers: vi.fn().mockRejectedValue(new Error('Not implemented')),
    getRiskProfileFromPreset: vi.fn().mockRejectedValue(new Error('Not implemented')),
  },
}))

const STORAGE_KEY = 'canvas.riskProfile.v1'

describe('RiskTolerancePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('initial state', () => {
    it('renders collapsed by default', () => {
      render(<RiskTolerancePanel />)

      expect(screen.getByTestId('risk-tolerance-panel')).toBeInTheDocument()
      expect(screen.getByText('Risk Tolerance')).toBeInTheDocument()
    })

    it('expands when header is clicked', async () => {
      render(<RiskTolerancePanel />)

      const header = screen.getByText('Risk Tolerance')
      fireEvent.click(header)

      await waitFor(() => {
        expect(screen.getByText(/Your risk tolerance affects/)).toBeInTheDocument()
      })
    })

    it('starts expanded when defaultExpanded is true', () => {
      render(<RiskTolerancePanel defaultExpanded={true} />)

      expect(screen.getByText(/Your risk tolerance affects/)).toBeInTheDocument()
    })
  })

  describe('localStorage persistence', () => {
    it('loads profile from localStorage on mount', () => {
      const savedProfile: RiskProfile = {
        profile: 'risk_averse',
        label: 'Risk Averse',
        score: 0.2,
        confidence: 'high',
        reasoning: 'Saved profile',
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedProfile))

      render(<RiskTolerancePanel defaultExpanded={true} />)

      // Should show the saved profile label (may appear in multiple places)
      const labels = screen.getAllByText('Risk Averse')
      expect(labels.length).toBeGreaterThan(0)
    })

    it('persists profile to localStorage', async () => {
      const savedProfile: RiskProfile = {
        profile: 'neutral',
        label: 'Neutral',
        score: 0.5,
        confidence: 'high',
        reasoning: 'Test',
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedProfile))

      render(<RiskTolerancePanel defaultExpanded={true} />)

      await waitFor(() => {
        const stored = localStorage.getItem(STORAGE_KEY)
        expect(stored).toBeTruthy()
        const parsed = JSON.parse(stored!)
        expect(parsed.profile).toBe('neutral')
      })
    })
  })

  describe('profile display', () => {
    it('shows profile details when set', async () => {
      const savedProfile: RiskProfile = {
        profile: 'risk_seeking',
        label: 'Risk Seeking',
        score: 0.8,
        confidence: 'high',
        reasoning: 'You prefer higher risk for greater potential',
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedProfile))

      render(<RiskTolerancePanel defaultExpanded={true} />)

      await waitFor(() => {
        const labels = screen.getAllByText('Risk Seeking')
        expect(labels.length).toBeGreaterThan(0)
      })
    })

    it('shows change and clear buttons when profile is set', async () => {
      const savedProfile: RiskProfile = {
        profile: 'neutral',
        label: 'Neutral',
        score: 0.5,
        confidence: 'high',
        reasoning: 'Balanced approach',
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedProfile))

      render(<RiskTolerancePanel defaultExpanded={true} />)

      await waitFor(() => {
        expect(screen.getByText('Change')).toBeInTheDocument()
        expect(screen.getByText('Clear')).toBeInTheDocument()
      })
    })

    it('clears profile when clear is clicked', async () => {
      const savedProfile: RiskProfile = {
        profile: 'neutral',
        label: 'Neutral',
        score: 0.5,
        confidence: 'high',
        reasoning: 'Balanced approach',
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedProfile))

      const onProfileChange = vi.fn()
      render(<RiskTolerancePanel defaultExpanded={true} onProfileChange={onProfileChange} />)

      await waitFor(() => {
        expect(screen.getByText('Clear')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Clear'))

      await waitFor(() => {
        expect(onProfileChange).toHaveBeenCalledWith(null)
      })
    })
  })

  describe('icon display', () => {
    it('shows correct icon in header when profile is set', () => {
      const savedProfile: RiskProfile = {
        profile: 'risk_averse',
        label: 'Risk Averse',
        score: 0.2,
        confidence: 'high',
        reasoning: 'Test',
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedProfile))

      render(<RiskTolerancePanel />)

      // Shield icon for risk averse
      expect(screen.getByText('🛡️')).toBeInTheDocument()
    })

    it('shows neutral icon when neutral profile', () => {
      const savedProfile: RiskProfile = {
        profile: 'neutral',
        label: 'Neutral',
        score: 0.5,
        confidence: 'high',
        reasoning: 'Test',
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedProfile))

      render(<RiskTolerancePanel />)

      // Scales icon for neutral
      expect(screen.getByText('⚖️')).toBeInTheDocument()
    })

    it('shows risk seeking icon when risk seeking profile', () => {
      const savedProfile: RiskProfile = {
        profile: 'risk_seeking',
        label: 'Risk Seeking',
        score: 0.8,
        confidence: 'high',
        reasoning: 'Test',
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedProfile))

      render(<RiskTolerancePanel />)

      // Dice icon for risk seeking
      expect(screen.getByText('🎲')).toBeInTheDocument()
    })
  })
})

describe('useStoredRiskProfile hook', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('returns null when no profile is stored', () => {
    const { result } = renderHook(() => useStoredRiskProfile())

    expect(result.current).toBeNull()
  })

  it('returns stored profile', async () => {
    const savedProfile: RiskProfile = {
      profile: 'neutral',
      label: 'Neutral',
      score: 0.5,
      confidence: 'high',
      reasoning: 'Test',
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedProfile))

    const { result } = renderHook(() => useStoredRiskProfile())

    await waitFor(() => {
      expect(result.current).toEqual(savedProfile)
    })
  })
})
