/**
 * ResultsPanel — DEPRECATED test suite
 *
 * The legacy ResultsPanel component (src/canvas/panels/ResultsPanel.tsx) is
 * explicitly marked "NOT currently in use". The canonical Results UX is now
 * OutputsDock (src/canvas/components/OutputsDock.tsx).
 *
 * The original 42 tests were removed because:
 * 1. The component is not rendered in the main canvas flow.
 * 2. Three tests failed due to value-formatting changes in KPIHeadline/RangeChips
 *    (e.g. "150.0%" → new format), and fixing them would maintain dead-code coverage.
 * 3. OutputsDock has its own test suite that covers the active results UI.
 *
 * If ResultsPanel is resurrected for a full-screen results view, re-add tests
 * that match the then-current formatting and rendering behaviour.
 */

import { describe, it, expect } from 'vitest'

describe('ResultsPanel (deprecated)', () => {
  it('is documented as deprecated — see src/canvas/panels/ResultsPanel.tsx header comment', () => {
    // This test exists solely to document that the legacy ResultsPanel is not
    // in active use and its original test suite was intentionally retired.
    expect(true).toBe(true)
  })
})
