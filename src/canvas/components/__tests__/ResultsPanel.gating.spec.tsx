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

import { describe, it } from 'vitest'

describe.skip('ResultsPanel gating (deprecated — canonical UX is OutputsDock)', () => {
  it('tests retired — telemetry wiring moved, see src/canvas/panels/ResultsPanel.tsx header', () => {
    // Intentionally empty: if ResultsPanel is resurrected, re-add gating tests
  })
})
