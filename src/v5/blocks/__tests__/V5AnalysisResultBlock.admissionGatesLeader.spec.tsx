/**
 * V5AnalysisResultBlock — the leader treatment must ask Q1 as well as Q2.
 *
 * ## What this card already asks, and what it never did
 *
 * ROADMAP 1.267 wired this card to `deriveDecisionVerdict` so the leader hoist,
 * the `data-leader` attribute and the heavier border stopped firing on a
 * producer NEAR-TIE. That closed Q2 — *did THIS RESULT separate the arms?*
 *
 * It never asked Q1 — *does the MODEL license a comparative-leader claim at
 * all?*, which CEE answers on `analysis_ready.analysis_admission
 * .permitted_analysis_mode`. So on a run where the arms separated cleanly but
 * CEE admitted the model only at `exploratory` (or refused at `none`), this
 * card hoists an option to first position, tags it `data-leader="true"` and
 * gives it a heavier border, while `useResultsSectionData` — reading the SAME
 * two questions, composed — withholds every designation on the results panel.
 *
 * `licensesComparativeLeaderClaim` is the one reader of Q1 in this codebase and
 * it already lives in `canvas/hooks/useAnalysisReady`; the results panel
 * imports it from there. This card now does the same. There is deliberately no
 * second spelling of the question.
 *
 * ## The anti-vacuity requirement this file inherits
 *
 * Q2 must be TRUE in every fixture below, or the withheld arms would pass
 * because the verdict refused rather than because admission did — the file
 * would be green and pin nothing. That precondition is asserted, not assumed.
 *
 * Every refusal arm has a PERMITTED twin: over-suppression is an equal failure.
 *
 * ## Scope (CLAUDE.md trap 3)
 *
 * jsdom proves DOM order, attributes and text. The border weight is asserted as
 * a class, which proves what the component emits, not what a browser paints.
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import { V5AnalysisResultBlock } from '../V5AnalysisResultBlock'
import { buildV5VerdictReportLike } from '../../mapV5AnalysisToReport'
import { deriveDecisionVerdict } from '../../../lib/decisionVerdict'
import { useCanvasStore } from '../../../canvas/store'
import type { V5AnalysisResultBlock as V5AnalysisResultBlockType } from '../../../canvas/conversation/types'
import type { AnalysisAdmissionV1 } from '../../../adapters/cee/types'

afterEach(cleanup)

const MAC = 'Standardise on MacBook Pro'
const DELL = 'Standardise on Dell XPS'
const STATUS_QUO = 'Defer and Keep Current Machines (Status Quo)'

/** Label-keyed win_probabilities — the real staging shape. */
const WIN_PROBABILITIES: Record<string, number> = {
  [MAC]: 0.4276666666666667,
  [DELL]: 0.32341666666666663,
  [STATUS_QUO]: 0.24891666666666665,
}

function optionComparison(): Array<Record<string, unknown>> {
  return [
    { id: 'opt_dell', option_id: 'opt_dell', label: DELL, option_label: DELL, win_probability: 0.32341666666666663 },
    { id: 'opt_mac', option_id: 'opt_mac', label: MAC, option_label: MAC, win_probability: 0.4276666666666667 },
    { id: 'opt_status_quo', option_id: 'opt_status_quo', label: STATUS_QUO, option_label: STATUS_QUO, win_probability: 0.24891666666666665 },
  ]
}

/** A CLEARLY SEPARATED run: Q2 is true, so only Q1 can withhold below. */
function separatedBlock(): V5AnalysisResultBlockType {
  return {
    type: 'v5_analysis_result',
    summary: 'MacBook Pro leads on total cost of ownership.',
    leading_option_id: 'opt_mac',
    win_probabilities: WIN_PROBABILITIES,
    enrichment: {
      option_comparison: optionComparison(),
      robustness: {
        near_tie: { is_tie: false, top_option_id: 'opt_mac', second_option_id: 'opt_dell', gap: 0.104, threshold: 0.1 },
      },
    },
  } as V5AnalysisResultBlockType
}

const ADMISSION_WITHHELD: AnalysisAdmissionV1 = {
  permitted_analysis_mode: 'none',
  reasons: [{ field: 'estimates', message: 'Every estimate here is machine-invented.' }],
}
/** A refusal of the COMPARATIVE claim that is not `none` — `!== "none"` leaks here. */
const ADMISSION_EXPLORATORY: AnalysisAdmissionV1 = {
  permitted_analysis_mode: 'exploratory',
  reasons: [{ field: 'evidence', message: 'Not enough evidence to rank these.' }],
}
const ADMISSION_PERMITTED: AnalysisAdmissionV1 = {
  permitted_analysis_mode: 'comparative_leader',
  reasons: [],
}

function setAdmission(admission: AnalysisAdmissionV1 | undefined) {
  useCanvasStore.setState({
    ceeAnalysisReady: admission
      ? { status: 'ready', options: [], goal_node_id: 'goal_1', analysis_admission: admission }
      : null,
  } as never)
}

const pills = (): HTMLElement[] =>
  within(screen.getByTestId('v5-analysis-result-probabilities')).getAllByRole('listitem')
const leaderPills = (): HTMLElement[] =>
  pills().filter((p) => p.getAttribute('data-leader') === 'true')

beforeEach(() => {
  setAdmission(undefined)
})

describe('the fixture isolates Q1 — Q2 is true throughout', () => {
  it('ANTI-VACUITY: the shared verdict PERMITS on this block', () => {
    // Without this, a withheld assertion below could pass because the verdict
    // refused (Q2) rather than because admission did (Q1), and the file would
    // be green while pinning nothing about admission at all.
    expect(deriveDecisionVerdict(buildV5VerdictReportLike(separatedBlock())).hasLeadingOption).toBe(true)
  })

  it('ANTI-VACUITY: the leader id is present, so the WHO resolver is not the thing suppressing', () => {
    expect(separatedBlock().leading_option_id).toBe('opt_mac')
  })
})

describe('V5AnalysisResultBlock leader treatment — Q1 gates it', () => {
  it('ARM A — no admission at all: today’s behaviour, byte for byte', () => {
    setAdmission(undefined)
    render(<V5AnalysisResultBlock block={separatedBlock()} />)
    expect(leaderPills()).toHaveLength(1)
    expect(leaderPills()[0].textContent ?? '').toContain(MAC)
  })

  it('ARM B — permitted: the leader is still marked (over-suppression control)', () => {
    setAdmission(ADMISSION_PERMITTED)
    render(<V5AnalysisResultBlock block={separatedBlock()} />)
    expect(leaderPills()).toHaveLength(1)
    expect(leaderPills()[0].textContent ?? '').toContain(MAC)
  })

  it('⭐ ARM C — refused (`none`): no pill is marked leader', () => {
    setAdmission(ADMISSION_WITHHELD)
    render(<V5AnalysisResultBlock block={separatedBlock()} />)
    expect(
      leaderPills(),
      'CEE refused a comparative claim on this model and the card crowned an option anyway',
    ).toHaveLength(0)
  })

  it('⭐ ARM C2 — refused (`exploratory`): no pill is marked leader either', () => {
    setAdmission(ADMISSION_EXPLORATORY)
    render(<V5AnalysisResultBlock block={separatedBlock()} />)
    expect(leaderPills()).toHaveLength(0)
  })

  it('⭐ ARM C — refused: no pill carries the heavier leader border', () => {
    setAdmission(ADMISSION_WITHHELD)
    render(<V5AnalysisResultBlock block={separatedBlock()} />)
    for (const pill of pills()) {
      expect(pill.className).toContain('border-option/30')
      expect(pill.className).not.toContain('border-option/50')
    }
  })

  it('⭐ ARM C — refused: the leader is not HOISTED to first position', () => {
    // The hoist is a designation in its own right: it promotes one option above
    // its own number. What stays is the probability-descending tail, which
    // restates a fact already on screen.
    setAdmission(ADMISSION_WITHHELD)
    render(<V5AnalysisResultBlock block={separatedBlock()} />)
    const order = pills().map((p) => p.textContent ?? '')
    // Descending by probability: MAC 43% still happens to be first here, so the
    // assertion that discriminates is the ATTRIBUTE, not the order. Pinned as
    // the data order rather than as "not first", which would be false for the
    // wrong reason.
    expect(order[0]).toContain(MAC)
    expect(order[1]).toContain(DELL)
    expect(order[2]).toContain(STATUS_QUO)
    expect(leaderPills()).toHaveLength(0)
  })

  it('DATA PRESERVED on a refused run — the CLAIM is withheld, never the numbers', () => {
    setAdmission(ADMISSION_WITHHELD)
    render(<V5AnalysisResultBlock block={separatedBlock()} />)
    const rendered = pills()
    expect(rendered).toHaveLength(3)
    expect(rendered.map((p) => p.textContent)).toEqual([
      expect.stringContaining('43%'),
      expect.stringContaining('32%'),
      expect.stringContaining('25%'),
    ])
  })

  it('the card still renders on a refused run — the absence assertions are not vacuous', () => {
    setAdmission(ADMISSION_WITHHELD)
    render(<V5AnalysisResultBlock block={separatedBlock()} />)
    expect(screen.getByTestId('v5-analysis-result-probabilities')).toBeDefined()
  })
})
