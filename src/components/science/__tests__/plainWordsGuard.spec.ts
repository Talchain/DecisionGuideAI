import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// Small explicit ratchet, not a complete analyser. It catches known raw-number
// formatter patterns and prevents new Compare renderers from being introduced.
const baseline = new Set([
  'src/canvas/components/CompareView.tsx',
  'src/canvas/compare-tab/TrajectorySection.tsx',
])
const root = resolve(__dirname, '../../../..')
const candidates = [...baseline, 'src/canvas/compare/EdgeDiffTable.tsx', 'src/canvas/compare-tab/TransitionCard.tsx']

describe('plain words first raw-science ratchet', () => {
  it('does not add or regress raw science renderers', () => {
    const raw = candidates.filter(file => /(?:toFixed|Math\.round)\([^)]*(?:weight|belief|probability|stability|delta)/i.test(readFileSync(resolve(root, file), 'utf8')))
    expect(raw.filter(file => !baseline.has(file))).toEqual([])
    expect(raw).not.toContain('src/canvas/compare/EdgeDiffTable.tsx')
  })
})
