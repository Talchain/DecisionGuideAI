/**
 * RunView PR 1 (design: programme-docs design/RUNVIEW-PHASE1-DESIGN-20261008.md, DL APPROVED 8 Oct): one per-option view,
 * one chance source (CEE's licence), built once per report, and the ONE production reader of the licence and range.
 * The licence record below is CAPTURED: P02 C3 (scenario 23b1495c), CEE 2334956288d3a87eaece7a5ab3d948b20a5f9dfb.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildRunView, runViewOf, OPTION_CHANCE_WITHHELD, RUN_AGAIN_FOR_CHANCE } from '../runView'
import { readGoalChanceLicence } from '../../../components/results/utils/goalChanceLicence'
import { goalChanceOptionLines } from '../../../components/results/analysis-hero/goalChanceCopy'

// Captured (C3, 23b1495c): the GOAL_CHANCE_LICENSED record, verbatim fields.
const C3 = {
  code: 'GOAL_CHANCE_LICENSED', form: 'each', severity: 'info',
  message: 'Each option’s chance of meeting your goal is licensed on this Run.',
  target: { unit: '£/month', value: 20000, comparator: 'at_least' },
  option_ids: ['keep_pro_at_49', 'raise_pro_to_59'],
  horizon_line: 'This model doesn\'t yet say whether any option gets there within 12 months.',
  pct_by_option: { keep_pro_at_49: 0, raise_pro_to_59: 0 }, horizon_untested: true,
  summary_withheld: { form: 'all_likely_to_miss', cause: 'olumi_existence_assumption' },
  no_driver_by_option: { keep_pro_at_49: 'none', raise_pro_to_59: 'none' },
  user_link_existence: { links: 1, one_in: 5 },
  display_rounding_by_option: { keep_pro_at_49: 'whole', raise_pro_to_59: 'whole' },
}
const LABELS: Record<string, string> = { keep_pro_at_49: 'Keep Pro at £49', raise_pro_to_59: 'Raise Pro to £59', a: 'A', b: 'B' }
const labelOf = (id: string) => LABELS[id] ?? null

describe('RunView: one per-option view, one chance source', () => {
  it('C3 captured: each option\'s chance is CEE\'s licensed figure in its display words; the Run\'s lines are byte-identical', () => {
    const report = { inference_warnings: [C3] }
    const view = buildRunView(report)
    expect(view.chanceOf('raise_pro_to_59')).toEqual({ kind: 'figure', pct: 0, words: 'less than 1%' })
    expect(view.chanceOf('keep_pro_at_49')).toEqual({ kind: 'figure', pct: 0, words: 'less than 1%' })
    expect(goalChanceOptionLines(view.goalChance!, labelOf)).toEqual(goalChanceOptionLines(readGoalChanceLicence([C3])!, labelOf))
  })

  it('an option CEE withheld keeps its place and says so; the others keep their figures', () => {
    const lic = { ...C3, option_ids: ['a', 'b'], pct_by_option: { a: 41 }, withheld_option_ids: ['b'], summary_withheld: undefined,
      no_driver_by_option: undefined, display_rounding_by_option: undefined }
    const view = buildRunView({ inference_warnings: [lic] })
    expect(view.chanceOf('a')).toEqual({ kind: 'figure', pct: 41, words: 'about 41%' })
    expect(view.chanceOf('b')).toEqual({ kind: 'withheld', reason: OPTION_CHANCE_WITHHELD, by: 'licence' })
  })

  it('DL ruling 1: goal figures in the report but NO licence → withheld, "Run the analysis again to see the chance."; never the report figure', () => {
    const view = buildRunView({ inference_warnings: [], option_probabilities: { a: { goal_probability: 0.074 }, b: { probability_of_goal: 0.3 } } })
    expect(view.unlicensedGoalFigures).toBe(true)
    expect(view.chanceOf('a')).toEqual({ kind: 'withheld', reason: RUN_AGAIN_FOR_CHANCE, by: 'no_licence' })
    expect(view.chanceOf('b')).toEqual({ kind: 'withheld', reason: RUN_AGAIN_FOR_CHANCE, by: 'no_licence' })
  })

  it('CONTROL: no goal figures and no licence → no chance to show (not "run again")', () => {
    const view = buildRunView({ inference_warnings: [], option_probabilities: { a: { win_probability: 0.6 } } })
    expect(view.unlicensedGoalFigures).toBe(false)
    expect(view.chanceOf('a')).toEqual({ kind: 'none' })
    expect(buildRunView(null).chanceOf('a')).toEqual({ kind: 'none' })
  })

  it('CONTROL: with a licence, an option it does not name has no chance (the report figure is never a fallback)', () => {
    const view = buildRunView({ inference_warnings: [C3], option_probabilities: { other: { goal_probability: 0.5 } } })
    expect(view.chanceOf('other')).toEqual({ kind: 'none' })
  })

  it('built once per report: the same report object gets the same view; a new report gets a new one', () => {
    const report = { inference_warnings: [C3] }
    expect(runViewOf(report)).toBe(runViewOf(report))
    expect(runViewOf({ inference_warnings: [C3] })).not.toBe(runViewOf(report))
  })

  it('GUARD: RunView is the ONE production reader of the licence and the range', () => {
    const root = join(__dirname, '..', '..', '..')
    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name)
        if (statSync(path).isDirectory()) { if (name !== '__tests__' && name !== 'node_modules') walk(path); continue }
        if (!/\.(ts|tsx)$/.test(name) || /\.(test|spec|stories)\.tsx?$/.test(name)) continue
        const text = readFileSync(path, 'utf8')
        if (/readGoalChanceLicence\(|readGoalChanceRange\(/.test(text)) offenders.push(relative(root, path))
      }
    }
    walk(root)
    // The readers' own module (definitions + their internal helpers) and RunView, nothing else.
    const ALLOWED = ['canvas/runView/runView.ts', 'components/results/utils/goalChanceLicence.ts', 'components/results/utils/goalChanceRange.ts']
    expect(offenders.filter((f) => !ALLOWED.includes(f))).toEqual([])
    expect(offenders).toContain('canvas/runView/runView.ts') // contrast: the probe sees the one real caller
  })
})
