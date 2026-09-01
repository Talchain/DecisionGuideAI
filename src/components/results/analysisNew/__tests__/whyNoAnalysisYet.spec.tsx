/**
 * Analysis (New) — THE PRE-RUN PANEL SAYS WHY NO ANALYSIS HAS RUN.
 *
 * ⚠⚠ THE GAP THIS CLOSES, MEASURED ON DEPLOYED `3595403b` (guest, saved model).
 * Clicking the product's primary button — Run analysis — fired
 * `POST /bff/cee/graph-readiness`, which answered `can_run_analysis: false`
 * with a written `blocker_reason` and five issues each naming a factor and an
 * option. The user was shown NOTHING (positive control in the same probe: a
 * canvas label read TRUE on screen, so the probe could see page text). This
 * panel meanwhile said "No analysis has run yet for this model" and stopped.
 *
 * ⭐ THE PROPERTY UNDER TEST IS PROVENANCE, NOT COPY. Every sentence rendered
 * here is the run gate's own `blockedListing`, and this surface must add no
 * rung, no threshold and no re-wording. So the tests feed a listing and assert
 * the sentences come out VERBATIM — a component that "improved" the producer's
 * text would pass a looser matcher and fail these.
 *
 * ⚠ AND THE ROUTE IS THE GATE'S DECISION, NOT THIS SURFACE'S.
 * `analysisBlockedItems` attaches `scope` only when EXACTLY ONE blocker authored
 * that exact sentence, because a wrong link "looks exactly as authoritative as
 * a correct one". A line that speaks for several blockers therefore arrives
 * WITHOUT a scope and must render inert. That asymmetry is the most important
 * thing here: it is the difference between routing a user to the right node and
 * routing them confidently to an arbitrary one.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { WhyNoAnalysisYet } from '../sections/WhyNoAnalysisYet'
import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { useCanvasStore } from '../../../../canvas/store'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import { openStrategicChallenge } from './analysisNewFixtures'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import type { GateBlockedListing } from '../../../../canvas/utils/canRunAnalysis'

const SCOPED = 'Status Quo: Hold Current Strategy has no effect values yet.'
const UNSCOPED = 'Two options still need values before this can run.'

/** A listing with one routable line and one deliberately unroutable one. */
const listing: GateBlockedListing = {
  summary: `${SCOPED} ${UNSCOPED}`,
  sentences: [
    { text: SCOPED, scope: { id: 'opt_status_quo', label: 'Status Quo: Hold Current Strategy' } },
    { text: UNSCOPED },
  ],
}

afterEach(cleanup)

const draw = (l: GateBlockedListing | null, onFocus = vi.fn()) => {
  render(<WhyNoAnalysisYet listing={l} onFocusTarget={onFocus} />)
  return onFocus
}

describe('THE INSTRUMENT — presence before absence', () => {
  /**
   * ⭐ THE POSITIVE CONTROL. Every "renders nothing" assertion below is vacuous
   * without proof that this component renders SOMETHING for some input
   * (CLAUDE.md trap 13). This is that proof, and it must fail first if the
   * component is ever blinded by a testid rename or a wrapper change.
   */
  it('renders the box when the gate published a refusal', () => {
    draw(listing)
    expect(screen.getByTestId('analysis-new-why-no-analysis')).toBeInTheDocument()
    expect(screen.getAllByTestId('analysis-new-why-no-analysis-item')).toHaveLength(2)
  })
})

describe('the gate speaks, this surface does not', () => {
  it('renders every sentence VERBATIM', () => {
    draw(listing)
    const items = screen.getAllByTestId('analysis-new-why-no-analysis-item')
    // ⚠ Exact, not substring: a re-worded or truncated producer sentence is the
    // defect, and `toHaveTextContent` with a string would accept both.
    expect(items.map((el) => el.textContent)).toEqual([SCOPED, UNSCOPED])
  })

  it('contributes exactly one string of its own — the heading', () => {
    draw(listing)
    expect(screen.getByTestId('analysis-new-why-no-analysis')).toHaveTextContent(
      COPY.whyNoAnalysis.heading,
    )
  })
})

describe('routing follows the gate — including where the gate withheld it', () => {
  it('a scoped line routes to the id the gate attached', () => {
    const onFocus = draw(listing)
    const route = screen.getByTestId('analysis-new-why-no-analysis-route')
    // ⚠ BOUND BY IDENTITY, not by position or by text: another line could
    // satisfy a value predicate, and this must be THIS blocker's node.
    expect(route).toHaveAttribute('data-target-id', 'opt_status_quo')
    fireEvent.click(route)
    expect(onFocus).toHaveBeenCalledWith('opt_status_quo')
  })

  /**
   * ⭐⭐ THE OPPOSITE-DIRECTION TWIN, and the reason it matters. A line standing
   * for several blockers arrives with NO scope. Making it clickable would send
   * the reader to an arbitrary one of them while looking exactly as
   * authoritative as a correct link.
   */
  it('an unscoped line renders but does not route', () => {
    draw(listing)
    const items = screen.getAllByTestId('analysis-new-why-no-analysis-item')
    const unscoped = items.find((el) => el.textContent === UNSCOPED)
    expect(unscoped).toBeDefined()
    expect(unscoped).toHaveAttribute('data-has-route', 'false')
    expect(unscoped!.querySelector('button')).toBeNull()
    // Exactly one route across the whole box — the scoped line's.
    expect(screen.getAllByTestId('analysis-new-why-no-analysis-route')).toHaveLength(1)
  })
})

describe('absence is silence, never a reassurance', () => {
  it('renders nothing when the gate published no refusal', () => {
    draw(null)
    expect(screen.queryByTestId('analysis-new-why-no-analysis')).toBeNull()
  })

  /**
   * ⚠ AN EMPTY LISTING IS NOT AN EMPTY BOX. A heading over no lines reads as a
   * failure to load, and "nothing is blocking this" would be a claim this
   * component never measured.
   */
  it('renders nothing when the listing has no sentences', () => {
    draw({ summary: '', sentences: [] })
    expect(screen.queryByTestId('analysis-new-why-no-analysis')).toBeNull()
  })
})

/**
 * ⭐⭐ MOUNTED, NOT MERELY BUILT — and this is the load-bearing block in the file.
 *
 * This estate's first chronic failure is "we build more than we plug in": 42
 * roadmap items have been working code no user could reach. Every test above
 * would pass on a component that is never rendered by anything. These assert it
 * reaches the panel in the state it was written for, and does NOT reach the
 * state it was not.
 */
describe('MOUNTED IN THE PANEL — pre-run, and only pre-run', () => {
  const previousNodes = { value: [] as unknown }

  beforeEach(() => {
    previousNodes.value = useCanvasStore.getState().nodes
    useCanvasStore.setState({
      nodes: [{ id: 'g1', type: 'goal', data: { label: 'Board wants NRR above 110%' } }],
    } as never)
    useStrengthenStore.setState({ records: {} })
  })
  afterEach(() => {
    useCanvasStore.setState({ nodes: previousNodes.value } as never)
  })

  const renderTab = (isPreRun: boolean, l: GateBlockedListing | null) =>
    render(
      <AnalysisNewTabBody
        resultsSectionData={openStrategicChallenge()}
        isPreRun={isPreRun}
        isRunning={false}
        isStale={false}
        responseHash="run_abc123"
        blockedListing={l}
      />,
    )

  it('the refusal reaches the pre-run panel', () => {
    renderTab(true, listing)
    expect(screen.getByTestId('analysis-new-status-pre-run')).toBeInTheDocument()
    const box = screen.getByTestId('analysis-new-why-no-analysis')
    expect(box).toBeInTheDocument()
    // ⚠ INSIDE the pre-run block, not merely somewhere on the page — the two
    // sentences above it are what this explains, and a box floating elsewhere
    // would be a different design that this test would otherwise bless.
    expect(screen.getByTestId('analysis-new-status-pre-run')).toContainElement(box)
    expect(box).toHaveTextContent(SCOPED)
  })

  /**
   * ⚠ THE OPPOSITE DIRECTION. After a run the panel has real results to show
   * and a refusal box would be describing a gate the reader has already passed.
   * Asserted with the SAME listing, so the only variable is the state.
   */
  it('does not reach the panel once a run is displayed', () => {
    renderTab(false, listing)
    expect(screen.queryByTestId('analysis-new-status-pre-run')).toBeNull()
    expect(screen.queryByTestId('analysis-new-why-no-analysis')).toBeNull()
  })

  /** ⚠ And a panel with no gate result is unchanged — no empty box, no heading. */
  it('a pre-run panel with no gate result is unchanged', () => {
    renderTab(true, null)
    expect(screen.getByTestId('analysis-new-status-pre-run')).toBeInTheDocument()
    expect(screen.queryByTestId('analysis-new-why-no-analysis')).toBeNull()
  })
})

/**
 * ⭐⭐⭐ THE WIRING GUARD — and it is here because every test above would pass on
 * a feature that ships DARK.
 *
 * All ten assertions feed `blockedListing` in by hand. Not one of them can see
 * whether the ONE production caller — `OutputsDock`, which renders this tab and
 * already holds `runGateResult.blockedListing` for the run button — actually
 * passes it. Forget that line and the panel is silent on every real model while
 * the suite stays green: this estate's first chronic failure, "we build more
 * than we plug in", reproduced exactly.
 *
 * So the call site is DERIVED FROM SOURCE at test time rather than remembered.
 * A hand-written note saying "remember to pass the prop" is the trap-12 mirror;
 * a scan that REDs when the prop leaves is not.
 */
describe('THE WIRING — the production caller actually passes it', () => {
  const dockSource = readFileSync(
    resolve(__dirname, '../../../../canvas/components/OutputsDock.tsx'),
    'utf8',
  )

  /** The `<AnalysisNewTabBody …/>` JSX block, extracted from source. */
  const mountBlock = (() => {
    const start = dockSource.indexOf('<AnalysisNewTabBody')
    if (start === -1) return null
    const end = dockSource.indexOf('/>', start)
    return end === -1 ? null : dockSource.slice(start, end + 2)
  })()

  /**
   * ⚠ THE POSITIVE CONTROL, FIRST. A scan that found nothing looks exactly like
   * a scan that found everything it wanted (CLAUDE.md trap 13). If the mount
   * block cannot be located, or a prop known to be there is missing from it,
   * this REDs before the real assertion can pass vacuously.
   */
  it('can locate the mount and see a prop known to be passed', () => {
    expect(mountBlock).not.toBeNull()
    expect(mountBlock!).toContain('resultsSectionData=')
    expect(mountBlock!).toContain('onReanalyse=')
  })

  it('passes blockedListing from the gate result', () => {
    expect(mountBlock!).toContain('blockedListing={runBlockedListing}')
  })

  /**
   * ⚠ AND THAT THE NAME IT PASSES IS THE GATE'S, not a local re-derivation.
   * `runBlockedListing` must still be `runGateResult.blockedListing`; if someone
   * recomputes it in this file the panel becomes a second authority on a
   * refusal, which is the defect `GateBlockedListing` exists to prevent.
   */
  it('and that value is still the gate\'s own published listing', () => {
    expect(dockSource).toContain('const runBlockedListing = runGateResult.blockedListing')
  })
})
