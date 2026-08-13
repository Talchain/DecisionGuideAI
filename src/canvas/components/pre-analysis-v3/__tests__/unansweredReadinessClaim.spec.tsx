/**
 * The pre-analysis panel never claims a readiness it has not been given.
 *
 * ── The defect, witnessed on deployed staging 2026-08-13 (UI `5deee0cf`) ──
 *
 * The panel rendered `Analysis available` beside an enabled `Analyse first
 * pass`, while CEE refused the run outright ("Options exist but don't have
 * effects configured yet…"). The response carried `blocks: []`, so nothing
 * explained the refusal in the panel; it landed in the chat column. Analysis
 * completed 0 of 4 attempts. The user presses the big blue button and nothing
 * changes.
 *
 * ── Why the existing guards did not see it ──
 *
 * #564 / ROADMAP 2.332 / 2.339 closed the arms where the readiness check
 * FAILS. `readinessOutageVisibility.spec.tsx` covers every one of them —
 * transport rejection, 404, 429, 5xx — and each drives the fetch to a definite
 * outcome before asserting. All of them set `readinessStore.error`.
 *
 * `usePreAnalysisModel` derives its outage slice as
 * `readinessError ? {…} : null`, so the outage arm is reachable ONLY through a
 * recorded error. That leaves one state uncovered, and it is the state the
 * panel spends every cold load in:
 *
 *     readiness === null  &&  error === null
 *
 * — the check has not answered YET, or never fired at all. In it:
 *   · `readinessCheck` is null, so PanelFooter's outage arm does not render;
 *   · `canRun` in the model is `readiness ? … : null`, which is not `false`,
 *     so the footer falls through to the availability copy; and
 *   · `canRunAnalysis` blocks only on `readiness && !can_run_analysis`, so the
 *     run gate is open and the CTA is enabled.
 *
 * The panel therefore asserts `Analysis available` about a model that nothing
 * has assessed. That is the same false-positive class #564 was merged to end,
 * on the one arm #564 did not reach — and it is not a transient frame: the
 * readinessStore's own header records `graph-readiness` being requested ZERO
 * times in three of four witnessed guest sessions (the 2.345 starvation
 * deadlock), and a Render cold start holds the in-flight state for seconds.
 *
 * ── What this spec does and does not require ──
 *
 * It constrains the CLAIM, never the gate. The run stays enabled on an unknown
 * verdict, deliberately: `readinessObjectsToRun`'s docstring settles that
 * failing closed on an unobtainable check would brick the Run button for a
 * healthy user whose only problem is a side-car service being down. Unknown
 * does not object — but neither does it entitle the panel to say "available".
 * Silence about a fact we do not hold beats a positive claim we cannot support.
 *
 * Scope (CLAUDE.md trap 3): PRESENCE and TEXT assertions on the real, mounted
 * panel driven by the real store through a mocked transport. Not layout, not
 * visibility, not above-the-fold — those belong to a walk.
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
import { clearInflightCache } from '../../../hooks/useGraphReadiness'

const mockFetch = vi.fn()

function node(
  id: string,
  kind: string,
  label: string,
  data: Record<string, unknown> = {},
): Node {
  return { id, type: kind, position: { x: 0, y: 0 }, data: { kind, label, ...data } } as Node
}

/**
 * The witnessed shape: a decision, a goal and two options — a model with no
 * success target set, which is the branch that printed
 * `readySubSuccessUnset` ("First pass will be provisional until success is
 * defined") in the staging capture. Seeding the exact branch matters: it is
 * the one that reaches the availability headline with `readiness === null`.
 */
function seedGraph() {
  useCanvasStore.setState({
    nodes: [
      node('d1', 'decision', 'Should we move the whole company to a four-day week?'),
      node('g1', 'goal', 'Maintain delivery output'),
      node('o1', 'option', 'Pilot four-day week (one department)'),
      node('o2', 'option', 'Keep the five-day week'),
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

/** A readiness service that accepts the request and never answers — the
 *  Render cold-start shape, and the state a never-fired request sits in. */
function neverAnswers() {
  return new Promise<never>(() => {})
}

function healthyOpenResponse() {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () =>
      Promise.resolve({
        readiness_score: 88,
        readiness_level: 'ready',
        can_run_analysis: true,
        confidence_explanation: 'Ready to analyse',
        improvements: [],
      }),
    text: () => Promise.resolve(''),
    headers: new Headers(),
  }
}

function refusingResponse() {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () =>
      Promise.resolve({
        readiness_score: 30,
        readiness_level: 'needs_work',
        can_run_analysis: false,
        confidence_explanation: 'Options need intervention values',
        improvements: [],
        options_ready: 0,
        options_total: 2,
      }),
    text: () => Promise.resolve(''),
    headers: new Headers(),
  }
}

function renderPanel() {
  return render(
    <ToastProvider>
      {/* `canRun` is passed TRUE deliberately — it is what OutputsDock's
          `canRunAnalysis` returns for a null verdict, and passing it true is
          what makes this a test about the panel's CLAIM rather than about the
          gate. A fix that merely closed the gate would not satisfy it. */}
      <PreAnalysisPanelV3 onAnalyse={vi.fn()} isAnalysing={false} canRun={true} />
    </ToastProvider>,
  )
}

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
  clearInflightCache()
  useSignalSessionStore.getState().reset()
  useGuidanceStore.setState({ _sendChip: null, _prefillChat: null })
  seedGraph()
})

afterEach(() => {
  useReadinessStore.getState().reset()
  vi.useRealTimers()
})

describe('pre-analysis panel — an unanswered readiness check is not an availability claim', () => {
  describe('the check has not answered', () => {
    it('does not print the availability headline while no verdict and no error exist', async () => {
      mockFetch.mockImplementation(() => neverAnswers())
      renderPanel()
      await settle()

      // PIN THE PRECONDITION IN-TEST (CLAUDE.md trap 13b): this test is only
      // about the unanswered state, so prove the store is IN it. Without this
      // the assertion below could pass because the check failed, or answered,
      // and the test would be silently measuring a different arm.
      const state = useReadinessStore.getState()
      expect(state.readiness).toBeNull()
      expect(state.error).toBeNull()

      // The claim, bound to the footer BY IDENTITY — never to whichever
      // element happens to carry the string.
      const footer = screen.getByTestId('pre-analysis-v3-footer')
      expect(footer).not.toHaveTextContent(FOOTER_COPY.ready)
    })

    it('says what it actually holds — that readiness has not been established', async () => {
      mockFetch.mockImplementation(() => neverAnswers())
      renderPanel()
      await settle()

      expect(useReadinessStore.getState().readiness).toBeNull()
      expect(useReadinessStore.getState().error).toBeNull()

      // Silence would satisfy the test above; this one requires the panel to
      // account for the gap rather than merely drop the sentence.
      const footer = screen.getByTestId('pre-analysis-v3-footer')
      expect(footer).toHaveTextContent(FOOTER_COPY.readinessPending)
    })

    it('leaves the run enabled — an unknown verdict must not brick a healthy model', async () => {
      mockFetch.mockImplementation(() => neverAnswers())
      renderPanel()
      await settle()

      expect(useReadinessStore.getState().readiness).toBeNull()
      expect(useReadinessStore.getState().error).toBeNull()

      // Over-blocking is its own defect (and would contradict
      // `readinessObjectsToRun`'s settled reasoning). The CTA is bound by
      // testid, not by its label.
      expect(screen.getByTestId('pre-analysis-v3-analyse')).not.toBeDisabled()
    })
  })

  // ── Negative controls ────────────────────────────────────────────
  //
  // Both exist so the fix cannot be "stop printing the headline". A blanket
  // removal passes every assertion above and fails both of these.
  describe('an answered check is unaffected', () => {
    it('still prints the availability headline when the server says the model is ready', async () => {
      mockFetch.mockResolvedValue(healthyOpenResponse())
      renderPanel()
      await settle()

      expect(useReadinessStore.getState().readiness?.can_run_analysis).toBe(true)
      expect(useReadinessStore.getState().error).toBeNull()

      const footer = screen.getByTestId('pre-analysis-v3-footer')
      expect(footer).toHaveTextContent(FOOTER_COPY.ready)
      expect(footer).not.toHaveTextContent(FOOTER_COPY.readinessPending)
    })

    it('still prints the not-ready copy when the server refuses the model', async () => {
      mockFetch.mockResolvedValue(refusingResponse())
      renderPanel()
      await settle()

      expect(useReadinessStore.getState().readiness?.can_run_analysis).toBe(false)

      const footer = screen.getByTestId('pre-analysis-v3-footer')
      expect(footer).toHaveTextContent(FOOTER_COPY.notReady)
      expect(footer).not.toHaveTextContent(FOOTER_COPY.ready)
      expect(footer).not.toHaveTextContent(FOOTER_COPY.readinessPending)
    })
  })
})
