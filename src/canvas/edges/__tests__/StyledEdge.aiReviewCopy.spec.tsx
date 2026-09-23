/**
 * ⛔ THE CANVAS NEVER CALLS AN AI-REVIEW DISAGREEMENT "CONTESTED".
 *
 * Paul, 23 Sep 2026 (D3 · Connectors, item 3): "contested" is reserved for
 * ATTRIBUTABLE HUMAN disagreement — people on the team disagreeing, on the
 * record. What `edge.data.validation` carries is two of Olumi's own drafting
 * passes disagreeing, which is a different fact about a different kind of
 * author. That human carrier does not exist yet, so no contested state renders
 * anywhere on the canvas, and no connection's copy may use the word.
 *
 * Internal identifiers (`readContestedState`, the `contested_*` rule ids, the
 * wire's own `contested_reasons`) keep the word; renaming them is churn. This
 * guard reads ONLY what a person can perceive: rendered text, and the
 * `aria-label` / `title` / `aria-description` attributes a screen reader or a
 * hover surfaces.
 *
 * ⚠ IT IS A GUARD, NOT A RED-FIRST TEST — no user-visible "contested" string
 * exists in StyledEdge at the base this was written against. What makes it
 * worth having is that it CAN fail: the positive controls below prove the
 * probe reads the chip's text, its titles and the hover popover, and the PR
 * records a mutant that injects the word and turns it RED.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, act, cleanup } from '@testing-library/react'
import { StyledEdge } from '../StyledEdge'
import { Position } from '@xyflow/react'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return {
    ...actual,
    BaseEdge: () => <path data-testid="base-edge" />,
    EdgeLabelRenderer: ({ children }: any) => <div>{children}</div>,
    getBezierPath: () => ['M0 0 L100 100', 50, 50],
    getSmoothStepPath: () => ['M0 0 L100 100', 50, 50],
    getStraightPath: () => ['M0 0 L100 100', 50, 50],
    useReactFlow: () => ({ getNode: () => null, getEdges: () => [], getNodes: () => [] }),
    useStore: (selector: any) => selector({ nodes: [] }),
  }
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector: any) =>
    selector({
      updateEdgeData: vi.fn(),
      runMeta: { ceeReview: null },
      results: {
        status: 'complete',
        report: { robustness: { fragile_edges: [{ edge_id: 'e1', switch_probability: 0.42 }] } },
      },
      viewMode: 'detailed',
      lodRung: 'full',
      hoveredOptionId: null,
      highlightedEdges: new Set<string>(),
      dimmedEdgeIds: new Set<string>(),
      lens: {
        active: 'full',
        _dimmedEdgeIds: new Set<string>(),
        _sensitivityWeights: new Map<string, number>(),
        _sensitivityQuartiles: null,
        _fragileEdgeIds: new Set<string>(),
        _lensFragileLabels: new Map<string, string>(),
      },
    }),
  ),
}))

vi.mock('../../store/edgeLabelMode', () => ({
  useEdgeLabelMode: vi.fn((selector: any) => selector({ mode: 'human' })),
}))
vi.mock('../../hooks/useTheme', () => ({ useIsDark: () => false }))
vi.mock('../../hooks/useFirstTimeHints', () => ({
  useEdgeEditHint: () => ({ showHint: false, dismissHint: vi.fn() }),
}))
vi.mock('../../hooks/usePrefersReducedMotion', () => ({ usePrefersReducedMotion: () => false }))
vi.mock('../../../flags', () => ({ isGraphLensEnabled: () => false }))

const REASONS = [
  'sign_flip',
  'strength_band_change',
  'confidence_band_change',
  'existence_boundary_crossing',
  'raw_magnitude',
] as const

function contestedData(reason: string, needs_user_input: boolean) {
  return {
    weight: 0.5,
    direction: 'positive',
    weightSource: 'cee',
    directionSource: 'cee',
    beliefExists: 0.9,
    beliefExistsSource: 'cee',
    validation: {
      status: 'contested',
      contested_reasons: [reason],
      pass1: { strength_mean: 0.3, strength_std: 0.1, exists_probability: 0.8 },
      pass2: {
        strength_mean: 0.7, strength_std: 0.15, exists_probability: 0.9,
        reasoning: 'test', basis: 'domain_prior', needs_user_input,
      },
      max_divergence: 0.6,
      distance_to_goal: 1,
      evoi_rank: null,
      evoi_impact: null,
      was_shown: true,
      user_action: 'pending',
      resolved_value: null,
      resolved_by: 'default',
    },
  }
}

const baseProps = {
  id: 'e1', source: 'n1', target: 'n2',
  sourceX: 0, sourceY: 0, targetX: 100, targetY: 100,
  sourcePosition: Position.Right, targetPosition: Position.Left,
}

const PERCEIVABLE_ATTRS = ['aria-label', 'title', 'aria-description', 'placeholder', 'alt']

/**
 * Every string a person can perceive, ONE PER NODE — never a concatenated
 * `textContent`, which glues neighbours and can both hide and invent a word.
 */
function perceivableStrings(root: HTMLElement): string[] {
  const out: string[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.textContent?.trim()
    if (t) out.push(t)
  }
  for (const el of Array.from(root.querySelectorAll('*'))) {
    for (const a of PERCEIVABLE_ATTRS) {
      const v = el.getAttribute(a)
      if (v && v.trim()) out.push(v.trim())
    }
  }
  return out
}

/** Render one edge twice — SELECTED (chip) and HOVERED (popover) — and pool the copy. */
function corpusFor(data: Record<string, unknown>): string[] {
  const strings: string[] = []
  const selected = render(<StyledEdge {...(baseProps as any)} selected data={data} />)
  strings.push(...perceivableStrings(selected.container))
  cleanup()
  const hovered = render(<StyledEdge {...(baseProps as any)} selected={false} data={data} />)
  const hit = hovered.container.querySelector('path[stroke="transparent"]')
  expect(hit, 'no hover target — the popover half of this probe is blind').not.toBeNull()
  act(() => { fireEvent.mouseEnter(hit!) })
  act(() => { vi.advanceTimersByTime(350) })
  strings.push(...perceivableStrings(hovered.container))
  cleanup()
  return strings
}

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('StyledEdge — no connection copy calls an AI-review disagreement "contested"', () => {
  it.each(REASONS.flatMap((r) => [[r, false], [r, true]] as const))(
    'a %s review disagreement (needs_user_input=%s) renders no "contested" anywhere a person can perceive',
    (reason, needs) => {
      const corpus = corpusFor(contestedData(reason, needs))
      const offenders = corpus.filter((s) => /contest/i.test(s))
      expect(offenders).toEqual([])
    },
  )

  it('POSITIVE CONTROL: the probe reads chip text, row titles AND the hover popover', () => {
    const corpus = corpusFor(contestedData('sign_flip', true))
    // Chip text (the fragility row's word, and its number).
    expect(corpus).toContain('Sensitive')
    // A `title` attribute (the fragility row's own sentence).
    expect(corpus.some((s) => s.includes('42% chance the result flips'))).toBe(true)
    // The hover popover, which only exists in the second render.
    expect(corpus.some((s) => s.includes('flip risk'))).toBe(true)
    // …and the regex itself is live on a string that DOES carry the word.
    expect(/contest/i.test('Contested: two AI passes disagree')).toBe(true)
  })
})
