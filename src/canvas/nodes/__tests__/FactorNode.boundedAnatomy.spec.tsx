/**
 * ⛔⛔ PARTLY SUPERSEDED — Paul, 25 Sep 2026, from live screenshots: the canvas
 * must match the PROTOTYPE, and where this ruling (ED 5809278282, "title plus
 * one primary line") conflicts with the prototype's card bodies, THE PROTOTYPE
 * WINS. So after a run the driver line, the TOP driver's found turning point
 * and the external range line (with its band) are back ON the Standard card —
 * pinned in `FactorNode.prototypeBodyAtRest.spec.tsx`, and re-pointed below
 * (each re-pointed case says so). What still holds from this file: the value
 * line and the `Needs input` row are each ONE no-wrap row; `Needs input` stays
 * on the card; a NON-top factor's found turning point stays in the popover; and
 * the body is identical at `full` and `quiet` (no rung-triggered re-layout).
 *
 * ⭐⭐ THE FACTOR CARD FITS ITS HEIGHT ALLOWANCE — title + ONE primary line.
 *
 * Experience Design, #63 5809278282 (24 Sep 2026):
 *   "Proceed with (2), modified; do not build rung-triggered re-layout … Keep one
 *   stable layout geometry.
 *   - Landing / quiet: repeated cards may reduce to title + one primary line
 *     inside the fixed fit-safe box. … Factor = value + provenance mark …
 *   - Do not turn the Canvas into an inventory-only surface. At Normal/Focused,
 *     keep a quiet reasoning signal visible at rest where one exists (attention
 *     mark and neutral driver cue). The fuller S3 reasoning detail — change
 *     rows, driver wording, turning-point explanation/findings — can move to the
 *     existing hover/focus popover and inspector rather than expanding layout
 *     geometry.
 *   - Truth does not become progressive-disclosure debt: `Needs input` and value
 *     provenance remain explicit; any stale run-derived figure shown on-card or
 *     in disclosure keeps `Last run ·`, with the whole-graph stale cue still
 *     present. Never hide provenance or staleness in tooltip-only copy.
 *   - This is a fit implementation of the locked anatomy, not a new design gate."
 *
 * WHY (measured by the brief): at 1280×800 with the dock open the landing zoom
 * is the 0.5 floor, `--canvas-label-scale` = 2, ~19 characters per line in a
 * 260-unit card, and the layout reserves each card's height AT that bound. The
 * allowance is ~149 units per card: padding + a title of ≤2 lines + EXACTLY ONE
 * body line.
 *
 * What this file pins (Standard view):
 *   · ONE visible body row at every rung and phase — the value line
 *     (`factor-recorded-value`: value + mark, never cut, mark `shrink-0`) or the
 *     `Needs input` row (the ruled word, visible; "Value not set yet" moved to
 *     the popover and kept as the row's sr-only description and `title`).
 *   · The S3 findings — `Driver N of M analysed` + bar, a FOUND turning point,
 *     the external prior-range line — are NOT in the card; they ARE in the
 *     factor's `NodePopover`, with `Last run ·` when stale, and the popover
 *     mounts for them whatever the factor's priority.
 *   · A RANKED factor at the Normal rung (`full`) carries a neutral driver cue
 *     INSIDE the value line (no words; accessible name = the caption, `Last
 *     run ·` when stale). Not at `quiet`, and never as a row of its own — so a
 *     `full` card can never be taller than the same card at `quiet` (the
 *     height-safety invariant).
 *   · Detailed keeps its inline detail (the contrast controls below).
 *
 * ⚠ IDENTITY, NOT A VALUE PREDICATE. Card and popover are told apart by
 * CONTAINER identity: the card is BaseNode's `role="group"` root that holds
 * `node-title`; the popover is the mocked `NodePopover`'s own test id (the
 * mock renders its children so its CONTENT is observable — its open/close
 * behaviour is `usePopoverHover`'s and is pinned there). Every absence is paired
 * with a positive control in the same render.
 *
 * Freshness is NOT mocked: `current` / `changed` come from the real store and
 * the real composed verdict (harness from `FactorNode.anatomyV32`).
 *
 * CLAIM SCOPE: jsdom — strings, test ids, classes and DOM containment. Not
 * pixels: "one line" here is "one row element whose layout cannot wrap its
 * mark", and the served-build witness at 1280×800 is the acceptance.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { FactorNode } from '../FactorNode'
import { useCanvasStore } from '../../store'
import { useAnalysisTrust } from '../../hooks/useAnalysisTrust'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, isGraphBadgesEnabled: () => true }
})

let displayMetadata: Record<string, unknown> = {}
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => displayMetadata),
}))

// Transparent, identity-bearing popover: its CONTENT is what this file reads.
vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="factor-node-popover">{children}</div>
  ),
}))

const ID = 'fac_conversion'

const VALUED = {
  label: 'Trial conversion', type: 'factor', category: 'controllable',
  observedState: { value: 0.08, unit: '%', display_value: '8%', extractionType: 'inferred', source: 'cee_inference' },
}
const MISSING = { label: 'Trial conversion', type: 'factor', category: 'controllable' }
/** External, range only — the card's old "Range: 0.3 to 0.8 no source" line. */
const RANGE_ONLY = {
  label: 'Trial conversion', type: 'factor', category: 'external',
  prior: { distribution: 'uniform', range_min: 0.3, range_max: 0.8 },
}
/** External, range only, stated in the reader's unit (percent) — v3.1 #20 keeps it on the card. */
const RANGE_ONLY_PCT = {
  label: 'Trial conversion', type: 'factor', category: 'external',
  prior: { distribution: 'uniform', range_min: 0.25, range_max: 0.45 },
  observedState: { unit: '%' },
}

const metadata = (rank: number | null, setSize: number | null, rankedCount: number | null, influence: number) => ({
  sensitivityRank: rank,
  influence,
  influenceProvenance: 'influence_score',
  influenceImportanceBasis: null,
  influenceSetSize: setSize,
  influenceRankedCount: rankedCount,
  confidence: null,
  confidenceIsDefaulted: false,
  confidenceIsProvisional: false,
  inSensitivityAnalysis: true,
  achievementProbability: null,
  achievementProbabilityIsModelledBasis: false,
  stabilityPercentage: null,
  winRate: null,
  isResultsMode: true,
  predictedOutcome: null,
  valueOfInformation: null,
  voiRank: null,
})
const RANKED = () => metadata(1, 6, 3, 1)
const UNRANKED = () => metadata(null, 6, 3, 0.12)

const FOUND_ROW = { node_id: ID, label: 'Trial conversion', current_value: 8, flip_value: 6.5, unit: '%', flip_reason: 'found', value_scale: 'display' }
const FRESH_VERDICT = { freshness: 'fresh', freshnessReason: 'graph_hash_match', computedAt: '2026-09-24T00:00:00.000Z' }

type Rung = 'full' | 'quiet'
const seed = (
  data: Record<string, unknown>,
  { phase, flipRows = [], viewMode = 'standard', lodRung = 'full' }:
    { phase: 'pre' | 'post'; flipRows?: unknown[]; viewMode?: 'standard' | 'expert'; lodRung?: Rung },
) => {
  useCanvasStore.setState({
    nodes: [{ id: ID, type: 'factor', position: { x: 0, y: 0 }, data }],
    edges: [], ceeAnalysisReady: null, viewMode, lodRung,
    goalConstraints: [],
    analysisStateV1: null, importPendingServerRegistration: false, currentScenarioId: 'bounded-anatomy',
    ...(phase === 'post'
      ? {
          analysisFreshness: FRESH_VERDICT, analysisFreshnessDirty: false,
          v5AnalysisFact: { scenarioId: 'bounded-anatomy', analysisHash: 'run-1', hasRunAnalysisFact: true },
          hasCompletedFirstRun: true,
          results: { status: 'complete', hash: 'run-1', report: {
            option_probabilities: {
              opt_a: { status: 'computed', win_probability: 0.6 },
              opt_b: { status: 'computed', win_probability: 0.4 },
            },
            robustness: { near_tie: { is_tie: false, top_option_id: 'opt_a' } },
            flip_thresholds: flipRows,
          } },
        }
      : {
          analysisFreshness: null, analysisFreshnessDirty: false, v5AnalysisFact: null,
          hasCompletedFirstRun: false, results: { status: 'idle', report: null },
        }),
  } as never)
}

const editTheModel = () => act(() => useCanvasStore.setState({ analysisFreshnessDirty: true }))

function TrustProbe() {
  return <span data-testid="trust-probe" data-semantic={useAnalysisTrust().semantic} />
}
const semantic = () => screen.getByTestId('trust-probe').getAttribute('data-semantic')

const renderFactor = (data: Record<string, unknown>) =>
  render(
    <ReactFlowProvider>
      <TrustProbe />
      <FactorNode
        id={ID} type="factor" data={data as never} selected={false}
        isConnectable positionAbsoluteX={0} positionAbsoluteY={0}
        dragging={false} zIndex={0} deletable selectable draggable
      />
    </ReactFlowProvider>,
  )

const visibleText = (el: Element) => {
  const clone = el.cloneNode(true) as Element
  clone.querySelectorAll('.sr-only').forEach((n) => n.remove())
  return (clone.textContent ?? '').trim()
}
const tokens = (el: Element) => new Set((el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean))
const before = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

/** BaseNode's root for THIS card — the positive control every absence needs. */
const card = () => {
  const title = screen.getByTestId('node-title')
  expect(title.textContent).toContain('Trial conversion')
  const root = title.closest('[role="group"]')
  expect(root).not.toBeNull()
  return root as HTMLElement
}
const popover = () => screen.getByTestId('factor-node-popover')

/** The card body's VISIBLE rows: the siblings of the primary line, sr-only excluded. */
const visibleBodyRows = (primary: Element) =>
  Array.from(primary.parentElement!.children).filter((el) => !el.classList.contains('sr-only'))

/** The S3 findings that must not be ON the card in Standard view. */
const FINDING_IDS = [
  'factor-driver-line', 'factor-driver-line-bar', 'factor-turning-point', 'factor-turning-point-none',
  `factor-prior-range-${ID}`, `factor-range-source-${ID}`,
]
const expectNoFindingOnTheCard = () => {
  const c = card()
  for (const id of FINDING_IDS) expect(within(c).queryByTestId(id), `${id} is on the card`).toBeNull()
}

beforeEach(() => {
  displayMetadata = UNRANKED()
})
afterEach(() => {
  cleanup()
  useCanvasStore.setState({
    analysisStateV1: null, analysisFreshness: null, analysisFreshnessDirty: false,
    v5AnalysisFact: null, results: { status: 'idle', report: null }, lodRung: 'full',
    viewMode: 'standard', goalConstraints: [],
  } as never)
})

describe('ED 5809278282 · Factor · the value line is the ONE body line, and it cannot wrap its mark', () => {
  it.each(['full', 'quiet'] as const)('pre-run at %s: one visible body row — value + mark, no-wrap row, mark shrink-0', (lodRung) => {
    seed(VALUED, { phase: 'pre', lodRung })
    renderFactor(VALUED)
    const row = within(card()).getByTestId('factor-recorded-value')
    expect(visibleText(row)).toBe('8%est.')
    expect(visibleBodyRows(row)).toEqual([row])
    const rowTokens = tokens(row)
    expect(rowTokens.has('flex-nowrap'), 'the value row may not wrap its mark onto a second line').toBe(true)
    expect(rowTokens.has('flex-wrap')).toBe(false)
    // The value is never cut (no ellipsis on the line) and the mark never shrinks.
    expect(rowTokens.has('text-ellipsis')).toBe(false)
    const markSlot = screen.getByTestId(`factor-value-mark-slot-${ID}`)
    expect(row.contains(markSlot)).toBe(true)
    expect(markSlot.contains(screen.getByTestId('estimate-marker'))).toBe(true)
    expect(tokens(markSlot).has('shrink-0')).toBe(true)
    expect(tokens(markSlot).has('whitespace-nowrap')).toBe(true)
  })
})

describe('ED 5809278282 · Factor · missing value — `Needs input` stays ON the card, on one line', () => {
  /**
   * ⛔ UPDATED 24 Sep 2026 (GAP-9, DESIGN-GAP-AUDIT-20260924.md row 9;
   * contract §02). This used to pin "Value not set yet" as sr-only/title-only
   * in Standard, with the visible row reading just "Needs input". The
   * contract wants the sentence VISIBLE on the card in the missing-value
   * state, so Standard now matches what "CONTRAST — Detailed" already
   * asserted below (which is unchanged, since Detailed was already correct).
   * `StatusPill`'s own label/title are UNCHANGED — only the row's wrap
   * behaviour and the sentence's visibility move.
   */
  it.each(['pre', 'post'] as const)('%s-run: the row shows the pill AND the visible sentence — no hidden text, no title duplicate', (phase) => {
    seed(MISSING, { phase })
    renderFactor(MISSING)
    const row = within(card()).getByTestId(`factor-needs-input-row-${ID}`)
    expect(visibleText(row)).toBe('Needs inputValue not set yet')
    expect(tokens(row).has('flex-wrap')).toBe(true)
    expect(tokens(row).has('flex-nowrap')).toBe(false)
    expect(visibleBodyRows(row)).toEqual([row])
    // GAP-9: nothing is hidden any more — no sr-only echo, no title duplicate
    // of text that is now on screen.
    expect(row.querySelector('.sr-only')).toBeNull()
    expect(row.getAttribute('title')).toBeNull()
    // The pill's own accessible contract is untouched (StatusPill reuses its
    // `title` prop as the accessible name — unchanged by this gap).
    expect(within(row).getByTestId('needs-input-pill')).toHaveAccessibleName('Missing required input')
    // …the popover keeps its own (now duplicate, and that is fine — see the
    // inline comment at `needsInputSentenceMoved`) copy of the sentence.
    expect(within(popover()).getByTestId(`factor-popover-needs-input-${ID}`).textContent).toBe('Needs input · Value not set yet')
    expect(within(card()).queryByTestId(`factor-popover-needs-input-${ID}`)).toBeNull()
  })

  it('CONTRAST — Detailed keeps the full sentence inline on the card (unchanged by GAP-9)', () => {
    seed(MISSING, { phase: 'pre', viewMode: 'expert' })
    renderFactor(MISSING)
    expect(visibleText(within(card()).getByTestId(`factor-needs-input-row-${ID}`))).toBe('Needs inputValue not set yet')
  })

  it('CONTRAST — a VALUED factor never shows "Value not set yet" anywhere on the card', () => {
    seed(VALUED, { phase: 'pre' })
    renderFactor(VALUED)
    expect(screen.queryByTestId(`factor-needs-input-row-${ID}`)).toBeNull()
    expect(card().textContent ?? '').not.toContain('Value not set yet')
  })
})

describe('Prototype (Paul 25 Sep, superseding ED 5809278282) · post-run RANKED with a found turning point — findings are ON the card', () => {
  /** On the face, and never repeated in the popover. */
  const onCardNotInPopover = (id: string) => {
    const pop = screen.queryByTestId('factor-node-popover')
    if (pop) expect(within(pop).queryByTestId(id), `${id} is repeated in the popover`).toBeNull()
    return within(card()).getByTestId(id)
  }

  it('current: value line → driver line → turning point, in that order, on the card; no inline cue', () => {
    displayMetadata = RANKED()
    seed(VALUED, { phase: 'post', flipRows: [FOUND_ROW] })
    renderFactor(VALUED)
    expect(semantic()).toBe('current')
    const row = within(card()).getByTestId('factor-recorded-value')
    expect(visibleText(row)).toBe('8%est.')
    const driver = onCardNotInPopover('factor-driver-line')
    const tp = onCardNotInPopover('factor-turning-point')
    expect(within(driver).getByTestId('factor-driver-line-caption').textContent).toBe('Driver 1 of 6 analysed')
    expect(within(driver).getByTestId('factor-driver-line-bar')).toBeTruthy()
    // v3.1 point 3 (DESIGN-GAP-v31 #38): the resting caption IS the direction
    // sentence (was "Model comparison changes" + a floated 6.5%).
    expect(within(tp).getByTestId('factor-turning-point-caption').textContent).toBe('Below 6.5%, the current model comparison changes.')
    expect(within(tp).queryByTestId('factor-turning-point-caption-value')).toBeNull()
    expect(tp.getAttribute('aria-label')!.startsWith('Below 6.5%, the current model comparison changes. ')).toBe(true)
    expect(before(row, driver)).toBe(true)
    expect(before(driver, tp)).toBe(true)
    expect(screen.queryByTestId(`factor-driver-cue-${ID}`)).toBeNull()
  })

  it('stale: `Last run ·` rides both findings on the card; the value is never prefixed', () => {
    displayMetadata = RANKED()
    seed(VALUED, { phase: 'post', flipRows: [FOUND_ROW] })
    renderFactor(VALUED)
    editTheModel()
    expect(semantic()).toBe('changed')
    onCardNotInPopover('factor-driver-line')
    onCardNotInPopover('factor-turning-point')
    expect(within(card()).getByTestId('factor-driver-line-caption').textContent).toBe('Last run · Driver 1 of 6 analysed')
    expect(within(card()).getByTestId('factor-turning-point-caption').textContent).toBe('Last run · Below 6.5%, the model comparison changes.')
    expect(within(card()).getByTestId('factor-turning-point').getAttribute('aria-label')!.startsWith(
      'Last run · Below 6.5%, the model comparison changes. ',
    )).toBe(true)
    expect(within(card()).getByTestId('factor-turning-point-run-value').textContent).toBe('8% in last run')
    expect(visibleText(within(card()).getByTestId('factor-recorded-value'))).toBe('8%est.')
  })

  it('HEIGHT SAFETY — the body is the same at `quiet` and `full`: no rung-triggered re-layout', () => {
    const body = () => {
      const row = within(card()).getByTestId('factor-recorded-value')
      return visibleBodyRows(row).map((el) => el.getAttribute('data-testid'))
    }
    displayMetadata = RANKED()
    seed(VALUED, { phase: 'post', flipRows: [FOUND_ROW], lodRung: 'quiet' })
    renderFactor(VALUED)
    const quiet = body()
    expect(quiet).toEqual(['factor-recorded-value', 'factor-driver-line', 'factor-turning-point'])
    cleanup()
    seed(VALUED, { phase: 'post', flipRows: [FOUND_ROW], lodRung: 'full' })
    renderFactor(VALUED)
    expect(body()).toEqual(quiet)
  })

  /**
   * ⛔ UPDATED 24 Sep 2026 (GAP-9): the row's visible text now includes
   * "Value not set yet" (contract §02) and the row may wrap. The prototype
   * property (Paul 25 Sep) is unchanged: the driver line is its own row on the
   * card, after the `Needs input` row — never inside it.
   */
  it('a ranked factor that still needs input: `Needs input` stays one row, and the driver line follows it', () => {
    displayMetadata = RANKED()
    seed(MISSING, { phase: 'post' })
    renderFactor(MISSING)
    const row = within(card()).getByTestId(`factor-needs-input-row-${ID}`)
    expect(visibleText(row)).toBe('Needs inputValue not set yet')
    const driver = onCardNotInPopover('factor-driver-line')
    expect(row.contains(driver)).toBe(false)
    expect(before(row, driver)).toBe(true)
  })

  it('a ranked factor with NO primary line (external, no value, no range) still states its rank on the card', () => {
    const EMPTY_EXTERNAL = { label: 'Trial conversion', type: 'factor', category: 'external' }
    displayMetadata = RANKED()
    seed(EMPTY_EXTERNAL, { phase: 'post' })
    renderFactor(EMPTY_EXTERNAL)
    const c = card()
    expect(within(c).queryByTestId('factor-recorded-value')).toBeNull()
    expect(within(c).queryByTestId(`factor-needs-input-row-${ID}`)).toBeNull()
    expect(within(onCardNotInPopover('factor-driver-line')).getByTestId('factor-driver-line-caption').textContent).toBe('Driver 1 of 6 analysed')
  })

  it('CONTRAST — Detailed keeps the driver line and the turning point inline, and needs no cue', () => {
    displayMetadata = RANKED()
    seed(VALUED, { phase: 'post', flipRows: [FOUND_ROW], viewMode: 'expert' })
    renderFactor(VALUED)
    const c = card()
    expect(within(c).getByTestId('factor-driver-line-detail-caption').textContent).toBe('Driver 1 of 6 analysed')
    expect(within(c).getByTestId('factor-turning-point')).toBeTruthy()
    expect(screen.queryByTestId(`factor-driver-cue-${ID}`)).toBeNull()
    expect(screen.queryByTestId('factor-node-popover')).toBeNull()
  })
})

describe('ED 5809278282 · Factor · post-run NOT ranked', () => {
  it('no cue and no driver line anywhere; a FOUND turning point moves to the popover, which mounts for it (low priority)', () => {
    displayMetadata = UNRANKED()
    seed(VALUED, { phase: 'post', flipRows: [FOUND_ROW] })
    renderFactor(VALUED)
    const row = within(card()).getByTestId('factor-recorded-value')
    expect(visibleBodyRows(row)).toEqual([row])
    expectNoFindingOnTheCard()
    expect(screen.queryByTestId(`factor-driver-cue-${ID}`)).toBeNull()
    expect(screen.queryByTestId('factor-driver-line')).toBeNull()
    expect(within(popover()).getByTestId('factor-turning-point-caption').textContent).toBe('Below 6.5%, the current model comparison changes.')
  })
})

describe('Prototype (Paul 25 Sep, superseding ED 5809278282) · the external prior-range line is ON the card with its mark', () => {
  /**
   * ⛔ UPDATED 24 Sep 2026 (GAP-16, DESIGN-GAP-AUDIT-20260924.md row 16):
   * `unknown`'s visible glyph was the word "no source" — a fifth wire-facing
   * phrase the v3/v3.1 contract never sanctioned (they name exactly `est.` /
   * `you` / `brief` / `panel`). `VALUE_SOURCE_MARK_TOKEN.unknown` is now `''`
   * — nothing prints — while the accessible name stays "Source not recorded"
   * (`VALUE_SOURCE_MARK_LABEL.unknown`, asserted via `data-value-source`
   * below), since nothing else on the card states that this range's source
   * was never stamped.
   */
  // ⛔ REVERSED (review 5822866079): "no source" stays visible. Paul, 23 Sep point 1 — a
  // number (or range) is never unmarked; the header does not carry a range.
  // ⭐ CONTRACT v3.1 #20 (26 Sep): a range stated only on the bare 0–1 scale
  // ("Range: 0.3 to 0.8") is omitted from the card — so this pin now runs on a
  // range the card CAN state in the reader's unit, and the bare one is pinned
  // absent (line AND mark) beside it.
  it.each(['pre', 'post'] as const)('%s-run: an own-unit range is on the card with its `no source` mark; not in the popover', (phase) => {
    seed(RANGE_ONLY_PCT, { phase })
    renderFactor(RANGE_ONLY_PCT)
    const c = card()
    expect(visibleText(within(c).getByTestId(`factor-prior-range-${ID}`))).toBe('Range: 25% to 45% no source')
    expect(within(c).getByTestId(`factor-range-source-${ID}`).getAttribute('data-value-source')).toBe('unknown')
    const pop = screen.queryByTestId('factor-node-popover')
    if (pop) expect(within(pop).queryByTestId(`factor-prior-range-${ID}`)).toBeNull()
  })

  // Review F2 (#2085): a bare 0–1 range's origin is unrecorded (the inspector's
  // 0–1 editor writes no stamp), so it may be the person's — it stays on the
  // card, with the `no source` mark stating the gap.
  it.each(['pre', 'post'] as const)('%s-run — a bare 0–1 range of unrecorded origin IS on the card with its `no source` mark (F2)', (phase) => {
    seed(RANGE_ONLY, { phase })
    renderFactor(RANGE_ONLY)
    const c = card()
    expect(visibleText(within(c).getByTestId(`factor-prior-range-${ID}`))).toBe('Range: 0.3 to 0.8 no source')
    expect(within(c).getByTestId(`factor-range-source-${ID}`)).toBeTruthy()
  })

  it('CONTRAST — Detailed keeps the (own-unit) range line on the card', () => {
    seed(RANGE_ONLY_PCT, { phase: 'pre', viewMode: 'expert' })
    renderFactor(RANGE_ONLY_PCT)
    expect(within(card()).getByTestId(`factor-prior-range-${ID}`)).toBeTruthy()
  })
})
