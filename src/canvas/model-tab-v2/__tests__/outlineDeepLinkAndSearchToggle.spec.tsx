/**
 * ⭐⭐ TWO DEFECTS #1275 SHIPPED, BOTH MEASURED ON MERGED STAGING.
 *
 * ── 1. `open_section` NO LONGER OPENED A SECTION ─────────────────────────
 * `ModelTabBody` scrolls `model-group-v2-<id>` into view for five live callers:
 * the assistant's `open_section` directive (`applyV5State.ts`), PreAnalysisPanel's
 * "See all relationships", `ContestedSection`, `TriageActionCardsBody` and
 * `AnalysisHeroContainer`. That `<section>` wrapper renders unconditionally
 * while its BODY is gated on `open` — so once the outline began arriving
 * closed, all five landed the reader on a collapsed heading. The scroll
 * "succeeded" and the list they asked for stayed behind a click nobody told
 * them to make.
 *
 * ⚠ AND NO TEST COULD SEE IT. The only pin
 * (`ModelTabBody.v1StackCollapsed.spec.tsx:128-133`) asserts the section
 * ELEMENT was scrolled to — and that element still renders. It binds to the
 * container rather than to visible content, so it passed unchanged while the
 * user-visible outcome regressed. That is assertion-by-predicate one level up.
 *
 * ── 2. THE HEADER TOGGLE WAS INERT WHILE A FILTER WAS ACTIVE ─────────────
 * `open: openGroups.has(id) || (searching && rows > 0)`. Both `aria-expanded`
 * and the body gate read that value; the click handler mutated only the resting
 * `closed` set. So during a search the chevron never moved, a screen reader was
 * told the button controlled an expanded region it would not collapse — and the
 * hidden flip surfaced later: clearing the search DUMPED the full list, because
 * the click meant to CLOSE the group had removed it from `closed`.
 *
 * ⚠ Measured coverage before this file: four group-toggle click lines exist
 * repo-wide, all in `ModelOutline.spec.tsx`, which never touches the filter;
 * three spec files DO drive the filter and not one clicks a toggle. **No spec
 * anywhere exercised toggle-while-filtering.**
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent, screen } from '@testing-library/react'
import type { Node, Edge } from '@xyflow/react'

vi.mock('../../conversation/ConversationContext', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, useOptionalConversationContext: () => ({ sendSystemEvent: vi.fn() }) }
})
vi.mock('../../utils/focusHelpers', () => ({ focusNodeById: vi.fn(), focusEdgeById: vi.fn() }))

import { ModelTabV2Panel } from '../ModelTabV2Panel'
import { useCanvasStore } from '../../store'

const FACTOR_A = 'fac_alpha'
const FACTOR_B = 'fac_beta'

const nodes = (): Node[] =>
  [
    { id: 'goal_x', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Hit ARR target', kind: 'goal' } },
    {
      id: FACTOR_A, type: 'factor', position: { x: 0, y: 0 },
      data: { label: 'Alpha Engineering Cost', kind: 'factor', category: 'observable' },
    },
    {
      id: FACTOR_B, type: 'factor', position: { x: 0, y: 0 },
      data: { label: 'Beta Team Capacity', kind: 'factor', category: 'observable' },
    },
  ] as unknown as Node[]

const renderPanel = (openGroupRequest: 'factors' | null = null) =>
  render(
    <ModelTabV2Panel
      nodes={nodes()}
      edges={[] as Edge[]}
      goalThreshold={null}
      openGroupRequest={openGroupRequest}
    />,
  )

const factorsToggle = () => screen.getByTestId('model-group-v2-factors-toggle')
const isOpen = () => factorsToggle().getAttribute('aria-expanded') === 'true'
const rowVisible = (id: string) => screen.queryByTestId(`model-row-v2-${id}`) !== null
const filterBox = () => screen.getByTestId('model-tab-v2-filter')

beforeEach(() => {
  useCanvasStore.setState({ nodes: nodes(), edges: [] } as never, false)
})
afterEach(cleanup)

describe('1 — a deep link opens the section it scrolls to', () => {
  it('PRECONDITION: with no request the group is CLOSED and its rows are hidden', () => {
    renderPanel(null)
    expect(isOpen()).toBe(false)
    // Bound to a ROW, not to the section wrapper — the wrapper renders either
    // way, which is exactly why the existing pin could not see the defect.
    expect(rowVisible(FACTOR_A)).toBe(false)
  })

  it('⭐ a request OPENS the group, and the rows are actually rendered', () => {
    renderPanel('factors')
    expect(isOpen()).toBe(true)
    expect(rowVisible(FACTOR_A)).toBe(true)
    expect(rowVisible(FACTOR_B)).toBe(true)
  })

  it('⛔ IT IS ONE-WAY — a request never CLOSES what the reader opened', () => {
    // A deep link that could collapse a section would be a new defect wearing
    // the fix's clothes.
    const { rerender } = render(
      <ModelTabV2Panel nodes={nodes()} edges={[] as Edge[]} goalThreshold={null} openGroupRequest={'factors'} />,
    )
    expect(isOpen()).toBe(true)
    rerender(
      <ModelTabV2Panel nodes={nodes()} edges={[] as Edge[]} goalThreshold={null} openGroupRequest={null} />,
    )
    expect(isOpen()).toBe(true)
  })
})

describe('2 — the header toggle works while a filter is active', () => {
  it('PRECONDITION: searching reveals the matching group, which is the behaviour being preserved', () => {
    renderPanel(null)
    expect(isOpen()).toBe(false)
    fireEvent.change(filterBox(), { target: { value: 'Alpha' } })
    expect(isOpen()).toBe(true)
    expect(rowVisible(FACTOR_A)).toBe(true)
  })

  it('⭐ clicking the header while searching ACTUALLY CLOSES IT', () => {
    renderPanel(null)
    fireEvent.change(filterBox(), { target: { value: 'Alpha' } })
    expect(isOpen()).toBe(true)

    fireEvent.click(factorsToggle())
    // The three things that were all wrong before: the state, the announcement,
    // and the content.
    expect(isOpen()).toBe(false)
    expect(factorsToggle().getAttribute('aria-expanded')).toBe('false')
    expect(rowVisible(FACTOR_A)).toBe(false)
  })

  it('⭐ and clicking again re-opens it — inert in BOTH directions before', () => {
    renderPanel(null)
    fireEvent.change(filterBox(), { target: { value: 'Alpha' } })
    fireEvent.click(factorsToggle())
    fireEvent.click(factorsToggle())
    expect(isOpen()).toBe(true)
    expect(rowVisible(FACTOR_A)).toBe(true)
  })

  it('⛔ THE SEARCH-TIME CLICK DOES NOT LEAK INTO THE RESTING OUTLINE', () => {
    // The defect's second half, and the one a reader actually met: a click made
    // to CLOSE a group removed it from `closed`, so clearing the search DUMPED
    // the full list. The resting state must be exactly what it was.
    renderPanel(null)
    expect(isOpen()).toBe(false)

    fireEvent.change(filterBox(), { target: { value: 'Alpha' } })
    fireEvent.click(factorsToggle())          // close it, during the search
    fireEvent.change(filterBox(), { target: { value: '' } })  // clear the search

    expect(isOpen()).toBe(false)
    expect(rowVisible(FACTOR_A)).toBe(false)
  })

  it('⛔ AND A SEARCH-TIME CLOSE DOES NOT SURVIVE INTO THE NEXT SEARCH', () => {
    renderPanel(null)
    fireEvent.change(filterBox(), { target: { value: 'Alpha' } })
    fireEvent.click(factorsToggle())                          // closed for THIS search
    fireEvent.change(filterBox(), { target: { value: '' } })  // search ends
    fireEvent.change(filterBox(), { target: { value: 'Beta' } })

    // A fresh search starts from the search's own default, not from the last
    // one's leftovers.
    expect(isOpen()).toBe(true)
    expect(rowVisible(FACTOR_B)).toBe(true)
  })
})
