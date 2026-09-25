/**
 * ⭐⭐ THE INSPECTOR SAYS WHAT THE CARD SAYS, AND ITS INPUT IS WHERE THE CARD
 * SENDS YOU (DEFECT 5 + ED #63 §9).
 *
 * ── WITNESSED ON THE SERVED BUILD (UI `a4434670`, 24 Sep 2026, 00:51–01:17Z) ──
 * `output/canvas-completion-20260923/MANUAL-EDIT-PROOF-20260924.md`, D3 + D5:
 *
 *   · CDP starter, "Adopt Segment" → Annual Platform Cost. CEE holds the factor
 *     as `value 0.5, raw 60000, cap 120000, unit £` and the option's target as
 *     `{value: 0.5, display_value: "£60k"}` with NO `source`. The card read
 *     "£60k"; the inspector's technical view read the input "0.5".
 *   · Pricing starter, after a target edit: the inspector row "loses 'Low
 *     (0.1)' and shows the input 0.2, 'model value'". A target the user has set
 *     carries no `display_value`, so from then on the inspector printed the
 *     model's internal number where the card printed a reading.
 *   · Paul's screenshot, same class: the card said "59 GBP/month", the
 *     inspector said "0.295 model value".
 *   · The card's route says "Open the inspector to change them"; the
 *     inspector's default view showed read-only text, said "Other fields here
 *     are read-only for now", and its inputs appeared only after "Show technical
 *     detail" — with no accessible label.
 *
 * ── HOW THIS FILE BINDS ─────────────────────────────────────────────────────
 * · It mounts `InspectorModal`, the DEPLOYED chain (canvas double-click →
 *   `InspectorModal` → `InspectorRouter` → `OptionPanel` → `InterventionRow`),
 *   with the REAL store — never `InterventionRow` alone with props a test
 *   chose (trap 3b).
 * · The card parity cases render the REAL `OptionNode` against the SAME store,
 *   so "same as the card" is measured against the card, not against a helper
 *   the change under test also edits.
 * · Every row is resolved by its factor id (trap 19); every absence has a
 *   presence twin in the same test (trap 13).
 *
 * ⚠ FIXTURE PROVENANCE (trap 22). The CDP factor, its target and "£60k" are the
 * witness's wire values, verbatim. The "GBP/month" factor is CONSTRUCTED to
 * reproduce Paul's screenshot numbers (0.295 ↔ 59); the witness notes no
 * starter carries that unit, so it is labelled as constructed, not as wire.
 *
 * CLAIM SCOPE (trap 3): jsdom proves text, accessible names and dispatch —
 * never layout or visibility in a real browser.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, within, fireEvent, cleanup } from '@testing-library/react'
import { optionCardRows } from '../../../nodes/__tests__/__helpers__/optionPreview'
import { ReactFlowProvider } from '@xyflow/react'

const sendSystemEvent = vi.fn()
vi.mock('../../../conversation/ConversationContext', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, useOptionalConversationContext: () => ({ sendSystemEvent }) }
})

// importOriginal-spread (trap 12): only the two members jsdom cannot provide.
vi.mock('@xyflow/react', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  Handle: () => null,
  useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
}))

import { InspectorModal } from '../../../components/InspectorModal'
import { OptionNode } from '../../../nodes/OptionNode'
import { useCanvasStore } from '../../../store'
import { INSPECTOR_OPTION_READ_ONLY_REASON } from '../useInspectorMutations'
import { readingShowsModelValue } from '../../../nodes/shared/optionTargetDisplay'

const NODE_INSPECTOR = 'div[role="dialog"][aria-label="Node inspector"]'

const OPTION_ID = 'opt_adopt_segment'
const OPTION_LABEL = 'Adopt Segment'

/** Wire: CDP starter, CEE re-read at 24 Sep 00:5xZ. */
const F_COST = 'fac_annual_platform_cost'
const F_COST_LABEL = 'Annual Platform Cost'
const F_COST_OBSERVED = { value: 0.5, raw_value: 60000, cap: 120000, unit: '£' }

/** CONSTRUCTED to reproduce Paul's "59 GBP/month" ↔ "0.295 model value". */
const F_PRICE = 'fac_pro_plan_price'
const F_PRICE_LABEL = 'Pro Plan Monthly Price'
const F_PRICE_OBSERVED = { value: 0.245, raw_value: 49, cap: 200, unit: 'GBP/month' }

/**
 * CONSTRUCTED (trap 22): the CDP cost factor with its `cap` removed. Without a
 * declared scale a typed £ amount has no conversion (`optionTargetEntry`), so
 * this row's field stays on the model scale — the case the route sentence and
 * the technical-detail box still exist for.
 */
const F_COST_NO_CAP = 'fac_annual_platform_cost_no_cap'
const F_COST_NO_CAP_LABEL = 'Annual Platform Cost (no declared scale)'
const F_COST_NO_CAP_OBSERVED = { value: 0.5, raw_value: 60000, unit: '£' }

/** Wire shape: a unitless factor whose target CEE writes as a tier reading. */
const F_FRICTION = 'fac_bottom_up_adoption_friction'
const F_FRICTION_LABEL = 'Bottom-Up Adoption Friction'
const F_FRICTION_OBSERVED = { value: 0.8 }

function factorNode(id: string, label: string, observedState: Record<string, unknown>) {
  return {
    id,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: { kind: 'factor', type: 'factor', category: 'controllable', label, observedState },
  }
}

function seed(interventions: Record<string, unknown>, ceeAnalysisReady: unknown = null) {
  const option = {
    id: OPTION_ID,
    type: 'option',
    position: { x: 0, y: 0 },
    data: { kind: 'option', type: 'option', label: OPTION_LABEL, interventions },
  }
  useCanvasStore.setState({
    nodes: [
      option,
      factorNode(F_COST, F_COST_LABEL, F_COST_OBSERVED),
      factorNode(F_PRICE, F_PRICE_LABEL, F_PRICE_OBSERVED),
      factorNode(F_FRICTION, F_FRICTION_LABEL, F_FRICTION_OBSERVED),
      factorNode(F_COST_NO_CAP, F_COST_NO_CAP_LABEL, F_COST_NO_CAP_OBSERVED),
    ] as never[],
    edges: [],
    results: { status: 'idle' },
    ceeAnalysisReady,
    lastServerGraphHash: 'gh-witness',
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: { x: 0, y: 0 } },
    goalThreshold: null,
    confirmedNodeIds: new Set(),
    _internal: {},
  } as never)
  return option
}

function openInspector(): HTMLElement {
  const utils = render(<InspectorModal nodeId={OPTION_ID} edgeId={null} onClose={vi.fn()} />)
  const dialog = utils.container.querySelector(NODE_INSPECTOR)
  expect(dialog, 'PRECONDITION: the node inspector dialog must be mounted').not.toBeNull()
  return dialog as HTMLElement
}

function row(dialog: HTMLElement, factorId: string): HTMLElement {
  return within(dialog).getByTestId(`inspector-intervention-${factorId}`)
}

function readout(dialog: HTMLElement, factorId: string): string {
  return within(row(dialog, factorId)).getByTestId(`intervention-readout-${factorId}`).textContent ?? ''
}

function inputs(dialog: HTMLElement, factorId: string): HTMLInputElement[] {
  return [...row(dialog, factorId).querySelectorAll('input')] as HTMLInputElement[]
}

function toggleTechnicalDetail(dialog: HTMLElement) {
  fireEvent.click(within(dialog).getByRole('button', { name: 'Show technical detail' }))
}

/** The card's own NodeProps, as `OptionNode.factorTargetsAreReachable.spec.tsx` spells them. */
const cardProps = {
  id: OPTION_ID,
  type: 'option',
  position: { x: 0, y: 0 },
  selected: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
  deletable: true,
  selectable: true,
  draggable: true,
}

/** The real card, for the same store. */
function renderCard(optionData: Record<string, unknown>) {
  const utils = render(
    <ReactFlowProvider>
      <OptionNode {...cardProps} data={optionData} />
    </ReactFlowProvider>,
  )
  return utils.container
}

/**
 * WHERE THE CARD'S CHANGE ROWS ARE READ: on the CARD body again (Paul 25 Sep:
 * the prototype's resting rows supersede ED #63 5809278282's popover
 * placement). The parity these tests pin is between the inspector and the rows
 * the card SHOWS, so they are read from the card's rows block, bound to it by
 * identity (`optionCardRows` refuses a block found in a popover).
 */
async function cardRows(_card: HTMLElement): Promise<HTMLElement> {
  return optionCardRows(OPTION_ID)
}

/** The card's visible TARGET: the text after its arrow, without the source mark. */
function cardTarget(card: HTMLElement, factorId: string): string {
  const dd = card.querySelector(`[data-testid="option-change-row-${OPTION_ID}-${factorId}"]`)
  expect(dd, `PRECONDITION: the card rendered a change row for ${factorId}`).not.toBeNull()
  const clone = dd!.cloneNode(true) as HTMLElement
  // The whole mark cluster goes — since S1 (#1926) it is a wrapper holding a
  // muted "·" separator AND the mark; removing only the mark left "£60k ·".
  // On a card without the wrapper this selector matches nothing.
  clone.querySelectorAll('[data-testid^="option-change-row-mark-"], [data-value-source], [data-testid^="option-change-row-estimate-"]').forEach(n => n.remove())
  const text = (clone.textContent ?? '').replace(/ · same as baseline$/, '').trim()
  const arrow = text.lastIndexOf('→ ')
  return arrow >= 0 ? text.slice(arrow + 2).trim() : text
}

function cardMarkKind(card: HTMLElement, factorId: string): string | null {
  return card
    .querySelector(`[data-testid="option-change-row-source-${OPTION_ID}-${factorId}"]`)
    ?.getAttribute('data-value-source') ?? null
}

beforeEach(() => {
  sendSystemEvent.mockClear()
})
afterEach(() => cleanup())

describe('(a) the inspector row reads like the card, never the internal 0–1 value', () => {
  it('⭐⭐ a user-set target on a £ factor reads in £, not as "0.7 model value" (RED at a4434670)', () => {
    seed({ [F_COST]: { value: 0.7, source: 'user_specified' } })
    const dialog = openInspector()

    const text = row(dialog, F_COST).textContent ?? ''
    expect(text, 'the internal number must not be user copy in the default view').not.toContain('0.7')
    expect(text).not.toMatch(/model value/i)
    expect(text).toContain('£84,000')
    expect(readout(dialog, F_COST)).toContain('£84,000')
    // ⭐ Presence twin: the row IS there and IS marked — the absences above are
    // about the internal number, not about an empty row.
    expect(text).toContain('Set by you')
    expect(inputs(dialog, F_COST).map(i => i.value)).not.toContain('0.7')
  })

  it('⭐⭐ Paul’s screenshot class — "59 GBP/month", not "0.295 model value" (RED at a4434670)', () => {
    seed({ [F_PRICE]: { value: 0.295, source: 'user_specified' } })
    const dialog = openInspector()

    const text = row(dialog, F_PRICE).textContent ?? ''
    expect(text).not.toContain('0.295')
    expect(text).not.toMatch(/model value/i)
    expect(readout(dialog, F_PRICE)).toContain('£59/month')
  })

  it('a CEE-authored reading is still rendered verbatim (the wire’s "£60k")', () => {
    seed({ [F_COST]: { value: 0.5, display_value: '£60k' } })
    const dialog = openInspector()
    // A GUARD, not a RED claim: the display_value branch already printed this
    // at a4434670. It pins that the new readout keeps CEE's words verbatim.
    expect(readout(dialog, F_COST)).toContain('£60k')
    expect(row(dialog, F_COST).textContent ?? '').not.toContain('0.5')
  })

  it('⭐⭐ PARITY — the inspector’s target is the card’s target, and the mark agrees, on the real card', async () => {
    const option = seed({
      [F_COST]: { value: 0.7, source: 'user_specified' },
      [F_PRICE]: { value: 0.295, source: 'brief_extraction' },
    })
    const card = await cardRows(renderCard(option.data))
    const dialog = openInspector()

    for (const fid of [F_COST, F_PRICE]) {
      // The card collapses a tier reading at rest; neither of these is one, so
      // the two strings are compared whole.
      const target = cardTarget(card, fid)
      expect(row(dialog, fid).textContent, `target text for ${fid}`).toContain(target)
      expect(readout(dialog, fid), `readout for ${fid}`).toContain(target)
    }
    expect(cardMarkKind(card, F_COST)).toBe('you')
    expect(row(dialog, F_COST).textContent).toContain('Set by you')
    expect(cardMarkKind(card, F_PRICE)).toBe('brief')
    expect(row(dialog, F_PRICE).textContent).toContain('From your brief')
  })
})

describe('(a) the SAME display source as the card — CEE’s analysis_ready, joined with its details', () => {
  it('⭐⭐ the reading CEE authored in `intervention_details` reaches the inspector too (RED at a4434670)', async () => {
    // `ceeAnalysisReady.options[]` carries the target as a FLAT number and the
    // words in a SIBLING `intervention_details` map (`factorOptionSetting.ts`).
    // The card joins them; the inspector read the node alone, which holds the
    // bare number — so it printed "0.5 model value" under a card saying "£60k".
    const option = seed(
      { [F_COST]: 0.5 },
      {
        options: [{
          id: OPTION_ID,
          interventions: { [F_COST]: 0.5 },
          intervention_details: { [F_COST]: { display_value: '£60k' } },
        }],
      },
    )
    const card = await cardRows(renderCard(option.data))
    const dialog = openInspector()

    expect(cardTarget(card, F_COST)).toBe('£60k')
    const text = row(dialog, F_COST).textContent ?? ''
    expect(text).not.toMatch(/model value/i)
    expect(text).toContain('£60k')
  })

  it('⭐ a bare producer number does not erase the user’s own stamp — on either surface', async () => {
    const option = seed(
      { [F_COST]: { value: 0.7, source: 'user_specified' } },
      { options: [{ id: OPTION_ID, interventions: { [F_COST]: 0.7 } }] },
    )
    const card = await cardRows(renderCard(option.data))
    const dialog = openInspector()

    expect(cardMarkKind(card, F_COST)).toBe('you')
    expect(row(dialog, F_COST).textContent).toContain('Set by you')
    expect(readout(dialog, F_COST)).toContain(cardTarget(card, F_COST))
  })
})

describe('readingShowsModelValue — the box stands beside a reading only when the reading prints its number', () => {
  it.each<[string, number, boolean]>([
    ['Low (0.1)', 0.1, true],
    ['0.2', 0.2, true],
    ['Very low (0.29)', 0.29, true],
    ['£60k', 0.5, false],
    ['59 GBP/month', 0.295, false],
    ['15%', 0.15, false],
    ['Increases', 0.4, false],
    ['halve licensing spend', 0.45, false],
    // Discriminating twin: the right SHAPE with the wrong number is refused.
    ['Low (0.2)', 0.1, false],
  ])('%s with %s → %s', (reading, value, expected) => {
    expect(readingShowsModelValue(reading, value)).toBe(expected)
  })
})

describe('(b) the input is in the default view, labelled, where it holds the number the row shows', () => {
  it('⭐⭐ a tier-read target has a labelled input in the DEFAULT view (RED at a4434670)', () => {
    seed({ [F_FRICTION]: { value: 0.1, display_value: 'Low (0.1)', source: 'brief_extraction' } })
    const dialog = openInspector()

    const input = within(dialog).getByRole('textbox', {
      name: `Target for ${F_FRICTION_LABEL} under ${OPTION_LABEL}`,
    }) as HTMLInputElement
    // Bound by identity: the labelled box is THIS row's box, holding THIS
    // target — the same number the readout shows in its parentheses.
    expect(row(dialog, F_FRICTION).contains(input)).toBe(true)
    expect(input.value).toBe('0.1')
    expect(readout(dialog, F_FRICTION)).toContain('Low (0.1)')
  })

  it('⭐ the default-view input reaches the model — option_intervention_edit, id-addressed', () => {
    seed({ [F_FRICTION]: { value: 0.1, display_value: 'Low (0.1)', source: 'brief_extraction' } })
    const dialog = openInspector()
    const input = within(dialog).getByRole('textbox', {
      name: `Target for ${F_FRICTION_LABEL} under ${OPTION_LABEL}`,
    })
    fireEvent.change(input, { target: { value: '0.3' } })
    fireEvent.blur(input)

    const call = sendSystemEvent.mock.calls.find(c => (c[0] as { type?: string })?.type === 'option_intervention_edit')
    expect(call, 'no option_intervention_edit was sent').toBeTruthy()
    const payload = (call![0] as { payload?: Record<string, unknown> }).payload ?? {}
    expect(payload.option_id).toBe(OPTION_ID)
    expect(payload.factor_id).toBe(F_FRICTION)
  })

  /**
   * ⚠ SUPERSEDES "a £ target keeps its internal input OUT of the default view".
   * That held while the field could only take the model's 0–1 value; the
   * route sentence's own docblock said that when the input-parsing path
   * accepted a target in its reading's unit, the box belonged in the default
   * view. `optionTargetEntry` is that path, so a £ row whose factor declares
   * its scale now has its £ field here — and the rows it cannot convert keep
   * the old behaviour, pinned in the next test.
   */
  it('⭐⭐ a £ target whose factor declares its scale has a £ field in the DEFAULT view, holding the card\'s figure, labelled', () => {
    seed({
      [F_COST]: { value: 0.5, display_value: '£60k' },
      [F_FRICTION]: { value: 0.1, display_value: 'Low (0.1)', source: 'brief_extraction' },
    })
    const dialog = openInspector()

    const input = within(dialog).getByRole('textbox', {
      name: `Target for ${F_COST_LABEL} under ${OPTION_LABEL}`,
    }) as HTMLInputElement
    expect(row(dialog, F_COST).contains(input)).toBe(true)
    // The card's figure, in the card's unit — never the model's 0.5.
    expect(input.value).toBe('60,000')
    expect(row(dialog, F_COST).textContent).toContain('£')
    expect(row(dialog, F_COST).textContent ?? '').not.toMatch(/model value|internal scale/i)
    expect(readout(dialog, F_COST)).toContain('£60k')
    // Every row has its box, so the route sentence is not shown.
    expect(inputs(dialog, F_FRICTION)).toHaveLength(1)
    expect(within(dialog).queryByTestId('option-target-edit-route')).toBeNull()
  })

  it('⭐⭐ a £ target whose factor declares NO usable scale keeps its internal input OUT of the default view and names the reachable control', () => {
    seed({
      [F_COST_NO_CAP]: { value: 0.5, display_value: '£60k' },
      [F_FRICTION]: { value: 0.1, display_value: 'Low (0.1)', source: 'brief_extraction' },
    })
    const dialog = openInspector()

    // Contrast in the same render: the tier row HAS its input.
    expect(inputs(dialog, F_FRICTION)).toHaveLength(1)
    // This £ row has none in the default view — its only input is on the
    // model's 0–1 scale, which is not what the row shows.
    expect(inputs(dialog, F_COST_NO_CAP)).toHaveLength(0)
    const route = within(dialog).getByTestId('option-target-edit-route')
    expect(route.textContent).toContain('Show technical detail')
    // ⭐ A remedy in copy must be a reachable control: the control it names
    // exists on this inspector under exactly that accessible name — and
    // pressing it puts this row's box on screen.
    toggleTechnicalDetail(dialog)
    expect(inputs(dialog, F_COST_NO_CAP)).toHaveLength(1)
  })

  it('CONTRAST — no route sentence when every target already has its box', () => {
    seed({ [F_FRICTION]: { value: 0.1, display_value: 'Low (0.1)', source: 'brief_extraction' } })
    const dialog = openInspector()
    expect(inputs(dialog, F_FRICTION)).toHaveLength(1)
    expect(within(dialog).queryByTestId('option-target-edit-route')).toBeNull()
  })

  it('⭐⭐ the notice names what IS editable here — the name and the factor targets (RED at a4434670)', () => {
    seed({ [F_FRICTION]: { value: 0.1, display_value: 'Low (0.1)', source: 'brief_extraction' } })
    const dialog = openInspector()
    const notice = within(dialog).getByTestId('inspector-authority-notice')

    expect(notice.textContent).toContain(INSPECTOR_OPTION_READ_ONLY_REASON)
    expect(INSPECTOR_OPTION_READ_ONLY_REASON).toMatch(/Renaming reaches the shared model/)
    expect(INSPECTOR_OPTION_READ_ONLY_REASON).toMatch(/factor targets/)
    // The targets it names are a control on this pane, not a promise.
    expect(within(dialog).getAllByRole('textbox', { name: /^Target for / }).length).toBeGreaterThan(0)
  })
})

describe('(c) technical detail keeps the internal value, labelled as the model’s internal scale', () => {
  it('⭐⭐ a model-scale row’s input appears under technical detail, labelled, beside the same £ reading', () => {
    seed({ [F_COST_NO_CAP]: { value: 0.5, display_value: '£60k' } })
    const dialog = openInspector()
    toggleTechnicalDetail(dialog)

    const input = within(dialog).getByRole('textbox', {
      name: `Target for ${F_COST_NO_CAP_LABEL} under ${OPTION_LABEL}`,
    }) as HTMLInputElement
    expect(row(dialog, F_COST_NO_CAP).contains(input)).toBe(true)
    expect(input.value).toBe('0.5')
    expect(row(dialog, F_COST_NO_CAP).textContent).toContain("model's internal scale (0–1)")
    // The reading does not go away when the internal value appears.
    expect(readout(dialog, F_COST_NO_CAP)).toContain('£60k')
  })

  /**
   * ⚠ REPLACES "the £ row’s input appears under technical detail … input.value
   * '0.5'". A £ row whose factor declares its scale keeps its £ field under
   * technical detail too — one field per row, one frame per field — and the
   * model's own number is stated BESIDE it, labelled as the internal scale, so
   * technical detail still shows it.
   */
  it('⭐⭐ a £ row under technical detail keeps its £ field and states the internal value beside it, labelled', () => {
    seed({ [F_COST]: { value: 0.5, display_value: '£60k' } })
    const dialog = openInspector()
    toggleTechnicalDetail(dialog)

    const input = within(dialog).getByRole('textbox', {
      name: `Target for ${F_COST_LABEL} under ${OPTION_LABEL}`,
    }) as HTMLInputElement
    expect(row(dialog, F_COST).contains(input)).toBe(true)
    expect(input.value).toBe('60,000')
    expect(inputs(dialog, F_COST)).toHaveLength(1)
    const internal = within(row(dialog, F_COST)).getByTestId(`intervention-internal-scale-${F_COST}`)
    expect(internal.textContent).toContain('0.5')
    expect(internal.textContent).toContain("model's internal scale (0–1)")
    expect(readout(dialog, F_COST)).toContain('£60k')
  })

  it('CONTRAST — the internal value is NOT user copy in the default view of the same row', () => {
    seed({ [F_COST]: { value: 0.5, display_value: '£60k' } })
    const dialog = openInspector()
    expect(within(row(dialog, F_COST)).queryByTestId(`intervention-internal-scale-${F_COST}`)).toBeNull()
    expect(row(dialog, F_COST).textContent ?? '').not.toContain('0.5')
  })
})
