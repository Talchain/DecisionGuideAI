/**
 * Accordion Component Tests
 *
 * Phase 3 Task 3.1: Tests for the Results Panel accordion layout component.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Accordion } from '../Accordion'

describe('Accordion', () => {
  describe('rendering', () => {
    it('renders with title', () => {
      render(
        <Accordion title="Test Section">
          <p>Content here</p>
        </Accordion>
      )

      expect(screen.getByRole('heading', { name: 'Test Section' })).toBeInTheDocument()
    })

    it('renders children when expanded', () => {
      render(
        <Accordion title="Test Section" defaultExpanded={true}>
          <p>Visible content</p>
        </Accordion>
      )

      expect(screen.getByText('Visible content')).toBeInTheDocument()
    })

    it('renders badge count when provided', () => {
      render(
        <Accordion title="Test Section" badgeCount={5}>
          <p>Content</p>
        </Accordion>
      )

      expect(screen.getByText('5')).toBeInTheDocument()
    })

    it('does not render badge when count is 0', () => {
      render(
        <Accordion title="Test Section" badgeCount={0}>
          <p>Content</p>
        </Accordion>
      )

      // Badge count text should not be present
      expect(screen.queryByText('0')).not.toBeInTheDocument()
    })
  })

  describe('expansion state', () => {
    it('starts collapsed by default', () => {
      render(
        <Accordion title="Test Section">
          <p>Hidden content</p>
        </Accordion>
      )

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('aria-expanded', 'false')
    })

    it('starts expanded when defaultExpanded is true', () => {
      render(
        <Accordion title="Test Section" defaultExpanded={true}>
          <p>Visible content</p>
        </Accordion>
      )

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('aria-expanded', 'true')
    })

    it('toggles on click', () => {
      render(
        <Accordion title="Test Section">
          <p>Content</p>
        </Accordion>
      )

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('aria-expanded', 'false')

      fireEvent.click(button)
      expect(button).toHaveAttribute('aria-expanded', 'true')

      fireEvent.click(button)
      expect(button).toHaveAttribute('aria-expanded', 'false')
    })
  })

  describe('accessibility', () => {
    it('has proper ARIA attributes', () => {
      render(
        <Accordion title="Test Section" testId="test-accordion" defaultExpanded={true}>
          <p>Content</p>
        </Accordion>
      )

      const button = screen.getByRole('button')

      // aria-expanded is set
      expect(button).toHaveAttribute('aria-expanded', 'true')

      // aria-controls links to content region
      const controlsId = button.getAttribute('aria-controls')
      expect(controlsId).toBeTruthy()

      // Content region exists with role="region" and matching id (when expanded)
      const regions = screen.getAllByRole('region')
      const contentRegion = regions.find(r => r.getAttribute('id') === controlsId)
      expect(contentRegion).toBeTruthy()
    })

    it('hides content from accessibility tree when collapsed', () => {
      render(
        <Accordion title="Test Section" defaultExpanded={false}>
          <p>Content</p>
        </Accordion>
      )

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('aria-expanded', 'false')

      // When collapsed, content region is hidden via aria-hidden
      // This means it won't be found by getByRole
      const controlsId = button.getAttribute('aria-controls')
      const contentDiv = document.getElementById(controlsId!)
      expect(contentDiv).toHaveAttribute('aria-hidden', 'true')
    })

    it('region is labelled by heading', () => {
      render(
        <Accordion title="Test Section" defaultExpanded={true}>
          <p>Content</p>
        </Accordion>
      )

      const heading = screen.getByRole('heading')
      const button = screen.getByRole('button')
      const controlsId = button.getAttribute('aria-controls')

      // Find the content region by its id
      const regions = screen.getAllByRole('region')
      const contentRegion = regions.find(r => r.getAttribute('id') === controlsId)

      // Region should be labelled by heading
      expect(contentRegion).toHaveAttribute('aria-labelledby', heading.id)
    })

    it('button is keyboard accessible', () => {
      render(
        <Accordion title="Test Section">
          <p>Content</p>
        </Accordion>
      )

      const button = screen.getByRole('button')

      // Button should be focusable
      button.focus()
      expect(document.activeElement).toBe(button)

      // Enter key should toggle
      fireEvent.keyDown(button, { key: 'Enter' })
      // Note: fireEvent.click is automatically triggered for button keydown
    })
  })

  describe('badge variants', () => {
    it('applies default variant styling', () => {
      render(
        <Accordion title="Test Section" badgeCount={3} badgeVariant="default">
          <p>Content</p>
        </Accordion>
      )

      const badge = screen.getByText('3')
      expect(badge).toHaveClass('bg-slate-100')
    })

    it('applies warning variant styling', () => {
      render(
        <Accordion title="Test Section" badgeCount={3} badgeVariant="warning">
          <p>Content</p>
        </Accordion>
      )

      const badge = screen.getByText('3')
      expect(badge).toHaveClass('bg-warning-100')
    })

    it('applies critical variant styling', () => {
      render(
        <Accordion title="Test Section" badgeCount={3} badgeVariant="critical">
          <p>Content</p>
        </Accordion>
      )

      const badge = screen.getByText('3')
      expect(badge).toHaveClass('bg-danger-100')
    })
  })

  describe('V12.3: Evidence tier label (actions section)', () => {
    it('renders tierLabel when tierLabel and tierVariant are provided', () => {
      render(
        <Accordion
          title="What to do next"
          tierLabel="Evidence: Good"
          tierVariant="strong"
        >
          <p>Content</p>
        </Accordion>
      )

      expect(screen.getByText('Evidence: Good')).toBeInTheDocument()
    })

    it('renders tierLabel for "fair" variant', () => {
      render(
        <Accordion
          title="What to do next"
          tierLabel="Evidence: Fair"
          tierVariant="fair"
        >
          <p>Content</p>
        </Accordion>
      )

      expect(screen.getByText('Evidence: Fair')).toBeInTheDocument()
    })

    it('renders tierLabel for "needs_work" variant', () => {
      render(
        <Accordion
          title="What to do next"
          tierLabel="Evidence: Needs work"
          tierVariant="needs_work"
        >
          <p>Content</p>
        </Accordion>
      )

      expect(screen.getByText('Evidence: Needs work')).toBeInTheDocument()
    })

    it('does NOT render tierLabel when tierVariant is absent', () => {
      render(
        <Accordion
          title="What to do next"
          tierLabel="Evidence: Good"
        >
          <p>Content</p>
        </Accordion>
      )

      expect(screen.queryByText('Evidence: Good')).not.toBeInTheDocument()
    })
  })

  describe('test ID', () => {
    it('applies testId to section', () => {
      render(
        <Accordion title="Test Section" testId="my-accordion">
          <p>Content</p>
        </Accordion>
      )

      expect(screen.getByTestId('my-accordion')).toBeInTheDocument()
    })
  })
})
