/**
 * ⚠ AN EMPTY LABEL IS NOT A LABEL, AND `??` CANNOT SEE THE DIFFERENCE.
 *
 * `GraphLink` built its accessible name as `Focus on ${label ?? 'element'} in
 * model`. `??` guards null and undefined only — an EMPTY STRING sails straight
 * through it.
 *
 * Callers do pass one. `compare-tab/DotProgression.tsx` builds its runner-up
 * row as `label: latest.runnerUpLabel ?? ''` and gates the row on
 * `runnerUpId` alone, so a runner-up that has an id but no label reaches this
 * component with `label=""`. A screen-reader user then hears
 * "Focus on  in model" — a control that names nothing, with a doubled space
 * where the subject should be.
 *
 * Sighted users never see this: the visible content is separate from the
 * accessible name, so the defect is announced-only. That is precisely why it
 * survived — and why it is pinned here rather than left to a visual check.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GraphLink } from '../GraphLink'

// Mock the module GraphLink actually imports (`focusHelpers`), not the store —
// the component never touches the store directly.
vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusByTarget: vi.fn(),
  focusEdgeByEndpoints: vi.fn(),
}))

describe('GraphLink — the accessible name always names something', () => {
  it.each([
    ['empty string', ''],
    ['whitespace only', '   '],
  ])('falls back to "element" for a %s label', (_name, label) => {
    render(<GraphLink nodeId="opt-1" label={label} />)
    const el = screen.getByRole('button')
    expect(el.getAttribute('aria-label')).toBe('Focus on element in model')
    // ⛔ The precise defect: a doubled space where the subject should be.
    expect(el.getAttribute('aria-label')).not.toContain('  ')
  })

  /**
   * ⭐ DISCRIMINATION. Without this the test above is satisfied by a component
   * that hardcodes "element" for every label, which would be a worse bug than
   * the one being fixed.
   */
  it('uses the real label when there is one', () => {
    render(<GraphLink nodeId="opt-1" label="Consolidate suppliers" />)
    expect(screen.getByRole('button').getAttribute('aria-label')).toBe(
      'Focus on Consolidate suppliers in model',
    )
  })
})
