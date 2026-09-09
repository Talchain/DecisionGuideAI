/**
 * ⭐⭐ THE EDITOR IS NOT BROKEN — IT IS UNDISCOVERABLE, AND IT NO-OPS IN SILENCE.
 *
 * THREE MEASURED FACTS ON THE DEPLOYED BUILD `9748b336`, which this spec pins:
 *
 *  1. THE `editing` PHASE OFFERS NO VISIBLE ROUTE FORWARD. With `0.4` typed into
 *     a factor row, the row's ONLY button was its own label. No advance control,
 *     and no hint that Enter is the way — visible text, `placeholder` AND
 *     `title` were all checked and all absent. Enter DOES work
 *     (`ModelRowView.tsx` maps Enter→`onProposeEdit`, Escape→`onDiscardEdit`),
 *     so this is a DISCOVERABILITY defect, not a broken editor. No duplicate key
 *     handler is added here, and none should be: the keys already work.
 *
 *  2. `proposeEdit` SILENTLY NO-OPS ON AN UNPARSEABLE DRAFT
 *     (`ModelTabV2Panel.tsx`: `const num = parseFloat(prev.draft); if
 *     (!Number.isFinite(num)) return prev`). The user types something invalid,
 *     presses Enter, and nothing whatever happens — no error, no feedback.
 *
 *  3. THE `Olumi: …` ESTIMATE HINT IS ILLEGIBLE. Measured widths: `clientWidth`
 *     31px against `scrollWidth` 83–125px on 6 of 8 factor rows ("Olumi:
 *     Moderate (0.5)" = 125px of content in a 31px box). A native `title` makes
 *     it hover-recoverable — and hover only: not by keyboard, not by touch.
 *     `clippedValueTextIsRecoverable.spec` pins that `title`; it does NOT make
 *     the text reachable without a pointer, and its own header says so.
 *
 * ── WHAT THIS SPEC CLAIMS, AND WHAT IT CANNOT ────────────────────────────────
 * jsdom performs NO LAYOUT. It cannot measure 31px-of-125px and this file does
 * not pretend to: `scrollWidth <= clientWidth` is worthless here — in jsdom both
 * are 0, so a hidden element, an empty element and a perfectly legible one all
 * satisfy it identically. So every readability assertion below is made the only
 * honest way available in this environment, and in this ORDER:
 *   (i)   the element EXISTS, bound by its own testid;
 *   (ii)  its `textContent` carries the EXACT expected string — so the text is
 *         rendered, not merely promised by an attribute;
 *   (iii) it does NOT carry the `truncate` class, which is the exact mechanism
 *         that produced the 31px box (`ModelRowView.tsx`'s hint carries it, and
 *         that trade is deliberate and untouched — see below).
 * Geometry belongs in a browser and is not claimed here.
 *
 * ⚠ THE GRID IS NOT WIDENED AND THE HINT STILL TRUNCATES. Both alternative
 * fixes are excluded ON MEASUREMENT by `ModelRowView.tsx` and
 * `clippedValueTextIsRecoverable.spec` — widening the value track
 * (`minmax(0,5.5rem)`, tried, cost four fully-visible option labels) and
 * stacking the hint onto a second line (tried, rows measured 42px). The idle row
 * stays compact; the FULL estimate is surfaced in the DETAIL REGION, which the
 * user already has open on the row they are editing.
 *
 * ⚠ FOUR OPERATIONS, NOT ONE. This spec touches the FACTOR-VALUE edit and the
 * GOAL-TARGET edit only. Edge-strength band buttons and option interventions are
 * different writers with different carriers and are deliberately untouched.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, cleanup, fireEvent, screen } from '@testing-library/react'
import type { Node, Edge } from '@xyflow/react'
import { ModelRowView } from '../ModelRowView'
import type { ModelRow } from '../types'
import { UNCONFIRMED_ESTIMATE_LABEL } from '../../domain/vocabulary'

const sendSystemEvent = vi.fn()

// Trap 12: spread the real module rather than hand-listing its exports.
vi.mock('../../conversation/ConversationContext', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, useOptionalConversationContext: () => ({ sendSystemEvent }) }
})

vi.mock('../../utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusEdgeById: vi.fn(),
}))

import { ModelTabV2Panel } from '../ModelTabV2Panel'
import { useCanvasStore } from '../../store'
import { openOutlineGroups } from './openOutlineGroups'

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

function row(over: Partial<ModelRow> & Pick<ModelRow, 'id'>): ModelRow {
  return {
    kind: 'factor',
    group: 'factors',
    label: `Label ${over.id}`,
    primaryValue: '45 days',
    attention: [],
    editable: true,
    ...over,
  }
}

const hasClass = (el: Element, name: string) => el.className.split(/\s+/).includes(name)

const FACTOR_ID = 'fac_monthly_eng_cost'
const GOAL_ID = 'goal_arr'

/**
 * ⭐ THE ESTIMATE ROW IS THE LIVE SHAPE, NOT ONE I INVENTED. `types.ts` records
 * it from the signed-in journey `20260826T082826Z-fresh-extended-17c4a0`:
 * `display_value "High (0.6)"` beside `value 0.6` and NO `raw_value`. Derived at
 * the adapter, this fixture produces exactly
 * `primaryValue: null · estimateText: 'Moderate (0.5)' ·
 *  attention: ['no-value','unconfirmed-estimate'] · provenanceSource: 'cee_inference'`
 * — which is the row the 31px measurement was taken on.
 */
const ESTIMATE_ID = 'fac_sales_rep_adoption'
const ESTIMATE_TEXT = 'Moderate (0.5)'

/**
 * The DISCRIMINATING TWIN: same `display_value`, no `observedState`, so the
 * adapter emits `estimateText` WITHOUT `unconfirmed-estimate`. Without this row
 * the status assertion could pass on a component that renders the label
 * unconditionally — a claim invented rather than derived.
 */
const ESTIMATE_NO_STATUS_ID = 'fac_no_observed_state'

function factorNode(): Node {
  return {
    id: FACTOR_ID,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: {
      label: 'Monthly Engineering Cost',
      kind: 'factor',
      category: 'observable',
      observedState: { value: 30000 / 30000, raw_value: 30000, cap: 30000, unit: '£', source: 'cee_inference' },
    },
  } as unknown as Node
}

function estimateNode(): Node {
  return {
    id: ESTIMATE_ID,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: {
      label: 'Sales Rep Adoption Rate',
      kind: 'factor',
      display_value: ESTIMATE_TEXT,
      observedState: { value: 0.6, source: 'cee_inference' },
    },
  } as unknown as Node
}

function estimateNodeWithoutStatus(): Node {
  return {
    id: ESTIMATE_NO_STATUS_ID,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: { label: 'CRM Feature Fit for B2B', kind: 'factor', display_value: ESTIMATE_TEXT },
  } as unknown as Node
}

function goalNode(): Node {
  return {
    id: GOAL_ID,
    type: 'goal',
    position: { x: 0, y: 0 },
    data: { label: 'Hit ARR target', kind: 'goal' },
  } as unknown as Node
}

const allNodes = (): Node[] => [
  goalNode(),
  factorNode(),
  estimateNode(),
  estimateNodeWithoutStatus(),
]
const allEdges = (): Edge[] => []

function seedStore() {
  useCanvasStore.setState({ nodes: allNodes(), edges: allEdges() } as never, false)
}

function observed(id: string): Record<string, unknown> {
  const n = useCanvasStore.getState().nodes.find(x => x.id === id)
  return ((n?.data as Record<string, unknown> | undefined)?.observedState ?? {}) as Record<string, unknown>
}

function renderPanel() {
  render(<ModelTabV2Panel nodes={allNodes()} edges={allEdges()} goalThreshold={null} />)
  openOutlineGroups()
}

beforeEach(() => {
  vi.clearAllMocks()
  seedStore()
})
afterEach(() => cleanup())

// ─────────────────────────────────────────────────────────────────────────────
// (a) A VISIBLE ROUTE FORWARD
// ─────────────────────────────────────────────────────────────────────────────

describe('⭐ (a) the `editing` phase offers a VISIBLE route forward', () => {
  function renderEditing(over: Partial<ModelRow> = {}, propose = vi.fn(), discard = vi.fn()) {
    render(
      <ModelRowView
        row={row({ id: 'f1', ...over })}
        tier="plain"
        commit={{ phase: 'editing', draft: '0.4' } as const}
        onDraftChange={() => {}}
        onProposeEdit={propose}
        onDiscardEdit={discard}
      />,
    )
    return { propose, discard }
  }

  it('PRECONDITION — this really is the editing arm, and the draft is the measured one', () => {
    renderEditing()
    expect(screen.getByTestId('model-row-v2-f1-value-input')).toHaveValue('0.4')
  })

  it('⭐ renders a Review change control, bound by identity, that advances the edit', () => {
    const { propose } = renderEditing()
    const review = screen.getByTestId('model-row-v2-f1-review')
    // (ii) the words are RENDERED, not promised by a title.
    expect(review.textContent).toBe('Review change')
    expect(review.tagName).toBe('BUTTON')
    fireEvent.click(review)
    // Bound to THIS row by id — never to "the first button", which is the
    // assertion that would pass on a different row's control (trap 19).
    expect(propose).toHaveBeenCalledWith('f1')
    expect(propose).toHaveBeenCalledTimes(1)
  })

  it('⭐ renders a visible Discard control — Escape works and is equally invisible', () => {
    const { discard } = renderEditing()
    const cancel = screen.getByTestId('model-row-v2-f1-discard-edit')
    expect(cancel.textContent).toBe('Discard')
    fireEvent.click(cancel)
    expect(discard).toHaveBeenCalledWith('f1')
  })

  it('⛔ THE VALUE CONTROL IS NOT THE ADVANCE CONTROL — they are different elements', () => {
    // The measured defect was "the row\'s ONLY button is its label". A test that
    // accepted any button would have scored that state as fixed.
    renderEditing()
    const review = screen.getByTestId('model-row-v2-f1-review')
    const input = screen.getByTestId('model-row-v2-f1-value-input')
    expect(review).not.toBe(input)
    expect(review.contains(input)).toBe(false)
  })

  it('⛔ NO DUPLICATE KEY HANDLER — Enter still advances exactly once', () => {
    const { propose } = renderEditing()
    fireEvent.keyDown(screen.getByTestId('model-row-v2-f1-value-input'), { key: 'Enter' })
    expect(propose).toHaveBeenCalledTimes(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// (b) AN INVALID DRAFT EXPLAINS ITSELF
// ─────────────────────────────────────────────────────────────────────────────

describe('⭐ (b) an unproposable draft says why, VISIBLY', () => {
  function renderDraft(draft: string, over: Partial<ModelRow> = {}, unit?: string) {
    render(
      <ModelRowView
        row={row({ id: 'f1', ...over })}
        tier="plain"
        commit={{ phase: 'editing', draft, ...(unit !== undefined ? { unit } : {}) } as const}
        onDraftChange={() => {}}
        onProposeEdit={() => {}}
        onDiscardEdit={() => {}}
      />,
    )
  }

  it('⭐ an unparseable draft renders a reason in TEXT — not in a title', () => {
    renderDraft('abc')
    const why = screen.getByTestId('model-row-v2-f1-value-blocked')
    expect(why.textContent).toBe('Enter a number to review this change')
    // The measured defect on the estimate hint was a `title` standing in for
    // visible text. A reason recoverable only on hover is the same defect.
    expect(why.getAttribute('title')).toBeNull()
    expect(hasClass(why, 'truncate')).toBe(false)
  })

  it('⭐ and the advance control is honestly disabled while it cannot advance', () => {
    renderDraft('abc')
    expect(screen.getByTestId('model-row-v2-f1-review')).toBeDisabled()
  })

  it('⛔ CONTRAST CONTROL — a valid draft renders NO reason and an ENABLED control', () => {
    // Without this the reason could render unconditionally and every assertion
    // above would still pass — a guard agreeing with itself.
    renderDraft('0.4')
    expect(screen.queryByTestId('model-row-v2-f1-value-blocked')).not.toBeInTheDocument()
    expect(screen.getByTestId('model-row-v2-f1-review')).toBeEnabled()
  })

  it('⭐ a goal row with no unit names the UNIT, not the number — the messages discriminate', () => {
    renderDraft('45', { kind: 'goal' }, '')
    expect(screen.getByTestId('model-row-v2-f1-value-blocked').textContent).toBe(
      'Add a unit — £, % or points — to review this change',
    )
  })

  it('⭐ a goal row at or below zero says so — the third distinct refusal', () => {
    renderDraft('0', { kind: 'goal' }, '£')
    expect(screen.getByTestId('model-row-v2-f1-value-blocked').textContent).toBe(
      'Enter a target above zero to review this change',
    )
  })

  it('⛔ CONTRAST CONTROL — a complete goal target renders no reason at all', () => {
    renderDraft('45000', { kind: 'goal' }, '£')
    expect(screen.queryByTestId('model-row-v2-f1-value-blocked')).not.toBeInTheDocument()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// ONE PREDICATE — the row's reason and the panel's refusal cannot disagree
// ─────────────────────────────────────────────────────────────────────────────

describe('⭐⭐ the reason and the refusal are ONE derivation, driven through the real panel', () => {
  it('⭐ an invalid draft: the button does nothing, and the row SAYS SO', () => {
    renderPanel()
    fireEvent.click(screen.getByTestId(`model-row-v2-${FACTOR_ID}-value`))
    fireEvent.change(screen.getByTestId(`model-row-v2-${FACTOR_ID}-value-input`), {
      target: { value: 'abc' },
    })
    fireEvent.click(screen.getByTestId(`model-row-v2-${FACTOR_ID}-review`))

    // Still editing — the panel's guard is unchanged and still refuses.
    expect(screen.getByTestId(`model-row-v2-${FACTOR_ID}-value-input`)).toBeInTheDocument()
    expect(screen.queryByTestId(`model-row-v2-${FACTOR_ID}-confirm`)).not.toBeInTheDocument()
    // But it is no longer SILENT. This is the whole defect.
    expect(screen.getByTestId(`model-row-v2-${FACTOR_ID}-value-blocked`).textContent).toBe(
      'Enter a number to review this change',
    )
    // And nothing was written or sent on the way.
    expect(observed(FACTOR_ID).raw_value).toBe(30000)
    expect(sendSystemEvent).not.toHaveBeenCalled()
  })

  it('⭐ a valid draft: the button reaches `proposed`, exactly as Enter does', () => {
    renderPanel()
    fireEvent.click(screen.getByTestId(`model-row-v2-${FACTOR_ID}-value`))
    fireEvent.change(screen.getByTestId(`model-row-v2-${FACTOR_ID}-value-input`), {
      target: { value: '20000' },
    })
    fireEvent.click(screen.getByTestId(`model-row-v2-${FACTOR_ID}-review`))

    // `proposed` — the existing copy, deliberately unchanged.
    expect(screen.getByTestId(`model-row-v2-${FACTOR_ID}-confirm`)).toBeInTheDocument()
    expect(screen.getByTestId(`model-row-v2-${FACTOR_ID}-discard`)).toBeInTheDocument()
    // ⚠ PROPOSING IS NOT SAVING. Nothing is written until Confirm — the word
    // "Saved" may only ever follow a canonical acknowledgement.
    expect(observed(FACTOR_ID).raw_value).toBe(30000)
    expect(sendSystemEvent).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// (c) THE ESTIMATE IS READABLE WITHOUT A POINTER
// ─────────────────────────────────────────────────────────────────────────────

describe('⭐ (c) the full estimate is readable in the detail region', () => {
  it('PRECONDITION — the fixture really is the clipped-hint row', () => {
    renderPanel()
    const hint = screen.getByTestId(`model-row-v2-${ESTIMATE_ID}-value-estimate`)
    // The row still renders the compact, truncating hint. That trade is
    // deliberate and this change does not touch it.
    expect(hint.textContent).toBe(`Olumi: ${ESTIMATE_TEXT}`)
    expect(hasClass(hint, 'truncate')).toBe(true)
  })

  it('⭐⭐ selecting the row surfaces the FULL estimate as text, untruncated', () => {
    renderPanel()
    fireEvent.click(screen.getByTestId(`model-row-v2-${ESTIMATE_ID}`))
    const full = screen.getByTestId('model-detail-v2-estimate')
    expect(full.textContent).toBe(`Olumi: ${ESTIMATE_TEXT}`)
    // (iii) the mechanism that produced the 31px box is absent here.
    expect(hasClass(full, 'truncate')).toBe(false)
    // Reachable without a pointer: the words are in the document, not in a title.
    expect(full.getAttribute('title')).toBeNull()
  })

  it('⭐ and states the estimate is unconfirmed — off the EXISTING predicate', () => {
    renderPanel()
    fireEvent.click(screen.getByTestId(`model-row-v2-${ESTIMATE_ID}`))
    expect(screen.getByTestId('model-detail-v2-estimate-status').textContent).toBe(
      UNCONFIRMED_ESTIMATE_LABEL,
    )
  })

  it('⛔ DISCRIMINATING TWIN — a row the predicate does NOT mark says nothing', () => {
    // Same estimate text, no `observedState`, so `unconfirmed-estimate` is
    // absent. A component rendering the label unconditionally passes the test
    // above and fails this one. Unknown stays unknown.
    renderPanel()
    fireEvent.click(screen.getByTestId(`model-row-v2-${ESTIMATE_NO_STATUS_ID}`))
    expect(screen.getByTestId('model-detail-v2-estimate').textContent).toBe(
      `Olumi: ${ESTIMATE_TEXT}`,
    )
    expect(screen.queryByTestId('model-detail-v2-estimate-status')).not.toBeInTheDocument()
  })

  it('⛔ A ROW WITH A SET VALUE HAS NO ESTIMATE BLOCK — it is not a second value line', () => {
    renderPanel()
    fireEvent.click(screen.getByTestId(`model-row-v2-${FACTOR_ID}`))
    expect(screen.queryByTestId('model-detail-v2-estimate')).not.toBeInTheDocument()
  })

  it('⭐⭐ REACHABILITY — beginning an edit OPENS the detail region for that row', () => {
    // Without this the estimate is surfaced somewhere the user editing the row
    // is not looking: the value control calls `stopPropagation`, so opening the
    // editor did not select the row and the detail region stayed shut.
    renderPanel()
    expect(screen.queryByTestId('model-detail-v2')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId(`model-row-v2-${ESTIMATE_ID}-value`))
    expect(screen.getByTestId('model-detail-v2')).toHaveAttribute('data-row-id', ESTIMATE_ID)
    // …and the editor really did open, so this is the editing state, not a
    // selection that happened to work.
    expect(screen.getByTestId(`model-row-v2-${ESTIMATE_ID}-value-input`)).toBeInTheDocument()
  })
})
