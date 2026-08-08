/**
 * Lane 3 Car 1 residual (P1/P4) — a WARNING-severity engine critique the live
 * wire ACTUALLY CARRIES must reach a mounted surface (ROADMAP 2.358 closure).
 *
 * ## Why this spec exists, stated bluntly
 *
 * PR #585 landed the V5 mapper leg: `enrichment.critiques` →
 * `report.run.critique`, with CEE-owned copy precedence in humaniseCritique.
 * At that date no live capture carried critique bytes, so the render question
 * was untestable against the wire. On 2026-08-08 the golden fresh-journey
 * runs began carrying them (4 of 12 runs, T5B/T6 steps: DEGENERATE_OUTCOMES,
 * severity warning) — and the complete reader manifest at tip 2e992a9f shows
 * every WARNING-severity terminal surface is DEAD CODE:
 *
 *   - ConfidenceSection (renders uncertainties + humanisedCritiques):
 *     ZERO live mounts — its barrel `components/results/index.ts` has zero
 *     importers outside tests.
 *   - ActionsSignal (useUnifiedActions:229): ZERO live mounts.
 *   - `hasWarnings` (useResultsSectionData:2055): computed, read by nothing.
 *   - OutputsDock:2435 ValidationPanel: LIVE, but filters `severity ===
 *     'BLOCKER'` — a warning row never fires it.
 *   - usePreAnalysisData:619: legacy pre-run panel only, and staging deploys
 *     VITE_FEATURE_PRE_ANALYSIS_V3=1, so the V3 panel mounts instead.
 *
 * So the projected critique row survives the mapper and dies in the store —
 * chronic failure 1 ("we build more than we plug in"), one hop later than
 * #585 found it. This spec is RED-first for the missing hop: a
 * CritiqueWarningStrip mounted in ResultsBody's unconditional current-view
 * group (the InferenceWarningStrip pattern, its exact sibling).
 *
 * ## The fixture is the live wire
 *
 * `live-analysis-turn-critique-degenerate-2026-08-08.json` is the verbatim
 * body of the T5B re-analysis turn from golden-journey run
 * 20260808T141709Z-fresh-extended-45b553 — the first capture family to carry
 * critique bytes. Its single critique row: code DEGENERATE_OUTCOMES,
 * severity "warning", source "isl", user_message populated, message EMPTY
 * STRING, NO affected_node_ids. The absence arm
 * (`live-analysis-turn-no-critiques-2026-08-08.json`) is the SAME session's
 * T3 first-analysis turn, whose enrichment has no `critiques` key at all —
 * real bytes on both sides of the presence/absence line.
 *
 * ## Binding
 *
 * The expected strings are HAND-PINNED to the historical capture, never
 * derived from the fixture at runtime (trap 12d / the downside spec's
 * self-caught oracle defect: an expectation derived from the input agrees
 * with itself and cannot notice a mis-join). The entry is addressed by
 * `data-critique-code` — identity, not a value predicate (trap 19).
 *
 * ## Flag posture
 *
 * Deployed staging posture derived from netlify.toml
 * [context.staging.environment]: VITE_FEATURE_ANALYSIS_HERO_PANEL = "1".
 * Injection goes through the flag system's own localStorage seam (NOT a
 * mock), with a parity assertion, exactly as
 * ResultsBody.keyQuestionLiveMount.spec.tsx established. The strip must
 * render on BOTH postures (its host group is unconditional), and the
 * deployed-posture case is the one that catches a re-host onto a flag arm.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ResultsBody } from '../ResultsBody'
import { useResultsSectionData } from '../useResultsSectionData'
import { isAnalysisHeroPanelEnabled } from '@/flags'
import { useCanvasStore } from '@/canvas/store'
import { useUIStore } from '@/stores/uiStore'
import { applyV5State } from '../../../v5/applyV5State'
import { mapV5AnalysisToReport } from '../../../v5/mapV5AnalysisToReport'
import type { AnalysisResultBlock } from '@talchain/schemas/boundary'
import critiqueTurnFixture from '../../../v5/__tests__/fixtures/live-analysis-turn-critique-degenerate-2026-08-08.json'
import noCritiqueTurnFixture from '../../../v5/__tests__/fixtures/live-analysis-turn-no-critiques-2026-08-08.json'

vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusByTarget: vi.fn(),
  focusExistingTarget: vi.fn(),
  focusModelTarget: vi.fn(() => true),
}))

// ── The capture's OWN strings — identity anchors, hand-pinned, never derived ─
const CAPTURED_CODE = 'DEGENERATE_OUTCOMES'
const CAPTURED_USER_MESSAGE =
  'An issue was detected in your model (DEGENERATE_OUTCOMES). Check the advanced details for more information.'
const CAPTURED_SUGGESTION =
  'Check that options specify different intervention values and that intervention targets are connected to the goal with non-zero effect'

/** Strip the fixture's provenance keys; what remains is the captured turn. */
const PROVENANCE_KEYS = ['__source__', '__captured_at__', '__captured_against__', '__notes__']
function turnOf(fixture: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fixture).filter(([k]) => !PROVENANCE_KEYS.includes(k)),
  )
}

/**
 * Drive the REAL applicator exactly as useConversation.ts does: a spread of
 * the live store's getState() plus the spliced currentResultsHash — so the
 * report under test reached the store through the production write path
 * (applyV5State step 5 → mapV5AnalysisToReport → resultsComplete), not a
 * hand-crafted setState.
 */
function applyTurnToRealStore(fixture: Record<string, unknown>): void {
  const s = useCanvasStore.getState()
  applyV5State(turnOf(fixture) as never, {
    ...s,
    currentResultsHash: s.results?.hash ?? null,
  } as never)
}

/**
 * The production wiring, miniaturised: OutputsDock.tsx:739 calls the REAL
 * useResultsSectionData() and passes the result into ResultsBody. A stubbed
 * confidence object here would skip the exact filter/humanise chain under
 * test (useResultsSectionData:2495→2936), so the harness calls the hook.
 */
function Harness() {
  const data = useResultsSectionData()
  return (
    <ResultsBody
      resultsSectionData={data}
      tornadoData={{ rows: [], expectedOutcome: null }}
      onSendMessage={() => {}}
    />
  )
}

function fixtureAnalysisBlock(fixture: Record<string, unknown>): AnalysisResultBlock {
  const blocks = turnOf(fixture).blocks as Array<Record<string, unknown>>
  const analysis = blocks.find((b) => b.type === 'analysis_result')
  if (!analysis) throw new Error('fixture no longer carries an analysis_result block')
  return structuredClone(analysis) as unknown as AnalysisResultBlock
}

describe('critique warning strip — mount-path proof at the deployed posture, live capture bytes', () => {
  beforeEach(() => {
    localStorage.removeItem('feature.analysisHeroPanel')
    useCanvasStore.setState({
      analysisFreshness: null,
      analysisFreshnessDirty: false,
      results: { status: 'idle', progress: 0 },
      runMeta: null,
      hasCompletedFirstRun: false,
    } as never)
    useUIStore.setState({ activeOutputTab: 'results', activeOutputTabVersion: 0 })
  })
  afterEach(() => {
    localStorage.removeItem('feature.analysisHeroPanel')
    cleanup()
  })

  it('GREEN control (adoption guarantee) — the real mapper carries the captured row to report.run.critique', () => {
    // Passes at pristine (#585's leg). Binds the WIRE → REPORT half so a RED
    // below is attributable to the render hop, not the mapper.
    const report = mapV5AnalysisToReport(fixtureAnalysisBlock(critiqueTurnFixture as never))
    const rows = report.run?.critique ?? []
    expect(rows).toHaveLength(1)
    expect(rows[0].code).toBe(CAPTURED_CODE)
    expect(rows[0].severity).toBe('WARNING')
    expect(rows[0].message).toBe(CAPTURED_USER_MESSAGE)
    expect((rows[0] as { user_message?: string }).user_message).toBe(CAPTURED_USER_MESSAGE)
    expect(rows[0].suggested_fix).toBe(CAPTURED_SUGGESTION)
    // The capture carries NO affected_node_ids — an absent field maps to
    // nothing (no invented node binding).
    expect(rows[0].node_id).toBeUndefined()
  })

  it('flag injection parity — localStorage "1" flips the REAL isAnalysisHeroPanelEnabled', () => {
    expect(isAnalysisHeroPanelEnabled()).toBe(false)
    localStorage.setItem('feature.analysisHeroPanel', '1')
    expect(isAnalysisHeroPanelEnabled()).toBe(true)
  })

  it('DEPLOYED POSTURE (analysisHeroPanel=1): the captured warning critique RENDERS, bound by code + exact CEE copy', () => {
    localStorage.setItem('feature.analysisHeroPanel', '1')
    applyTurnToRealStore(critiqueTurnFixture as never)
    render(<Harness />)

    const strip = screen.getByTestId('critique-warning-strip')
    const entry = strip.querySelector(`[data-critique-code="${CAPTURED_CODE}"]`)
    expect(entry, `strip entry addressed by data-critique-code=${CAPTURED_CODE}`).not.toBeNull()
    // The CEE-owned U-bucket copy, verbatim — never a UI paraphrase.
    expect(entry!.textContent).toContain(CAPTURED_USER_MESSAGE)
    // The wire-carried remediation rides along.
    expect(entry!.textContent).toContain(CAPTURED_SUGGESTION)
    // No invention: the payload names no node, so the entry binds to none.
    expect(entry!.getAttribute('data-critique-node-id')).toBeNull()
    // Exactly ONE entry for the captured row in the whole document.
    expect(
      document.querySelectorAll(`[data-critique-code="${CAPTURED_CODE}"]`),
    ).toHaveLength(1)
  })

  it('flag-OFF posture: the strip host group is unconditional, so the same capture still renders it', () => {
    // Guards the re-host failure class in the OTHER direction: moving the
    // strip INTO a flag arm makes one of these two posture cases go RED.
    expect(isAnalysisHeroPanelEnabled()).toBe(false)
    applyTurnToRealStore(critiqueTurnFixture as never)
    render(<Harness />)
    const strip = screen.getByTestId('critique-warning-strip')
    expect(strip.querySelector(`[data-critique-code="${CAPTURED_CODE}"]`)).not.toBeNull()
  })

  it('ABSENCE arm (real bytes): the same session\'s T3 turn carries no critiques key — no strip renders', () => {
    // The presence arms above prove this harness CAN see the strip (trap 13);
    // this arm proves absence renders nothing rather than an empty shell.
    localStorage.setItem('feature.analysisHeroPanel', '1')
    applyTurnToRealStore(noCritiqueTurnFixture as never)
    render(<Harness />)
    expect(screen.queryByTestId('critique-warning-strip')).toBeNull()
  })

  it('fixture precondition pin — the degenerate fixture still carries exactly the row this file describes', () => {
    // A discriminator whose fixture nothing pins decays silently (trap 13b
    // third face): assert the payload we are about to send WOULD trigger the
    // behaviour, so a fixture refresh that drops the row fails HERE, loudly,
    // not by quietly hollowing the cases above.
    const block = fixtureAnalysisBlock(critiqueTurnFixture as never) as unknown as {
      enrichment: { critiques?: Array<Record<string, unknown>> }
    }
    const rows = block.enrichment.critiques ?? []
    expect(rows).toHaveLength(1)
    expect(rows[0].code).toBe(CAPTURED_CODE)
    expect(rows[0].severity).toBe('warning')
    expect(rows[0].user_message).toBe(CAPTURED_USER_MESSAGE)
    expect(rows[0].message).toBe('')
    expect(rows[0].affected_node_ids).toBeUndefined()

    const absenceBlock = fixtureAnalysisBlock(noCritiqueTurnFixture as never) as unknown as {
      enrichment: Record<string, unknown>
    }
    expect('critiques' in absenceBlock.enrichment).toBe(false)
  })
})
