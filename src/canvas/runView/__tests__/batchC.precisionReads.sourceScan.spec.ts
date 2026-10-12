/**
 * Recovery Batch C (UI) items 5 and 6, pinned by IDENTITY over every production source (comments stripped):
 *
 *   5. never draw an interval from a standard error of 0: no production code reads `standard_error` at all, so no client
 *      interval can be drawn from one (the C licence carries none: C CEE ruling 2, "nothing an interval could be drawn
 *      from is carried on the licence"); the SE-0 joint is said only through CEE's own face (behavioural case below);
 *   6. joint precision is read ONLY as `probability_of_joint_goal_precision` (PLoT's wire name, C CEE ruling 1): every
 *      identifier naming a joint precision is exactly that name. Today the client reads none (CEE's licence decides).
 *
 * CONTRAST CONTROLS in the same run: the same matchers find the tokens in the Batch C fixture (a test file), and the
 * sibling `probability_of_joint_goal` IS read in production, so a zero is the code's, not a blind probe's.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { stripComments } from '../../../../tests/helpers/stripSourceComments'
import { useResultsSectionData } from '../../../components/results/useResultsSectionData'
import { marketingFace, marketingJourney, resetJourney, seedJourney } from '../../../components/results/__tests__/helpers/batchCGoalChance'

const SRC = join(process.cwd(), 'src')
const EXCLUDED_DIRS = new Set(['__tests__', '__fixtures__', '__mocks__', 'fixtures', 'tests', 'test', 'node_modules'])
const FIXTURE = 'components/results/__tests__/helpers/batchCGoalChance.ts'

function productionSources(): Map<string, string> {
  const sources = new Map<string, string>()
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRS.has(entry.name)) walk(full)
      } else if (/\.(?:tsx?|[cm]?jsx?)$/.test(entry.name) && !/\.(?:spec|test)\./.test(entry.name)) {
        sources.set(relative(SRC, full).split(sep).join('/'), stripComments(readFileSync(full, 'utf8'), entry.name))
      }
    }
  }
  walk(SRC)
  return sources
}

const STANDARD_ERROR = /\bstandard_error\b|\bstandardError\b/g
/** Any identifier that names a JOINT precision, however spelled. */
const JOINT_PRECISION = /\b\w*joint\w*precision\w*\b|\b\w*precision\w*joint\w*\b/gi
const JOINT_GOAL = /\bprobability_of_joint_goal\b/g

const hits = (sources: Map<string, string>, re: RegExp) =>
  [...sources].flatMap(([file, text]) => [...text.matchAll(re)].map(m => ({ file, token: m[0] })))

afterEach(() => resetJourney())

describe('Batch C items 5 and 6: no interval from a standard error; one name for joint precision', () => {
  const sources = productionSources()
  const fixture = stripComments(readFileSync(join(SRC, FIXTURE), 'utf8'), 'batchCGoalChance.ts')

  it('CONTRAST: the probes see their tokens (fixture) and the sibling joint field IS read in production', () => {
    expect(sources.size).toBeGreaterThan(1000)
    expect([...fixture.matchAll(STANDARD_ERROR)].length).toBeGreaterThan(0)
    expect([...fixture.matchAll(JOINT_PRECISION)].map(m => m[0])).toContain('probability_of_joint_goal_precision')
    expect(hits(sources, JOINT_GOAL).length).toBeGreaterThan(0)
  })

  it('item 5: no production source reads a standard error', () => {
    expect(hits(sources, STANDARD_ERROR)).toEqual([])
  })

  it('item 6: every joint-precision identifier in production is `probability_of_joint_goal_precision`', () => {
    expect(hits(sources, JOINT_PRECISION).filter(h => h.token !== 'probability_of_joint_goal_precision')).toEqual([])
  }, 60_000)

  it('item 5 behaviour (C CEE ruling 2): a joint of exactly 1 with standard error 0 is said only through CEE\'s face; no interval', () => {
    const j = marketingJourney('licensed')
    const enrichment = (j.block.enrichment as { option_comparison: Record<string, unknown>[]; inference_warnings: Record<string, unknown>[] })
    for (const row of enrichment.option_comparison) Object.assign(row, { probability_of_joint_goal: 1, probability_of_joint_goal_precision: { n_informative: 10000, standard_error: 0 } })
    enrichment.inference_warnings[0].pct_by_option = { hire_manager: 100, ai_plus_ads: 100 }
    const face = marketingFace('Hire a marketing manager', 100).replace('about 100%', 'more than 99%')
    const canonical = { ...j.canonical, options: (j.canonical.options as Record<string, unknown>[]).map(o => ({ ...o,
      cell: { kind: 'figure', display: 'more than 99%', face: o.option_id === 'hire_manager' ? face : marketingFace('AI planning plus advertising', 100).replace('about 100%', 'more than 99%') } })) }
    seedJourney(j, canonical)
    const data = renderHook(() => useResultsSectionData()).result.current
    const cell = data.runView!.chanceCellOf('hire_manager', { goalChanceHeroSays: true, labelOf: () => 'Hire a marketing manager' })
    expect(cell).toEqual({ kind: 'figure', text: face })
    expect(JSON.stringify(data.runView!.goalChanceDetail())).not.toMatch(/standard_error|interval|±/)
  })
})
