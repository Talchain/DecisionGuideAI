/**
 * Tests for driver-policy/no-raw-influence-fallback (Lane 2, Codex R3-B1
 * class). Uses the runner-agnostic Linter API — NOTE: eslint-rules/__tests__/
 * is NOT covered by any vitest include glob (the RuleTester spec there is
 * never executed); tests/eslint-rules/ is the location that runs.
 */
import { Linter } from 'eslint'
import { describe, it, expect } from 'vitest'
import rule from '../../eslint-rules/no-raw-influence-fallback.js'

const linter = new Linter()
function lint(code: string) {
  return linter.verify(code, {
    languageOptions: { ecmaVersion: 2021, sourceType: 'module' },
    plugins: { 'driver-policy': { rules: { 'no-raw-influence-fallback': rule } } },
    rules: { 'driver-policy/no-raw-influence-fallback': 'error' },
  })
}

describe('driver-policy/no-raw-influence-fallback', () => {
  it('stays silent on the canonical sanctioned chain (raw members as RIGHT operands)', () => {
    expect(lint('const v = d.displayInfluence ?? d.influenceScore ?? d.normalisedInfluence')).toHaveLength(0)
  })

  it('stays silent on adapter property creation and presence probes', () => {
    expect(lint('const row = { influenceScore: f.influence_score ?? null }')).toHaveLength(0)
    expect(lint("const has = typeof f.influenceScore === 'number'")).toHaveLength(0)
    expect(lint('const fin = Number.isFinite(f.influenceScore)')).toHaveLength(0)
    expect(lint('const fires = (d.displayInfluence ?? 0) >= 0.8')).toHaveLength(0)
  })

  it('flags the raw metric as FIRST basis of a ?? chain (tornado/Triage shape)', () => {
    expect(lint('const v = d.influenceScore ?? d.normalisedInfluence ?? 0')).toHaveLength(1)
    expect(lint('const v = d.influenceScore ?? d.displayInfluence')).toHaveLength(1)
    expect(lint('const v = top2?.normalisedInfluence ?? 0')).toHaveLength(1)
  })

  it('flags threshold gates and sort arithmetic on the raw metric (LEHI/nudge shape)', () => {
    expect(lint('const fires = f.influenceScore > FLOOR')).toHaveLength(1)
    expect(lint('rows.sort((a, b) => b.influenceScore - a.influenceScore)')).toHaveLength(2)
  })
})
