/**
 * BaseNode — node titles must wrap at WORD boundaries, never mid-word.
 *
 * Defect witnessed on deployed staging build f2b48fc9 (14 Aug 2026), in a real
 * browser: when a dense tier compresses cards to NODE_LAYOUT_MIN_W (140px), the
 * title shared its flex row with the shape indicator and the header slot,
 * leaving a 77px measure. `overflow-wrap: break-word` is a LAST-RESORT rule —
 * it splits a word mid-character the moment that word cannot fit the line box —
 * so ordinary words broke mid-word:
 *
 *   "Team Coordination Overhead"  ->  "Team Coordinatio / n Overhead"
 *   "Development Headcount"       ->  "Developme / nt Headcount"
 *
 * Measured in-browser with Range.getClientRects (line-box spans per word):
 * 3 of 16 titles broke mid-word at the compressed width; 0 after this fix.
 *
 * jsdom CANNOT assert layout — it has no line boxes and no text metrics. This
 * spec therefore binds to the CSS RULE CONTRACT that produces word-boundary
 * wrapping, by IDENTITY (`data-testid="node-title"`), never by a value
 * predicate another element could satisfy. The visual witness is the browser
 * screenshot / Range measurement recorded on the PR, not this file.
 */

import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { Target } from 'lucide-react'
import { BaseNode } from '../BaseNode'
import { NODE_TITLE_MIN_MEASURE_PX } from '../../utils/nodeLayoutConstants'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return {
    ...actual,
    Handle: () => null,
    useUpdateNodeInternals: () => vi.fn(),
  }
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) =>
    selector({
      highlightedNodes: new Set(),
      dimmedNodeIds: new Set(),
      lens: { _dimmedNodeIds: new Set() },
      results: { status: 'idle' },
      goalThreshold: null,
      goalConstraints: [],
      edges: [],
      viewMode: 'expert',
    })
  ),
}))

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null,
    influence: null,
    confidence: null,
    inSensitivityAnalysis: false,
    achievementProbability: null,
    winRate: null,
    isResultsMode: false,
  })),
}))

const baseProps = {
  id: 'node-1',
  selected: false,
  dragging: false,
  zIndex: 0,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  type: 'factor',
  xPos: 0,
  yPos: 0,
  deletable: true,
  selectable: true,
  draggable: true,
}

/** The exact labels Paul reported breaking mid-word on staging f2b48fc9. */
const REPORTED_LABEL = 'Team Coordination Overhead'

/**
 * Render at the compressed card width the layout pipeline actually produces
 * (NODE_LAYOUT_MIN_W = 140) — the only width at which the defect appears.
 */
function renderTitle(label: string = REPORTED_LABEL) {
  const { container } = render(
    <BaseNode
      {...baseProps}
      data={{ label }}
      nodeType="factor"
      icon={Target}
      maxWidth={140}
    />
  )
  const title = container.querySelector('[data-testid="node-title"]') as HTMLElement | null
  expect(title, 'node-title must exist — bind by testid, not by class').toBeTruthy()
  return { container, title: title as HTMLElement }
}

describe('BaseNode — titles wrap at word boundaries (never mid-word)', () => {
  it('reserves a minimum title measure wide enough for an ordinary word', () => {
    const { title } = renderTitle()
    const wrapper = title.parentElement as HTMLElement

    // The title's flex wrapper must carry a real minimum measure. Without it
    // (`min-w-0`), the wrapper collapses to 77px inside a 140px card and
    // break-word splits "Coordination" mid-word.
    expect(wrapper.style.minWidth).toBe(`${NODE_TITLE_MIN_MEASURE_PX}px`)
    expect(NODE_TITLE_MIN_MEASURE_PX).toBeGreaterThanOrEqual(96)
  })

  it('does not let the title shrink to zero (min-w-0 must not govern the title)', () => {
    const { title } = renderTitle()
    const wrapper = title.parentElement as HTMLElement

    // `min-w-0` is precisely the rule that permits a sub-word measure.
    expect(wrapper.className).not.toContain('min-w-0')
    expect(wrapper.style.minWidth).not.toBe('0px')
    expect(wrapper.style.minWidth).not.toBe('')
  })

  it('lets the header row wrap so the header slot yields instead of the title', () => {
    const { title } = renderTitle()
    const row = title.parentElement?.parentElement as HTMLElement

    // With a minimum title measure but a non-wrapping row, the shape indicator
    // and header slot would overflow the card instead of moving below.
    expect(row.style.flexWrap).toBe('wrap')
    expect(row.style.display).toBe('flex')
  })

  it('keeps break-words so a genuinely unbreakable token still wraps', () => {
    // break-word must REMAIN: a single 40-char token with no spaces has no word
    // boundary to wrap at, and must break rather than overflow the card.
    const { title } = renderTitle('Supercalifragilisticexpialidociousness')
    expect(title.className).toContain('break-words')
  })

  it('applies the contract to the exact label reported on staging f2b48fc9', () => {
    const { title } = renderTitle(REPORTED_LABEL)
    const wrapper = title.parentElement as HTMLElement

    expect(title.textContent).toBe(REPORTED_LABEL)
    // Bind the regression to the reported string by identity.
    expect(wrapper.style.minWidth).toBe(`${NODE_TITLE_MIN_MEASURE_PX}px`)
  })
})
