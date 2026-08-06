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
import { render, screen, act, fireEvent } from '@testing-library/react'
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

function openServerResponse() {
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

function networkRejection() {
  return Promise.reject(new TypeError('Failed to fetch'))
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
  clearInflightCache()
  useSignalSessionStore.getState().reset()
  useGuidanceStore.setState({ _sendChip: null, _prefillChat: null })
  seedGraph()
})

afterEach(() => {
  useReadinessStore.getState().reset()
  vi.useRealTimers()
})

describe('pre-analysis panel — an unchecked model is never presented as a checked one', () => {
  // ── Negative control, stated first ───────────────────────────────
  //
  // Everything below asserts that something NEW appears. This proves it does
  // not appear when the service is healthy — without it, a component that
  // always rendered the outage row would pass every test in this file.
  describe('a healthy readiness check renders nothing new', () => {
    it('shows the ordinary footer and no outage row when the server answers', async () => {
      mockFetch.mockResolvedValue(openServerResponse())
      renderPanel()
      await settle()

      expect(useReadinessStore.getState().readiness?.can_run_analysis).toBe(true)
      expect(useReadinessStore.getState().error).toBeNull()

      expect(screen.getByTestId('pre-analysis-v3-footer')).toHaveTextContent(FOOTER_COPY.ready)
      expect(screen.queryByTestId('pre-analysis-v3-readiness-outage')).toBeNull()
      expect(screen.queryByRole('button', { name: /retry readiness check/i })).toBeNull()
    })
  })

  // ── (a) The user can SEE "could not check", and can act on it ────
  describe('an unreachable readiness service is visible where readiness renders', () => {
    it('shows a could-not-check row instead of an availability claim', async () => {
      mockFetch.mockImplementation(() => networkRejection())
      renderPanel()
      await settle()

      // The store reached the honest state #564 installed…
      const state = useReadinessStore.getState()
      expect(state.readiness).toBeNull()
      expect(state.error).not.toBeNull()

      // …and the panel now says so, instead of "Analysis available".
      const outage = screen.getByTestId('pre-analysis-v3-readiness-outage')
      expect(outage).toHaveTextContent(/could not check/i)
      expect(screen.getByTestId('pre-analysis-v3-footer')).not.toHaveTextContent(
        FOOTER_COPY.ready,
      )
    })

    it('offers a retry control that issues a real second request', async () => {
      mockFetch.mockImplementation(() => networkRejection())
      renderPanel()
      await settle()
      expect(mockFetch).toHaveBeenCalledTimes(1)

      const retry = screen.getByRole('button', { name: /retry readiness check/i })

      clearInflightCache()
      mockFetch.mockResolvedValue(openServerResponse())
      await act(async () => {
        fireEvent.click(retry)
        await vi.runAllTimersAsync()
      })

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(useReadinessStore.getState().readiness?.can_run_analysis).toBe(true)
      expect(screen.queryByTestId('pre-analysis-v3-readiness-outage')).toBeNull()
    })

    it('does not gate the run locally — the verdict stays the server’s', async () => {
      mockFetch.mockImplementation(() => networkRejection())
      renderPanel()
      await settle()

      // Visibility is the deliverable; the run gate is OutputsDock's and is
      // deliberately untouched by this slice. `canRun` is passed true here, so
      // an Analyse button that had become locally disabled would fail this.
      expect(screen.getByTestId('pre-analysis-v3-analyse')).not.toBeDisabled()
    })
  })

  // ── (b) The stale marking on a RETAINED verdict ──────────────────
  describe('a verdict the model has outgrown is marked, with the service unreachable', () => {
    it('keeps the served verdict and says it predates the current model', async () => {
      mockFetch.mockResolvedValue(openServerResponse())
      renderPanel()
      await settle()
      expect(screen.queryByTestId('pre-analysis-v3-readiness-outage')).toBeNull()

      // The service drops, then the model changes underneath the verdict — the
      // walk's exact sequence, with `ceeAnalysisReady` written by a turn.
      mockFetch.mockImplementation(() => networkRejection())
      clearInflightCache()
      await act(async () => {
        useCanvasStore.setState({
          ceeAnalysisReady: {
            options: [{ id: 'opt_retention', label: 'Retention push', status: 'ready' }],
            goal_node_id: 'g1',
            status: 'ready',
          } as any,
        })
        await vi.runAllTimersAsync()
      })

      const store = useReadinessStore.getState()
      expect(store.readiness?.can_run_analysis).toBe(true)
      expect(store.error).not.toBeNull()
      expect(store.stale).toBe(true)

      const outage = screen.getByTestId('pre-analysis-v3-readiness-outage')
      expect(outage).toHaveTextContent(/changed since/i)
      // …and the retained answer is cited with the time it was taken, not
      // presented as if it described the model now on the canvas.
      expect(outage).toHaveTextContent(/showing the check from/i)
      expect(outage).toHaveTextContent(/could not reach/i)
      // The retained verdict is still the server's, and the panel does not
      // reprint it as a current availability claim.
      expect(screen.getByTestId('pre-analysis-v3-footer')).not.toHaveTextContent(
        FOOTER_COPY.ready,
      )
      expect(
        screen.getByRole('button', { name: /retry readiness check/i }),
      ).toBeInTheDocument()
    })
  })

  // ── A locally-composed verdict is never cited with a time ────────
  //
  // The adversarial review's amendment 2, at the surface where it does harm:
  // the empty-canvas arm composes its verdict locally and used to stamp
  // `verdictAtMs`. Add the first node while the service is down and the footer
  // cited "Showing the check from HH:MM" for a verdict no server produced.
  describe('a verdict composed locally is never cited as a timed server check', () => {
    it('names the failure without a timestamp after the first node on an empty canvas', async () => {
      useCanvasStore.setState({ nodes: [] as any, edges: [] as any })
      mockFetch.mockImplementation(() => networkRejection())
      renderPanel()
      await settle()

      // The first node arrives while the service is unreachable.
      await act(async () => {
        seedGraph()
        await vi.runAllTimersAsync()
      })

      const outage = screen.getByTestId('pre-analysis-v3-readiness-outage')
      expect(outage).toHaveTextContent(/could not reach/i)
      expect(outage).not.toHaveTextContent(/showing the check from/i)
    })
  })

  // ── The 429 limb: no local fallback exists to cite (ROADMAP 2.635) ─
  //
  // This block used to assert `readiness` was NON-null after a 429 — the local
  // heuristic's verdict — while insisting the surface not print "Showing the
  // check from HH:MM" over it. That was the best available compromise while a
  // fabricated verdict was on screen. 2.635 removed the fabrication instead:
  // the arm publishes nothing, so the panel reaches the SAME honest
  // never-checked surface as the transport, 404 and 5xx limbs, and the
  // timestamp problem cannot arise because there is no local verdict.
  describe('a rate-limited check is named as one, and cites no server time', () => {
    it('shows the rate-limit reason and publishes no verdict to timestamp', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: () => Promise.reject(new Error('not json')),
        text: () => Promise.resolve('rate limited'),
        headers: new Headers(),
      })
      renderPanel()
      await settle()

      expect(useReadinessStore.getState().readiness).toBeNull()
      expect(useReadinessStore.getState().verdictAtMs).toBeNull()

      const outage = screen.getByTestId('pre-analysis-v3-readiness-outage')
      expect(outage).toHaveTextContent(/rate limited/i)
      expect(outage).not.toHaveTextContent(/showing the check from/i)
    })
  })

  // ── The 2.339 limb reaches the same surface ──────────────────────
  describe('a 5xx from the readiness service reaches the same honest surface', () => {
    it('shows the could-not-check row on a 502 rather than a fabricated verdict', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        json: () => Promise.reject(new Error('not json')),
        text: () => Promise.resolve('<html>502 Bad Gateway</html>'),
        headers: new Headers(),
      })
      renderPanel()
      await settle()

      expect(useReadinessStore.getState().readiness).toBeNull()
      const outage = screen.getByTestId('pre-analysis-v3-readiness-outage')
      expect(outage).toHaveTextContent(/could not check/i)
      // The response body never reaches the surface.
      expect(outage).not.toHaveTextContent(/html/i)
    })
  })
})
