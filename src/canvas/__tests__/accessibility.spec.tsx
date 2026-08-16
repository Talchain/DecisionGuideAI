/**
 * S4-A11Y & S4-ARIA: Accessibility validation for retained canvas surfaces.
 *
 * The former EdgeEditPopover was removed when edge-label editing was routed to
 * the canonical InspectorModal. Inspector accessibility is exercised with the
 * live route in openEdgeStrengthEditor.spec.tsx rather than a parallel editor.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { UnknownKindWarning } from '../components/UnknownKindWarning'

describe('S4-A11Y: Focus Management and ARIA', () => {
  describe('UnknownKindWarning Accessibility', () => {
    it('has status role for announcements', () => {
      const { container } = render(<UnknownKindWarning originalKind="custom-type" />)

      expect(container.querySelector('[role="status"]')).toBeDefined()
    })

    it('has a contextual aria-label for screen readers', () => {
      const { container } = render(<UnknownKindWarning originalKind="custom-type" />)
      const warning = container.querySelector('[role="status"]')

      expect(warning?.getAttribute('aria-label')).toContain('custom-type')
    })

    it('has a contextual native tooltip', () => {
      const { container } = render(<UnknownKindWarning originalKind="custom-type" />)
      const warning = container.querySelector('[role="status"]')

      expect(warning?.getAttribute('title')).toContain('custom-type')
    })

    it('keeps the visual icon hidden from assistive technology', () => {
      const { container } = render(<UnknownKindWarning originalKind="custom-type" />)
      const icon = container.querySelector('[aria-hidden="true"]')

      expect(icon).toBeDefined()
      expect(icon?.classList.contains('w-3')).toBe(true)
    })

    it('retains concise visible copy and warning contrast token', () => {
      const { container } = render(<UnknownKindWarning originalKind="custom-type" />)

      expect(screen.getByText('Unknown type')).toBeDefined()
      expect(container.querySelector('[role="status"]')?.classList.toString()).toContain('warning')
    })
  })
})
