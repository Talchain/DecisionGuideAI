/**
 * CompareTabBody — rerun prop wiring (static check).
 *
 * v5-canonical-analysis brief correction 5: do NOT assume the Compare-tab
 * rerun is automatically covered by OutputsDock — prove the prop path.
 *
 * Strategy: assert at the source level that OutputsDock passes its own
 * `handleRunAnalysis` to `<CompareTabBodyV2 onRunAnalysis={...} />`. This
 * is faster and more deterministic than rendering CompareTabBody (which
 * needs richly-shaped snapshots to pass deriveTransitions).
 *
 * If that wiring is ever moved/renamed, this test fails — that is the
 * point: the canonical-routing change in OutputsDock.handleRunAnalysis
 * is only effective if Compare's onRunAnalysis prop continues to point
 * at it.
 */
import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

const ROOT = path.resolve(__dirname, '../../../..')

describe('CompareTabBody rerun prop wiring (correction 5)', () => {
  it('OutputsDock passes handleRunAnalysis to CompareTabBody.onRunAnalysis', () => {
    const source = fs.readFileSync(
      path.join(ROOT, 'src/canvas/components/OutputsDock.tsx'),
      'utf-8',
    )
    // ROADMAP 2.581 reshaped this mount from a single-prop self-closing tag to
    // a multi-line element (expert mode is now owned by OutputsDock and passed
    // down), so the pin is on the wiring rather than on one line's whitespace.
    expect(source).toMatch(/<CompareTabBodyV2[\s\S]{0,200}?onRunAnalysis=\{handleRunAnalysis\}/)
  })

  it('CompareTabBody.onRunAnalysis prop signature is still a single callback', () => {
    const source = fs.readFileSync(
      path.join(ROOT, 'src/canvas/compare-tab/CompareTabBody.tsx'),
      'utf-8',
    )
    expect(source).toMatch(/interface CompareTabBodyProps\s*\{[^}]*onRunAnalysis:\s*\(\)\s*=>\s*void/)
  })

  it('CompareTabBody passes onRunAnalysis through to CompareFooter', () => {
    const source = fs.readFileSync(
      path.join(ROOT, 'src/canvas/compare-tab/CompareTabBody.tsx'),
      'utf-8',
    )
    expect(source).toContain('onRunAnalysis={onRunAnalysis}')
  })
})
