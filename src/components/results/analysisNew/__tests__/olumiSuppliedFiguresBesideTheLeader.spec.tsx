/**
 * MC P0's disclosure for a KEPT leader (DL fa027 ruling, e8 next row): the finding rests on a deciding link whose
 * figures Olumi supplied (`GOAL_FIGURES_OLUMI_SUPPLIED_LINK`, severity `info`, `node_ids` = the first link, `links` =
 * every one). The Analysis tab says it directly under the finding line, in Science d5's words, never behind a
 * disclosure; a Run without the warning says nothing new.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { AtAGlance } from '../sections/AtAGlance'
import { OLUMI_SUPPLIED_LINK_CODE, olumiSuppliedFiguresDisclosure } from '../analysisNewCopy'
import { genuineDecision } from './analysisNewFixtures'
import { readGoalIdentityWithheld } from '../../utils/goalIdentityWithheld'

const LABELS = new Map([
  ['subscribers', 'Subscribers'], ['revenue', 'Revenue'], ['churn', 'Churn'], ['price', 'Price'],
  ['margin', 'Margin'], ['demand', 'Demand'], ['cost', 'Cost'],
])
const labelOf = (id: string) => LABELS.get(id) ?? null
const supplied = (links: Array<[string, string]>, extra: Record<string, unknown> = {}) => ({
  code: OLUMI_SUPPLIED_LINK_CODE, severity: 'info', message: 'Not shown.',
  node_ids: links[0] ? [...links[0]] : [], links: links.map(([from, to]) => ({ from, to })), ...extra,
})

const ONE = 'Olumi supplied the figures for the link from ‘Subscribers’ to ‘Revenue’. Set your own to see how much it matters.'
const TWO = 'Olumi supplied the figures for the links from ‘Subscribers’ to ‘Revenue’ and from ‘Churn’ to ‘Revenue’. Set your own to see how much they matter.'
const FIVE = 'Olumi supplied the figures for the links from ‘Subscribers’ to ‘Revenue’, from ‘Churn’ to ‘Revenue’, from ‘Price’ to ‘Demand’ and 2 more. Set your own to see how much they matter.'
const UNNAMED = 'Olumi supplied the figures for at least one link this finding rests on. Set your own to see how much it matters.'
const TID = 'analysis-new-glance-olumi-supplied-figures'

const glanceFor = (warnings: unknown[] | undefined, withhold = false) => {
  const data = genuineDecision()
  data.confidence = { ...(data.confidence ?? {}), inferenceWarnings: warnings } as never
  if (withhold) data.recommendation.leaderDesignationPermitted = false as never
  return buildAnalysisNewViewModel({
    data, recommendations: [], isPreRun: false, isRunning: false, isStale: false, nodeLabels: LABELS,
  }).atAGlance
}
const mount = (warnings: unknown[] | undefined, withhold = false) =>
  render(<AtAGlance reanalyseBlocked={false} isRunning={false} reanalyseBlockedReason={null} glance={glanceFor(warnings, withhold)} />)

afterEach(cleanup)

describe('d5\'s words, verbatim', () => {
  it.each([
    ['one link', [['subscribers', 'revenue']], ONE],
    ['two links', [['subscribers', 'revenue'], ['churn', 'revenue']], TWO],
    ['five links: three named, then "and 2 more"', [['subscribers', 'revenue'], ['churn', 'revenue'], ['price', 'demand'], ['margin', 'revenue'], ['cost', 'margin']], FIVE],
    ['an end with no label: the label-free line, never omitted', [['subscribers', 'node_without_a_label']], UNNAMED],
    ['only the first link nameable: label-free (the disclosure has no count form)', [['subscribers', 'revenue'], ['churn', 'node_without_a_label']], UNNAMED],
    ['a link counted in "and N more" needs no labels: the three shown are named', [['subscribers', 'revenue'], ['churn', 'revenue'], ['price', 'demand'], ['margin', 'node_without_a_label']], 'Olumi supplied the figures for the links from ‘Subscribers’ to ‘Revenue’, from ‘Churn’ to ‘Revenue’, from ‘Price’ to ‘Demand’ and 1 more. Set your own to see how much they matter.'],
  ] as const)('%s', (_n, links, words) => {
    expect(olumiSuppliedFiguresDisclosure([supplied(links.map(l => [...l] as [string, string]))], labelOf)).toBe(words)
  })
  it('no `links` (an older carrier): node_ids[0] → node_ids[1]', () => {
    expect(olumiSuppliedFiguresDisclosure([{ ...supplied([['subscribers', 'revenue']]), links: undefined }], labelOf)).toBe(ONE)
  })
  it('the warning with neither `links` nor two node ids: still said, label-free', () => {
    expect(olumiSuppliedFiguresDisclosure([{ code: OLUMI_SUPPLIED_LINK_CODE, severity: 'info' }], labelOf)).toBe(UNNAMED)
  })
  it('duplicate links are said once', () => {
    expect(olumiSuppliedFiguresDisclosure([supplied([['subscribers', 'revenue'], ['subscribers', 'revenue']])], labelOf)).toBe(ONE)
  })
  it('⭐ a DISCLOSURE, not a withhold: the goal figures stay shown (it is not in GOAL_FIGURES_WITHHELD_CODES)', () => {
    expect(readGoalIdentityWithheld({ inference_warnings: [supplied([['subscribers', 'revenue']])] })).toBeNull()
    // contrast: the unsized-path warning with the same links DOES withhold them
    expect(readGoalIdentityWithheld({ inference_warnings: [{ ...supplied([['subscribers', 'revenue']]), code: 'GOAL_FIGURES_PLACEHOLDER_PATH', message: 'Not shown. x' }] })).not.toBeNull()
  })
  it('CONTROL — only its own code: the unsized-path warning, same links, says nothing here', () => {
    expect(olumiSuppliedFiguresDisclosure([{ ...supplied([['subscribers', 'revenue']]), code: 'GOAL_FIGURES_PLACEHOLDER_PATH' }], labelOf)).toBeNull()
    expect(olumiSuppliedFiguresDisclosure(undefined, labelOf)).toBeNull()
  })
})

describe('the Analysis tab, beside the leader\'s finding line', () => {
  it('⭐ fa027-shape (a kept leader resting on an Olumi-supplied link): the disclosure is visible directly under the finding line', () => {
    mount([supplied([['subscribers', 'revenue']])])
    const verdict = screen.getByTestId('analysis-new-glance-verdict')
    expect(within(verdict).getByTestId('analysis-new-glance-win-share')).toBeInTheDocument() // PRECONDITION: the finding line is on screen
    const line = within(verdict).getByTestId(TID)
    expect(line).toHaveTextContent(ONE)
    expect(line.closest('details, [hidden], [aria-hidden="true"]')).toBeNull() // never behind a disclosure
  })
  it('⭐ every Olumi-supplied deciding link, named', () => {
    mount([supplied([['subscribers', 'revenue'], ['churn', 'revenue']])])
    expect(screen.getByTestId(TID)).toHaveTextContent(TWO)
  })
  it('⭐ an info warning among the Run\'s others still reaches the line (not filtered as `info`)', () => {
    mount([{ code: 'SOME_OTHER_WARNING', severity: 'warning', message: 'x' }, supplied([['subscribers', 'revenue']])])
    expect(screen.getByTestId(TID)).toHaveTextContent(ONE)
  })
  it('CONTROL — no Olumi-supplied deciding link: absent, and the finding line is unchanged', () => {
    mount(undefined)
    expect(screen.getByTestId('analysis-new-glance-win-share')).toBeInTheDocument()
    expect(screen.queryByTestId(TID)).toBeNull()
  })
  it('CONTROL — the leader is withheld: absent (the withhold says why; no leader finding to qualify)', () => {
    const glance = glanceFor([supplied([['subscribers', 'revenue']])], true)
    expect(glance.headline).toBeNull() // PRECONDITION: no leader is named
    expect(glance.olumiSuppliedFigures).toBeNull()
  })
})
