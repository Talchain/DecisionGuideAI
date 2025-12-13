/**
 * FormOnboardingTooltip Tests
 *
 * Brief 11.8: Tests for first-time user onboarding tooltip
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FormOnboardingTooltip, useFormOnboarding } from '../FormOnboardingTooltip'
import { renderHook, act } from '@testing-library/react'

describe('FormOnboardingTooltip', () => {
  describe('Basic rendering', () => {
    it('renders tooltip when show is true', () => {
      render(<FormOnboardingTooltip show onDismiss={vi.fn()} />)
      expect(screen.getByTestId('form-onboarding-tooltip')).toBeInTheDocument()
    })

    it('returns null when show is false', () => {
      const { container } = render(<FormOnboardingTooltip show={false} onDismiss={vi.fn()} />)
      expect(container.firstChild).toBeNull()
    })

    it('shows title', () => {
      render(<FormOnboardingTooltip show onDismiss={vi.fn()} />)
      expect(screen.getByText('Relationship Forms')).toBeInTheDocument()
    })

    it('shows explanation text', () => {
      render(<FormOnboardingTooltip show onDismiss={vi.fn()} />)
      expect(screen.getByText(/Relationships between nodes/)).toBeInTheDocument()
    })
  })

  describe('Form examples', () => {
    it('shows diminishing returns example', () => {
      render(<FormOnboardingTooltip show onDismiss={vi.fn()} />)
      expect(screen.getByText('Diminishing')).toBeInTheDocument()
      expect(screen.getByText(/More marketing spend/)).toBeInTheDocument()
    })

    it('shows threshold example', () => {
      render(<FormOnboardingTooltip show onDismiss={vi.fn()} />)
      expect(screen.getByText('Threshold')).toBeInTheDocument()
      expect(screen.getByText(/Must reach minimum quality/)).toBeInTheDocument()
    })

    it('shows s_curve example', () => {
      render(<FormOnboardingTooltip show onDismiss={vi.fn()} />)
      expect(screen.getByText('Adoption curve')).toBeInTheDocument()
      expect(screen.getByText(/Market adoption starts slow/)).toBeInTheDocument()
    })
  })

  describe('Tip section', () => {
    it('shows tip about edge editing', () => {
      render(<FormOnboardingTooltip show onDismiss={vi.fn()} />)
      expect(screen.getByText(/Click on any edge/)).toBeInTheDocument()
    })
  })

  describe('Dismiss functionality', () => {
    it('calls onDismiss when X button is clicked', () => {
      const onDismiss = vi.fn()
      render(<FormOnboardingTooltip show onDismiss={onDismiss} />)

      fireEvent.click(screen.getByLabelText('Dismiss onboarding'))

      expect(onDismiss).toHaveBeenCalled()
    })

    it('calls onDismiss when "Got it!" button is clicked', () => {
      const onDismiss = vi.fn()
      render(<FormOnboardingTooltip show onDismiss={onDismiss} />)

      fireEvent.click(screen.getByRole('button', { name: 'Got it!' }))

      expect(onDismiss).toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    it('has dialog role', () => {
      render(<FormOnboardingTooltip show onDismiss={vi.fn()} />)
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('has accessible label', () => {
      render(<FormOnboardingTooltip show onDismiss={vi.fn()} />)
      expect(
        screen.getByRole('dialog', { name: /Understanding relationship forms/i })
      ).toBeInTheDocument()
    })
  })
})

describe('useFormOnboarding', () => {
  const STORAGE_KEY = 'canvas.formOnboarding.v1'

  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('Initial state', () => {
    it('returns show: true when not seen', () => {
      const { result } = renderHook(() => useFormOnboarding())
      expect(result.current.show).toBe(true)
    })

    it('returns show: false when already seen', () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ hasSeenOnboarding: true, dismissedAt: Date.now() })
      )

      const { result } = renderHook(() => useFormOnboarding())
      expect(result.current.show).toBe(false)
    })
  })

  describe('dismiss', () => {
    it('sets show to false', () => {
      const { result } = renderHook(() => useFormOnboarding())

      expect(result.current.show).toBe(true)

      act(() => {
        result.current.dismiss()
      })

      expect(result.current.show).toBe(false)
    })

    it('persists to localStorage', () => {
      const { result } = renderHook(() => useFormOnboarding())

      act(() => {
        result.current.dismiss()
      })

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
      expect(stored.hasSeenOnboarding).toBe(true)
      expect(stored.dismissedAt).toBeDefined()
    })
  })

  describe('reset', () => {
    it('sets show back to true', () => {
      const { result } = renderHook(() => useFormOnboarding())

      act(() => {
        result.current.dismiss()
      })

      expect(result.current.show).toBe(false)

      act(() => {
        result.current.reset()
      })

      expect(result.current.show).toBe(true)
    })

    it('clears localStorage', () => {
      const { result } = renderHook(() => useFormOnboarding())

      act(() => {
        result.current.dismiss()
      })

      act(() => {
        result.current.reset()
      })

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
      expect(stored.hasSeenOnboarding).toBe(false)
    })
  })

  describe('localStorage error handling', () => {
    it('handles invalid JSON in localStorage', () => {
      localStorage.setItem(STORAGE_KEY, 'invalid json')

      const { result } = renderHook(() => useFormOnboarding())

      // Should default to showing onboarding
      expect(result.current.show).toBe(true)
    })
  })
})
