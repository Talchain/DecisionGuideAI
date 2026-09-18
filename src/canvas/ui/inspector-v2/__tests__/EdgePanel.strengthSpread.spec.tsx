/**
 * EdgePanel — the spread must not be a number nobody stated, and the band word
 * must admit when it is under-determined.
 *
 * ⚠⚠ THIS SPEC HAS NOT BEEN RUN. The lane that wrote it was barred from running
 * any test runner, installing anything, or invoking `tsc`. Every expectation was
 * derived by reading the component and the resolvers it consults. Treat it as an
 * UNVERIFIED claim until CI or a later lane executes it, and do not quote a
 * passing result nobody has seen. The harness (store seeding, panel props, the
 * `drawEdgeThroughProduct` helper) is COPIED from the merged
 * `EdgePanel.unsetNumber.spec.tsx` rather than invented, precisely because an
 * unrun spec's setup is the part most likely to be wrong.
 *
 * ── DEFECT 1: THE PANEL PRINTED A SPREAD NOBODY STATED
 * `EdgePanel.tsx` read `edge?.data?.strengthStd ?? 0.15` raw and fed it to four
 * channels, the loudest being an `ExpertAnnotation` printing a literal `σ =`
 * with the fabricated 0.15 in its field. `USER_EDGE_DEFAULTS.strengthStd` is
 * that 0.15 and it is never stamped, so an edge the user had just drawn showed
 * them a precise-looking standard deviation that nobody supplied.
 *
 * ⭐ AND THE LINE ON THE BOARD ALREADY REFUSED THE SAME FIELD.
 * `StyledEdge.tsx:1228` routes `strengthStd` through `resolveEdgeValueDisplay`
 * before drawing its ribbon. So the canvas withheld the number while the panel a
 * foot away printed it — one quantity, one edge, two verdicts. This is the exact
 * shape of the `beliefExists` defect `EdgePanel.unsetNumber.spec.tsx` closed,
 * on the field beside it.
 *
 * ── DEFECT 2 (the capability): A CONFIDENT WORD OVER AN OPEN QUESTION
 * The panel highlighted one band pill — "Strong" — and said nothing about the
 * fact that the stated spread reached into the neighbouring band. A team read a
 * settled adjective where the numbers supported a range.
 *
 * ── CLAIM TYPE
 * Rendered-text and attribute claims on elements bound by `data-testid` or
 * accessible name. jsdom cannot prove visibility or layout (platform trap 3) and
 * nothing here claims either.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EdgePanel } from '../panels/EdgePanel'
import { useCanvasStore } from '../../../store'
import { useGuidanceStore } from '../../../stores/guidanceStore'
import { USER_EDGE_DEFAULTS } from '../../../domain/edges'

const panelProps = { edgeId: 'e1', techMode: false, onClose: vi.fn(), onNavigate: vi.fn() }
const expertProps = { ...panelProps, techMode: true }

const NODES = [
  { id: 'fac1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Marketing budget' } },
  { id: 'out1', type: 'outcome', position: { x: 100, y: 0 }, data: { label: 'Revenue' } },
]

function seedNodes() {
  useCanvasStore.setState({
    ...useCanvasStore.getState(),
    nodes: NODES,
    edges: [],
    results: { status: 'none', report: null },
  } as never)
}

function seedEdge(data: Record<string, unknown>) {
  seedNodes()
  useCanvasStore.setState({
    ...useCanvasStore.getState(),
    edges: [{ id: 'e1', source: 'fac1', target: 'out1', type: 'styled', data }],
  } as never)
}

/** Build the edge the way the PRODUCT does — no hand-authored `data`. */
function drawEdgeThroughProduct() {
  seedNodes()
  const result = useCanvasStore
    .getState()
    .addEdge({ source: 'fac1', target: 'out1', data: { ...USER_EDGE_DEFAULTS } } as never)
  expect((result as { created: boolean }).created).toBe(true)
  const drawn = useCanvasStore.getState().edges
  expect(drawn).toHaveLength(1)
  useCanvasStore.setState({
    ...useCanvasStore.getState(),
    edges: [{ ...drawn[0], id: 'e1' }],
  } as never)
  return drawn[0]
}

/**
 * A CEE-drafted edge whose stated spread reaches ACROSS the 0.40 cut.
 * 0.45 ± 0.10 → [0.35, 0.55] → Moderate … Strong.
 *
 * ⚠ THE NUMBERS ARE NOT INVENTED. Measured across the eight captured canvas
 * fixtures in this repo: 240 edges carry `strengthStd`, 201 stamped `'cee'`,
 * none stamped `'user'`, values spanning 0.01–0.22. A 0.10 spread on a 0.45
 * strength is an ordinary member of that census, not a contrived one.
 */
const SPANNING_EDGE = {
  weight: 0.45,
  direction: 'positive',
  weightSource: 'cee',
  strengthStd: 0.1,
  strengthStdSource: 'cee',
}

/** The same shape, but tight enough to stay inside one band: [0.53, 0.57]. */
const TIGHT_EDGE = {
  weight: 0.55,
  direction: 'positive',
  weightSource: 'cee',
  strengthStd: 0.02,
  strengthStdSource: 'cee',
}

beforeEach(() => {
  useCanvasStore.setState(useCanvasStore.getState(), true)
  useGuidanceStore.setState({ guidanceItems: [], _prefillChat: null, _sendMessage: null })
})

describe('EdgePanel — the spread is provenance-gated on every channel', () => {
  it('REACHABILITY CONTROL: an edge drawn through the product carries a spread and NO source', () => {
    // The state under test is one a real user produces by dragging a
    // connection — not a fixture invented to make the gate fire.
    const drawn = drawEdgeThroughProduct()
    const data = drawn.data as Record<string, unknown>
    expect(typeof data.strengthStd).toBe('number')
    expect(data.strengthStdSource).toBeUndefined()
  })

  it('⭐ prints NO sigma annotation for an edge nobody has characterised', () => {
    drawEdgeThroughProduct()
    render(<EdgePanel {...expertProps} />)
    expect(screen.queryByText('σ =')).toBeNull()
  })

  it('says so in words instead, where the fabricated number used to be', () => {
    drawEdgeThroughProduct()
    render(<EdgePanel {...expertProps} />)
    expect(screen.getByTestId('edge-std-unset').textContent ?? '').toContain('Not set')
  })

  it('DISCRIMINATING PAIR: a CEE-stated spread still shows its annotation', () => {
    // Without this, hiding the annotation unconditionally would pass every
    // assertion above — and that is a different, worse product.
    seedEdge(SPANNING_EDGE)
    render(<EdgePanel {...expertProps} />)
    expect(screen.getByText('σ =')).toBeTruthy()
    expect(screen.queryByTestId('edge-std-unset')).toBeNull()
  })

  it('does not announce the fabricated spread to assistive tech either', () => {
    // The number had four channels. Gating the visible ones would leave the
    // fabrication in the accessibility tree, where nobody would see it.
    drawEdgeThroughProduct()
    render(<EdgePanel {...expertProps} />)
    const slider = screen.getByLabelText('Strength uncertainty')
    // ⚠ BOUND TO WHAT A PERSON HEARS, NOT TO ONE ATTRIBUTE. Assistive tech
    // announces `aria-valuetext` in preference to `aria-valuenow`, and a range
    // input is expected to carry `aria-valuenow`. Asserting the attribute alone
    // would force the worse implementation and fail the correct one.
    const spoken = slider.getAttribute('aria-valuetext') ?? slider.getAttribute('aria-valuenow')
    expect(spoken).not.toBe('0.15')
    expect((spoken ?? '').toLowerCase()).toContain('not set')
  })
})

describe('EdgePanel — how much of this answer is still open', () => {
  it('⭐⭐ discloses that the stated spread reaches across a band boundary', () => {
    seedEdge(SPANNING_EDGE)
    render(<EdgePanel {...panelProps} />)
    const sentence = screen.getByTestId('edge-strength-spans-bands').textContent ?? ''
    // The two band words, as the reader meets them.
    expect(sentence).toContain('moderate')
    expect(sentence).toContain('strong')
    // And the point: the highlighted adjective is doing unearned work.
    expect(sentence).toContain('earn')
  })

  it('shows the magnitude WITH its spread, not a bare point estimate', () => {
    seedEdge(SPANNING_EDGE)
    render(<EdgePanel {...panelProps} />)
    const readout = screen.getByTestId('edge-strength-spread').textContent ?? ''
    expect(readout).toContain('0.45')
    expect(readout).toContain('±')
    expect(readout).toContain('0.10')
  })

  it('reaches a PLAIN-mode user, not only an expert one', () => {
    // techMode is false in `panelProps`. The sigma annotation is expert-only and
    // that is right; this sentence is the product's core claim about what it
    // does not know, so gating it behind a mode would hide it from the people
    // it is for.
    seedEdge(SPANNING_EDGE)
    render(<EdgePanel {...panelProps} />)
    expect(screen.getByTestId('edge-strength-spans-bands')).toBeTruthy()
  })

  it('DISCRIMINATING PAIR: a spread that stays inside one band says nothing', () => {
    // The sentence must be a signal, not decoration. If it appeared on every
    // edge it would carry no information and the first test would be proving
    // only that the string exists.
    seedEdge(TIGHT_EDGE)
    render(<EdgePanel {...panelProps} />)
    expect(screen.queryByTestId('edge-strength-spans-bands')).toBeNull()
    // …but the value ± spread readout is still there, because both are stated.
    expect(screen.getByTestId('edge-strength-spread').textContent ?? '').toContain('±')
  })

  /**
   * ⭐⭐ THE LOAD-BEARING REFUSAL. An edge the user drew has a fabricated
   * strength AND a fabricated spread. Rendering the sentence from those two
   * would be the product inventing an uncertainty and then dramatising it:
   * weight 0.3 ± 0.15 spans [0.15, 0.45], which crosses TWO cuts, so the
   * ungated sentence on a freshly-drawn connection would have read "anywhere
   * from slight to strong" — maximally alarming and entirely invented.
   */
  it('says NOTHING about spread for an edge nobody has characterised', () => {
    drawEdgeThroughProduct()
    render(<EdgePanel {...panelProps} />)
    expect(screen.queryByTestId('edge-strength-spread')).toBeNull()
    expect(screen.queryByTestId('edge-strength-spans-bands')).toBeNull()
  })

  it('refuses when the SPREAD is stated but the STRENGTH is not', () => {
    // Both ends of the interval are `magnitude ± spread`, so an unstamped
    // magnitude makes the band words fabrications even though the spread is a
    // genuine CEE estimate. The asymmetry is easy to get wrong and is pinned.
    seedEdge({ weight: 0.45, direction: 'positive', strengthStd: 0.1, strengthStdSource: 'cee' })
    render(<EdgePanel {...panelProps} />)
    expect(screen.queryByTestId('edge-strength-spread')).toBeNull()
  })

  it('refuses when the STRENGTH is stated but the SPREAD is not', () => {
    seedEdge({ weight: 0.45, direction: 'positive', weightSource: 'cee' })
    render(<EdgePanel {...panelProps} />)
    expect(screen.queryByTestId('edge-strength-spread')).toBeNull()
  })
})

/**
 * ⛔ A DIFFERENT QUESTION FROM THE SPREAD, AND KEPT APART DELIBERATELY.
 * The block above asks "how uncertain is this?". This one asks "how big, and
 * which way?" — a separate quantity with a separate stamp (`weightSource`), and
 * folding them into one gate would be the trap-21 collapse this estate pays for.
 *
 * ⚠ THE GUARD ALREADY EXISTED AND WAS WIRED TO ONE OF ITS TWO CALL SITES.
 * `StrengthBandButtons` has an `unset` prop whose docblock names this exact
 * defect. It was passed on the `awaitingStatedStrength` branch — the rare
 * stand-down path — and NOT on the ordinary branch, which is the one a user
 * reaches by selecting any connection they drew. So the highlighted pill,
 * carrying `aria-pressed="true"`, proposed a band nobody chose; and clicking it
 * stamps `weightSource: 'user'`, turning the product's own default into the
 * user's stated fact.
 */
describe('EdgePanel — an unassessed strength proposes nothing', () => {
  const PILLS = ['slight', 'moderate', 'strong', 'very-strong'] as const
  const pressed = () =>
    PILLS.filter(p => screen.getByTestId(`strength-band-${p}`).getAttribute('aria-pressed') === 'true')

  it('⭐ lights NO band pill for an edge nobody has characterised', () => {
    // USER_EDGE_DEFAULTS.weight is 0.3, which lands in the Moderate band — so
    // before the fix exactly one pill here read aria-pressed="true".
    drawEdgeThroughProduct()
    render(<EdgePanel {...panelProps} />)
    expect(pressed()).toEqual([])
  })

  it('DISCRIMINATING PAIR: a CEE-stated strength still lights its band', () => {
    // Without this, passing `unset` unconditionally would pass the test above
    // and would break the control for every edge that HAS a stated strength.
    seedEdge(SPANNING_EDGE) // weight 0.45 → Strong
    render(<EdgePanel {...panelProps} />)
    expect(pressed()).toEqual(['strong'])
  })

  it('withholds the beta field rather than pre-filling it with a default', () => {
    drawEdgeThroughProduct()
    render(<EdgePanel {...expertProps} />)
    expect(screen.queryByText('β =')).toBeNull()
    expect(screen.getByTestId('edge-strength-unset').textContent ?? '').toContain('Not set')
  })

  it('DISCRIMINATING PAIR: a stated strength still shows its beta field', () => {
    seedEdge(SPANNING_EDGE)
    render(<EdgePanel {...expertProps} />)
    expect(screen.getByText('β =')).toBeTruthy()
    expect(screen.queryByTestId('edge-strength-unset')).toBeNull()
  })

  /**
   * ⭐⭐ THE HANDLE HAS TO SIT SOMEWHERE — so the panel says what its position
   * means. The rejected alternative worth pinning is the CENTRE: this slider's
   * midpoint is labelled "No effect", so centring an unassessed handle would
   * assert a null result, which is a STRONGER claim than the default it
   * replaced. The notice is the honest option and this test is what stops a
   * later tidy-up silently removing it.
   */
  it('tells the reader the slider handle is a starting point, not a reading', () => {
    drawEdgeThroughProduct()
    render(<EdgePanel {...panelProps} />)
    const notice = screen.getByTestId('edge-strength-slider-unset-notice').textContent ?? ''
    expect(notice).toContain('not a reading')
  })

  it('DISCRIMINATING PAIR: no such notice where a strength IS stated', () => {
    seedEdge(SPANNING_EDGE)
    render(<EdgePanel {...panelProps} />)
    expect(screen.queryByTestId('edge-strength-slider-unset-notice')).toBeNull()
  })

  it('draws no uncertainty ribbon around a fabricated centre', () => {
    // A real spread hung on a defaulted magnitude is a fabricated interval.
    // Stated spread, UNSTATED strength — the ribbon must not appear.
    seedEdge({ weight: 0.45, direction: 'positive', strengthStd: 0.1, strengthStdSource: 'cee' })
    render(<EdgePanel {...panelProps} />)
    expect(screen.queryByTestId('uncertainty-band')).toBeNull()
  })
})
