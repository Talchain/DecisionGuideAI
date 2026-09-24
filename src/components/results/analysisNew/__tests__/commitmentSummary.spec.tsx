/**
 * ⭐ "MOVE TOWARDS COMMITMENT" — the rendered zone.
 *
 * The bullet RULES are pinned in `commitmentSynthesis.spec.ts`. This file pins
 * what the component does with them: it renders exactly the bullets it is
 * handed, nothing pre-run, the stale marker once, the chart slot where the
 * lead will put it, and the EXISTING decision record as the user's view.
 *
 * The withheld-leader arm runs end to end through the real view-model builder,
 * so "no winner wording anywhere" is a claim about what this zone actually
 * renders on that run, with a contrast control proving the probe can fire.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CommitmentSummary, type CommitmentSummaryProps } from '../sections/CommitmentSummary'
import { buildAnalysisNewViewModel, type AnalysisNewViewModelInputs } from '../buildAnalysisNewViewModel'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import {
  buildCommitmentSynthesis,
  commitmentAskContext,
  COMMITMENT_COPY,
  type CommitmentSynthesis,
} from '../commitmentSynthesis'
import { recordedOptionText, storageSentenceFor } from '../sections/DecisionRecorded'
import {
  decisionWithLeaderWithheld,
  decisionWithLeaderWithheldAndReason,
  genuineDecision,
} from './analysisNewFixtures'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import type { Recommendation } from '../../strengthen/strengthenTypes'
import type { DecisionRecord } from '../../modals'

afterEach(cleanup)

const TID = 'analysis-new-commitment'

/** The winner / recommendation vocabulary the brief bans on a withheld run. */
const WINNER = /best|winner|recommend|lead(s|ing) option/i

const rec = (over: Partial<Recommendation> & { id: string }): Recommendation =>
  ({
    helpType: 'clarify',
    title: 'Define what success looks like',
    signal: 'No measurable success target is set.',
    whyNow: 'Without a target the analysis cannot say how likely each option is to succeed.',
    tryThis: null,
    sourceLine: 'Source: your goal has no success threshold (checked directly).',
    action: { kind: 'ai-dialogue', label: 'Work through this', prompt: 'p' },
    targetId: null,
    priority: 0,
    ...over,
  }) as Recommendation

const vmOf = (data: ResultsSectionDataReturn, over: Partial<AnalysisNewViewModelInputs> = {}) =>
  buildAnalysisNewViewModel({
    data,
    recommendations: [rec({ id: 'r1' })],
    isPreRun: false,
    isRunning: false,
    isStale: false,
    ...over,
  })

const FULL: CommitmentSynthesis = {
  describesLastRun: false,
  staleKind: null,
  founded: { text: 'In this model, Segment is most likely on both readings of this run.', source: 'implication_aligned_lead' },
  open: { text: COPY.checks.robustness_not_assessed.meaning, source: 'robustness' },
  before: { text: 'Define what success looks like', source: 'intervention' },
}
const EMPTY: CommitmentSynthesis = { describesLastRun: false, staleKind: null, founded: null, open: null, before: null }

const RECORD: DecisionRecord = {
  optionId: 'opt_b',
  optionLabel: 'Raise price',
  optionNumber: null,
  confidence: 70,
  expectation: 'Margin rises by about three points.',
  rationale: '   ',
  assumptionToWatch: 'Churn stays flat.',
  revisitTrigger: 'If churn passes 4%.',
  analysisHash: null,
  savedAt: Date.UTC(2026, 8, 24, 12),
  remote: null,
}

function renderZone(over: Partial<CommitmentSummaryProps> = {}) {
  const props: CommitmentSummaryProps = {
    synthesis: FULL,
    isPreRun: false,
    canCapture: true,
    record: null,
    onRecord: vi.fn(),
    onAsk: vi.fn(),
    ...over,
  }
  return { props, ...render(<CommitmentSummary {...props} />) }
}

/** Every string a reader or a screen reader meets: text plus accessible names. */
function everythingSaid(root: HTMLElement): string {
  const labels = Array.from(root.querySelectorAll('[aria-label]')).map((e) => e.getAttribute('aria-label') ?? '')
  return `${root.textContent ?? ''}\n${labels.join('\n')}`
}

// ═══════════════════════════════════════════════════════════════════════════

describe('pre-run: nothing at all', () => {
  it('renders nothing pre-run, even with a record, a capture and a chart to show', () => {
    const { container } = renderZone({ isPreRun: true, record: RECORD, children: <div>chart</div> })
    expect(container).toBeEmptyDOMElement()
  })

  it('CONTRAST: the same props post-run render the zone', () => {
    renderZone({ record: RECORD, children: <div>chart</div> })
    expect(screen.getByTestId(TID)).toBeInTheDocument()
  })

  it('end to end: a pre-run view model renders nothing', () => {
    const vm = vmOf(genuineDecision(), { isPreRun: true })
    const { container } = renderZone({ synthesis: buildCommitmentSynthesis(vm), isPreRun: vm.status.isPreRun })
    expect(container).toBeEmptyDOMElement()
  })
})

describe('the bullets', () => {
  it('renders each bullet with its label and the builder text, verbatim, in order', () => {
    renderZone()
    for (const key of ['founded', 'open', 'before'] as const) {
      const li = screen.getByTestId(`${TID}-${key}`)
      expect(li).toHaveAttribute('data-source', FULL[key]!.source)
      expect(screen.getByTestId(`${TID}-${key}-text`).textContent).toBe(FULL[key]!.text)
      expect(li.textContent).toBe(`${COMMITMENT_COPY.labels[key]}: ${FULL[key]!.text}`)
    }
    const order = Array.from(screen.getByTestId(`${TID}-synthesis`).querySelectorAll('li')).map((l) =>
      l.getAttribute('data-testid'),
    )
    expect(order).toEqual([`${TID}-founded`, `${TID}-open`, `${TID}-before`])
  })

  it('a null bullet renders no row (and the others still do)', () => {
    renderZone({ synthesis: { ...FULL, open: null } })
    expect(screen.queryByTestId(`${TID}-open`)).toBeNull()
    expect(screen.getByTestId(`${TID}-founded`)).toBeInTheDocument()
    expect(screen.getByTestId(`${TID}-before`)).toBeInTheDocument()
  })

  it('all three empty → no bullet block at all', () => {
    renderZone({ synthesis: EMPTY })
    expect(screen.queryByTestId(`${TID}-synthesis`)).toBeNull()
  })

  it('all three empty, no record, no capture, no chart → the zone renders nothing', () => {
    const { container } = renderZone({ synthesis: EMPTY, canCapture: false, record: null })
    expect(container).toBeEmptyDOMElement()
  })

  it('CONTRAST: the same empty zone with a capture to offer renders the door only', () => {
    renderZone({ synthesis: EMPTY, canCapture: true, record: null })
    expect(screen.getByTestId(`${TID}-record-open`)).toBeInTheDocument()
    expect(screen.queryByTestId(`${TID}-synthesis`)).toBeNull()
  })
})

describe('⛔ a withheld-leader run: no winner wording anywhere', () => {
  it('PRECONDITION: the probe fires on the words it bans', () => {
    expect(WINNER.test('Raise price is the leading option')).toBe(true)
    expect(WINNER.test('Raise price leads option ranking')).toBe(true)
    expect(WINNER.test('We recommend Raise price')).toBe(true)
  })

  for (const [name, make] of [
    ['decisionWithLeaderWithheld', decisionWithLeaderWithheld],
    ['decisionWithLeaderWithheldAndReason', decisionWithLeaderWithheldAndReason],
  ] as const) {
    it(`${name}: the zone says only what the run licenses`, () => {
      const data: ResultsSectionDataReturn = {
        ...make(),
        // A found threshold rides the wire on this run too; it must not leak.
        recommendation: {
          ...make().recommendation,
          flipThresholds: [
            {
              label: 'Price elasticity',
              current_value: 0.6,
              flip_value: 0.9,
              alternative_winner_label: 'Hold price',
              flip_reason: 'found',
              unit: '',
            },
          ],
        } as ResultsSectionDataReturn['recommendation'],
      }
      const vm = vmOf(data, { producerLeaderWithholdReason: 'separation_unavailable' })
      expect(vm.leaderClaimPermitted).toBe(false)
      expect(vm.sensitivity.tippingPoints.length).toBe(1)

      renderZone({
        synthesis: buildCommitmentSynthesis(vm),
        isPreRun: vm.status.isPreRun,
        record: RECORD,
        onCompare: vi.fn(),
      })
      const said = everythingSaid(screen.getByTestId(TID))

      // The probe read real content: the withhold cause is on screen.
      expect(screen.getByTestId(`${TID}-open-text`).textContent).toBe(vm.checks.leaderWithholdCause)
      expect(said).toContain(vm.checks.leaderWithholdCause!)
      // …and none of the banned vocabulary, nor the threshold that implies a leader.
      expect(said).not.toMatch(WINNER)
      expect(said).not.toContain('Hold price')
      expect(screen.queryByTestId(`${TID}-founded`)).toBeNull()
    })
  }

  it('on the PERMITTED twin the threshold is still not restated here: the Challenge signals row owns it', () => {
    const base = genuineDecision()
    const data = {
      ...base,
      recommendation: {
        ...base.recommendation,
        flipThresholds: [
          { label: 'Price elasticity', current_value: 0.6, flip_value: 0.9, alternative_winner_label: 'Hold price', flip_reason: 'found', unit: '' },
        ],
      },
    } as ResultsSectionDataReturn
    const vm = vmOf(data)
    renderZone({ synthesis: buildCommitmentSynthesis(vm) })
    // One owner for the tipping sentence: this zone never repeats it.
    expect(screen.queryByTestId(`${TID}-open`)?.getAttribute('data-source') ?? '').not.toBe('tipping_point')
    expect(screen.queryByTestId(`${TID}-open-text`)?.textContent ?? '').not.toContain('Hold price')
  })
})

describe('stale: the bullets say they describe the last run', () => {
  it('adds NO freshness marker of its own (the glance ribbon owns it) and puts the re-run words in bullet 3', () => {
    const vm = vmOf(genuineDecision(), { isStale: true, staleReason: 'changed' })
    renderZone({ synthesis: buildCommitmentSynthesis(vm) })
    expect(screen.queryByTestId(`${TID}-stale`)).toBeNull()
    expect(screen.queryByText(COPY.markers.stale)).toBeNull()
    expect(screen.getByTestId(`${TID}-before-text`).textContent).toBe(COPY.status.reanalyseToBeSure)
  })

  it('CONTRAST: a fresh run carries no marker and names the review item', () => {
    const vm = vmOf(genuineDecision())
    renderZone({ synthesis: buildCommitmentSynthesis(vm) })
    expect(screen.queryByTestId(`${TID}-stale`)).toBeNull()
    expect(screen.getByTestId(`${TID}-before-text`).textContent).toBe('Define what success looks like')
  })
})

describe('record your view — the existing decision record', () => {
  it('no record + a capture to offer → the door; it opens the existing modal route', () => {
    const onRecord = vi.fn()
    renderZone({ onRecord })
    const door = screen.getByTestId(`${TID}-record-open`)
    expect(door.textContent).toBe(COMMITMENT_COPY.record.open)
    fireEvent.click(door)
    expect(onRecord).toHaveBeenCalledTimes(1)
  })

  it('no record + no capture → no door (the modal would open disabled)', () => {
    renderZone({ canCapture: false })
    expect(screen.queryByTestId(`${TID}-record`)).toBeNull()
  })

  /**
   * ⭐ V2 FIDELITY (24 Sep 2026, re-pointed for gap 21): TRIMMED TO TWO LINES.
   * WAS up to six `dt`/`dd` rows (option, confidence, expectation, rationale,
   * assumption, revisit) — the prototype's own read-back (`positionHTML()`)
   * shows only "Your view" and "Revisit when" plus a storage sentence, and
   * every field this test used to find in the resting read-back is still on
   * `DecisionRecord`, still true, and still reachable via "Update" — nothing
   * here narrows what can be captured, only what shows without a click.
   */
  it('a record reads back compactly, as the user\'s view — option and revisit only', () => {
    renderZone({ record: RECORD })
    expect(screen.getByTestId(`${TID}-record-title`).textContent).toBe(COMMITMENT_COPY.record.recorded)
    expect(screen.getByTestId(`${TID}-record-option`).textContent).toBe(
      `${COMMITMENT_COPY.record.optionLabel}: ${recordedOptionText(RECORD)}`,
    )
    expect(screen.getByTestId(`${TID}-record-revisit`).textContent).toContain(RECORD.revisitTrigger)
    // ⛔ TRIMMED FROM THE RESTING READ-BACK (gap 21), not merely blank: these
    // never render here now, however the record is populated. `RECORD` (below)
    // carries a real confidence and assumption, so their absence here is the
    // trim, not the pre-existing "blank fields withheld" rule.
    expect(screen.queryByTestId(`${TID}-record-confidence`)).toBeNull()
    expect(screen.queryByTestId(`${TID}-record-expectation`)).toBeNull()
    expect(screen.queryByTestId(`${TID}-record-assumption`)).toBeNull()
    expect(screen.queryByTestId(`${TID}-record-rationale`)).toBeNull()
    expect(screen.getByTestId(`${TID}-record-storage`).textContent).toContain(storageSentenceFor(RECORD))
    // Never an Olumi decision.
    expect(screen.getByTestId(`${TID}-record`).textContent).not.toMatch(/olumi|recommend|decided/i)
  })

  /**
   * ⛔ V2 FIDELITY (gap 21): RE-POINTED. The rationale row (and its siblings)
   * left the resting read-back regardless of whether it is blank — this now
   * proves the NEGATIVE for a non-blank rationale too, which the trimmed
   * component does not special-case: `Update` is the only route to it.
   */
  it('CONTRAST: even a non-blank rationale does not get a resting row — it is one click away via Update', () => {
    renderZone({ record: { ...RECORD, rationale: 'Pricing power is proven in two regions.' }, canCapture: true })
    expect(screen.queryByTestId(`${TID}-record-rationale`)).toBeNull()
    expect(screen.getByTestId(`${TID}-record-update`)).toBeInTheDocument()
  })

  it('the update control follows `canCapture`; the read-back does not', () => {
    renderZone({ record: RECORD, canCapture: false })
    expect(screen.getByTestId(`${TID}-record-title`)).toBeInTheDocument()
    expect(screen.queryByTestId(`${TID}-record-update`)).toBeNull()
    cleanup()
    const onRecord = vi.fn()
    renderZone({ record: RECORD, canCapture: true, onRecord })
    fireEvent.click(screen.getByTestId(`${TID}-record-update`))
    expect(onRecord).toHaveBeenCalledTimes(1)
  })
})

describe('the header acts', () => {
  it('the AI icon asks Olumi what remains, carrying exactly what is on screen', () => {
    const onAsk = vi.fn()
    renderZone({ onAsk })
    const ask = screen.getByTestId(`${TID}-ask`)
    expect(ask).toHaveAttribute('data-ai', 'true')
    expect(ask).toHaveAttribute('aria-label', COMMITMENT_COPY.ask.label)
    fireEvent.click(ask)
    expect(onAsk).toHaveBeenCalledWith({
      label: COMMITMENT_COPY.ask.label,
      draft: COMMITMENT_COPY.ask.draft,
      context: commitmentAskContext(FULL),
    })
  })

  /* ⛔ NO PLACEHOLDER ACT. The agreed rule (ChatGPT review on #63, 5806411059):
     render Compare only when a real route exists. No path passes one today, and
     the OpenAI lane sends no `run_delta`, so a greyed icon was the only
     "comparison" a reader met after a re-run, and it could never act. */
  it('no compare control at all when no route is supplied', () => {
    renderZone()
    expect(screen.queryByTestId(`${TID}-compare`)).toBeNull()
    const header = screen.getByTestId(TID).firstElementChild as HTMLElement
    expect(header.querySelectorAll('button:disabled').length, 'no disabled act on the header row').toBe(0)
  })

  it('CONTRAST: with a route, compare is enabled and calls it', () => {
    const onCompare = vi.fn()
    renderZone({ onCompare })
    const cmp = screen.getByTestId(`${TID}-compare`)
    expect(cmp).toBeEnabled()
    expect(cmp).toHaveAttribute('aria-label', COMMITMENT_COPY.compare.label)
    fireEvent.click(cmp)
    expect(onCompare).toHaveBeenCalledTimes(1)
  })

  it('at most three icon acts on the header row', () => {
    renderZone({ onCompare: vi.fn() })
    const header = screen.getByTestId(TID).firstElementChild as HTMLElement
    expect(header.querySelectorAll('button').length).toBeLessThanOrEqual(3)
  })
})

describe('the chart slot', () => {
  it('renders the children between the bullets and the record row', () => {
    renderZone({ record: RECORD, children: <div data-testid="the-chart">chart</div> })
    const synthesis = screen.getByTestId(`${TID}-synthesis`)
    const chart = screen.getByTestId('the-chart')
    const record = screen.getByTestId(`${TID}-record`)
    expect(synthesis.compareDocumentPosition(chart) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(chart.compareDocumentPosition(record) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('CONTRAST: no children, no slot', () => {
    renderZone()
    expect(screen.queryByTestId(`${TID}-slot`)).toBeNull()
  })
})
