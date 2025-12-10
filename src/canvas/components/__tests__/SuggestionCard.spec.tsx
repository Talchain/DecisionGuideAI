/**
 * SuggestionCard Unit Tests
 *
 * Tests for the generic CEE suggestion card component that displays
 * AI-generated suggestions with confidence indicators and action buttons.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SuggestionCard, type Suggestion } from '../SuggestionCard'

describe('SuggestionCard', () => {
  const mockSuggestion: Suggestion<number> = {
    suggested_value: 0.7,
    confidence: 'high',
    reasoning: 'Based on historical market data and similar product launches',
    provenance: 'cee',
  }

  const defaultProps = {
    suggestion: mockSuggestion,
    label: 'Market Success',
    formatValue: (v: number) => `${(v * 100).toFixed(0)}%`,
    onAccept: vi.fn(),
    onOverride: vi.fn(),
  }

  it('displays AI suggested badge', () => {
    render(<SuggestionCard {...defaultProps} />)
    expect(screen.getByText('AI suggested')).toBeInTheDocument()
  })

  it('displays high confidence level', () => {
    render(<SuggestionCard {...defaultProps} />)
    expect(screen.getByText('High confidence')).toBeInTheDocument()
  })

  it('displays medium confidence level', () => {
    const mediumSuggestion: Suggestion<number> = {
      ...mockSuggestion,
      confidence: 'medium',
    }
    render(<SuggestionCard {...defaultProps} suggestion={mediumSuggestion} />)
    expect(screen.getByText('Medium confidence')).toBeInTheDocument()
  })

  it('displays low confidence level', () => {
    const lowSuggestion: Suggestion<number> = {
      ...mockSuggestion,
      confidence: 'low',
    }
    render(<SuggestionCard {...defaultProps} suggestion={lowSuggestion} />)
    expect(screen.getByText('Low confidence')).toBeInTheDocument()
  })

  it('displays label', () => {
    render(<SuggestionCard {...defaultProps} />)
    expect(screen.getByText('Market Success')).toBeInTheDocument()
  })

  it('displays formatted suggested value', () => {
    render(<SuggestionCard {...defaultProps} />)
    expect(screen.getByText('70%')).toBeInTheDocument()
  })

  it('displays reasoning text', () => {
    render(<SuggestionCard {...defaultProps} />)
    expect(
      screen.getByText(
        'Based on historical market data and similar product launches'
      )
    ).toBeInTheDocument()
  })

  it('calls onAccept with suggested value when Accept button is clicked', () => {
    const onAccept = vi.fn()
    render(<SuggestionCard {...defaultProps} onAccept={onAccept} />)

    fireEvent.click(screen.getByText('Accept'))
    expect(onAccept).toHaveBeenCalledWith(0.7)
  })

  it('calls onOverride when Override button is clicked', () => {
    const onOverride = vi.fn()
    render(<SuggestionCard {...defaultProps} onOverride={onOverride} />)

    fireEvent.click(screen.getByText('Override'))
    expect(onOverride).toHaveBeenCalledTimes(1)
  })

  it('disables Accept button when isOverriding is true', () => {
    render(<SuggestionCard {...defaultProps} isOverriding={true} />)

    const acceptButton = screen.getByText('Accept').closest('button')
    expect(acceptButton).toBeDisabled()
  })

  it('renders with data-testid for integration testing', () => {
    render(<SuggestionCard {...defaultProps} />)
    expect(screen.getByTestId('suggestion-card')).toBeInTheDocument()
  })

  it('has accessible aria-labels on buttons', () => {
    render(<SuggestionCard {...defaultProps} />)

    expect(
      screen.getByLabelText('Accept suggestion: 70%')
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText('Override suggestion with custom value')
    ).toBeInTheDocument()
  })

  // Clarification mode tests
  describe('clarification mode', () => {
    const clarificationSuggestion: Suggestion<number> = {
      ...mockSuggestion,
      needs_clarification: true,
      clarifying_question: 'Which scenario best describes your market situation?',
      options: [
        { label: 'Conservative estimate', value: 0.3 },
        { label: 'Moderate estimate', value: 0.5 },
        { label: 'Optimistic estimate', value: 0.7 },
      ],
    }

    it('renders clarification question when needs_clarification is true', () => {
      render(
        <SuggestionCard
          {...defaultProps}
          suggestion={clarificationSuggestion}
          onSelectOption={vi.fn()}
        />
      )

      expect(
        screen.getByText('Which scenario best describes your market situation?')
      ).toBeInTheDocument()
    })

    it('renders all clarification options as buttons', () => {
      render(
        <SuggestionCard
          {...defaultProps}
          suggestion={clarificationSuggestion}
          onSelectOption={vi.fn()}
        />
      )

      expect(screen.getByText('Conservative estimate')).toBeInTheDocument()
      expect(screen.getByText('Moderate estimate')).toBeInTheDocument()
      expect(screen.getByText('Optimistic estimate')).toBeInTheDocument()
    })

    it('calls onSelectOption with correct value when option is clicked', () => {
      const onSelectOption = vi.fn()
      render(
        <SuggestionCard
          {...defaultProps}
          suggestion={clarificationSuggestion}
          onSelectOption={onSelectOption}
        />
      )

      fireEvent.click(screen.getByText('Moderate estimate'))
      expect(onSelectOption).toHaveBeenCalledWith(0.5)
    })

    it('does not show Accept/Override buttons in clarification mode', () => {
      render(
        <SuggestionCard
          {...defaultProps}
          suggestion={clarificationSuggestion}
          onSelectOption={vi.fn()}
        />
      )

      expect(screen.queryByText('Accept')).not.toBeInTheDocument()
      expect(screen.queryByText('Override')).not.toBeInTheDocument()
    })

    it('renders with clarification-specific data-testid', () => {
      render(
        <SuggestionCard
          {...defaultProps}
          suggestion={clarificationSuggestion}
          onSelectOption={vi.fn()}
        />
      )

      expect(
        screen.getByTestId('suggestion-card-clarification')
      ).toBeInTheDocument()
    })

    it('shows AI suggested badge in clarification mode', () => {
      render(
        <SuggestionCard
          {...defaultProps}
          suggestion={clarificationSuggestion}
          onSelectOption={vi.fn()}
        />
      )

      expect(screen.getByText('AI suggested')).toBeInTheDocument()
    })

    it('shows confidence level in clarification mode', () => {
      render(
        <SuggestionCard
          {...defaultProps}
          suggestion={clarificationSuggestion}
          onSelectOption={vi.fn()}
        />
      )

      expect(screen.getByText('High confidence')).toBeInTheDocument()
    })

    it('has accessible group role on options', () => {
      render(
        <SuggestionCard
          {...defaultProps}
          suggestion={clarificationSuggestion}
          onSelectOption={vi.fn()}
        />
      )

      expect(
        screen.getByRole('group', { name: 'Clarification options' })
      ).toBeInTheDocument()
    })
  })

  // Generic type tests
  describe('generic type support', () => {
    it('works with string values', () => {
      const stringSuggestion: Suggestion<string> = {
        suggested_value: 'aggressive',
        confidence: 'medium',
        reasoning: 'Based on your stated goals',
        provenance: 'cee',
      }

      render(
        <SuggestionCard
          suggestion={stringSuggestion}
          label="Risk Profile"
          formatValue={(v) => v.charAt(0).toUpperCase() + v.slice(1)}
          onAccept={vi.fn()}
          onOverride={vi.fn()}
        />
      )

      expect(screen.getByText('Aggressive')).toBeInTheDocument()
    })

    it('works with object values', () => {
      interface WeightConfig {
        min: number
        max: number
        default: number
      }

      const objectSuggestion: Suggestion<WeightConfig> = {
        suggested_value: { min: 0.2, max: 0.8, default: 0.5 },
        confidence: 'high',
        reasoning: 'Standard range for this factor type',
        provenance: 'cee',
      }

      const onAccept = vi.fn()

      render(
        <SuggestionCard
          suggestion={objectSuggestion}
          label="Weight Range"
          formatValue={(v) => `${v.min * 100}%-${v.max * 100}%`}
          onAccept={onAccept}
          onOverride={vi.fn()}
        />
      )

      expect(screen.getByText('20%-80%')).toBeInTheDocument()

      fireEvent.click(screen.getByText('Accept'))
      expect(onAccept).toHaveBeenCalledWith({
        min: 0.2,
        max: 0.8,
        default: 0.5,
      })
    })
  })
})
