/**
 * Zooming out must not make a number look more certain than it is.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE DEFECT — measured in Paul's manual test, 21 Sep, screenshot 7
 * ─────────────────────────────────────────────────────────────────────────────
 * At the reduced rung the cards read `0.4`, `£30,000`, `0.2`. At full zoom the
 * same cards read `0.4 est.` — **the figure survives and its provenance does
 * not.** The further out you zoom, the more authoritative Olumi's own guess
 * looks, which is the opposite of what a reduced view should cost you.
 *
 * ⭐ NOTHING NEW IS INVENTED, WHICH IS THIS LANE'S RECURRING SHAPE. The mark,
 * its meaning, its hover sentence and its glossary row all shipped long ago.
 * `FactorNode:199` gates it; `CanvasLegendPopover:929` re-types that gate to
 * decide whether the glossary may promise a marker, and says in its own comment
 * that it is copying this line. The reduced line — which IS the whole card
 * below the legibility floor — had no copy at all. One owner, three readers.
 *
 * ⛔ THE MARK NAMES A FACTOR'S OWN VALUE AND NOTHING ELSE (trap 21). The factor
 * arm of the resolver has three branches and only the first states that value;
 * the others state an INFLUENCE SCORE and a PRIOR RANGE. Marking those would
 * point the disclosure at the wrong number, which is worse than the omission
 * being fixed — so the arm that produces the string decides the mark, and the
 * last test here pins that.
 *
 * Locked Canvas design (23 Sep 2026): the influence arm now states the DRIVER
 * RANK (`Driver N of M analysed`, ED 02:31Z D1a) from the `driverRank`
 * fact, never a bare `Influence N%` (ED 11:52Z). Still a different object from
 * the factor's value, so the rule — and the tests below — are unchanged in
 * intent; the fixtures now carry the rank so that arm actually fires.
 *
 * CLAIM SCOPE (trap 3): jsdom proves PRESENCE and STRUCTURE, never pixels. The
 * `shrink-0` assertion is a claim about the class the element carries, which is
 * what makes the layout claim checkable at all.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { FactorNode } from '../FactorNode'
import { UNCONFIRMED_ESTIMATE_TOKEN } from '../../domain/vocabulary'
import { resolveLodMetricLineDetail } from '../shared/lodMetricLine'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

let storeState: Record<string, unknown> = {}

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector: (s: unknown) => unknown) => selector(storeState)),
}))

let displayMetadata: Record<string, unknown> = {}

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => displayMetadata),
}))

const NODE_ID = 'fac_conversion_rate'

const baseMetadata = {
  sensitivityRank: null,
  influence: null,
  influenceProvenance: null,
  confidence: null,
  inSensitivityAnalysis: false,
  achievementProbability: null,
  achievementProbabilityIsModelledBasis: null,
  stabilityPercentage: null,
  winRate: null,
  isResultsMode: false,
}

/** `lodRung: 'line'` IS the reduced rung — the same field the card reads. */
const makeStore = (nodeData: Record<string, unknown>) => ({
  results: { status: 'idle', report: null },
  highlightedNodes: new Set(),
  dimmedNodeIds: new Set(),
  editedSinceRunNodeIds: new Set(),
  analysisHighlight: { source: null, edgeIds: new Set(), nodeIds: new Set() },
  lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
  goalThreshold: null,
  goalConstraints: [],
  hoveredOptionId: null,
  ceeAnalysisReady: null,
  edges: [],
  nodes: [{ id: NODE_ID, type: 'factor', data: nodeData }],
  viewMode: 'standard',
  lodRung: 'line',
})

const baseProps = {
  id: NODE_ID,
  type: 'factor',
  position: { x: 0, y: 0 },
  selected: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
}

/**
 * ⚠ THE FIXTURE IS THE MEASURED WIRE SHAPE, NOT THE ONE I FIRST WROTE. A bare
 * `{ value: 0.4 }` with no unit and no `display_value` produces NO display text
 * at all — correctly, because nothing anchors the scale — so a spec built from
 * the type definition asserts against a card showing nothing. Measured on the
 * deployed board: `unit` 0 of 8 factors, `display_value` 7 of 8. The cards that
 * print a figure at all are printing CEE's own authored string.
 *
 * A factor whose value Olumi filled in — the marked case.
 */
/*
 * ⚠ 26 Sep (contract v3.1 #20, WS4): the figure is `40%` — in the reader's
 * unit. A bare `0.4` Olumi estimate is now omitted from the card (no figure, so
 * no mark on nothing), which would make every mark assertion below vacuous; the
 * bare shape is pinned SILENT in its own test at the end of this block.
 */
const INFERRED = {
  label: 'Conversion Rate',
  kind: 'factor',
  category: 'controllable',
  display_value: '40%',
  observedState: { value: 0.4, raw_value: 40, unit: '%', source: 'cee_inference', extractionType: 'inferred' },
}

/** The same factor after a human typed the number — the contrast. */
const USER_STATED = {
  label: 'Conversion Rate',
  kind: 'factor',
  category: 'controllable',
  display_value: '40%',
  observedState: { value: 0.4, raw_value: 40, unit: '%', source: 'user_override' },
}

const renderAtLineRung = (nodeData: Record<string, unknown>) => {
  storeState = makeStore(nodeData)
  return render(
    <ReactFlowProvider>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <FactorNode {...(baseProps as any)} data={nodeData as any} />
    </ReactFlowProvider>,
  )
}

describe('the est. mark survives the zoom that hides the card body', () => {
  beforeEach(() => {
    displayMetadata = { ...baseMetadata }
  })

  it('⭐ marks an inferred value at the reduced rung — RED at pristine, where only the number showed', () => {
    renderAtLineRung(INFERRED)
    expect(screen.getByTestId('node-lod-line-text').textContent).toContain('40%')
    expect(screen.getByTestId('node-lod-estimate-mark').textContent?.trim()).toBe(
      UNCONFIRMED_ESTIMATE_TOKEN,
    )
  })

  it('v3.1 #20 — the SAME estimate as a bare 0–1 figure says NOTHING at the reduced rung: no number, so no mark', () => {
    renderAtLineRung({ ...INFERRED, display_value: '0.4', observedState: { value: 0.4, source: 'cee_inference', extractionType: 'inferred' } })
    expect(screen.queryByTestId('node-lod-line-text')).toBeNull()
    expect(screen.queryByTestId('node-lod-estimate-mark')).toBeNull()
  })

  it('CONTRAST — a value the reader typed is never marked, so the mark is not simply always on', () => {
    renderAtLineRung(USER_STATED)
    expect(screen.getByTestId('node-lod-line-text').textContent).toContain('40%')
    expect(screen.queryByTestId('node-lod-estimate-mark')).toBeNull()
  })

  it('⛔ the mark is OUTSIDE the truncating element, so an ellipsis eats the number and never the disclosure', () => {
    renderAtLineRung(INFERRED)
    /*
     * ⚠ THE TRUNCATING ELEMENT IS THE TEXT SPAN, NOT `node-lod-line`. A first
     * cut put the id on the text and the mark beside it, which broke two specs
     * outside this file: `BaseNode.lodBodyLine` and `DecisionNode.optionCount`
     * both assert that `node-lod-line`'s PARENT is the hidden body and that it
     * re-declares `visibility: visible`. `node-lod-line` IS the reduced line;
     * the truncation belongs to the text inside it, which is precisely why the
     * mark can escape the ellipsis.
     */
    const text = screen.getByTestId('node-lod-line-text')
    const mark = screen.getByTestId('node-lod-estimate-mark')
    // Putting the token in the STRING would make it the first thing truncated —
    // the number surviving and the disclosure vanishing, which is the defect
    // this file closes, rebuilt by its own fix.
    expect(text.textContent).not.toContain(UNCONFIRMED_ESTIMATE_TOKEN)
    expect(text.className).toContain('truncate')
    expect(mark.className).toContain('shrink-0')
    expect(mark.className).not.toContain('truncate')
    expect(text.contains(mark)).toBe(false)
  })

  it('⭐ contract v3.1 T15 — on the line rung\'s KIND FILL the mark is body ink (text ≥ 4.5:1 on its actual ground)', () => {
    renderAtLineRung(INFERRED)
    // Precondition: the card really is on its kind fill at this rung.
    const card = screen.getAllByRole('group')[0]
    expect(card.className.split(/\s+/).some(c => /^bg-[a-z]+-light$/.test(c))).toBe(true)
    const t = screen.getByTestId('node-lod-estimate-mark').className.split(/\s+/)
    // `text-light` measures 3.05–4.26:1 on the six light fills; `text-body` 6.09–8.51:1.
    expect(t).toContain('text-text-body')
    expect(t).not.toContain('text-text-light')
  })
})

describe('the mark names the factor’s own value and no other number', () => {
  const influenceOnly = {
    label: 'Conversion Rate',
    kind: 'factor',
    category: 'controllable',
    // No value at all — the resolver falls through to the influence arm, which
    // states a DIFFERENT object. `extractionType` is still 'inferred'.
    observedState: { source: 'cee_inference', extractionType: 'inferred' },
  }

  it('withholds the mark where the line states an influence score, not a value', () => {
    // Locked Canvas design (23 Sep 2026): the influence arm speaks as the driver
    // rank (ED 02:31Z D1a / ED 11:52Z "no pseudo-precise `% influence`"), so the
    // rank fact BaseNode hands down is supplied and the non-vacuity check binds
    // to that exact line instead of to "62%".
    const detail = resolveLodMetricLineDetail({
      nodeType: 'factor',
      data: influenceOnly,
      label: 'Conversion Rate',
      displayMetadata: {
        ...baseMetadata,
        influence: 0.62,
        influenceProvenance: 'analysis',
      } as never,
      facts: { driverRank: { rank: 1, setSize: 4 } },
    })
    // ED #63 5806207128 wording ("Driver N of M analysed").
    expect(detail.text, 'the influence arm produced no line — fixture is vacuous').toBe(
      'Driver 1 of 4 analysed',
    )
    expect(detail.unconfirmedEstimate).toBe(false)
  })

  it('PINS THE PRECONDITION — where the mark IS set, the line is the stated value itself (trap 13b)', () => {
    const detail = resolveLodMetricLineDetail({
      nodeType: 'factor',
      data: INFERRED,
      label: 'Conversion Rate',
      // An influence score is ALSO available here. If the arms were ever
      // reordered, the line would become the influence score while the mark
      // stayed set — the wrong-object failure this asserts cannot happen.
      displayMetadata: {
        ...baseMetadata,
        influence: 0.62,
        influenceProvenance: 'analysis',
      } as never,
      // Locked Canvas design (23 Sep 2026): the rank fact is supplied so the
      // influence arm WOULD fire if the arms were reordered — without it the
      // arm is dead and this precondition would pass for the wrong reason.
      facts: { driverRank: { rank: 1, setSize: 4 } },
    })
    expect(detail.unconfirmedEstimate).toBe(true)
    expect(detail.text).toContain('40%')
    expect(detail.text).not.toContain('62%')
    expect(detail.text).not.toContain('Driver')
  })
})
