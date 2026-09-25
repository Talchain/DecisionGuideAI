/**
 * design-b1w2-header-structure — H1 (the title fallback chain) and H2 (the
 * closed tally's glyph strip), stacked on wave 1 (#2024).
 *
 * ⭐⭐ THE DATA GAP THIS FILE IS BUILT AROUND (D1, reported to the model owners
 * on #69 5832347190): the decision node carries no `question` field. It is
 * only `{id, kind, label: 'Decision: <goal label>', provenance}`. So the title
 * prefers, in order: a `question` field on the decision node, should one ever
 * arrive; the user's own brief, trimmed to one sentence; and only then the
 * structural decision/goal label, its `'Decision: '` prefix stripped. Never
 * invented — every arm is either the producer's own field or the user's own
 * words.
 *
 * Bound by identity — testids and exact text — never a value another element
 * could satisfy.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: () => true }))
vi.mock('../../../../canvas/utils/highlightHelpers', () => ({
  highlightNode: vi.fn(),
  clearHighlight: vi.fn(),
}))
vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/ToastContext', () => ({ useShowToastSafe: () => vi.fn() }))

import { ModelStrip } from '../sections/ModelStrip'
import { useCanvasStore } from '../../../../canvas/store'
import { useContextIntegrityStore } from '../../../../canvas/stores/contextIntegrityStore'

const TID = 'analysis-new-model-strip'
const SCENARIO = 'scn_header_structure'
const node = (id: string, type: string, data: Record<string, unknown>) => ({ id, type, data })

const recordBrief = (briefText: string | null) =>
  useContextIntegrityStore.setState({ scenarioId: SCENARIO, briefText, manifest: null, modelBuildingNotices: null })

const setNodes = (nodes: unknown[]) => useCanvasStore.setState({ nodes, currentScenarioId: SCENARIO } as never)

beforeEach(() => {
  setNodes([])
  recordBrief(null)
})
afterEach(() => {
  cleanup()
  useContextIntegrityStore.getState().reset()
})

describe('H1: the title fallback chain', () => {
  it('⭐⭐ prefers the brief, trimmed to one sentence, over the structural decision label', () => {
    setNodes([
      node('d1', 'decision', { label: 'Decision: Hire a tech lead or two developers' }),
      node('f1', 'factor', { label: 'Budget' }),
    ])
    recordBrief('Should we hire a tech lead or two developers? Budget is capped at £150k this year.')
    render(<ModelStrip isPreRun={false} />)
    expect(screen.getByTestId(`${TID}-lead`)).toHaveTextContent(
      'Should we hire a tech lead or two developers?',
    )
    // The prototype's title carries no subtitle at all when it leads with the
    // question — the framing is already stated in the sentence itself.
    expect(screen.queryByTestId(`${TID}-goal`)).toBeNull()
  })

  it('⭐ a decision node `question` field, should one ever arrive, outranks even the brief', () => {
    setNodes([
      node('d1', 'decision', {
        label: 'Decision: Hire a tech lead or two developers',
        question: 'Hire a tech lead or two developers?',
      }),
      node('f1', 'factor', { label: 'Budget' }),
    ])
    recordBrief('A completely different sentence the question field must outrank.')
    render(<ModelStrip isPreRun={false} />)
    expect(screen.getByTestId(`${TID}-lead`)).toHaveTextContent('Hire a tech lead or two developers?')
  })

  it('⛔ never invents: with no question field and no brief, it falls through to the structural label, prefix stripped', () => {
    setNodes([
      node('d1', 'decision', { label: 'Decision: Productivity increase' }),
      node('f1', 'factor', { label: 'Headcount' }),
    ])
    render(<ModelStrip isPreRun={false} />)
    const lead = screen.getByTestId(`${TID}-lead`)
    expect(lead).toHaveTextContent('Productivity increase')
    expect(lead).not.toHaveTextContent('Decision:')
  })

  it('⭐ CONTRAST: a genuinely distinct goal still gets its own subtitle when there is no question or brief', () => {
    setNodes([
      node('d1', 'decision', { label: 'Which data platform to adopt' }),
      node('g1', 'goal', { label: 'Sustained margin' }),
      node('f1', 'factor', { label: 'Supplier lead time' }),
    ])
    render(<ModelStrip isPreRun={false} />)
    expect(screen.getByTestId(`${TID}-goal`)).toHaveTextContent('Sustained margin')
  })

  it('the brief is cut to its first sentence, never rendered as a paragraph', () => {
    setNodes([node('d1', 'decision', { label: 'Decision: Hire' }), node('f1', 'factor', { label: 'Budget' })])
    recordBrief('Hire a tech lead or two developers? Budget is fixed at £150k. There is no room to move.')
    render(<ModelStrip isPreRun={false} />)
    const lead = screen.getByTestId(`${TID}-lead`)
    expect(lead).toHaveTextContent('Hire a tech lead or two developers?')
    expect(lead).not.toHaveTextContent('Budget is fixed')
  })
})

describe('H2: the closed tally draws a capped glyph strip, not one mark', () => {
  it('⭐⭐ a row of 20 factors draws SUMMARY_GLYPH_CAP (6) glyphs, never one and never all 20', () => {
    setNodes([
      node('g1', 'goal', { label: 'Grow margin' }),
      ...Array.from({ length: 20 }, (_, i) => node(`f${i}`, 'factor', { label: `Factor ${i}` })),
    ])
    render(<ModelStrip isPreRun={false} />)
    const factorTally = screen
      .getAllByTestId(`${TID}-tally`)
      .find((el) => el.getAttribute('data-kind') === 'factor')!
    expect(factorTally.querySelectorAll('[data-mark-kind]')).toHaveLength(6)
    // The count itself is never clamped — only the decorative glyphs are.
    expect(factorTally).toHaveTextContent('20')
    // No interactive per-node marks leak into the closed tally (unchanged
    // invariant from `modelStripFootprint.spec.tsx`, re-asserted here because
    // this change touches the exact span that invariant guards).
    expect(screen.queryAllByTestId(`${TID}-mark`)).toHaveLength(0)
  })

  it('a row under the cap draws exactly one glyph per node', () => {
    setNodes([
      node('g1', 'goal', { label: 'Grow margin' }),
      node('o1', 'option', { label: 'Option A' }),
      node('o2', 'option', { label: 'Option B' }),
    ])
    render(<ModelStrip isPreRun={false} />)
    const optionTally = screen
      .getAllByTestId(`${TID}-tally`)
      .find((el) => el.getAttribute('data-kind') === 'option')!
    expect(optionTally.querySelectorAll('[data-mark-kind]')).toHaveLength(2)
  })
})
