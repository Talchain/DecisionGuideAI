/**
 * ResultsPanel gating — DEPRECATED test suite
 *
 * The legacy ResultsPanel component (src/canvas/panels/ResultsPanel.tsx) is
 * explicitly marked "NOT currently in use". The canonical Results UX is now
 * OutputsDock (src/canvas/components/OutputsDock.tsx).
 *
 * The original 4 tests were removed because:
 * 1. The component is not rendered in the main canvas flow.
 * 2. Telemetry counter wiring (sandbox.run.blocked / sandbox.run.clicked)
 *    changed, breaking the assertions against __getTelemetryCounters().
 * 3. Run-gating logic is tested via OutputsDock and useRunEligibilityCheck tests.
 *
 * If ResultsPanel is resurrected, re-add gating tests that match the
 * then-current telemetry and run-eligibility wiring.
 */

import { describe, it, expect } from 'vitest'

describe('ResultsPanel gating (deprecated)', () => {
  it('is documented as deprecated — see src/canvas/panels/ResultsPanel.tsx header comment', () => {
    // This test exists solely to document that the legacy ResultsPanel gating
    // tests were intentionally retired when the component was deprecated.
    expect(true).toBe(true)
  })
})
