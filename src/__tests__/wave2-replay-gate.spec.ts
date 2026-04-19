/**
 * Wave 2 Task 8 (P0 feedback): UI-Contract Replay Gate Spec
 *
 * Validates cross-cutting UI contracts that must hold after Wave 2 remediation:
 * 1. Formatter behaviour (formatTargetValue, formatPercent)
 * 2. Trust-boundary cast budget (useResultsSectionData.ts ≤ 14 casts —
 *    debug-only window access plus approved PLoT-adapter boundary reads;
 *    see Packet A in docs/ui/cascade-triage-v3.md for rationale)
 * 3. ESLint rule activation (dangerouslySetInnerHTML)
 * 4. British English pass (customize/customise family present)
 * 5. No technical-string leakage in results surface helpers
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { formatTargetValue } from '../components/results/utils/formatTargetValue'
import { formatPercent } from '../utils/formatPercent'

// =============================================================================
// 1. Formatter behaviour contracts
// =============================================================================
describe('formatTargetValue — contract', () => {
  it('currency: symbol + commas', () => {
    expect(formatTargetValue(1200, 'currency', '$')).toBe('$1,200')
    expect(formatTargetValue(1000000, 'currency', '£')).toBe('£1,000,000')
  })

  it('percent: appends % with no commas', () => {
    expect(formatTargetValue(85, 'percent')).toBe('85%')
    expect(formatTargetValue(0, 'percent')).toBe('0%')
  })

  it('count: formats with commas (no unit suffix)', () => {
    expect(formatTargetValue(200000)).toBe('200,000')
    expect(formatTargetValue(42)).toBe('42')
  })

  it('count explicit: same as default', () => {
    expect(formatTargetValue(200000, 'count')).toBe('200,000')
  })

  it('currency without symbol falls through to count format', () => {
    // When currency has no symbol, should still produce a readable number
    expect(formatTargetValue(5000, 'currency')).toBe('5,000')
  })
})

describe('formatPercent — contract', () => {
  it('decimal → integer percentage', () => {
    expect(formatPercent(0.58, { fromDecimal: true })).toBe('58%')
    expect(formatPercent(0.9615, { fromDecimal: true })).toBe('96%')
  })

  it('rounds correctly (no decimals by default)', () => {
    expect(formatPercent(0.505, { fromDecimal: true })).toBe('51%')
    expect(formatPercent(0.994, { fromDecimal: true })).toBe('99%')
  })

  it('sign prefix for positive deltas', () => {
    expect(formatPercent(10, { sign: true })).toBe('+10%')
    expect(formatPercent(-5, { sign: true })).toBe('-5%')
  })

  it('zero stays unsigned', () => {
    expect(formatPercent(0, { sign: true })).toBe('0%')
  })
})

// =============================================================================
// 2. Trust-boundary cast budget
// =============================================================================
describe('Trust boundary — cast budget', () => {
  const filePath = join(process.cwd(), 'src/components/results/useResultsSectionData.ts')
  const content = readFileSync(filePath, 'utf-8')

  it('useResultsSectionData.ts has ≤ 14 "as any" casts (debug-only window access + PLoT-adapter boundary reads)', () => {
    // Packet A (2026-04-19): raised from 6 to 14 with documented rationale.
    // 8 net-new casts across 5 PLoT-adapter boundary sites in useResultsSectionData.ts
    // (lines 1027, 1663, 2363, 2381, 2396) read optional PLoT response fields
    // not in the typed adapter interface: probability_of_joint_goal,
    // nonZeroImpactDrivers, conditional_winners, inference_warnings,
    // edge_e_values. These are deferred typing, tracked under
    // docs/ui/cascade-triage-v3.md "Technical debt — PLoT adapter type gap".
    // Option C (type the PLoT response surface) resolves when adapter/CEE
    // schema work next touches this area.
    const matches = content.match(/as any/g) || []
    expect(matches.length).toBeLessThanOrEqual(14)
  })

  it('all remaining "as any" casts are debug window access OR PLoT-adapter boundary reads', () => {
    // Packet A (2026-04-19): allowlist for the 5 PLoT-adapter boundary sites.
    // See preceding test for technical debt reference.
    //
    // Each boundary field must appear as a whole-word token on the same line
    // as the `as any` cast — not as a substring. This prevents coincidental
    // bypasses where a future field like `probability_of_joint_goal_xyz` or
    // `nonZeroImpactDriversLegacy` would piggyback on the allowlist.
    const PLOT_BOUNDARY_FIELDS = [
      'probability_of_joint_goal',
      'nonZeroImpactDrivers',
      'conditional_winners',
      'inference_warnings',
      'edge_e_values',
    ]
    const lines = content.split('\n')
    const castLines = lines.filter(line => line.includes('as any'))
    for (const line of castLines) {
      const isDebugGuard = line.includes('__OLUMI_DEBUG')
      const isPlotBoundary = PLOT_BOUNDARY_FIELDS.some(field =>
        new RegExp(`\\b${field}\\b`).test(line),
      )
      expect(
        isDebugGuard || isPlotBoundary,
        `cast lacks both __OLUMI_DEBUG guard and PLoT-adapter boundary field: ${line.trim()}`
      ).toBe(true)
    }
  })

  it('no Record<string, any> casts remain', () => {
    expect(content).not.toContain('Record<string, any>')
  })
})

// =============================================================================
// 3. ESLint rule activation (static check)
// =============================================================================
describe('ESLint dangerouslySetInnerHTML rule', () => {
  const eslintConfig = readFileSync(join(process.cwd(), 'eslint.config.js'), 'utf-8')
  const ruleFile = readFileSync(join(process.cwd(), 'eslint-rules/no-unsafe-innerhtml.js'), 'utf-8')

  it('security/no-unsafe-innerhtml rule enforces dangerouslySetInnerHTML restriction', () => {
    expect(eslintConfig).toContain('no-unsafe-innerhtml')
    expect(ruleFile).toContain('dangerouslySetInnerHTML')
    expect(ruleFile).toContain('DOMPurify')
  })

  it('mitigated usages have eslint-disable comments with sanitisation reference', () => {
    const mitigatedFiles = [
      'src/canvas/nodes/BaseNode.tsx',
      'src/canvas/conversation/MessageBubble.tsx',
      'src/components/stream/StreamOutputDisplay.tsx',
    ]
    for (const relPath of mitigatedFiles) {
      const fileContent = readFileSync(join(process.cwd(), relPath), 'utf-8')
      if (fileContent.includes('dangerouslySetInnerHTML')) {
        expect(fileContent).toContain('eslint-disable')
        // Each usage must document its sanitisation method (DOMPurify or safeRichText)
        const hasSanitiser = fileContent.includes('DOMPurify') || fileContent.includes('safeRichText')
        expect(hasSanitiser).toBe(true)
      }
    }
  })
})

// =============================================================================
// 4. British English — customize/customise pair present
// =============================================================================
describe('British English spec coverage', () => {
  const specPath = join(process.cwd(), 'src/canvas/__tests__/british-english.spec.ts')
  const specContent = readFileSync(specPath, 'utf-8')

  it('dictionary includes customize/customise family', () => {
    expect(specContent).toContain("'customize': 'customise'")
    expect(specContent).toContain("'customized': 'customised'")
    expect(specContent).toContain("'customizable': 'customisable'")
  })

  it('dictionary includes all required pairs from spec', () => {
    const requiredPairs = [
      ['visualization', 'visualisation'],
      ['analyze', 'analyse'],
      ['color', 'colour'],
      ['behavior', 'behaviour'],
      ['optimize', 'optimise'],
      ['customize', 'customise'],
    ]
    for (const [american, british] of requiredPairs) {
      expect(specContent).toContain(american)
      expect(specContent).toContain(british)
    }
  })
})

// =============================================================================
// 5. No technical-string leakage in formatters
// =============================================================================
describe('No technical-string leakage', () => {
  it('formatTargetValue never returns "undefined", "null", "NaN"', () => {
    const outputs = [
      formatTargetValue(0),
      formatTargetValue(100, 'currency', '$'),
      formatTargetValue(50, 'percent'),
      formatTargetValue(1000, 'count'),
    ]
    for (const out of outputs) {
      expect(out).not.toBe('undefined')
      expect(out).not.toBe('null')
      expect(out).not.toBe('NaN')
    }
  })

  it('formatPercent never returns "NaN%" or "undefined%"', () => {
    // Edge cases
    expect(formatPercent(0)).toBe('0%')
    expect(formatPercent(100)).toBe('100%')
    expect(formatPercent(0.5, { fromDecimal: true })).toBe('50%')
  })
})
