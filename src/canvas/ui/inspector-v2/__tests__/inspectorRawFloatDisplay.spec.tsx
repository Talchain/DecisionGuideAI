/**
 * Inspector-v2 — A RAW IEEE-754 FLOAT IS NEVER PRINTED TO A READER.
 *
 * ── THE DEFECT, AS THE FOUNDER SAW IT ─────────────────────────────────────
 * Verbatim from the 19 Sep screenshot:
 *
 *     Olumi's current estimate is 0.5428571428571428.
 *
 * `EdgePanel.tsx:715` rendered `String(currentEstimatedWeight)`. No rounding of
 * any kind. A sibling edge read a clean `0.45` only because that value happens
 * to be short — **the formatting was ABSENT, not inconsistent**, so nothing in
 * the estate would have caught it drifting. The same debug bundle carries 16
 * floats at ≥8 decimal places, including the float-precision artefact
 * `0.08399999999999998` (which is 0.084).
 *
 * ── WHY IT IS A TRUST DEFECT AND NOT A COSMETIC ONE ───────────────────────
 * Seventeen significant figures assert a precisely-known quantity. These
 * magnitudes are minted by a CEE rescale (a raw float division) and are not
 * stable even in their ORDERING between two independent passes — the argument
 * is set out at length in `formatValueWithUnit.ts:41-60`, which is the module
 * these sites now adopt. A number printed to the last bit of a double claims
 * a precision the producer never had.
 *
 * ── CLAIM TYPE ────────────────────────────────────────────────────────────
 * Every assertion here is a RENDERED-TEXT claim on an element bound by
 * `data-testid` or by a testid'd ancestor. jsdom cannot prove visibility or
 * layout (platform trap 3) and nothing here claims either.
 *
 * ── WHAT THIS SPEC DELIBERATELY DOES **NOT** ASSERT ───────────────────────
 * ⛔ It does not assert a UNIT grammar, and it must not grow one.
 * `labelUtils.ts:347-355` records the inspector's hardcoded `['£','$','€']`
 * prefix set as a DOCUMENTED, DELIBERATE UX exception ("a structural UX choice,
 * not a tech-debt scatter — leave it"), specced by `InspectorRouter.spec.tsx`,
 * which asserts an ISO code renders as a TRAILING SPAN rather than a fused
 * prefix glyph. These sites therefore adopt `formatNumber` — the canonical
 * module's NUMBER bound — and not `formatValueWithUnit`, whose unit grammar
 * would collide with that ruling. See each fix site for the recorded reason.
 *
 * ⛔ It does not assert a QUALITATIVE label anywhere. `formatValueWithUnit`
 * turns an unqualified 0-1 value into a word ("moderate"). On these surfaces
 * that would DESTROY information: an intervention target of 0.4 on a factor
 * whose unit is `ratio` is a real 40%, not a vague band. Which grammar a
 * `ratio` earns is being decided centrally and is out of this lane's scope.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EdgePanel } from '../panels/EdgePanel'
import { InterventionRow } from '../shared/InterventionRow'
import { FactorObservablePanel } from '../panels/FactorObservablePanel'
import { useCanvasStore } from '../../../store'
import { useGuidanceStore } from '../../../stores/guidanceStore'

/** The exact value on the founder's screenshot. */
const FOUNDER_RAW = 0.5428571428571428
/** The float-precision artefact from the same debug bundle: this IS 0.084. */
const FP_ARTEFACT = 0.08399999999999998

const panelProps = { edgeId: 'e1', techMode: false, onClose: vi.fn(), onNavigate: vi.fn() }

const NODES = [
  { id: 'fac1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Marketing budget' } },
  { id: 'out1', type: 'outcome', position: { x: 100, y: 0 }, data: { label: 'Revenue' } },
]

/**
 * Seeds the edge state that makes `currentEstimatedWeight` non-null — the ONLY
 * state in which the estimate sentence renders at all.
 *
 * Both conjuncts are required and they are different questions (the panel
 * carries its own trap-21 note about exactly this): `weightSource: 'cee'` says
 * a producer originated the number, `serverStrength` says the SERVER holds it.
 */
function seedCeeEstimate(weight: number) {
  useCanvasStore.setState({
    ...useCanvasStore.getState(),
    nodes: NODES,
    edges: [{
      id: 'e1', source: 'fac1', target: 'out1', type: 'styled',
      data: {
        weight,
        direction: 'positive',
        weightSource: 'cee',
        serverStrength: { mean: weight, effect_direction: 'positive' },
      },
    }],
    results: { status: 'none', report: null },
  } as never)
}

/** The estimate sentence, bound by the one testid inside its container. */
function estimateSentence(): string {
  const box = screen.getByTestId('edge-confirm-current-strength').closest('div')
  expect(box).not.toBeNull()
  return box!.textContent ?? ''
}

beforeEach(() => {
  useCanvasStore.setState(useCanvasStore.getState(), true)
  useGuidanceStore.setState({ guidanceItems: [], _prefillChat: null, _sendMessage: null })
})

describe("EdgePanel — Olumi's current estimate is bounded, not a raw double", () => {
  it('PRECONDITION: the seeded edge actually renders the estimate sentence', () => {
    // Pins this spec's own precondition in-test. Without it, every assertion
    // below could pass by the sentence being absent — a guard agreeing with
    // itself (trap 13b). If the render gate ever changes, this REDs first and
    // names the reason, rather than the format tests silently going vacuous.
    seedCeeEstimate(FOUNDER_RAW)
    render(<EdgePanel {...panelProps} />)
    expect(screen.getByTestId('edge-confirm-current-strength')).toBeTruthy()
    expect(estimateSentence()).toContain('current estimate is')
  })

  it("does NOT print the founder's raw 17-significant-figure double", () => {
    seedCeeEstimate(FOUNDER_RAW)
    render(<EdgePanel {...panelProps} />)
    expect(estimateSentence()).not.toContain('0.5428571428571428')
  })

  it('prints the bounded form instead', () => {
    seedCeeEstimate(FOUNDER_RAW)
    render(<EdgePanel {...panelProps} />)
    expect(estimateSentence()).toContain('0.5429')
  })

  it('collapses a float-precision artefact to the number it actually is', () => {
    // 0.08399999999999998 is not a measurement with seventeen figures; it is
    // 0.084 with binary-representation noise. Printing the noise invites the
    // reader to believe the trailing digits mean something.
    seedCeeEstimate(FP_ARTEFACT)
    render(<EdgePanel {...panelProps} />)
    const text = estimateSentence()
    expect(text).not.toContain('0.08399999999999998')
    expect(text).toContain('0.084')
  })

  it('DISCRIMINATING PAIR: a value that is ALREADY short is passed through unchanged', () => {
    // Without this, the fix could pad every value to four decimals ("0.4500"),
    // or replace it with a qualitative word ("moderate"), and every test above
    // would still pass. One direction alone proves nothing — this is the
    // opposite-direction twin (trap 22b).
    seedCeeEstimate(0.45)
    render(<EdgePanel {...panelProps} />)
    const text = estimateSentence()
    expect(text).toContain('0.45')
    expect(text).not.toContain('0.4500')
    expect(text.toLowerCase()).not.toContain('moderate')
  })

  it('DISCRIMINATING PAIR: the bound never renders a real non-zero value as zero', () => {
    // The failure mode the fix must NOT introduce, stated as its own case.
    seedCeeEstimate(0.00049)
    render(<EdgePanel {...panelProps} />)
    const text = estimateSentence()
    expect(text).toContain('0.0005')
    // ⚠ THE LOOKAHEAD IS LOAD-BEARING. Written first as
    // `/estimate is\s*0\s*\./` this RED-ed against the CORRECT output, because
    // "estimate is 0.0005." literally contains "estimate is 0." — the regex
    // matched the leading zero of the very value it was meant to accept. It
    // must reject a BARE zero only, so the digit must not be followed by more
    // number.
    expect(text).not.toMatch(/estimate is\s*0(?![.\d])/)
  })
})

/**
 * ── InterventionRow ───────────────────────────────────────────────────────
 * The read-only target is the "This option sets <n> model value" surface. It
 * rendered `String(currentValue)`, the same raw-double class as EdgePanel.
 *
 * ⚠ THE EDITABLE BRANCH IS DELIBERATELY EXCLUDED FROM THE FIX, and the last
 * two tests here are what hold that line. Rounding an EDIT BUFFER would not be
 * a display change: blur parses the draft and commits it, so a rounded buffer
 * would silently WRITE the rounded value into the model. The read-only span is
 * a readout; the input is a buffer. `InlineNumberEditor`'s own header already
 * draws this exact distinction ("Display formatting stays separate: `readout`
 * may still be rounded… Seed from the EXACT value, never a rounded display
 * string"), so this follows an in-directory precedent rather than inventing one.
 */
const rowProps = {
  factorId: 'fac1',
  factorLabel: 'Founder time on product',
  onChange: vi.fn(),
}

function readonlyTarget(): string {
  return screen.getByTestId('intervention-target-readonly-fac1').textContent ?? ''
}

describe('InterventionRow — the read-only target is bounded, the edit buffer is not', () => {
  it("does NOT print a raw double as the option's target", () => {
    render(<InterventionRow {...rowProps} currentValue={FOUNDER_RAW} disabled />)
    expect(readonlyTarget()).not.toContain('0.5428571428571428')
  })

  it('prints the bounded form instead', () => {
    render(<InterventionRow {...rowProps} currentValue={FOUNDER_RAW} disabled />)
    expect(readonlyTarget()).toContain('0.5429')
  })

  it('REGRESSION GUARD, NAMED BY THE ORIGINAL AUTHOR: 0.00049 must not render as 0', () => {
    // The docblock at the fix site rejected `toLocaleString` for precisely this
    // reason — it defaults to THREE fraction digits, so a real non-zero model
    // value of 0.00049 rendered as `0`. That objection was correct and is the
    // reason `formatNumber` (FOUR fraction digits) is the adopted bound rather
    // than a bare locale format. This pins that the objection stays answered.
    render(<InterventionRow {...rowProps} currentValue={0.00049} disabled />)
    const text = readonlyTarget()
    expect(text).toContain('0.0005')
    expect(text).not.toMatch(/^\s*0\s*model value/)
  })

  it('DISCRIMINATING PAIR: an already-short target is passed through unchanged', () => {
    render(<InterventionRow {...rowProps} currentValue={0.12} disabled />)
    const text = readonlyTarget()
    expect(text).toContain('0.12')
    expect(text).not.toContain('0.1200')
    expect(text.toLowerCase()).not.toContain('very low')
  })

  it('⛔ THE EDIT BUFFER KEEPS FULL PRECISION — a rounded buffer would WRITE a rounded value', () => {
    // The editable branch must be untouched by the display fix. If this ever
    // goes green-by-rounding, the row has started corrupting the model on blur.
    render(<InterventionRow {...rowProps} currentValue={FOUNDER_RAW} />)
    const input = screen.getByDisplayValue(String(FOUNDER_RAW))
    expect(input).toBeTruthy()
  })

  it('⛔ DISCRIMINATING CONTROL: the read-only and editable branches genuinely differ', () => {
    // Proves the two assertions above are measuring two different renderings of
    // the SAME value, not one shape twice. Without this, a fix that changed
    // neither branch would satisfy both tests in isolation.
    const { unmount } = render(<InterventionRow {...rowProps} currentValue={FOUNDER_RAW} disabled />)
    const readOnlyText = readonlyTarget()
    unmount()
    render(<InterventionRow {...rowProps} currentValue={FOUNDER_RAW} />)
    const bufferValue = (screen.getByRole('textbox') as HTMLInputElement).value
    expect(bufferValue).toBe(String(FOUNDER_RAW))
    expect(readOnlyText).not.toContain(bufferValue)
  })
})

/**
 * ── FactorObservablePanel ─────────────────────────────────────────────────
 * `formatValue`'s UNITLESS fallback was a bare template interpolation,
 * `` `${v}` `` — the same raw-double class again, on the headline value of an
 * observable factor.
 *
 * ⛔ ONLY THE UNITLESS BRANCH IS TOUCHED. The currency branch one line above
 * is the `['£','$','€']` prefix treatment that `labelUtils.ts:347-355`
 * explicitly rules is a deliberate UX choice to be left alone, and
 * `InspectorRouter.spec.tsx` pins its ISO counterpart. The last test here is
 * the control that proves the fix did not reach into it.
 */
const factorPanelProps = (nodeId: string) => ({
  nodeId, techMode: false, onClose: vi.fn(), onNavigate: vi.fn(),
})

function seedObservable(value: number, unit?: string) {
  useCanvasStore.setState(useCanvasStore.getState(), true)
  useCanvasStore.setState({
    nodes: [{
      id: 'factor-1', type: 'factor', position: { x: 0, y: 0 },
      data: {
        label: 'Market rate', category: 'observable',
        observedState: unit === undefined ? { value } : { value, unit },
      },
    }],
    edges: [],
    results: { status: 'none', report: null },
    analysisFreshnessDirty: false,
  } as never)
}

function observableReadout(): string {
  return screen.getByTestId('observable-value-display').textContent ?? ''
}

describe('FactorObservablePanel — the unitless readout is bounded', () => {
  it('does NOT print a raw double as an observable factor value', () => {
    seedObservable(FOUNDER_RAW)
    render(<FactorObservablePanel {...factorPanelProps('factor-1')} />)
    expect(observableReadout()).not.toContain('0.5428571428571428')
  })

  it('prints the bounded form instead', () => {
    seedObservable(FOUNDER_RAW)
    render(<FactorObservablePanel {...factorPanelProps('factor-1')} />)
    expect(observableReadout()).toContain('0.5429')
  })

  it('⛔ CONTROL: the editor still seeds from the EXACT value, not the bounded readout', () => {
    // `InlineNumberEditor.precision.spec.tsx` exists because seeding from a
    // rounded readout once destroyed producer precision on blur. Bounding the
    // readout must not reintroduce that. This is the same claim that spec
    // makes, restated against the value this change actually alters.
    seedObservable(FOUNDER_RAW)
    render(<FactorObservablePanel {...factorPanelProps('factor-1')} />)
    fireEvent.click(screen.getByTestId('observable-value-display'))
    expect((screen.getByTestId('observable-value-input') as HTMLInputElement).value)
      .toBe(String(FOUNDER_RAW))
  })

  it('⛔ CONTROL: the currency-prefix branch is UNTOUCHED (documented UX exception)', () => {
    // `labelUtils.ts:347-355` rules the inspector's ['£','$','€'] inline-prefix
    // treatment a deliberate structural UX choice. If this fix had been written
    // as a wholesale `formatValueWithUnit` adoption, this would RED — the glyph
    // would still prefix, but the grammar and the qualitative branch would move.
    seedObservable(49000, '£')
    render(<FactorObservablePanel {...factorPanelProps('factor-1')} />)
    expect(observableReadout()).toContain('£49,000')
  })
})
