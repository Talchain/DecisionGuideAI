/**
 * ⭐ D2 · THE OPTION CARD AT REST — "lead with what the option changes".
 * Locked Experience Design, Paul-approved 23 Sep 2026. Supersedes the one-row
 * draft in #1888, whose selection mechanism this keeps.
 *
 * The rule and its reasons live in `shared/optionCardAtRest.ts`; this spec pins
 * what the CARD renders under it and what it must keep.
 *
 * FIXTURE — NOT AUTHORED HERE. The shipped `pricing-model` starter
 * (`src/canvas/starters/data/pricing-model.draft.json`), put into the store by
 * `applyDraftResult`, the same call `applyStarter` makes. Every from→to below
 * is the pair CEE authored (`analysis_ready.options[].interventions[].display_value`),
 * so the strings are the wire's, not this file's.
 *
 * ⭐ THE DISCRIMINATING CARD IS `opt_new_logos`. Its list order (by |target|)
 * is friction 0.6, usage 0.3, risk 0.1 — so "the first two rows" would be
 * friction + usage. Its differentiator is RISK ("Enterprise revenue… is the key
 * difference"), so the differentiator-first rule keeps friction + risk. Only
 * one of those passes.
 *
 * CLAIM SCOPE (trap 3): jsdom has no geometry. This pins which rows are in the
 * card's DOM, that each row is one two-cell grid row, and that the preview
 * carries the rest — never a pixel height, and never that a value fits on one
 * visual line. The height is CI's `Canvas Browser Gate` and `e2e/geometry`.
 *
 * Rows are bound by IDENTITY (`data-delta-factor` = the factor id), never by a
 * value string another row could also render.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { OptionNode } from '../OptionNode'
import { useCanvasStore } from '../../store'
import { applyDraftResult } from '../../utils/applyDraftResult'
import pricingStarter from '../../starters/data/pricing-model.draft.json'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

/** The at-rest budget the locked design sets. Literal here, so this file does
 *  not import the module under test and its controls can run against the
 *  unchanged card. `shared/__tests__/optionCardAtRest.spec.ts` pins the constant. */
const AT_REST = 2

const USAGE = 'fac_usage_exposure'
const FRICTION = 'fac_adoption_friction'
const RISK = 'fac_enterprise_revenue_risk'
const ALL = [USAGE, FRICTION, RISK]

const NEW_LOGOS = 'opt_new_logos'
const FULL_SWITCH = 'opt_full_switch'
const HYBRID = 'opt_hybrid'
const STATUS_QUO = 'opt_status_quo'
const NON_BASELINE = [FULL_SWITCH, HYBRID, NEW_LOGOS]

/** The full, sentence-cased factor names — what the preview must recover. */
const FULL_LABEL: Record<string, string> = {
  [USAGE]: 'Usage-based pricing exposure',
  [FRICTION]: 'Bottom-up adoption friction',
  [RISK]: 'Enterprise revenue cannibalization risk',
}

/** CEE's authored pairs, reference option → this option. */
const FROM_TO: Record<string, Record<string, string>> = {
  [NEW_LOGOS]: {
    [FRICTION]: 'Very high (0.8) → High (0.6)',
    [USAGE]: 'Low (0) → Moderate (0.3)',
    [RISK]: 'Low (0) → Low (0.1)',
  },
  [FULL_SWITCH]: {
    [USAGE]: 'Low (0) → Very high (1)',
    [RISK]: 'Low (0) → Very high (0.8)',
    [FRICTION]: 'Very high (0.8) → Low (0.1)',
  },
  [HYBRID]: {
    [USAGE]: 'Low (0) → Moderate (0.5)',
    [FRICTION]: 'Very high (0.8) → Moderate (0.4)',
    [RISK]: 'Low (0) → Moderate (0.4)',
  },
}

const REFERENCE_FULL = 'Reference: Keep Per-Seat Pricing (Status Quo)'

function seed(viewMode: 'standard' | 'expert') {
  applyDraftResult(pricingStarter as never, { skipAutosave: true })
  useCanvasStore.setState({ viewMode, results: { status: 'idle', report: null } } as never)
}

/** A completed, current run over the same four options (shape from `rule2.optionOwnUnitBeforeSupport.spec`). */
function seedCompletedRun(goalThreshold: number | null) {
  useCanvasStore.setState({
    importPendingServerRegistration: false, currentScenarioId: 'd2-scenario',
    analysisFreshness: {
      freshness: 'fresh', freshnessReason: 'graph_hash_match',
      computedAt: '2026-09-23T00:00:00.000Z',
    },
    analysisFreshnessDirty: false, analysisStateV1: null,
    v5AnalysisFact: { scenarioId: 'd2-scenario', analysisHash: 'last-run', hasRunAnalysisFact: true },
    hasCompletedFirstRun: true,
    goalThreshold,
    results: { status: 'complete', hash: 'last-run', report: {
      option_probabilities: {
        [FULL_SWITCH]: { status: 'computed', win_probability: 0.4 },
        [HYBRID]: { status: 'computed', win_probability: 0.3 },
        [NEW_LOGOS]: {
          status: 'computed', win_probability: 0.2,
          probability_of_joint_goal: 0.05,
          constraint_analysis: { constraints: [{ id: 'c1' }], joint_probability: 0.05 },
        },
        [STATUS_QUO]: { status: 'computed', win_probability: 0.1 },
      },
      robustness: { near_tie: { is_tie: false, top_option_id: FULL_SWITCH } },
    } },
  } as never)
}

function card(id: string, selected: boolean) {
  const node = useCanvasStore.getState().nodes.find(n => n.id === id)
  if (!node) throw new Error(`fixture lost option ${id}`)
  return (
    <ReactFlowProvider>
      <OptionNode
        id={id} type="option" data={node.data} selected={selected}
        isConnectable positionAbsoluteX={0} positionAbsoluteY={0}
        dragging={false} zIndex={0} deletable selectable draggable
      />
    </ReactFlowProvider>
  )
}

const mount = (id: string, selected = false) => render(card(id, selected))

/** Rows IN THE CARD — the render container, which a portalled preview is not in. */
const cardRows = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>('[data-delta-factor]'))
const cardRowIds = (container: HTMLElement) => cardRows(container).map(el => el.dataset.deltaFactor)

/** The card's preview list, which `NodePopover` portals to `document.body`. */
const previewList = (id: string) =>
  document.body.querySelector<HTMLElement>(`[data-testid="option-deltas-full-${id}"]`)
const previewRowIds = (id: string) => {
  const list = previewList(id)
  return list === null
    ? null
    : Array.from(list.querySelectorAll<HTMLElement>('[data-delta-factor]')).map(el => el.dataset.deltaFactor)
}

/**
 * The CONTROLS' probe: a row's factor read back from its `title` (the full
 * name, then the pair), which the card has carried since #1247. It exists so
 * the controls run against the UNCHANGED card too — `data-delta-factor` is new
 * in this change, so a control bound to it could not be green before it.
 */
const titledRowIds = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>('li[title]'))
    .map(li => ALL.find(id => (li.getAttribute('title') ?? '').startsWith(`${FULL_LABEL[id]}: `)))
    .filter((id): id is string => id !== undefined)

/** Open the preview the way a pointer does — hover, then the 300ms intent delay. */
async function hoverOpen(container: HTMLElement) {
  fireEvent.mouseEnter(container.firstElementChild!)
  await waitFor(() => expect(document.body.querySelector('[data-node-popover]')).not.toBeNull())
  return document.body.querySelector<HTMLElement>('[data-node-popover]')!
}

const moreButton = (container: HTMLElement, id: string) =>
  container.querySelector<HTMLElement>(`[data-testid="option-deltas-more-${id}"]`)

afterEach(cleanup)

describe('(a) Standard, at rest — two grid rows, then "+N more"', () => {
  beforeEach(() => seed('standard'))

  it.each(NON_BASELINE)('%s: exactly two delta rows of its three, and "+N more" for the rest', (id) => {
    const { container } = mount(id)
    expect(cardRows(container)).toHaveLength(AT_REST)
    const more = moreButton(container, id)
    expect(more, 'the hidden rows must be announced').not.toBeNull()
    expect(more!.tagName).toBe('BUTTON')
    const n = Object.keys(FROM_TO[id]).length - AT_REST
    expect(more!.querySelector('[aria-hidden="true"]')?.textContent).toBe(`+${n} more`)
  })

  it.each(NON_BASELINE)('%s: each row is ONE two-cell grid row — compacted label | CEE\'s from→to', (id) => {
    const { container } = mount(id)
    const list = container.querySelector<HTMLElement>(`[data-testid="option-deltas-${id}"]`)
    expect(list, 'the delta list must render').not.toBeNull()
    // The list declares the two tracks; every row adopts them, so the label
    // column and the value column line up down the card.
    expect(list!.className).toMatch(/(^|\s)grid(\s|$)/)
    expect(list!.className).toContain('grid-cols-[auto_minmax(0,1fr)]')
    const rows = cardRows(container)
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      const factorId = row.dataset.deltaFactor!
      expect(row.className).toContain('grid-cols-subgrid')
      const cells = Array.from(row.children) as HTMLElement[]
      expect(cells.map(c => c.dataset.deltaCell)).toEqual(['label', 'value'])
      const [label, value] = cells
      // The value is never truncated and never re-derived: it is CEE's pair.
      expect(value.textContent).toBe(FROM_TO[id][factorId])
      // The label is the compacted name — shorter than the full one, a prefix
      // of it — and its full name is recoverable from the row's title.
      const labelText = (label.textContent ?? '').replace(/…$/, '')
      expect(labelText.length).toBeGreaterThan(0)
      expect(label.textContent).not.toContain('→')
      expect(FULL_LABEL[factorId].startsWith(labelText)).toBe(true)
      expect(row.getAttribute('title')).toBe(`${FULL_LABEL[factorId]}: ${FROM_TO[id][factorId]}`)
    }
  })

  it('the reference stays on the card as ONE truncated line, its full text in the title', () => {
    const { container } = mount(NEW_LOGOS)
    const ref = container.querySelector<HTMLElement>(`[data-testid="option-reference-${NEW_LOGOS}"]`)
    expect(ref, 'the named reference must stay on the card').not.toBeNull()
    expect(ref!.textContent!.startsWith('Reference: ')).toBe(true)
    expect(ref!.textContent).not.toBe(REFERENCE_FULL)
    expect(ref!.textContent!.endsWith('…')).toBe(true)
    expect(ref!.getAttribute('title')).toBe(REFERENCE_FULL)
  })

  it('does not hold the preview open at rest', () => {
    mount(NEW_LOGOS)
    expect(previewRowIds(NEW_LOGOS)).toBeNull()
  })
})

describe('(b) the differentiator\'s factor is always among the rows shown', () => {
  beforeEach(() => seed('standard'))

  it('opt_new_logos keeps friction + RISK (its differentiator), not the first two rows (friction + usage)', () => {
    const { container } = mount(NEW_LOGOS)
    expect(cardRowIds(container)).toEqual([FRICTION, RISK])
  })

  it.each(NON_BASELINE)('%s: the row set contains the factor its differentiator sentence names', (id) => {
    const { container } = mount(id)
    const sentence = container.querySelector<HTMLElement>(`[data-testid="option-differentiator-${id}"]`)
    expect(sentence, 'every non-baseline pricing option carries a differentiator').not.toBeNull()
    const factorId = sentence!.dataset.differentiatorFactor
    expect(factorId, 'the sentence must carry its factor\'s identity').toBeDefined()
    expect(cardRowIds(container)).toContain(factorId)
  })
})

describe('(c) "+N more" opens the EXISTING preview with the full list', () => {
  beforeEach(() => seed('standard'))

  it('pins the preview open with EVERY row, each under its FULL label', () => {
    const { container } = mount(NEW_LOGOS)
    const more = moreButton(container, NEW_LOGOS)
    expect(more).not.toBeNull()
    expect(more!.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(more!)
    expect(more!.getAttribute('aria-expanded')).toBe('true')
    expect([...(previewRowIds(NEW_LOGOS) ?? [])].sort()).toEqual([...ALL].sort())
    const list = previewList(NEW_LOGOS)!
    for (const factorId of ALL) {
      const row = list.querySelector<HTMLElement>(`[data-delta-factor="${factorId}"]`)!
      expect(row.querySelector('[data-delta-cell="label"]')?.textContent).toBe(FULL_LABEL[factorId])
      expect(row.querySelector('[data-delta-cell="value"]')?.textContent).toBe(FROM_TO[NEW_LOGOS][factorId])
    }
    // A from→to with no named baseline is not a comparison.
    expect(list.textContent).toContain(REFERENCE_FULL)
  })

  it('a second press closes it again — the control is a toggle, not a one-way door', () => {
    const { container } = mount(NEW_LOGOS)
    const more = moreButton(container, NEW_LOGOS)!
    fireEvent.click(more)
    expect(previewList(NEW_LOGOS)).not.toBeNull()
    fireEvent.click(more)
    expect(previewList(NEW_LOGOS)).toBeNull()
  })

  it('post-analysis: the pinned preview lists EVERY target — not three and a pointer to the inspector', () => {
    seed('standard')
    // A fourth target on the discriminating option and its reference, written
    // the way CEE writes the other three (value + authored display string), so
    // the card has two rows to hide and the preview's old cap of three bites.
    const EXTRA = 'fac_top_account_concentration'
    const state = useCanvasStore.getState() as unknown as {
      ceeAnalysisReady: { options: { id: string; interventions: Record<string, unknown>; intervention_details?: Record<string, unknown> }[] }
    }
    const withExtra = (id: string, value: number, display: string) => {
      const opt = state.ceeAnalysisReady.options.find(o => o.id === id)!
      return {
        ...opt,
        interventions: { ...opt.interventions, [EXTRA]: { value, source: 'brief_extraction', display_value: display } },
        intervention_details: { ...(opt.intervention_details ?? {}), [EXTRA]: { display_value: display, normalised_value: value } },
      }
    }
    useCanvasStore.setState({
      ceeAnalysisReady: {
        ...state.ceeAnalysisReady,
        options: state.ceeAnalysisReady.options.map(o =>
          o.id === NEW_LOGOS ? withExtra(NEW_LOGOS, 0.7, 'High (0.7)')
            : o.id === STATUS_QUO ? withExtra(STATUS_QUO, 0.2, 'Low (0.2)')
              : o),
      },
    } as never)
    seedCompletedRun(null)
    const { container } = mount(NEW_LOGOS, true)
    expect(cardRows(container)).toHaveLength(AT_REST)
    expect(moreButton(container, NEW_LOGOS)?.querySelector('[aria-hidden="true"]')?.textContent).toBe('+2 more')
    const preview = document.body.querySelector<HTMLElement>('[data-node-popover]')
    expect(preview, 'selecting must pin the post-analysis preview').not.toBeNull()
    const text = preview!.textContent ?? ''
    for (const name of [...Object.values(FULL_LABEL), 'Top account revenue concentration']) {
      expect(text).toContain(name)
    }
    expect(text).not.toMatch(/more in inspector/)
  })

  it('Escape releases the pin', () => {
    const { container } = mount(NEW_LOGOS)
    fireEvent.click(moreButton(container, NEW_LOGOS)!)
    expect(previewList(NEW_LOGOS)).not.toBeNull()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(previewList(NEW_LOGOS)).toBeNull()
  })
})

describe('(d) selecting the card pins the preview and does NOT grow the card', () => {
  beforeEach(() => seed('standard'))

  it('same rows, same delta block, before and after select — and the preview carries the rest', () => {
    const view = mount(NEW_LOGOS, false)
    const before = cardRowIds(view.container)
    const blockBefore = view.container.querySelector(`[data-testid="option-deltas-${NEW_LOGOS}"]`)?.textContent
    expect(before).toHaveLength(AT_REST)
    expect(previewRowIds(NEW_LOGOS)).toBeNull()

    view.rerender(card(NEW_LOGOS, true))

    expect(cardRowIds(view.container)).toEqual(before)
    expect(view.container.querySelector(`[data-testid="option-deltas-${NEW_LOGOS}"]`)?.textContent).toBe(blockBefore)
    expect([...(previewRowIds(NEW_LOGOS) ?? [])].sort()).toEqual([...ALL].sort())
  })

  it('post-analysis too: selecting pins the post-analysis preview, and the card keeps two rows', () => {
    seedCompletedRun(null)
    const { container } = mount(NEW_LOGOS, true)
    expect(cardRowIds(container)).toHaveLength(AT_REST)
    const preview = document.body.querySelector<HTMLElement>('[data-node-popover]')
    expect(preview, 'selecting must pin the post-analysis preview').not.toBeNull()
    expect(preview!.textContent).toContain('What this option sets:')
  })

  it('deselecting releases the pin', () => {
    const view = mount(NEW_LOGOS, true)
    expect(previewList(NEW_LOGOS)).not.toBeNull()
    view.rerender(card(NEW_LOGOS, false))
    expect(previewList(NEW_LOGOS)).toBeNull()
  })
})

describe('(e) CONTROLS — what this change must not touch', () => {
  it('Detailed view: every row stays on the card, the full reference with it, and nothing pins', () => {
    seed('expert')
    const { container } = mount(NEW_LOGOS, true)
    expect([...titledRowIds(container)].sort()).toEqual([...ALL].sort())
    expect(moreButton(container, NEW_LOGOS)).toBeNull()
    expect(container.textContent).toContain(REFERENCE_FULL)
    expect(previewList(NEW_LOGOS)).toBeNull()
  })

  it('the baseline card renders no delta rows and no "+N more"', () => {
    seed('standard')
    const { container } = mount(STATUS_QUO, true)
    expect(titledRowIds(container)).toEqual([])
    expect(moreButton(container, STATUS_QUO)).toBeNull()
    expect(container.textContent).toContain('Baseline option')
    expect(container.querySelector(`[data-testid="option-change-count-${STATUS_QUO}"]`)).toBeNull()
  })

  it('the differentiator sentence still renders, one line, its full text recoverable (Paul 10 Sep, "both stay")', () => {
    seed('standard')
    const { container } = mount(NEW_LOGOS)
    const sentence = container.querySelector<HTMLElement>(`[data-testid="option-differentiator-${NEW_LOGOS}"]`)
    expect(sentence?.textContent).toBe('Enterprise revenue… is the key difference')
    expect(sentence?.getAttribute('title')).toBe('Enterprise revenue cannibalization risk is the key difference')
  })

  it('pre-analysis: the question chip and the "N factor targets" route still render, unchanged', () => {
    seed('standard')
    const { container } = mount(NEW_LOGOS)
    expect(container.querySelector('[data-testid="option-card-question"]')).not.toBeNull()
    const route = container.querySelector(`[data-testid="option-change-count-${NEW_LOGOS}"]`)
    expect(route?.tagName).toBe('BUTTON')
    expect(route?.querySelector('[aria-hidden="true"]')?.textContent).toBe('3 factor targets')
  })

  it('post-analysis: the support row renders BELOW the change rows (Rule 2), and chip/route keep their pre-analysis gate', () => {
    seed('standard')
    seedCompletedRun(null)
    const { container } = mount(NEW_LOGOS)
    const support = container.querySelector(`[data-testid="option-win-readout-${NEW_LOGOS}"]`)
    expect(support, 'the support readout must render, or this asserts nothing').not.toBeNull()
    const rows = Array.from(container.querySelectorAll<HTMLElement>('li[title]'))
      .filter(li => ALL.some(id => (li.getAttribute('title') ?? '').startsWith(`${FULL_LABEL[id]}: `)))
    expect(rows.length, 'the change rows must survive the run').toBeGreaterThan(0)
    for (const row of rows) {
      expect(row.compareDocumentPosition(support!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
    expect(container.querySelector('[data-testid="option-card-question"]')).toBeNull()
    expect(container.querySelector(`[data-testid="option-change-count-${NEW_LOGOS}"]`)).toBeNull()
  })

  it('post-analysis preview: UI-SEM-082 still withholds "chance of target" when the user set no target', async () => {
    seed('standard')
    seedCompletedRun(null)
    const { container } = mount(NEW_LOGOS)
    const preview = await hoverOpen(container)
    expect(preview.textContent).toContain('What this option sets:')
    expect(preview.textContent).not.toMatch(/chance of target/)
  })

  it('post-analysis preview: …and states it when the user DID set one (positive control for the gate above)', async () => {
    seed('standard')
    seedCompletedRun(0.6)
    const { container } = mount(NEW_LOGOS)
    const preview = await hoverOpen(container)
    expect(preview.textContent).toMatch(/chance of target/)
  })
})
