/**
 * Explain-diff MOUNT + behaviour on the applied-edit receipt.
 *
 * ── WHY THE MOUNT PATH IS ASSERTED AND NOT ASSUMED ──────────────────────────
 * This estate has twice shipped a feature onto a component the deployed flags
 * switch off, with a fully green suite each time, because every test pointed at
 * the wrong component. A render test alone would repeat that: it proves the
 * button appears when THIS component is rendered, and says nothing about whether
 * anything renders this component.
 *
 * So the mount path itself is asserted below, derived from the dispatcher source,
 * and it fails loud if the `v5_graph_patch` case is re-routed or gains a flag.
 *
 * Host verified at the DEPLOYED bytes, not from flag prose: a full 83-chunk crawl
 * of the staging bundle finds `v5-change-receipt`, `v5-change-status` and
 * `v5-change-summary` present (positive controls `key-question-card`, `No change`
 * non-zero; fabricated negatives zero). The card a user sees after an assistant
 * edit is this one.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import type { V5GraphPatchBlock as V5GraphPatchBlockType } from '../../../canvas/conversation/types'

const NODES = [
  { id: 'fac_team_morale', data: { label: 'team morale' } },
  { id: 'goal_outcome', data: { label: 'overall outcome' } },
]
const EDGES = [{ id: 'edge_a', source: 'fac_team_morale', target: 'goal_outcome' }]

vi.mock('../../../canvas/store', () => ({
  useCanvasStore: (
    selector: (s: {
      nodes: unknown
      edges: unknown
      analysisFreshness: { freshness: string } | null
      analysisFreshnessDirty: boolean
    }) => unknown,
  ) =>
    selector({
      nodes: NODES,
      edges: EDGES,
      analysisFreshness: { freshness: 'unknown' },
      analysisFreshnessDirty: false,
    }),
}))

import { V5GraphPatchBlock } from '../V5GraphPatchBlock'

const applied: V5GraphPatchBlockType = {
  type: 'v5_graph_patch',
  status: 'applied',
  operation: 'set_factor_value',
  target_id: 'fac_team_morale',
  before: { value: 0.5 },
  after: { value: 0.7 },
}

const jsonResponse = (body: unknown, ok = true) =>
  ({ ok, json: () => Promise.resolve(body) }) as unknown as Response

beforeEach(() => cleanup())
afterEach(() => vi.restoreAllMocks())

/* ── THE MOUNT PATH ─────────────────────────────────────────────────────────── */
describe('mount path: the dispatcher actually renders this card', () => {
  const dispatcherSource = readFileSync(
    resolve(__dirname, '../../../canvas/conversation/InlineBlocks.tsx'),
    'utf8',
  )

  it('routes the v5_graph_patch block type to V5GraphPatchBlock', () => {
    expect(dispatcherSource).toContain("case 'v5_graph_patch':")
    expect(dispatcherSource).toMatch(/case 'v5_graph_patch':[\s\S]{0,200}<V5GraphPatchBlock/)
  })

  it('renders that case with NO block-level flag gate', () => {
    // Neighbouring V4 cases DO gate (`if (!isDeterministicCeeEnabled()) return null`).
    // If a gate is ever added to this case, this REDs — which is the whole point:
    // a flag moving must not silently dark this capability again.
    const caseBody = dispatcherSource
      .split("case 'v5_graph_patch':")[1]
      .split('case ')[0]
    expect(caseBody).not.toContain('isDeterministicCeeEnabled')
    expect(caseBody).not.toMatch(/return null/)
  })

  // Positive control: the gating pattern this file claims to detect is genuinely
  // present in the same source. Without it, both assertions above could pass
  // because the pattern never appears anywhere — an absence probe with nothing
  // proving it can see a presence.
  it('CONTROL: the flag-gate pattern does exist in this dispatcher', () => {
    expect(dispatcherSource).toContain('isDeterministicCeeEnabled')
  })
})

/* ── THE AFFORDANCE ─────────────────────────────────────────────────────────── */
describe('V5GraphPatchBlock — "Why these changes?"', () => {
  it('offers the question on an applied receipt', () => {
    render(<V5GraphPatchBlock block={applied} />)
    expect(screen.getByTestId('explain-diff-trigger')).toBeInTheDocument()
    expect(screen.getByTestId('explain-diff-trigger').textContent).toContain(
      'Why these changes?',
    )
  })

  it('does NOT offer it on a noop receipt (nothing changed to explain)', () => {
    // The route answers 400 "patch has no changes to explain" for an empty patch,
    // so offering the button here would advertise an action that ends in refusal.
    render(<V5GraphPatchBlock block={{ ...applied, status: 'noop' }} />)
    expect(screen.queryByTestId('explain-diff-trigger')).not.toBeInTheDocument()
  })

  it('asks CEE through the browser-reachable seam, with the receipt mapped into updates[]', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse({ rationales: [{ target: 'fac_team_morale', why: 'ok' }] }))

    render(<V5GraphPatchBlock block={applied} />)
    fireEvent.click(screen.getByTestId('explain-diff-trigger'))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled())

    const [url, init] = fetchSpy.mock.calls[0]
    // The seam. `/bff/assist/*` — what the dark version called — does not exist
    // in production and returns the SPA catch-all.
    expect(url).toBe('/bff/cee/explain-diff')

    const body = JSON.parse((init as RequestInit).body as string)
    // Bound by IDENTITY to the receipt on screen, not by a value predicate.
    expect(body.patch.updates).toEqual([
      {
        target_id: 'fac_team_morale',
        operation: 'set_factor_value',
        before: { value: 0.5 },
        after: { value: 0.7 },
      },
    ])
    expect(body.patch.adds.nodes).toEqual([])
    // Real counts from the store, not fabricated.
    expect(body.graph_summary).toEqual({ node_count: 2, edge_count: 1 })
  })

  it("renders the SERVER'S words, verbatim", async () => {
    const serverText = 'Raised because the brief states Q3 headcount is already committed.'
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ rationales: [{ target: 'fac_team_morale', why: serverText }] }),
    )

    render(<V5GraphPatchBlock block={applied} />)
    fireEvent.click(screen.getByTestId('explain-diff-trigger'))

    await waitFor(() =>
      expect(screen.getByTestId('explain-diff-rationale').textContent).toBe(serverText),
    )
  })

  it('renders every rationale the server returns', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        rationales: [
          { target: 'a', why: 'first reason' },
          { target: 'b', why: 'second reason' },
        ],
      }),
    )
    render(<V5GraphPatchBlock block={applied} />)
    fireEvent.click(screen.getByTestId('explain-diff-trigger'))

    await waitFor(() =>
      expect(screen.getAllByTestId('explain-diff-rationale')).toHaveLength(2),
    )
  })

  /* ── HONESTY UNDER FAILURE ────────────────────────────────────────────────── */

  it.each([
    ['a network error', () => vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('boom'))],
    ['a non-ok status', () => vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({}, false))],
    ['the legacy shape that was never real', () =>
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ explanation: 'plausible' }))],
    ['an empty rationale list', () =>
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ rationales: [] }))],
  ])('says plainly that it could not answer, given %s', async (_label, arrange) => {
    arrange()
    render(<V5GraphPatchBlock block={applied} />)
    fireEvent.click(screen.getByTestId('explain-diff-trigger'))

    const notice = await screen.findByTestId('explain-diff-unavailable')
    expect(notice.textContent).toMatch(/couldn.t get an explanation/i)
    // And it leaves a route the user can actually take — the composer is directly
    // below this card.
    expect(notice.textContent).toMatch(/ask in the chat/i)

    // No explanation is claimed.
    expect(screen.queryByTestId('explain-diff-rationale')).not.toBeInTheDocument()
  })

  /**
   * ⚠ THE FABRICATION REGRESSION, PINNED.
   *
   * The dark version rendered the literal "No explanation available" whenever
   * `data.explanation` was undefined — which was ALWAYS, because this route
   * returns `rationales`. It reported failure at the moment the server answered
   * in full, and it did so in words a user reads as the server's verdict.
   */
  it('never renders the old fabricated placeholder, even when the server answers well', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ rationales: [{ target: 'fac_team_morale', why: 'a genuine reason' }] }),
    )
    render(<V5GraphPatchBlock block={applied} />)
    fireEvent.click(screen.getByTestId('explain-diff-trigger'))

    await waitFor(() => expect(screen.getByTestId('explain-diff-rationale')).toBeInTheDocument())
    expect(screen.queryByText(/no explanation available/i)).not.toBeInTheDocument()
  })

  it('always leaves a terminal state — never a spinner that never resolves', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('boom'))
    render(<V5GraphPatchBlock block={applied} />)
    fireEvent.click(screen.getByTestId('explain-diff-trigger'))

    await screen.findByTestId('explain-diff-unavailable')
    expect(screen.getByTestId('explain-diff-trigger').textContent).toContain('Why these changes?')
    expect(screen.getByTestId('explain-diff-trigger')).not.toBeDisabled()
  })
})
