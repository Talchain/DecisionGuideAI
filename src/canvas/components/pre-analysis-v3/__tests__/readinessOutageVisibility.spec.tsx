/**
 * The pre-analysis panel tells the user when readiness could not be checked.
 *
 * ROADMAP 2.332 / 2.339 — closing the interim #564 merged on record:
 *
 *   "an unreachable or missing readiness service is invisible: no readiness
 *    assessment, no error, Run stays enabled."
 *
 * #564 and 2.329 made the STORE honest — a transport failure, a 404 and (with
 * 2.339) a 5xx all publish no verdict and set a truthful `error`. Nobody could
 * see any of it. The only component that renders that state,
 * `PreAnalysisHealth`, has ZERO non-test importers in `src/` (derived with
 * `grep -arn PreAnalysisHealth src/`, per CLAUDE.md trap 17: the whole tree,
 * binary-flagged files included). Meanwhile the surface users DO see —
 * `PreAnalysisPanelV3`, mounted by `OutputsDock` in the Analysis tab pre-run
 * slot — read the outage as good news: with `readiness === null` the run gate
 * (`canRunAnalysis`, which blocks only on `readiness && !can_run_analysis`)
 * stays OPEN, and the panel footer prints "Analysis available".
 *
 * So the honest store state was being rendered as a POSITIVE claim about a
 * model nothing had assessed. That is what these tests close.
 *
 * Why this panel and not a mount of `PreAnalysisHealth`: that component brings
 * its own readiness tier badge, its own improvements list and its own "Run
 * analysis" button. Mounting it beside the V3 footer would put two run
 * controls and two readiness assessments in one panel — the same one-state,
 * two-strings defect class this programme keeps closing. The honest states
 * belong in the surface that today makes the false claim, which is the footer.
 *
 * Scope (CLAUDE.md trap 3): these are PRESENCE and TEXT assertions on the
 * rendered output of the real, mounted panel driven by the real store through
 * a real (mocked) transport. They are not layout, visibility or
 * above-the-fold claims; those belong to a walk.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, act } from '@testing-library/react'
import type { Node } from '@xyflow/react'
import { PreAnalysisPanelV3 } from '../PreAnalysisPanelV3'
import { FOOTER_COPY } from '../constants'
import { ToastProvider } from '../../../ToastContext'
import { useCanvasStore } from '../../../store'
import { useReadinessStore } from '../../../stores/readinessStore'
import { useGuidanceStore } from '../../../stores/guidanceStore'
import { useSignalSessionStore } from '../signals/signalSessionStore'

const mockFetch = vi.fn()

function node(
  id: string,
  kind: string,
  label: string,
  data: Record<string, unknown> = {},
): Node {
  return { id, type: kind, position: { x: 0, y: 0 }, data: { kind, label, ...data } } as Node
}

function seedGraph() {
  useCanvasStore.setState({
    nodes: [
      node('d1', 'decision', 'Hire a tech lead or two developers?'),
      node('g1', 'goal', 'Increase delivery output', {
        goal_threshold: 0.8,
        goal_threshold_raw: 20,
        goal_threshold_unit: '%',
      }),
      node('o1', 'option', 'Hire a tech lead'),
      node('o2', 'option', 'Hire two developers'),
    ] as any,
    edges: [] as any,
    preAnalysisSensitivity: null,
    ceeAnalysisReady: null,
    draftCoaching: null,
    currentBriefText: null,
    goalThreshold: null,
    goalConstraints: null,
  })
}

function renderPanel() {
  return render(
    <ToastProvider>
      <PreAnalysisPanelV3 onAnalyse={vi.fn()} isAnalysing={false} canRun={true} />
    </ToastProvider>,
  )
}

/** Drain the debounce, the fetch microtasks and React's effects together. */
async function settle() {
  await act(async () => {
    await vi.runAllTimersAsync()
  })
}

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
  vi.stubGlobal('fetch', mockFetch)
  vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' })
})

beforeEach(() => {
  vi.useFakeTimers()
  mockFetch.mockReset()
  useReadinessStore.getState().reset()
  useSignalSessionStore.getState().reset()
  useGuidanceStore.setState({ _sendChip: null, _prefillChat: null })
  seedGraph()
})

afterEach(() => {
  useReadinessStore.getState().reset()
  vi.useRealTimers()
})

describe('pre-analysis panel — an unchecked model is never presented as a checked one', () => {
  // DL Q2a-A (15 Oct 2026): readiness is the TURN's verdict (`ceeAnalysisReady.may_run`), no longer a graph-readiness
  // POST. The rows that drove that request's failures (network rejection, 429, 502, retry, a retained verdict marked
  // stale behind an outage, a locally composed verdict with no time) are deleted with the request: none of those states
  // can arise. What survives is the invariant this file exists for, now driven by the turn.

  // ── Negative control, stated first ───────────────────────────────
  describe('a healthy turn verdict renders nothing new', () => {
    it('shows the ordinary footer and no outage row when the turn says the model may run, and asks nobody', async () => {
      useCanvasStore.setState({ ceeAnalysisReady: { status: 'ready', may_run: true } as any })
      renderPanel()
      await settle()

      expect(useReadinessStore.getState().readiness?.can_run_analysis).toBe(true)
      expect(useReadinessStore.getState().error).toBeNull()
      expect(screen.getByTestId('pre-analysis-v3-footer')).toHaveTextContent(FOOTER_COPY.ready)
      expect(screen.queryByTestId('pre-analysis-v3-readiness-outage')).toBeNull()
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe('before any turn verdict, nothing claims the model was checked', () => {
    it('publishes no verdict, prints no availability claim, sends no request, and leaves the run gate to its owner', async () => {
      renderPanel()
      await settle()
      // An edit on the canvas asks nobody anything.
      await act(async () => {
        seedGraph()
        await vi.runAllTimersAsync()
      })

      expect(useReadinessStore.getState().readiness).toBeNull()
      expect(useReadinessStore.getState().verdictAtMs).toBeNull()
      expect(screen.getByTestId('pre-analysis-v3-footer')).not.toHaveTextContent(FOOTER_COPY.ready)
      expect(screen.getByTestId('pre-analysis-v3-analyse')).not.toBeDisabled()
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })
})
