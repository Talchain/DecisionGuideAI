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

describe('fidelity gaps #3 / #8 — the subject line no longer clamps', () => {
  it('⭐ PRECONDITION: the matcher can see a clamp — the goal subline (out of\n      scope, another lane owns it) still carries `truncate` while closed', () => {
    setNodes(DECISION_AND_GOAL)
    render(<ModelStrip isPreRun={false} />)
    // Closed by default post-run (isPreRun=false, no override yet).
    expect(screen.getByTestId(`${TID}-toggle`)).toHaveAttribute('aria-expanded', 'false')
    const goalLine = screen.getByTestId(`${TID}-goal`)
    expect(goalLine.className, 'the sibling this PR does not touch is still clamped').toMatch(/\btruncate\b/)
  })

  it('⭐⭐ the subject (`-lead`) carries no `truncate`, closed', () => {
    setNodes(DECISION_AND_GOAL)
    render(<ModelStrip isPreRun={false} />)
    expect(screen.getByTestId(`${TID}-toggle`)).toHaveAttribute('aria-expanded', 'false')
    const lead = screen.getByTestId(`${TID}-lead`)
    expect(lead.className, 'the panel\'s loudest text must never be cut to one line').not.toMatch(/\btruncate\b/)
    expect(lead.className, 'and must wrap instead').toMatch(/\bbreak-words\b/)
  })

  it('⭐ and carries no `truncate` once opened either — never clamped, either state', () => {
    setNodes(DECISION_AND_GOAL)
    render(<ModelStrip isPreRun={false} />)
    fireEvent.click(screen.getByTestId(`${TID}-toggle`))
    expect(screen.getByTestId(`${TID}-toggle`)).toHaveAttribute('aria-expanded', 'true')
    const lead = screen.getByTestId(`${TID}-lead`)
    expect(lead.className).not.toMatch(/\btruncate\b/)
  })
})

describe('fidelity gap #14 — the model-strip pills carry no tinted fill', () => {
  // V2 (Paul, 25 Sep 2026): the two worklist toggles left the strip, so their
  // no-fill cases went with them. The detail chip below is the pill that stays.
  it('⭐ the node-detail "not yet confirmed" chip carries no tinted fill', () => {
    setNodes([needsCheckFactor('f1', 'Supplier lead time')])
    render(<ModelStrip isPreRun={false} />)
    fireEvent.click(screen.getByTestId(`${TID}-toggle`))
    fireEvent.click(screen.getByTestId(`${TID}-mark`))

    const chip = screen.getByTestId(`${TID}-detail-verify`)
    expect(chip.className).not.toMatch(/bg-warning/)
    expect(chip.className, 'severity ink is unchanged').toContain('text-warning-ink')
  })
})
