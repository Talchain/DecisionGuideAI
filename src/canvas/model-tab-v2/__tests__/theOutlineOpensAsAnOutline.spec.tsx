/**
 * THE MODEL OUTLINE OPENS AS AN OUTLINE, AND CLOSING COSTS NO INFORMATION.
 *
 * `initiallyClosedGroups` has existed since `ModelOutline` was written and
 * NOTHING ever passed it, so all seven groups rendered open. Measured on
 * deployed staging with a real completed analysis: **8 of 9 expanded regions
 * and 1,817px of scroll** before the reader has chosen anything. That is a
 * dump, not progressive disclosure.
 *
 * ⚠⚠ THE SECOND HALF IS THE POINT, AND IT IS THE HALF A NAIVE PIN WOULD MISS.
 * "Every group is closed" is trivially satisfiable by rendering nothing useful
 * — hiding information and calling it disclosure. What makes this change safe
 * is that the COLLAPSED HEADER still carries the group name, the row COUNT and
 * `unsetSummary` ("2 with no value yet"), all derived from the same fields the
 * rows read. So the closed state IS the model at a glance.
 *
 * Both halves are asserted. A change that closed the groups AND dropped the
 * counts would satisfy the first and REDs on the second.
 *
 * ⚠ NOT the piecemeal pattern Paul named. Each of these seven hides a real
 * list, not a sentence; the complaint being answered is twelve small doors each
 * buying one line. Level 1 is the shape of the model, level 2 is the rows.
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
import { MODEL_GROUP_IDS, type ModelGroupId } from '../types'
import { useCanvasStore } from '../../store'

const GOAL_ID = 'goal_arr'
const FACTOR_SET = 'fac_priced'
const FACTOR_UNSET = 'fac_unpriced'

const nodes = (): Node[] =>
  [
    { id: GOAL_ID, type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Hit ARR target', kind: 'goal' } },
    {
      id: FACTOR_SET,
      type: 'factor',
      position: { x: 0, y: 0 },
      data: {
        label: 'Monthly Engineering Cost',
        kind: 'factor',
        category: 'observable',
        observedState: { value: 1, raw_value: 30000, cap: 30000, unit: '£', source: 'cee_inference' },
      },
    },
    // Deliberately UNVALUED, so `unsetSummary` has something to say on the
    // factors header. Without it the second half of the ruling is vacuous.
    {
      id: FACTOR_UNSET,
      type: 'factor',
      position: { x: 0, y: 0 },
      data: { label: 'Data Team Capacity', kind: 'factor', category: 'observable' },
    },
  ] as unknown as Node[]

const edges = (): Edge[] => []

const renderPanel = (requestedGroupId: ModelGroupId | null = null) =>
  render(
    <ModelTabV2Panel
      nodes={nodes()}
      edges={edges()}
      goalThreshold={null}
      requestedGroupId={requestedGroupId}
    />,
  )

/** Every group whose header currently reads open — the object of the discriminators. */
const openGroupIds = (): string[] =>
  MODEL_GROUP_IDS.filter(
    id =>
      screen.queryByTestId(`model-group-v2-${id}-toggle`)?.getAttribute('aria-expanded') === 'true',
  )

beforeEach(() => {
  useCanvasStore.setState({ nodes: nodes(), edges: edges() } as never, false)
})
afterEach(cleanup)

describe('the Model outline opens as an outline', () => {
  it('PRECONDITION: the fixture really does have an unvalued factor, or half two is vacuous', () => {
    renderPanel()
    expect(
      screen.queryByTestId('model-group-v2-factors-unknown-summary'),
      'no unknown summary in the fixture — the information-survives assertion would prove nothing',
    ).not.toBeNull()
  })

  it('HALF ONE: every group is CLOSED on first render', () => {
    renderPanel()
    const open = MODEL_GROUP_IDS.filter(
      id => screen.queryByTestId(`model-group-v2-${id}-toggle`)?.getAttribute('aria-expanded') === 'true',
    )
    expect(open, `these groups opened uninvited: ${open.join(', ')}`).toEqual([])
  })

  it('HALF TWO: the closed header still carries the COUNT and the unknown summary', () => {
    renderPanel()
    const header = screen.getByTestId('model-group-v2-factors-toggle')
    // Closed, and still saying what is inside.
    expect(header.getAttribute('aria-expanded')).toBe('false')
    expect(header.textContent).toContain('2') // both factors counted
    const summary = screen.getByTestId('model-group-v2-factors-unknown-summary')
    expect(summary.textContent?.trim().length).toBeGreaterThan(0)
    // IDENTITY, not proximity: the summary belongs to THIS group's header.
    expect(header.contains(summary)).toBe(true)
  })

  it('the rows are genuinely hidden while closed — this is disclosure, not a style change', () => {
    renderPanel()
    expect(screen.queryByTestId(`model-row-v2-${FACTOR_UNSET}`)).toBeNull()
  })

  // ══════════════════════════════════════════════════════════════════════════
  // ⭐⭐ THE REGRESSION THE CLOSED DEFAULT INTRODUCED, AND ITS FIX.
  //
  // Closing the groups made the tab's ONE search box useless on arrival: the
  // needle narrowed `rows` and never touched `open`, so a reader who typed
  // matched rows that were never rendered. `outlineLayout` now opens a group
  // WHILE SEARCHING if that group has a match — and only then.
  //
  // Found by an existing test going RED, not by inspection. The tempting
  // repair was to open the groups inside that test, which would have left the
  // defect live under a green suite.
  // ══════════════════════════════════════════════════════════════════════════
  it('a search REVEALS its matches even though every group is shut', () => {
    renderPanel()
    // PRECONDITION, pinned: nothing is on screen before the search, so the
    // negative assertions below cannot pass merely because a group is closed.
    expect(screen.queryByTestId(`model-row-v2-${FACTOR_SET}`)).toBeNull()
    expect(screen.queryByTestId(`model-row-v2-${FACTOR_UNSET}`)).toBeNull()

    fireEvent.change(screen.getByTestId('model-tab-v2-filter'), {
      target: { value: 'Engineering' },
    })

    // The match is revealed...
    expect(
      screen.getByTestId(`model-row-v2-${FACTOR_SET}`),
      'a search that reveals nothing is not a search',
    ).toBeInTheDocument()
    // ...and its group is genuinely OPEN, which is what makes the next
    // assertion mean "filtered out" rather than "still collapsed".
    expect(
      screen.getByTestId('model-group-v2-factors-toggle').getAttribute('aria-expanded'),
    ).toBe('true')
    // The sibling in the SAME group is absent because it does not match.
    expect(screen.queryByTestId(`model-row-v2-${FACTOR_UNSET}`)).toBeNull()
  })

  it('DISCRIMINATOR: searching opens ONLY the groups that have a match', () => {
    // The paired half. Without it, "open every group whenever the box is
    // non-empty" would satisfy the test above and turn any keystroke into the
    // 1,817px dump this PR exists to remove.
    renderPanel()
    fireEvent.change(screen.getByTestId('model-tab-v2-filter'), {
      target: { value: 'Engineering' },
    })
    expect(
      screen.getByTestId('model-group-v2-goal-toggle').getAttribute('aria-expanded'),
      'the goal group holds no match and must stay shut',
    ).toBe('false')
    expect(screen.queryByTestId(`model-row-v2-${GOAL_ID}`)).toBeNull()

    const opened = MODEL_GROUP_IDS.filter(
      id => screen.queryByTestId(`model-group-v2-${id}-toggle`)?.getAttribute('aria-expanded') === 'true',
    )
    expect(opened, `only a matching group may open; these did: ${opened.join(', ')}`).toEqual(['factors'])
  })

  it('one click opens the group the reader asked for, and only that one', () => {
    renderPanel()
    fireEvent.click(screen.getByTestId('model-group-v2-factors-toggle'))
    expect(screen.getByTestId('model-group-v2-factors-toggle').getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByTestId(`model-row-v2-${FACTOR_UNSET}`)).toBeInTheDocument()
    // Toggling one NEVER touches another — the outline's own design rule.
    const others = MODEL_GROUP_IDS.filter(id => id !== 'factors').filter(
      id => screen.queryByTestId(`model-group-v2-${id}-toggle`)?.getAttribute('aria-expanded') === 'true',
    )
    expect(others, `opening factors also opened: ${others.join(', ')}`).toEqual([])
  })

  // ══════════════════════════════════════════════════════════════════════════
  // ⭐⭐ THE SECOND REGRESSION THE CLOSED DEFAULT INTRODUCED.
  //
  // Five live surfaces deep-link INTO a section (`requestModelTabSection`), and
  // not one of them was updated to open what it points at. The `<section>`
  // wrapper renders whether the group is open or shut, so the host's
  // `querySelector` resolved, `scrollIntoView` fired, the request drained — and
  // the reader arrived at a heading with nothing under it. The spec that should
  // have caught it asserted on that wrapper and stayed green.
  //
  // Same shape as the search fix above, and pinned the same way: the reveal AND
  // its discriminator, because "open everything on any request" satisfies the
  // first alone and restores the 1,817px dump.
  // ══════════════════════════════════════════════════════════════════════════
  it('a REQUESTED section opens, and its rows are on screen', () => {
    // PRECONDITION: the same fixture with no request is entirely shut, so the
    // assertion below cannot pass on a group that was open anyway.
    renderPanel(null)
    expect(openGroupIds()).toEqual([])
    expect(screen.queryByTestId(`model-row-v2-${FACTOR_UNSET}`)).toBeNull()
    cleanup()

    renderPanel('factors')
    expect(
      screen.getByTestId(`model-row-v2-${FACTOR_UNSET}`),
      'the requested section is on screen but empty — a deep link to a heading',
    ).toBeInTheDocument()
  })

  it('DISCRIMINATOR: a request opens ONLY the group it names', () => {
    renderPanel('factors')
    const opened = openGroupIds()
    expect(opened, `only the requested group may open; these did: ${opened.join(', ')}`)
      .toEqual(['factors'])
    expect(screen.queryByTestId(`model-row-v2-${GOAL_ID}`)).toBeNull()
  })

  it('the request is an EVENT — the reader can shut what it opened', () => {
    renderPanel('factors')
    fireEvent.click(screen.getByTestId('model-group-v2-factors-toggle'))
    expect(screen.getByTestId('model-group-v2-factors-toggle').getAttribute('aria-expanded'))
      .toBe('false')
    expect(
      screen.queryByTestId(`model-row-v2-${FACTOR_UNSET}`),
      'the group reports shut but its rows are still rendered',
    ).toBeNull()
  })

  it('a request does not fight the search: both may be true at once', () => {
    // The two openers write to different things — the request into `closed`,
    // the needle into `outlineLayout` — so neither can cancel the other.
    renderPanel('factors')
    fireEvent.change(screen.getByTestId('model-tab-v2-filter'), {
      target: { value: 'Engineering' },
    })
    expect(screen.getByTestId(`model-row-v2-${FACTOR_SET}`)).toBeInTheDocument()
    expect(screen.queryByTestId(`model-row-v2-${FACTOR_UNSET}`)).toBeNull()
    expect(openGroupIds()).toEqual(['factors'])
  })
})
