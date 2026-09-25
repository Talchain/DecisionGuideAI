/**
 * ⭐⭐ THE PROVISIONAL ANSWER IS ON THE FIRST SCREEN — V2's three stages, compact.
 *
 * ── THE MEASURED DEFECT ────────────────────────────────────────────────────
 * Served `c5000550`, 24 Sep 2026 16:3xZ, guest, OpenAI path, MRR pricing brief
 * (scenario 342575f9), leader WITHHELD (`constraint_verdict_withheld`), panel
 * 414×769 at a 1440×900 viewport. Offsets from the panel's top:
 *
 *   method strip 16 · amber caveat box 60 (76px) · model strip 152 ·
 *   "Focus now" 334 (108px) · Challenge zone 458 (278px, of which the two
 *   collapsed detail sections are 614–735) · "Move towards commitment" 751 ·
 *   options chart 848 — BELOW the 769px fold.
 *
 * The prototype (`Olumi_Reasoning_Prototype_V2.html`, `reasoningHTML()`) goes
 * check → challenge → commit, with the qualifier one borderless 11px line under
 * the chart: "Provisional · evidence and robustness not established."
 *
 * ── WHAT THIS PINS ─────────────────────────────────────────────────────────
 * 1. Nothing that is DETAIL sits between the challenge and the answer: the
 *    drivers section and the "Focus now" nudges come after the commitment
 *    block. "What would change your mind" is the challenge itself and stays
 *    above it (review 5818389086).
 * 2. No amber caveat box renders above the model; its entries are listed under
 *    About › Limitations instead.
 * 3. One provisional qualifier sits under the chart, before "Record your view",
 *    and every clause in it is a fact the view model already licenses (the
 *    run's input provenance, the evidence check, the robustness verdict).
 *
 * Both the withheld run (what an automatic first run on unconfirmed values will
 * almost always be) and its permitted twin are checked: the answer's position
 * must not depend on how well the run went.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { buildCommitmentQualifier } from '../commitmentQualifier'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import {
  decisionWithLeaderWithheldAndReason,
  genuineDecision,
} from './analysisNewFixtures'

const renderBody = (data: ResultsSectionDataReturn) =>
  render(
    <AnalysisNewTabBody
      resultsSectionData={data}
      isPreRun={false}
      isRunning={false}
      isStale={false}
      responseHash="first_screen"
    />,
  )

const vmOf = (data: ResultsSectionDataReturn) =>
  buildAnalysisNewViewModel({ data, recommendations: [], isPreRun: false, isRunning: false, isStale: false })

/** `a` comes before `b` in document order. */
const precedes = (a: Element, b: Element) =>
  Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

beforeEach(() => {
  useStrengthenStore.setState({ records: {}, priorityOrder: [] } as never)
})
afterEach(() => cleanup())

const BOTH = [
  ['a withheld run', decisionWithLeaderWithheldAndReason],
  ['a permitted run', genuineDecision],
] as const

describe('the provisional answer is on the first screen', () => {
  it('PRECONDITION: the two fixtures differ on the leader licence', () => {
    expect(vmOf(decisionWithLeaderWithheldAndReason()).leaderClaimPermitted).toBe(false)
    expect(vmOf(genuineDecision()).leaderClaimPermitted).toBe(true)
  })

  it.each(BOTH)('no detail section sits between the challenge and the answer — %s', (_n, make) => {
    renderBody(make())
    const challenge = screen.getByTestId('analysis-new-zone-also-group')
    const commitment = screen.getByTestId('analysis-new-commitment')
    const options = screen.getByTestId('analysis-new-options')
    expect(precedes(challenge, commitment), 'challenge, then the answer').toBe(true)
    expect(within(commitment).getByTestId('analysis-new-options')).toBe(options)

    // The drivers detail that used to push the chart below the fold now follows
    // it — bounded: inside the answer zone, never sunk to the foot of the tab.
    const whatMoves = screen.getByTestId('analysis-new-what-moves-the-outcome')
    const answer = screen.getByTestId('analysis-new-zone-answer-group')
    expect(challenge, 'the drivers detail left the challenge zone').not.toContainElement(whatMoves)
    expect(answer, 'it follows the answer, inside the answer zone').toContainElement(whatMoves)
    expect(precedes(commitment, whatMoves), 'after the commitment block').toBe(true)

    // "What would change your mind" is the challenge to the answer: it stays
    // in the challenge zone, above the answer, wherever it renders.
    const sensitivity = screen.queryByTestId('analysis-new-sensitivity')
    if (sensitivity !== null) {
      expect(challenge).toContainElement(sensitivity)
      expect(precedes(sensitivity, commitment), 'the challenge is read before the answer').toBe(true)
    }
    const focus = screen.queryByTestId('analysis-new-zone-focus-group')
    if (focus !== null) {
      expect(precedes(answer, focus), '"Focus now" nudges come after the answer').toBe(true)
    }
  })

  /** The fixture `AnalysisNewTabBody.spec.tsx` uses for the strip: a real engine caveat. */
  const warned = () =>
    ({
      ...genuineDecision(),
      confidence: {
        ...genuineDecision().confidence,
        inferenceWarnings: [
          {
            code: 'ROOT_NODE_DEFAULT_VALUE',
            affected_nodes: ['n_alpha'],
            message: "No observed value provided for root node 'n_alpha'; defaulted to 0.0.",
            severity: 'warning',
          },
        ],
      },
    }) as never

  it('PRECONDITION: the warned fixture carries a caveat the strip would render', () => {
    expect(vmOf(warned()).deeper.caveats.length).toBeGreaterThan(0)
  })

  it('no amber caveat box sits above the model; the caveat is listed under About › Limitations', () => {
    renderBody(warned())
    // At rest: no caveat box anywhere on the tab.
    expect(screen.queryByTestId('inference-warning-strip')).toBeNull()
    expect(screen.queryByTestId('critique-warning-strip')).toBeNull()

    // The caveat is not lost: it is one disclosure away, in About's limitations.
    const about = screen.getByTestId('analysis-new-about')
    fireEvent.click(within(about).getByTestId('analysis-new-about-toggle'))
    fireEvent.click(within(about).getByTestId('analysis-new-about-detail-limitations-toggle'))
    const strip = screen.getByTestId('inference-warning-strip')
    expect(within(about).getByTestId('analysis-new-about-detail-limitations-body')).toContainElement(strip)
  })

  it('the qualifier sits under the chart and before "Record your view", on a withheld run', () => {
    const data = decisionWithLeaderWithheldAndReason()
    const expected = buildCommitmentQualifier(vmOf(data))
    expect(expected, 'the withheld fixture must license a qualifier').not.toBeNull()

    renderBody(data)
    const qualifier = screen.getByTestId('analysis-new-commitment-qualifier')
    const options = screen.getByTestId('analysis-new-options')
    expect(qualifier).toHaveTextContent(expected as string)
    expect(qualifier.textContent).toMatch(/^Provisional · /)
    expect(precedes(options, qualifier), 'the qualifier follows the chart it qualifies').toBe(true)
    const record = screen.queryByTestId('analysis-new-commitment-record')
    if (record !== null) expect(precedes(qualifier, record), 'and precedes the record row').toBe(true)
  })
})

describe('every clause of the qualifier is a fact the view model already states', () => {
  const base = () => vmOf(decisionWithLeaderWithheldAndReason())

  it('names Olumi\'s estimates only when the run\'s inputs were estimated', () => {
    const vm = base()
    const withEstimates = { ...vm, atAGlance: { ...vm.atAGlance, inputProvenance: 'estimated' as const } }
    const withYours = { ...vm, atAGlance: { ...vm.atAGlance, inputProvenance: 'user_supplied' as const } }
    expect(buildCommitmentQualifier(withEstimates)).toMatch(/Olumi's estimates/)
    expect(buildCommitmentQualifier(withYours) ?? '').not.toMatch(/estimates/)
  })

  it('says robustness is not established only when there is no verdict', () => {
    const vm = base()
    const noVerdict = { ...vm, atAGlance: { ...vm.atAGlance, verdict: null } }
    expect(buildCommitmentQualifier(noVerdict)).toMatch(/robustness not established/)
    if (vm.atAGlance.verdict !== null) {
      expect(buildCommitmentQualifier(vm) ?? '').not.toMatch(/robustness not established/)
    }
  })

  it('renders nothing when no clause is licensed', () => {
    const vm = base()
    const settled = {
      ...vm,
      atAGlance: {
        ...vm.atAGlance,
        inputProvenance: 'user_supplied' as const,
        verdict: vm.atAGlance.verdict ?? { label: 'Holds', tone: 'stable' as const },
      },
      checks: {
        ...vm.checks,
        items: vm.checks.items.map((i) => (i.id === 'evidence' ? { ...i, code: 'evidence_none_flagged' as const } : i)),
      },
      deeper: { ...vm.deeper, critiques: [], caveats: [] },
    }
    expect(buildCommitmentQualifier(settled as never)).toBeNull()
  })

  it('counts the engine\'s caveats and points to where they are listed', () => {
    const vm = base()
    const one = { ...vm, deeper: { ...vm.deeper, critiques: [], caveats: [vm.deeper.caveats[0] ?? ({} as never)] } }
    const none = { ...vm, deeper: { ...vm.deeper, critiques: [], caveats: [] } }
    expect(buildCommitmentQualifier(one)).toMatch(/1 caveat in About/)
    expect(buildCommitmentQualifier(none) ?? '').not.toMatch(/caveat/)
  })

  it('renders nothing before a run', () => {
    const vm = base()
    expect(buildCommitmentQualifier({ ...vm, status: { ...vm.status, isPreRun: true } })).toBeNull()
  })
})

/**
 * ⭐ THE TYPED PROVISIONAL MARKER (RC 5818628860; Runtime 5818605567):
 * `analysis_result.enrichment.run_provenance.provisional`. It licenses
 * "Provisional" by itself, so an automatic first run is never unlabelled, and
 * nothing else can license its clause.
 */
describe('the automatic-first-pass clause', () => {
  const settled = () => {
    const vm = vmOf(decisionWithLeaderWithheldAndReason())
    return {
      ...vm,
      atAGlance: { ...vm.atAGlance, inputProvenance: 'user_supplied' as const, verdict: vm.atAGlance.verdict ?? { label: 'Holds', tone: 'stable' as const } },
      checks: { ...vm.checks, items: vm.checks.items.map((i) => (i.id === 'evidence' ? { ...i, code: 'evidence_none_flagged' as const } : i)) },
      deeper: { ...vm.deeper, critiques: [], caveats: [] },
    } as never
  }

  it('PRECONDITION: with no marker the settled run licenses no line', () => {
    expect(buildCommitmentQualifier(settled())).toBeNull()
  })

  it('the marker alone licenses the line, and leads it', () => {
    expect(buildCommitmentQualifier(settled(), { runProvisional: true })).toBe('Provisional · automatic first pass')
    const full = buildCommitmentQualifier(vmOf(decisionWithLeaderWithheldAndReason()), { runProvisional: true }) ?? ''
    expect(full).toMatch(/^Provisional · automatic first pass · /)
  })

  it('CONTRAST: an explicit or unmarked run never says "automatic"', () => {
    expect(buildCommitmentQualifier(vmOf(decisionWithLeaderWithheldAndReason()), { runProvisional: false }) ?? '').not.toMatch(/automatic/)
    expect(buildCommitmentQualifier(vmOf(decisionWithLeaderWithheldAndReason())) ?? '').not.toMatch(/automatic/)
  })

  it('pre-run: nothing, marker or not', () => {
    const vm = vmOf(decisionWithLeaderWithheldAndReason())
    expect(buildCommitmentQualifier({ ...vm, status: { ...vm.status, isPreRun: true } }, { runProvisional: true })).toBeNull()
  })
})

describe('the marker, read from the stored report, reaches the qualifier on the tab', () => {
  it('a report stamped provisional leads the qualifier with "automatic first pass"', async () => {
    const { useCanvasStore } = await import('../../../../canvas/store')
    const previous = useCanvasStore.getState().results
    useCanvasStore.setState({ results: { ...previous, report: { run_provenance: { initiated_by: 'auto_post_construction', provisional: true } } } } as never)
    try {
      renderBody(decisionWithLeaderWithheldAndReason())
      expect(screen.getByTestId('analysis-new-commitment-qualifier').textContent).toMatch(/^Provisional · automatic first pass/)
    } finally {
      useCanvasStore.setState({ results: previous } as never)
    }
  })

  it('CONTRAST: an unstamped report never says "automatic"', () => {
    renderBody(decisionWithLeaderWithheldAndReason())
    expect(screen.getByTestId('analysis-new-commitment-qualifier').textContent ?? '').not.toMatch(/automatic/)
  })
})
