/**
 * StarterProvenanceBanner — the saved-example disclosure and the redraft escape.
 *
 * The disclosure is a NON-NEGOTIABLE honesty requirement: a starter graph is
 * indistinguishable on screen from one Olumi just drafted, so without this
 * banner the product implies a live computation that did not happen. These
 * tests pin the two claims that must never silently regress — that the
 * disclosure renders whenever starter provenance is on the graph, and that the
 * redraft re-sends the VERBATIM brief the shown graph came from.
 *
 * ⭐ THE ANALYSIS CLAIM IS NOW CONDITIONAL, AND THAT IS THE POINT (18 Aug
 * affordance sweep, cross-cutting note 1). The banner used to print "Analysis
 * is held on a saved example" unconditionally, on its OWN mount condition —
 * so it kept saying it while a toast said "Analysis complete." It now reads
 * `analysisHeldNotice`, the run gate's own condition and sentence, which is
 * `null` off the V5 canonical run path (a V2-direct run carries the graph, so
 * nothing is held). The DEPLOYED posture bakes that path ON — both
 * `VITE_V5_CANONICAL_ANALYSIS` and `VITE_ENABLE_V5_ORCHESTRATOR` are inlined
 * "true" — so the held-claim tests stub it ON to test the surface the
 * deployment actually mounts (trap 3b), and the twin below proves the claim
 * DISAPPEARS when the state stops holding.
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const sendMessageMock = vi.fn()
const setDraftMock = vi.fn()
vi.mock('../../conversation/ConversationContext', () => ({
  // `draft`/`setDraft` are part of this context's real shape and the banner's
  // failure path now writes the brief back through them. A `vi.mock` FACTORY
  // REPLACES THE MODULE (CLAUDE.md trap 12), so a field omitted here is
  // `undefined` in the component — which is why they are listed rather than
  // the component being made defensive against its own test double.
  useConversationContext: () => ({ sendMessage: sendMessageMock, draft: '', setDraft: setDraftMock }),
}))

import { StarterProvenanceBanner } from '../StarterProvenanceBanner'
import { useCanvasStore } from '../../store'
import { STARTERS } from '../../starters/loadStarter'

const MARKET = STARTERS.find((s) => s.id === 'market-entry')!

function setNodes(data: Record<string, unknown> | null, count = 3) {
  useCanvasStore.setState({
    nodes: (data === null
      ? []
      : Array.from({ length: count }, (_, i) => ({
          id: `n${i}`,
          type: 'factor',
          position: { x: 0, y: 0 },
          data: { label: `n${i}`, ...data },
        }))) as never,
    edges: [] as never,
  })
}

describe('StarterProvenanceBanner', () => {
  let confirmSpy: ReturnType<typeof vi.spyOn>
  let resetSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    resetSpy = vi.spyOn(useCanvasStore.getState(), 'resetCanvas').mockImplementation(() => {})
    // The deployed flag posture (see the file header). Without it the run gate
    // does not hold, so the banner correctly declines to say that it does — and
    // the assertions below would be measuring a posture staging does not serve.
    //
    // ⚠ THE CANONICAL HALF GOES THROUGH localStorage, NOT `vi.stubEnv`.
    // `flags.ts` resolves `VITE_V5_CANONICAL_ANALYSIS` at MODULE LOAD (which is
    // why `flags.v5CanonicalAnalysis.spec.ts` pairs every `stubEnv` with a
    // `vi.resetModules()`), so a stub set here arrives too late and reads as
    // OFF. The documented storage override is evaluated per call and is the one
    // that works from a component spec. Measured, not assumed: with `stubEnv`
    // alone these assertions failed while the "STOPS claiming" twin below
    // passed — i.e. the twin was agreeing for the wrong reason and proving
    // nothing (trap 13b).
    try { localStorage.setItem('feature.v5CanonicalAnalysis', '1') } catch { /* ignore */ }
    vi.stubEnv('VITE_ENABLE_V5_ORCHESTRATOR', 'true')
    setNodes({ starterId: 'market-entry', starterTitle: MARKET.title })
  })

  afterEach(() => {
    confirmSpy.mockRestore()
    resetSpy.mockRestore()
    vi.unstubAllEnvs()
    try { localStorage.removeItem('feature.v5CanonicalAnalysis') } catch { /* ignore */ }
  })

  describe('disclosure', () => {
    it('states this is a saved example and that it was NOT generated just now', () => {
      render(<StarterProvenanceBanner />)
      const banner = screen.getByTestId('starter-provenance-banner')
      expect(banner).toHaveTextContent(/saved example/i)
      expect(banner).toHaveTextContent(/wasn’t generated just now/i)
      // Names WHEN it was drafted, from the generated manifest — never a
      // hardcoded date that could drift from the capture.
      expect(banner).toHaveTextContent(MARKET.provenance.capturedAt)
    })

    it('explains why analysis is held, so a disabled Run does not read as broken', () => {
      render(<StarterProvenanceBanner />)
      expect(screen.getByTestId('starter-provenance-banner')).toHaveTextContent(/analysis is held/i)
    })

    it('STOPS claiming analysis is held once the run gate no longer holds it', () => {
      // The staleness the sweep witnessed, pinned from the other side: the
      // banner still read "Analysis is held on a saved example" beside a toast
      // that said "Analysis complete." The claim now comes from the gate's own
      // condition, so when that condition is false the sentence is simply not
      // made — while the provenance disclosure, which is still true, stays.
      try { localStorage.setItem('feature.v5CanonicalAnalysis', '0') } catch { /* ignore */ }
      render(<StarterProvenanceBanner />)
      const banner = screen.getByTestId('starter-provenance-banner')
      expect(banner).not.toHaveTextContent(/analysis is held/i)
      // CONTROL: the banner is still mounted and still discloses provenance, so
      // the absence above is the CLAIM being dropped, not the component.
      expect(banner).toHaveTextContent(/saved example/i)
      expect(banner).toHaveTextContent(/wasn’t generated just now/i)
    })

    // ── the two-shapes defect ────────────────────────────────────────────
    //
    // `analysisHeldOn` (canRunAnalysis.ts) refuses the run when ANY
    // node carries starter provenance — `nodes.some(...)`. This banner used to
    // read `nodes[0]?.data?.starterId`, i.e. the FIRST node only. Two shapes
    // for one question, and they disagree exactly when an unstamped node sits
    // at index 0: the gate still refuses to analyse, and the banner that
    // exists to explain the refusal is gone. That is the precise failure this
    // component's own docstring says it exists to prevent — "a user who does
    // not know why will read it as the product being broken".
    it('discloses provenance when a LATER node carries the stamp, matching the run gate', () => {
      useCanvasStore.setState({
        nodes: [
          // A node added after the starter loaded — no stamp.
          { id: 'n_user', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'My own factor' } },
          {
            id: 'n_starter',
            type: 'factor',
            position: { x: 0, y: 0 },
            data: { label: 'From the starter', starterId: 'market-entry', starterTitle: MARKET.title },
          },
        ] as never,
        edges: [] as never,
      })
      render(<StarterProvenanceBanner />)
      expect(screen.getByTestId('starter-provenance-banner')).toHaveTextContent(/saved example/i)
    })

    it('renders nothing when NO node carries starter provenance', () => {
      // Positive control for the assertion above: the same query that found the
      // banner must be able to NOT find it, or "it renders" proves nothing.
      setNodes({})
      render(<StarterProvenanceBanner />)
      expect(screen.queryByTestId('starter-provenance-banner')).toBeNull()
    })

    it('does NOT promise that saving re-enables analysis — the stamp rides a save', () => {
      // An earlier draft of this copy said "drafted or saved into your own
      // decision". Saving does not strip `starterId`, so the gate still
      // refuses: that sentence promised something the product does not do.
      // Copy that overstates the product is the defect class this repo hunts,
      // so it is pinned rather than left to review.
      render(<StarterProvenanceBanner />)
      const banner = screen.getByTestId('starter-provenance-banner')
      expect(banner.textContent ?? '').not.toMatch(/saved into your own decision/i)
      // The one route that DOES work is named.
      expect(banner).toHaveTextContent(/re-draft it live/i)
    })

    it('does not render on a graph with no starter provenance (a real CEE draft)', () => {
      setNodes({})
      const { container } = render(<StarterProvenanceBanner />)
      expect(container).toBeEmptyDOMElement()
      expect(screen.queryByTestId('starter-provenance-banner')).not.toBeInTheDocument()
    })

    it('does not render on an empty canvas', () => {
      setNodes(null)
      render(<StarterProvenanceBanner />)
      expect(screen.queryByTestId('starter-provenance-banner')).not.toBeInTheDocument()
    })

    it('can be dismissed', async () => {
      const user = userEvent.setup()
      render(<StarterProvenanceBanner />)
      await user.click(screen.getByTestId('starter-provenance-dismiss'))
      expect(screen.queryByTestId('starter-provenance-banner')).not.toBeInTheDocument()
    })
  })

  describe('redraft', () => {
    it('names the trade-off before doing anything destructive', async () => {
      const user = userEvent.setup()
      render(<StarterProvenanceBanner />)
      await user.click(screen.getByTestId('starter-redraft'))
      expect(confirmSpy).toHaveBeenCalledTimes(1)
      const prompt = String(confirmSpy.mock.calls[0][0])
      // The user is told it replaces the example AND that live drafting can fail.
      expect(prompt).toMatch(/replaces/i)
      expect(prompt).toMatch(/fail or time out/i)
    })

    it('does nothing when the user declines', async () => {
      confirmSpy.mockReturnValue(false)
      const user = userEvent.setup()
      render(<StarterProvenanceBanner />)
      await user.click(screen.getByTestId('starter-redraft'))
      expect(resetSpy).not.toHaveBeenCalled()
      expect(sendMessageMock).not.toHaveBeenCalled()
    })

    it('sends the VERBATIM original brief — not a shortened or rewritten one', async () => {
      const user = userEvent.setup()
      render(<StarterProvenanceBanner />)
      await user.click(screen.getByTestId('starter-redraft'))
      await waitFor(() => expect(sendMessageMock).toHaveBeenCalledTimes(1))
      const [text, opts] = sendMessageMock.mock.calls[0]
      // Byte-equality with the manifest brief. Shortening these to raise the
      // live pass rate was explicitly forbidden: it would make the demo
      // unrepresentative and hide the drafting wall rather than clear it.
      expect(text).toBe(MARKET.brief)
      expect(text.length).toBeGreaterThan(300)
      expect(opts).toMatchObject({ turnType: 'explicit_generate' })
    })

    it('clears the canvas first so the composer drafts a model rather than chats', async () => {
      const user = userEvent.setup()
      render(<StarterProvenanceBanner />)
      await user.click(screen.getByTestId('starter-redraft'))
      expect(resetSpy).toHaveBeenCalledTimes(1)
    })
  })
})
