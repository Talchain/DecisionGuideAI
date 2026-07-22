/**
 * TemplatesPanel merge-freshness routing guard.
 *
 * Both merge actions ("Merge into Current" footer button → handleMergeIntoCurrent,
 * and the template card's onMerge → handleMerge) are analysis-affecting structural
 * graph changes. They previously appended via a bare `useCanvasStore.setState(...)`,
 * which bypassed the freshness overlay and left a retained CEE 'fresh' verdict
 * falsely intact after a merge. They must now route through the shared dirtying
 * commit (commitGraphMutation) — proven behaviourally in
 * mutations/__tests__/commitGraphMutation.spec.ts.
 *
 * This guard pins the routing at the source level so a future edit cannot quietly
 * reintroduce a raw-setState graph mutation in this panel. (A full render test is
 * impractical here: each merge awaits an async plot.template fetch and the real
 * store pulls scenarios/Supabase; the shared-helper behaviour test plus this
 * routing guard together cover both merges.)
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { stripComments } from '../../../../tests/helpers/stripSourceComments'

// TemplatesPanel.tsx is JSX-heavy; the naive regex strip PR #432 had to keep
// here mis-handled it, and the shared strip's earlier JSX tokeniser bug (a
// `</tag>` slash mistaken for a regex open) made the migration unsafe until the
// stripper was made JSX-aware. Now it is, so route through the shared helper —
// passing the real `.tsx` filename selects the JSX-aware path.
const source = stripComments(
  readFileSync(join(process.cwd(), 'src/canvas/panels/TemplatesPanel.tsx'), 'utf8'),
  'TemplatesPanel.tsx',
)

describe('TemplatesPanel — merge actions dirty the freshness overlay', () => {
  it('imports the shared graph-mutation commit', () => {
    expect(source).toMatch(/import\s*\{[^}]*\bcommitGraphMutation\b[^}]*\}\s*from\s*['"][^'"]*mutations\/commitGraphMutation['"]/)
  })

  it('routes BOTH merge handlers through commitGraphMutation (≥2 call sites)', () => {
    const calls = source.match(/commitGraphMutation\s*\(/g) ?? []
    expect(calls.length).toBeGreaterThanOrEqual(2)
  })

  it('contains NO raw useCanvasStore.setState graph mutation (the bypass that left fresh verdicts intact)', () => {
    expect(source).not.toMatch(/useCanvasStore\.setState\s*\(/)
  })
})
