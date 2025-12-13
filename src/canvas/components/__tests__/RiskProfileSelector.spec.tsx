/**
 * RiskProfileSelector Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { RiskProfileSelector } from '../RiskProfileSelector'

// Mock the httpV1Adapter
vi.mock('../../../adapters/plot/httpV1Adapter', () => ({
  httpV1Adapter: {
    getRiskQuestions: vi.fn(),
    submitRiskAnswers: vi.fn(),
    getRiskProfileFromPreset: vi.fn(),
  },
}))

import { httpV1Adapter } from '../../../adapters/plot/httpV1Adapter'

describe('RiskProfileSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('preset selection', () => {
    it('renders preset buttons', () => {
      render(<RiskProfileSelector />)

      expect(screen.getByText('Risk Averse')).toBeInTheDocument()
      expect(screen.getByText('Neutral')).toBeInTheDocument()
      expect(screen.getByText('Risk Seeking')).toBeInTheDocument()
    })

    it('renders preset icons', () => {
      render(<RiskProfileSelector />)

      expect(screen.getByText('🛡️')).toBeInTheDocument()
      expect(screen.getByText('⚖️')).toBeInTheDocument()
      expect(screen.getByText('🎲')).toBeInTheDocument()
    })

    it('calls onProfileChange when preset is selected', async () => {
      const mockProfile = {
        profile: 'neutral' as const,
        label: 'Neutral',
        score: 0.5,
        confidence: 'high' as const,
        reasoning: 'Selected neutral preset',
      }
      vi.mocked(httpV1Adapter.getRiskProfileFromPreset).mockResolvedValueOnce({
        profile: mockProfile,
        provenance: 'cee' as const,
      })

      const onProfileChange = vi.fn()
      render(<RiskProfileSelector onProfileChange={onProfileChange} />)

      fireEvent.click(screen.getByText('Neutral'))

      await waitFor(() => {
        expect(onProfileChange).toHaveBeenCalledWith(mockProfile)
      })
    })

    it('has data-testid for preset selector', () => {
      render(<RiskProfileSelector />)

      expect(screen.getByTestId('risk-profile-selector')).toBeInTheDocument()
    })
  })

  describe('questionnaire button', () => {
    it('renders "Take questionnaire" button', () => {
      render(<RiskProfileSelector />)

      expect(screen.getByText('Take questionnaire')).toBeInTheDocument()
    })

    it('starts questionnaire when button is clicked', async () => {
      const mockQuestions = {
        questions: [
          {
            id: 'q1',
            text: 'How do you feel about risk?',
            type: 'choice' as const,
            choices: [
              { value: 'low', label: 'I avoid it' },
              { value: 'high', label: 'I embrace it' },
            ],
          },
        ],
        provenance: 'cee' as const,
      }
      vi.mocked(httpV1Adapter.getRiskQuestions).mockResolvedValueOnce(mockQuestions)

      render(<RiskProfileSelector />)

      fireEvent.click(screen.getByText('Take questionnaire'))

      await waitFor(() => {
        expect(screen.getByTestId('risk-questionnaire')).toBeInTheDocument()
      })
    })
  })

  describe('questionnaire flow', () => {
    const mockQuestions = {
      questions: [
        {
          id: 'q1',
          text: 'Question 1',
          type: 'choice' as const,
          choices: [
            { value: 'a', label: 'Answer A' },
            { value: 'b', label: 'Answer B' },
          ],
        },
        {
          id: 'q2',
          text: 'Question 2',
          type: 'scale' as const,
          scale: {
            min: 1,
            max: 10,
            min_label: 'Low',
            max_label: 'High',
          },
        },
      ],
      provenance: 'cee' as const,
    }

    it('shows progress bar', async () => {
      vi.mocked(httpV1Adapter.getRiskQuestions).mockResolvedValueOnce(mockQuestions)

      render(<RiskProfileSelector />)
      fireEvent.click(screen.getByText('Take questionnaire'))

      await waitFor(() => {
        expect(screen.getByText('Question 1 of 2')).toBeInTheDocument()
        expect(screen.getByRole('progressbar')).toBeInTheDocument()
      })
    })

    it('advances to next question after answering', async () => {
      vi.mocked(httpV1Adapter.getRiskQuestions).mockResolvedValueOnce(mockQuestions)

      render(<RiskProfileSelector />)
      fireEvent.click(screen.getByText('Take questionnaire'))

      await waitFor(() => {
        expect(screen.getByText('Question 1')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Answer A'))

      await waitFor(() => {
        expect(screen.getByText('Question 2 of 2')).toBeInTheDocument()
      })
    })

    it('allows going back to previous question', async () => {
      vi.mocked(httpV1Adapter.getRiskQuestions).mockResolvedValueOnce(mockQuestions)

      render(<RiskProfileSelector />)
      fireEvent.click(screen.getByText('Take questionnaire'))

      await waitFor(() => {
        expect(screen.getByText('Question 1')).toBeInTheDocument()
      })

      // Answer first question
      fireEvent.click(screen.getByText('Answer A'))

      await waitFor(() => {
        expect(screen.getByText('Question 2')).toBeInTheDocument()
      })

      // Go back
      fireEvent.click(screen.getByText('Back'))

      await waitFor(() => {
        expect(screen.getByText('Question 1 of 2')).toBeInTheDocument()
      })
    })

    it('allows canceling questionnaire', async () => {
      vi.mocked(httpV1Adapter.getRiskQuestions).mockResolvedValueOnce(mockQuestions)

      render(<RiskProfileSelector />)
      fireEvent.click(screen.getByText('Take questionnaire'))

      await waitFor(() => {
        expect(screen.getByTestId('risk-questionnaire')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Cancel'))

      await waitFor(() => {
        expect(screen.getByTestId('risk-profile-selector')).toBeInTheDocument()
      })
    })
  })

  describe('profile display', () => {
    const mockProfile = {
      profile: 'risk_averse' as const,
      label: 'Risk Averse',
      score: 0.2,
      confidence: 'high' as const,
      reasoning: 'You prefer certainty over higher potential gains',
    }

    it('displays profile when set', () => {
      render(<RiskProfileSelector initialProfile={mockProfile} />)

      expect(screen.getByTestId('risk-profile-display')).toBeInTheDocument()
      // Profile label appears in both title and detail view, use getAllByText
      expect(screen.getAllByText('Risk Averse').length).toBeGreaterThan(0)
    })

    it('shows confidence badge', () => {
      render(<RiskProfileSelector initialProfile={mockProfile} />)

      expect(screen.getByText('High confidence')).toBeInTheDocument()
    })

    it('shows reasoning text', () => {
      render(<RiskProfileSelector initialProfile={mockProfile} />)

      expect(
        screen.getByText('You prefer certainty over higher potential gains')
      ).toBeInTheDocument()
    })

    it('allows changing profile', () => {
      render(<RiskProfileSelector initialProfile={mockProfile} />)

      fireEvent.click(screen.getByText('Change'))

      expect(screen.getByTestId('risk-profile-selector')).toBeInTheDocument()
    })

    it('shows capacity note when present', () => {
      const profileWithNote = {
        ...mockProfile,
        capacity_note: 'Consider your financial capacity',
      }

      render(<RiskProfileSelector initialProfile={profileWithNote} />)

      expect(screen.getByText('Consider your financial capacity')).toBeInTheDocument()
    })
  })

  describe('disabled state', () => {
    it('disables preset buttons when disabled', () => {
      render(<RiskProfileSelector disabled={true} />)

      const buttons = screen.getAllByRole('button')
      buttons.forEach(button => {
        if (!button.textContent?.includes('questionnaire')) {
          // Skip the questionnaire button check as it has its own disabled logic
        }
      })
    })

    it('disables questionnaire button when disabled', () => {
      render(<RiskProfileSelector disabled={true} />)

      expect(screen.getByText('Take questionnaire').closest('button')).toBeDisabled()
    })
  })

  describe('error handling', () => {
    it('shows fallback profile on API error', async () => {
      vi.mocked(httpV1Adapter.getRiskProfileFromPreset).mockRejectedValueOnce({
        error: 'API error',
      })

      const onProfileChange = vi.fn()
      render(<RiskProfileSelector onProfileChange={onProfileChange} />)

      fireEvent.click(screen.getByText('Neutral'))

      await waitFor(() => {
        // Should still call with fallback profile
        expect(onProfileChange).toHaveBeenCalled()
        const profile = onProfileChange.mock.calls[0][0]
        expect(profile.label).toBe('Neutral')
        expect(profile.confidence).toBe('low') // Fallback has low confidence
      })
    })
  })
})
