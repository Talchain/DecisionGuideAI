/**
 * ⭐ REASONING-V2 FIDELITY GAPS #3, #8 AND #14 (model-strip pills only) —
 * `FIDELITY-WORKFLOW-RESULT-20260924.json`, verified against
 * `prototype-v2-reference.html`.
 *
 * #3 / #8 — the subject line (`${TID}-lead`) was clamped to one line with
 * `truncate` while the strip is closed, at `typography.reasoningLead` (18px):
 * the panel's own loudest text arrived as a cut-off ellipsis. The prototype's
 * `.briefrow h2` never clips (`text-wrap:pretty;overflow-wrap:anywhere`). Fix:
 * drop `truncate`, add `break-words`, so the subject always wraps instead of
 * being cut. jsdom applies no layout, so this file cannot see a "wrap" — it
 * pins the STRUCTURAL fact that produces one (no clamp class) and proves the
 * matcher can see a clamp at all via a contrast control (the sibling goal
 * subline, owned by another lane, is left clamped).
 *
 * ⛔ STILL NOT DONE: defaulting the strip OPEN post-run (the map-collapse
 * half of gap #3). Left as filed — it breaks ~a dozen existing ModelStrip
 * specs that assume closed-by-default post-run (e.g.
 * `censusLabelsFit.spec.tsx`'s `openStrip()` helper).
 *
 * ⭐⭐ DONE (design-audit-20260925, gap TYPE-1): the token demotion this note
 * used to defer — `reasoningLead` (18px) to `panelHeader` (14px) — landed in
 * this PR. It does NOT collide with Paul's 18 Sep ruling; it ANSWERS it more
 * directly than the 18px token did, because "lead with the decision label"
 * no longer needs a size step above the rest of the panel to be true — see
 * `theLargestTypeIsTheDecision.spec.tsx`'s re-derived invariant (no panel
 * text above 14px; the -lead element is the first text rendered).
 *
 * #14 — the worklist toggles (`-verify-toggle`, `-no-value-toggle`) and the
 * node-detail "Estimate not yet confirmed" chip (`-detail-verify`) carried
 * `bg-warning/10` / `bg-warning/20` tinted fills. BUILDER-RULES: "Neutral/
 * transparent surfaces. NO tinted backgrounds." The prototype's own pill
 * (`.source-pill`) is outline-only, never filled. Fix: replace the fill with
 * an outlined pill (`border border-panel-border`); the pressed ring recolours
 * `ring-warning` -> `ring-info` so "pressed" does not double as a second,
 * stronger severity read. `text-warning-ink` stays on every case, so the
 * severity signal itself (and `amberIsRationed.spec.tsx`'s census, which keys
 * on `text-warning`) is unchanged — only the fill goes.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

const nodes: unknown[] = []
type MockState = { nodes: unknown; setHighlightedNodes: unknown }
const setHighlightedNodesSpy = vi.fn()
vi.mock('../../../../canvas/store', () => {
  const read = (): MockState => ({ nodes, setHighlightedNodes: setHighlightedNodesSpy })
  const useCanvasStore = (select: (s: MockState) => unknown) => select(read())
  ;(useCanvasStore as unknown as { getState: () => MockState }).getState = read
  return { useCanvasStore }
})
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: () => true }))
vi.mock('../../../../canvas/utils/highlightHelpers', () => ({
  highlightNode: vi.fn(),
  clearHighlight: vi.fn(),
}))
vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/ToastContext', () => ({ useShowToastSafe: () => vi.fn() }))

import { ModelStrip } from '../sections/ModelStrip'

const TID = 'analysis-new-model-strip'

const setNodes = (next: unknown[]) => {
  nodes.length = 0
  nodes.push(...next)
}
afterEach(() => {
  cleanup()
  setHighlightedNodesSpy.mockClear()
})

/** A factor whose value needs verification — the shape that lets a mark open
 * `-detail-verify`. */
const needsCheckFactor = (id: string, label: string) => ({
  id,
  type: 'factor',
  data: {
    label,
    observedState: { value: 0.49, raw_value: 49, unit: '£', source: 'cee_inference' },
    confidence: 'low',
  },
})

const DECISION_AND_GOAL = [
  { id: 'd1', type: 'decision', data: { label: 'Which data platform to adopt' } },
  { id: 'g1', type: 'goal', data: { label: 'Sustained margin' } },
  needsCheckFactor('f1', 'Supplier lead time'),
]

// Paul 14 Oct 2026: the decision text no longer displays at the top of the Reasoning panel.
// The subject (`-lead`) and its goal sub-line (`-goal`) are `sr-only`: visually hidden, still in the accessibility
// tree (the region's aria-labelledby names the lead). The clamp-vs-wrap pins below are re-pinned to that fact.
describe('fidelity gaps #3 / #8 — the subject line is screen-reader-only, never clamped', () => {
  it('⭐ the goal sub-line (`-goal`) is `sr-only` while closed — visually hidden, still in the accessibility tree', () => {
    setNodes(DECISION_AND_GOAL)
    render(<ModelStrip isPreRun={false} />)
    // Closed by default post-run (isPreRun=false, no override yet).
    expect(screen.getByTestId(`${TID}-toggle`)).toHaveAttribute('aria-expanded', 'false')
    const goalLine = screen.getByTestId(`${TID}-goal`)
    expect(goalLine).toHaveClass('sr-only')
    expect(goalLine.closest('[aria-hidden="true"]'), 'hidden visually, never from assistive tech').toBeNull()
  })

  it('⭐⭐ the subject (`-lead`) is `sr-only` and carries no `truncate`, closed', () => {
    setNodes(DECISION_AND_GOAL)
    render(<ModelStrip isPreRun={false} />)
    expect(screen.getByTestId(`${TID}-toggle`)).toHaveAttribute('aria-expanded', 'false')
    const lead = screen.getByTestId(`${TID}-lead`)
    expect(lead.className, 'the subject must never be cut to one line').not.toMatch(/\btruncate\b/)
    expect(lead).toHaveClass('sr-only')
    expect(lead.closest('[aria-hidden="true"]'), 'hidden visually, never from assistive tech').toBeNull()
  })

  // Paul 14 Oct 2026: one checklist — Brief/Decision, Goal, census. Opened, the subject is the Decision row's text:
  // displayed, one clipped line at rest, the whole question on a click (never lost: `title` carries it too).
  it('⭐ once opened, the subject is the Decision row: shown, clipped at rest, whole on a click', () => {
    setNodes(DECISION_AND_GOAL)
    render(<ModelStrip isPreRun={false} />)
    fireEvent.click(screen.getByTestId(`${TID}-toggle`))
    expect(screen.getByTestId(`${TID}-toggle`)).toHaveAttribute('aria-expanded', 'true')
    const lead = screen.getByTestId(`${TID}-lead`)
    expect(lead).not.toHaveClass('sr-only')
    expect(lead.closest('[aria-hidden="true"]'), 'never hidden from assistive tech').toBeNull()
    const text = screen.getByTestId(`${TID}-lead-text`)
    expect(text).toHaveTextContent('Which data platform to adopt')
    expect(text).toHaveAttribute('title', 'Which data platform to adopt')
    expect(text).toHaveAttribute('aria-expanded', 'false')
    expect(text.className).toMatch(/\btruncate\b/)
    fireEvent.click(text)
    expect(text).toHaveAttribute('aria-expanded', 'true')
    expect(text.className, 'a click shows the whole question').not.toMatch(/\btruncate\b/)
    // The goal is the Goal row now, not an sr-only sub-line.
    expect(screen.queryByTestId(`${TID}-goal`)).toBeNull()
    expect(screen.getByTestId(`${TID}-target-text`)).toHaveTextContent('Sustained margin')
  })
})

describe('fidelity gap #14 — the model-strip pills carry no tinted fill', () => {
  // V2 (Paul, 25 Sep 2026): the two worklist toggles left the strip, so their
  // no-fill cases went with them. The detail chip below is the pill that stays.
  /*
   * ⚠ RE-PINNED 26 Sep 2026 (design audit B12): the chip itself is gone — the
   * V2 prototype's detail has none, and an unconfirmed factor is a review-queue
   * item whose tool says so. What this case keeps pinning is the rule it was
   * written for: nothing on the node detail carries a tinted fill, including
   * the detail itself (it was a `bg-panel-hover` card; it is now a divider).
   */
  it('⭐ the node detail carries no tinted fill — no chip, and no tinted card', () => {
    setNodes([needsCheckFactor('f1', 'Supplier lead time')])
    render(<ModelStrip isPreRun={false} />)
    fireEvent.click(screen.getByTestId(`${TID}-toggle`))
    fireEvent.click(screen.getByTestId(`${TID}-mark`))

    const detail = screen.getByTestId(`${TID}-detail`)
    // CONTRAST: this is the node that USED to carry the chip.
    expect(detail).toHaveAttribute('data-node-id', 'f1')
    expect(screen.queryByTestId(`${TID}-detail-verify`)).toBeNull()
    const filled = [detail, ...Array.from(detail.querySelectorAll('*'))].filter((el) =>
      (el.getAttribute('class') ?? '').split(/\s+/).some((c) => /^bg-(warning|panel-hover|info\/)/.test(c)),
    )
    expect(filled).toEqual([])
  })
})
