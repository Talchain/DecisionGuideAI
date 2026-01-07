/**
 * AdvancedSettingsPanel tests
 *
 * Tests for the collapsible advanced settings panel in the Results tab.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AdvancedSettingsPanel } from '../AdvancedSettingsPanel'

const STORAGE_KEY = 'canvas.riskProfile.v1'

describe('AdvancedSettingsPanel', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  describe('collapsed state', () => {
    it('renders collapsed by default', () => {
      render(<AdvancedSettingsPanel />)

      // Header should be visible
      expect(screen.getByText('Advanced Settings')).toBeInTheDocument()

      // Content should not be visible
      expect(screen.queryByText('Risk Tolerance')).not.toBeInTheDocument()
    })

    it('expands when header is clicked', () => {
      render(<AdvancedSettingsPanel />)

      const header = screen.getByRole('button', { name: /advanced settings/i })
      fireEvent.click(header)

      // Content should now be visible
      expect(screen.getByText('Risk Tolerance')).toBeInTheDocument()
    })

    it('starts expanded when defaultExpanded is true', () => {
      render(<AdvancedSettingsPanel defaultExpanded />)

      expect(screen.getByText('Risk Tolerance')).toBeInTheDocument()
    })

    it('has correct aria-expanded attribute', () => {
      render(<AdvancedSettingsPanel />)

      const header = screen.getByRole('button', { name: /advanced settings/i })
      expect(header).toHaveAttribute('aria-expanded', 'false')

      fireEvent.click(header)
      expect(header).toHaveAttribute('aria-expanded', 'true')
    })
  })

  describe('Risk Tolerance section', () => {
    it('shows 3-position selector when expanded', () => {
      render(<AdvancedSettingsPanel defaultExpanded />)

      expect(screen.getByRole('radio', { name: /risk-averse/i })).toBeInTheDocument()
      expect(screen.getByRole('radio', { name: /neutral/i })).toBeInTheDocument()
      expect(screen.getByRole('radio', { name: /risk-seeking/i })).toBeInTheDocument()
    })

    it('selects neutral by default when no profile stored', () => {
      render(<AdvancedSettingsPanel defaultExpanded />)

      const neutralButton = screen.getByRole('radio', { name: /neutral/i })
      expect(neutralButton).toHaveAttribute('aria-checked', 'true')
    })

    it('persists selection to localStorage', () => {
      render(<AdvancedSettingsPanel defaultExpanded />)

      const riskAverseButton = screen.getByRole('radio', { name: /risk-averse/i })
      fireEvent.click(riskAverseButton)

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
      expect(stored.profile).toBe('risk_averse')
    })

    it('loads previously stored profile', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        profile: 'risk_seeking',
        label: 'Risk Seeking',
        score: 0.8,
        confidence: 'medium',
        reasoning: 'Test',
      }))

      render(<AdvancedSettingsPanel defaultExpanded />)

      const riskSeekingButton = screen.getByRole('radio', { name: /risk-seeking/i })
      expect(riskSeekingButton).toHaveAttribute('aria-checked', 'true')
    })

    it('shows appropriate helper text for each selection', () => {
      render(<AdvancedSettingsPanel defaultExpanded />)

      // Default neutral text
      expect(screen.getByText(/balances conservative and optimistic/i)).toBeInTheDocument()

      // Select risk-averse
      fireEvent.click(screen.getByRole('radio', { name: /risk-averse/i }))
      expect(screen.getByText(/emphasises downside scenarios/i)).toBeInTheDocument()

      // Select risk-seeking
      fireEvent.click(screen.getByRole('radio', { name: /risk-seeking/i }))
      expect(screen.getByText(/emphasises upside potential/i)).toBeInTheDocument()
    })
  })

  describe('Structural Uncertainty section', () => {
    it('shows Coming Soon badge', () => {
      render(<AdvancedSettingsPanel defaultExpanded />)

      expect(screen.getByText('Coming Soon')).toBeInTheDocument()
    })

    it('shows disabled toggle', () => {
      render(<AdvancedSettingsPanel defaultExpanded />)

      const toggle = screen.getByRole('switch')
      expect(toggle).toBeDisabled()
      expect(toggle).toHaveAttribute('aria-checked', 'false')
    })

    it('shows helper text about edge confidence', () => {
      render(<AdvancedSettingsPanel defaultExpanded />)

      expect(screen.getByText(/causal relationships.*edge confidence/i)).toBeInTheDocument()
    })

    it('toggle does nothing when clicked', () => {
      render(<AdvancedSettingsPanel defaultExpanded />)

      const toggle = screen.getByRole('switch')
      fireEvent.click(toggle)

      // Should still be unchecked
      expect(toggle).toHaveAttribute('aria-checked', 'false')
    })
  })

  describe('accessibility', () => {
    it('has proper heading structure', () => {
      render(<AdvancedSettingsPanel defaultExpanded />)

      expect(screen.getByLabelText('Risk Tolerance')).toBeInTheDocument()
    })

    it('has proper radiogroup role for risk tolerance', () => {
      render(<AdvancedSettingsPanel defaultExpanded />)

      expect(screen.getByRole('radiogroup')).toBeInTheDocument()
    })

    it('toggle switch has aria-disabled', () => {
      render(<AdvancedSettingsPanel defaultExpanded />)

      const toggle = screen.getByRole('switch')
      expect(toggle).toHaveAttribute('aria-disabled', 'true')
    })
  })
})
