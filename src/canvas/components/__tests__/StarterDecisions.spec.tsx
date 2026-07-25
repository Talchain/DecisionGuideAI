/**
 * StarterDecisions — first-run starter strip (P1-2, pre-drafted CEE starters).
 *
 * This spec replaces the PLoT-template version. The strip no longer fetches a
 * producer list: the starters are REAL CEE draft-graph responses committed to
 * the repo and derived by `scripts/build-starter-fixtures.mjs`, so the pins
 * that matter changed from "allow-list resolution against a live list" to
 * "the cards describe the graph they actually open, and a click applies it
 * through the real draft-ingestion path".
 *
 * Mocking pattern: importOriginal-SPREAD everywhere (the repo rule — a
 * hand-listed `vi.mock` factory REPLACES the module and silently drops every
 * export added later, which is how 51 tests once went dark). Only
 * `confirmReplaceCanvas` and `applyStarter` are stubbed; the REAL manifest,
 * the REAL `STARTERS` list and the REAL failure constant stay live.
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- mocks -----------------------------------------------------------------

const confirmReplaceCanvasMock = vi.fn(() => true)
vi.mock('../../blueprints/loadTemplateBlueprint', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../blueprints/loadTemplateBlueprint')>()
  return { ...actual, confirmReplaceCanvas: () => confirmReplaceCanvasMock() }
})

const applyStarterMock = vi.fn(async (_id: string) => ({ nodeCount: 18, edgeCount: 35 }))
const loadStarterPayloadMock = vi.fn(async (_id: string) => ({ nodes: [], edges: [] }))
vi.mock('../../starters/loadStarter', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../starters/loadStarter')>()
  return {
    ...actual,
    applyStarter: (id: string) => applyStarterMock(id),
    loadStarterPayload: (id: string) => loadStarterPayloadMock(id),
  }
})

const showToastMock = vi.fn()
vi.mock('../../ToastContext', () => ({ useShowToastSafe: () => showToastMock }))

import { StarterDecisions, STARTER_LOAD_FAILED_MESSAGE } from '../StarterDecisions'
import { useCanvasStore } from '../../store'
import { STARTERS } from '../../starters/loadStarter'

// --- helpers ---------------------------------------------------------------

function setGraph(nodeCount: number) {
  useCanvasStore.setState({
    nodes: Array.from({ length: nodeCount }, (_, i) => ({
      id: `n${i}`,
      type: 'factor',
      position: { x: 0, y: 0 },
      data: { label: `n${i}` },
    })) as never,
    edges: [] as never,
  })
}

describe('StarterDecisions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    confirmReplaceCanvasMock.mockReturnValue(true)
    applyStarterMock.mockResolvedValue({ nodeCount: 18, edgeCount: 35 })
    loadStarterPayloadMock.mockResolvedValue({ nodes: [], edges: [] })
    setGraph(0)
  })

  describe('rendering', () => {
    it('renders one card per starter in the generated manifest', () => {
      render(<StarterDecisions />)
      expect(screen.getByTestId('starter-decisions')).toBeInTheDocument()
      for (const s of STARTERS) {
        expect(screen.getByTestId(`starter-decision-${s.id}`)).toBeInTheDocument()
      }
    })

    it('ships the 3 roadmap-named enterprise shapes, within the 3–5 card range', () => {
      render(<StarterDecisions />)
      const ids = STARTERS.map((s) => s.id)
      // These three are the shapes the roadmap names AND the shapes that fail
      // live most often (5/14 = 35.7%) — which is exactly why they are cached.
      expect(ids).toContain('vendor-selection')
      expect(ids).toContain('market-entry')
      expect(ids).toContain('build-vs-buy')
      expect(STARTERS.length).toBeGreaterThanOrEqual(3)
      expect(STARTERS.length).toBeLessThanOrEqual(5)
    })

    it('card copy is the graph’s own decision/goal labels — never authored strings', () => {
      render(<StarterDecisions />)
      for (const s of STARTERS) {
        const card = screen.getByTestId(`starter-decision-${s.id}`)
        expect(card).toHaveTextContent(s.title)
        expect(card).toHaveTextContent(s.summary)
      }
    })

    it('discloses that these are saved examples, not a live generation', () => {
      render(<StarterDecisions />)
      expect(screen.getByText(/saved example/i)).toBeInTheDocument()
    })

    it('renders nothing once a graph exists (starters are not the way in any more)', () => {
      setGraph(3)
      const { container } = render(<StarterDecisions />)
      expect(container).toBeEmptyDOMElement()
    })
  })

  describe('picking a starter', () => {
    it('applies the starter through applyStarter', async () => {
      const user = userEvent.setup()
      render(<StarterDecisions />)
      await user.click(screen.getByTestId('starter-decision-market-entry'))
      await waitFor(() => expect(applyStarterMock).toHaveBeenCalledWith('market-entry'))
    })

    it('respects the shared replace-canvas confirm gate', async () => {
      confirmReplaceCanvasMock.mockReturnValue(false)
      const user = userEvent.setup()
      render(<StarterDecisions />)
      await user.click(screen.getByTestId('starter-decision-market-entry'))
      expect(applyStarterMock).not.toHaveBeenCalled()
    })

    it('shows persistent error copy when a starter will not open — never a dead click', async () => {
      applyStarterMock.mockRejectedValue(new Error('chunk load failed'))
      const user = userEvent.setup()
      render(<StarterDecisions />)
      await user.click(screen.getByTestId('starter-decision-vendor-selection'))
      await waitFor(() =>
        expect(showToastMock).toHaveBeenCalledWith(STARTER_LOAD_FAILED_MESSAGE, 'error'),
      )
    })

    it('drops the click when the canvas gains content WHILE the chunk is loading', async () => {
      // The guard this pins: the confirm was made against an empty canvas, but
      // the ~28 KB fixture fetch is long enough for a hydrating scenario or a
      // landing CEE draft to populate the canvas. applyStarter REPLACES the
      // graph, so applying now would silently destroy work the user can see and
      // was never asked about.
      loadStarterPayloadMock.mockImplementation(async () => {
        setGraph(12) // content arrives mid-fetch
        return { nodes: [], edges: [] }
      })
      const user = userEvent.setup()
      render(<StarterDecisions />)
      await user.click(screen.getByTestId('starter-decision-market-entry'))
      expect(applyStarterMock).not.toHaveBeenCalled()
      // ...and it is dropped SILENTLY — a toast would blame the user for a
      // race they did not cause.
      expect(showToastMock).not.toHaveBeenCalled()
    })

    it('re-entrancy latch: a double click applies exactly once', async () => {
      let release: (v: { nodeCount: number; edgeCount: number }) => void = () => {}
      applyStarterMock.mockReturnValue(
        new Promise((resolve) => {
          release = resolve
        }) as never,
      )
      const user = userEvent.setup()
      render(<StarterDecisions />)
      const card = screen.getByTestId('starter-decision-build-vs-buy')
      await user.click(card)
      await user.click(card)
      expect(applyStarterMock).toHaveBeenCalledTimes(1)
      release({ nodeCount: 19, edgeCount: 37 })
    })
  })
})
