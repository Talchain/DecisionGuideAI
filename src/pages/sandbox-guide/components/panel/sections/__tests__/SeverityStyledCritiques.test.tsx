/**
 * SeverityStyledCritiques Tests
 *
 * Tests for severity-styled critique grouping:
 * - Groups critiques by severity
 * - ERROR always expanded
 * - WARNING/INFO collapsible
 * - Correct icons and colors
 * - Count badges accurate
 */

import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SeverityStyledCritiques } from '../SeverityStyledCritiques'

describe('SeverityStyledCritiques', () => {
  describe('Grouping and Display', () => {
    it('groups critiques by semantic severity', () => {
      render(
        <SeverityStyledCritiques
          critiques={[
            {
              message: 'Critical issue 1',
              severity: 'BLOCKER',
              semantic_severity: 'ERROR',
            },
            {
              message: 'Warning issue 1',
              severity: 'IMPROVEMENT',
              semantic_severity: 'WARNING',
            },
            {
              message: 'Info issue 1',
              severity: 'OBSERVATION',
              semantic_severity: 'INFO',
            },
          ]}
        />
      )

      expect(screen.getByText('Critical')).toBeInTheDocument()
      expect(screen.getByText('Warning')).toBeInTheDocument()
      expect(screen.getByText('Info')).toBeInTheDocument()
    })

    it('displays correct count badges', () => {
      render(
        <SeverityStyledCritiques
          critiques={[
            {
              message: 'Error 1',
              severity: 'BLOCKER',
              semantic_severity: 'ERROR',
            },
            {
              message: 'Error 2',
              severity: 'BLOCKER',
              semantic_severity: 'ERROR',
            },
            {
              message: 'Warning 1',
              severity: 'IMPROVEMENT',
              semantic_severity: 'WARNING',
            },
          ]}
        />
      )

      const criticalGroup = screen.getByText('Critical').parentElement
      expect(criticalGroup).toHaveTextContent('2')

      const warningGroup = screen.getByText('Warning').parentElement
      expect(warningGroup).toHaveTextContent('1')
    })

    it('sorts groups by severity order (ERROR, WARNING, INFO)', () => {
      const { container } = render(
        <SeverityStyledCritiques
          critiques={[
            {
              message: 'Info issue',
              severity: 'OBSERVATION',
              semantic_severity: 'INFO',
            },
            {
              message: 'Error issue',
              severity: 'BLOCKER',
              semantic_severity: 'ERROR',
            },
            {
              message: 'Warning issue',
              severity: 'IMPROVEMENT',
              semantic_severity: 'WARNING',
            },
          ]}
        />
      )

      const groups = container.querySelectorAll('[aria-label$="issues"]')
      expect(groups[0]).toHaveAccessibleName('Critical issues')
      expect(groups[1]).toHaveAccessibleName('Warning issues')
      expect(groups[2]).toHaveAccessibleName('Info issues')
    })
  })

  describe('ERROR Severity', () => {
    it('ERROR group is always expanded', () => {
      render(
        <SeverityStyledCritiques
          critiques={[
            {
              message: 'Critical issue',
              severity: 'BLOCKER',
              semantic_severity: 'ERROR',
            },
          ]}
        />
      )

      // Message should be visible immediately
      expect(screen.getByText('Critical issue')).toBeInTheDocument()
    })

    it('ERROR group is not toggleable', () => {
      render(
        <SeverityStyledCritiques
          critiques={[
            {
              message: 'Critical issue',
              severity: 'BLOCKER',
              semantic_severity: 'ERROR',
            },
          ]}
        />
      )

      const button = screen.getByLabelText('Critical issues')
      expect(button).toBeDisabled()
    })

    it('ERROR group does not show expand/collapse arrow', () => {
      render(
        <SeverityStyledCritiques
          critiques={[
            {
              message: 'Critical issue',
              severity: 'BLOCKER',
              semantic_severity: 'ERROR',
            },
          ]}
        />
      )

      const criticalGroup = screen.getByText('Critical').closest('button')
      expect(criticalGroup).not.toHaveTextContent('▼')
      expect(criticalGroup).not.toHaveTextContent('▶')
    })

    it('displays ERROR messages with correct styling', () => {
      render(
        <SeverityStyledCritiques
          critiques={[
            {
              message: 'Critical error message',
              severity: 'BLOCKER',
              semantic_severity: 'ERROR',
            },
          ]}
        />
      )

      const button = screen.getByLabelText('Critical issues')
      expect(button).toHaveClass('bg-red-50')

      const criticalLabel = screen.getByText('Critical')
      expect(criticalLabel).toHaveClass('text-red-600')
    })
  })

  describe('WARNING Severity', () => {
    it('WARNING group starts collapsed', () => {
      render(
        <SeverityStyledCritiques
          critiques={[
            {
              message: 'Warning message',
              severity: 'IMPROVEMENT',
              semantic_severity: 'WARNING',
            },
          ]}
        />
      )

      expect(screen.queryByText('Warning message')).not.toBeInTheDocument()
    })

    it('WARNING group expands on click', () => {
      render(
        <SeverityStyledCritiques
          critiques={[
            {
              message: 'Warning message',
              severity: 'IMPROVEMENT',
              semantic_severity: 'WARNING',
            },
          ]}
        />
      )

      fireEvent.click(screen.getByText('Warning'))
      expect(screen.getByText('Warning message')).toBeInTheDocument()
    })

    it('WARNING group collapses on second click', () => {
      render(
        <SeverityStyledCritiques
          critiques={[
            {
              message: 'Warning message',
              severity: 'IMPROVEMENT',
              semantic_severity: 'WARNING',
            },
          ]}
        />
      )

      const button = screen.getByText('Warning')

      fireEvent.click(button)
      expect(screen.getByText('Warning message')).toBeInTheDocument()

      fireEvent.click(button)
      expect(screen.queryByText('Warning message')).not.toBeInTheDocument()
    })

    it('displays WARNING with correct styling', () => {
      render(
        <SeverityStyledCritiques
          critiques={[
            {
              message: 'Warning message',
              severity: 'IMPROVEMENT',
              semantic_severity: 'WARNING',
            },
          ]}
        />
      )

      const button = screen.getByLabelText('Warning issues')
      expect(button).toHaveClass('bg-amber-50')

      const warningLabel = screen.getByText('Warning')
      expect(warningLabel).toHaveClass('text-amber-600')
    })
  })

  describe('INFO Severity', () => {
    it('INFO group starts collapsed', () => {
      render(
        <SeverityStyledCritiques
          critiques={[
            {
              message: 'Info message',
              severity: 'OBSERVATION',
              semantic_severity: 'INFO',
            },
          ]}
        />
      )

      expect(screen.queryByText('Info message')).not.toBeInTheDocument()
    })

    it('INFO group expands on click', () => {
      render(
        <SeverityStyledCritiques
          critiques={[
            {
              message: 'Info message',
              severity: 'OBSERVATION',
              semantic_severity: 'INFO',
            },
          ]}
        />
      )

      fireEvent.click(screen.getByText('Info'))
      expect(screen.getByText('Info message')).toBeInTheDocument()
    })

    it('displays INFO with correct styling', () => {
      render(
        <SeverityStyledCritiques
          critiques={[
            {
              message: 'Info message',
              severity: 'OBSERVATION',
              semantic_severity: 'INFO',
            },
          ]}
        />
      )

      const button = screen.getByLabelText('Info issues')
      expect(button).toHaveClass('bg-blue-50')

      const infoLabel = screen.getByText('Info')
      expect(infoLabel).toHaveClass('text-blue-600')
    })
  })

  describe('Suggested Actions', () => {
    it('displays suggested action when provided', () => {
      render(
        <SeverityStyledCritiques
          critiques={[
            {
              message: 'Critical issue',
              severity: 'BLOCKER',
              semantic_severity: 'ERROR',
              suggested_action: 'Fix this immediately',
            },
          ]}
        />
      )

      expect(screen.getByText('→ Fix this immediately')).toBeInTheDocument()
    })

    it('does not show suggested action when not provided', () => {
      render(
        <SeverityStyledCritiques
          critiques={[
            {
              message: 'Critical issue',
              severity: 'BLOCKER',
              semantic_severity: 'ERROR',
            },
          ]}
        />
      )

      expect(screen.queryByText(/→/)).not.toBeInTheDocument()
    })

    it('displays multiple suggested actions correctly', () => {
      render(
        <SeverityStyledCritiques
          critiques={[
            {
              message: 'Issue 1',
              severity: 'BLOCKER',
              semantic_severity: 'ERROR',
              suggested_action: 'Action 1',
            },
            {
              message: 'Issue 2',
              severity: 'BLOCKER',
              semantic_severity: 'ERROR',
              suggested_action: 'Action 2',
            },
          ]}
        />
      )

      expect(screen.getByText('→ Action 1')).toBeInTheDocument()
      expect(screen.getByText('→ Action 2')).toBeInTheDocument()
    })
  })

  describe('Multiple Critiques per Severity', () => {
    it('displays all critiques in a group', () => {
      render(
        <SeverityStyledCritiques
          critiques={[
            {
              message: 'Error 1',
              severity: 'BLOCKER',
              semantic_severity: 'ERROR',
            },
            {
              message: 'Error 2',
              severity: 'BLOCKER',
              semantic_severity: 'ERROR',
            },
            {
              message: 'Error 3',
              severity: 'BLOCKER',
              semantic_severity: 'ERROR',
            },
          ]}
        />
      )

      expect(screen.getByText('Error 1')).toBeInTheDocument()
      expect(screen.getByText('Error 2')).toBeInTheDocument()
      expect(screen.getByText('Error 3')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has proper aria-label on group buttons', () => {
      render(
        <SeverityStyledCritiques
          critiques={[
            {
              message: 'Critical issue',
              severity: 'BLOCKER',
              semantic_severity: 'ERROR',
            },
            {
              message: 'Warning issue',
              severity: 'IMPROVEMENT',
              semantic_severity: 'WARNING',
            },
          ]}
        />
      )

      expect(screen.getByLabelText('Critical issues')).toBeInTheDocument()
      expect(screen.getByLabelText('Warning issues')).toBeInTheDocument()
    })

    it('has aria-expanded for collapsible groups', () => {
      render(
        <SeverityStyledCritiques
          critiques={[
            {
              message: 'Warning issue',
              severity: 'IMPROVEMENT',
              semantic_severity: 'WARNING',
            },
          ]}
        />
      )

      const button = screen.getByLabelText('Warning issues')
      expect(button).toHaveAttribute('aria-expanded', 'false')

      fireEvent.click(button)
      expect(button).toHaveAttribute('aria-expanded', 'true')
    })

    it('marks detail region with proper role', () => {
      render(
        <SeverityStyledCritiques
          critiques={[
            {
              message: 'Warning issue',
              severity: 'IMPROVEMENT',
              semantic_severity: 'WARNING',
            },
          ]}
        />
      )

      fireEvent.click(screen.getByText('Warning'))

      expect(
        screen.getByRole('region', { name: 'Warning issues details' })
      ).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('handles empty critiques array', () => {
      const { container } = render(<SeverityStyledCritiques critiques={[]} />)

      expect(screen.getByText('Issues & Recommendations')).toBeInTheDocument()
      expect(container.querySelectorAll('[aria-label$="issues"]')).toHaveLength(0)
    })

    it('handles only one severity level', () => {
      render(
        <SeverityStyledCritiques
          critiques={[
            {
              message: 'Error 1',
              severity: 'BLOCKER',
              semantic_severity: 'ERROR',
            },
            {
              message: 'Error 2',
              severity: 'BLOCKER',
              semantic_severity: 'ERROR',
            },
          ]}
        />
      )

      expect(screen.getByText('Critical')).toBeInTheDocument()
      expect(screen.queryByText('Warning')).not.toBeInTheDocument()
      expect(screen.queryByText('Info')).not.toBeInTheDocument()
    })
  })
})
