/**
 * ⭐ EVERY USER-INVOKED FIT FRAMES WHAT THE LANDING FIT FRAMES — the model AND
 * its row-end prompts (S5, 24 Sep 2026).
 *
 * Measured on the S5 build (1440×900, dock open, `pricing-model`): the toolbar's
 * "Fit to view" left all four row-end prompt cards under the Olumi dock (their
 * right edges at x 1024–1103 against the dock's left edge at 1012). The landing
 * fit frames `fitFrameNodes` — model + row-end prompts (NODE-ANATOMY L4: "all
 * rows plus the prompt cards") — but the three fits a PERSON invokes (toolbar
 * "Fit to view", palette "Zoom to Fit", the extent notice's "Show whole model")
 * still framed `excludeNonModelNodes`, which drops the prompts, so the prompts
 * sat outside their frame.
 *
 * Source scan, because each site is a callback deep inside a component whose
 * harness does not run a camera; the unit half proves the helper's set.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { userFitNodes, isRowEndPromptId } from '../utils/fitTargets'

const SITES = [
  'ReactFlowGraph.tsx',
  'components/CommandPalette.tsx',
  'components/ModelExtentNotice.tsx',
] as const
const read = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf-8')

describe('user-invoked fits frame the row-end prompts, like the landing fit', () => {
  it.each(SITES)('%s: the user fit frames userFitNodes(…), never excludeNonModelNodes(…) alone', (rel) => {
    const src = read(rel)
    expect(src.length, 'POSITIVE CONTROL: the file was read').toBeGreaterThan(1000)
    expect(src, `${rel} does not frame the row-end prompts`).toContain('userFitNodes(')
    // The old spelling at a fit site: `const nodes = … excludeNonModelNodes(getNodes…())` feeding fitView.
    expect(src).not.toMatch(/(?:const|let) (?:nodes|fitTargets) = [^\n]*excludeNonModelNodes\(getNodes/)
  })

  it('userFitNodes keeps every model node and every row-end prompt, and drops other ghosts', () => {
    const nodes = [
      { id: 'dec' }, { id: 'opt_a' }, { id: 'fac_b' },
      { id: '__ghost-option__' }, { id: '__ghost-factor__' }, { id: '__ghost-outcome__' }, { id: '__ghost-risk__' },
      { id: '__ghost-something-else__' },
    ]
    const ids = userFitNodes(nodes).map(n => n.id)
    expect(ids).toEqual(['dec', 'opt_a', 'fac_b', '__ghost-option__', '__ghost-factor__', '__ghost-outcome__', '__ghost-risk__'])
    expect(ids.filter(isRowEndPromptId)).toHaveLength(4)
  })

  it('an empty model frames nothing (the fit then falls back to all nodes, as before)', () => {
    expect(userFitNodes([{ id: '__ghost-option__' }])).toEqual([])
  })
})
