/**
 * InlineNumberEditor — the RESTING affordance.
 *
 * ⭐⭐ WHY THIS SPEC EXISTS, and why fixing the input was not enough.
 *
 * The founder, having built the product himself, reported: *"I still can't edit
 * the graph."* The first repair gave the factor-value INPUT a visible box. On
 * the two panels that carry the primary value control — observable factor and
 * risk — **that input does not exist until a button has been clicked**, and the
 * button was:
 *
 *     text-left w-full cursor-text hover:bg-panel-hover rounded px-0.5 -mx-0.5
 *
 * No border, no fill, no cue. Its only visible state was `hover:`, which needs
 * the pointer already on it. So the control a person must find in order to edit
 * anything announced itself exclusively to someone who had already found it —
 * and the earlier fix could not reach it, because it styled the wrong half of a
 * two-state control.
 *
 * ⚠ THE THREE PROPERTIES PINNED HERE ARE NOT INTERCHANGEABLE. Each fails in a
 * different direction, and a guard for one is silent about the others:
 *   1 · at rest the control is visibly a field (under-claim -> invisible);
 *   2 · a FENCED writer is visibly not (over-claim -> a lie the user acts on);
 *   3 · a refusal REPLACES the border colour rather than appending one.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { InlineNumberEditor } from '../InlineNumberEditor'
import { controls } from '../../../../../styles/controls'

const classesOf = (s: string) => new Set(s.split(/\s+/).filter(Boolean))

// ─────────────────────────────────────────────────────────────────────
// 1 · At rest, the control is visibly a field
// ─────────────────────────────────────────────────────────────────────

describe('the resting value control is visibly editable', () => {
  it('renders a bordered, filled box — not a bare string with a hover state', () => {
    render(
      <InlineNumberEditor
        readout="0.81"
        placeholder="No value set. Click to enter."
        value={0.81}
        onSave={vi.fn()}
        displayTestId="observable-value-display"
        inputTestId="observable-value-input"
      />,
    )
    const rest = classesOf(screen.getByTestId('observable-value-display').className)

    // The two channels the defect lacked. `bg-panel-hover` is the fill and
    // `border-field` the 3.70:1 edge — `controls.contrast.spec.ts` computes
    // that ratio from `brand.css` rather than restating it here.
    expect(rest.has('border-field')).toBe(true)
    expect(rest.has('bg-panel-hover')).toBe(true)

    // ⛔ And the state the defect DID have must no longer be the whole story:
    // a control whose only marking is a hover rule is the defect itself.
    expect(rest.has('hover:bg-panel-hover')).toBe(false)
  })

  it('carries the same pencil cue idiom as the rename trigger', () => {
    render(
      <InlineNumberEditor
        readout="38%"
        placeholder="Not set"
        value={38}
        onSave={vi.fn()}
        displayTestId="risk-probability-display"
        inputTestId="risk-probability-input"
      />,
    )
    expect(screen.getByTestId('risk-probability-display-cue')).toBeTruthy()
  })

  it('announces the click in its accessible name when the caller named the field', () => {
    render(
      <InlineNumberEditor
        readout="38%"
        placeholder="Not set"
        value={38}
        onSave={vi.fn()}
        displayTestId="risk-probability-display"
        inputTestId="risk-probability-input"
        ariaLabel="Likelihood percentage"
      />,
    )
    expect(
      screen.getByTestId('risk-probability-display').getAttribute('aria-label'),
    ).toMatch(/click to edit/i)
  })

  it('swaps to the input with no change of box — the click must not move the number', () => {
    // ⭐ A DERIVED invariant, not a restated one. The resting button and the
    // input it becomes must agree on radius, padding and border token, or the
    // value visibly jumps on click and reads as a glitch rather than as
    // entering a field. Written against the CONSTANTS, so editing either token
    // alone REDs — a rendered-only assertion would pass on two boxes that
    // happen to differ, since jsdom computes no layout.
    const GEOMETRY = ['rounded-md', 'px-2', 'py-1', 'border', 'border-field']
    const resting = classesOf(controls.editableResting)
    const field = classesOf(controls.editableField)
    for (const token of GEOMETRY) {
      expect(resting.has(token), `resting box is missing ${token}`).toBe(true)
      expect(field.has(token), `input box is missing ${token}`).toBe(true)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────
// 2 · A fenced writer must NOT look editable
// ─────────────────────────────────────────────────────────────────────

describe('a fenced writer is visibly fenced', () => {
  it('both field tokens carry a disabled treatment', () => {
    // Several inspector writers sit inside `<fieldset disabled={readOnly}>`
    // fences. Giving those the live field's warm fill and 3.70:1 border would
    // advertise an edit the product refuses — a MORE convincing lie than the
    // invisible field, because the user would act on it.
    for (const token of [controls.editableField, controls.editableTextarea]) {
      expect(token).toContain('disabled:bg-panel')
      expect(token).toContain('disabled:border-default')
      expect(token).toContain('disabled:cursor-not-allowed')
    }
  })

  it('⭐ the RESTING control is fenced too — its only two call sites are inside the Router fence', () => {
    // `InspectorRouter`'s else-branch wraps every NON-authority panel in a
    // `<fieldset disabled>`, and `InlineNumberEditor` is used ONLY by the
    // observable-factor and risk panels, both of which are in that branch. So
    // the live resting box would render on a control the product has fenced.
    //
    // ⚠ PIN THE PRECONDITION: `:disabled` must match a `<button>` inside a
    // disabled fieldset, not merely an `<input>`. Assuming it is how the input's
    // own fence was nearly shipped inert.
    render(
      <fieldset disabled>
        <InlineNumberEditor
          readout="0.62"
          placeholder="No value set. Click to enter."
          value={0.62}
          onSave={vi.fn()}
          displayTestId="fenced-value-display"
          inputTestId="fenced-value-input"
        />
      </fieldset>,
    )
    const fenced = screen.getByTestId('fenced-value-display')
    expect(fenced.matches(':disabled')).toBe(true)
    expect(controls.editableResting).toContain('disabled:bg-panel')
    expect(controls.editableResting).toContain('disabled:cursor-not-allowed')

    // A pencil on a fenced control is a promise the product will refuse.
    expect(controls.editableCue).toContain('group-disabled:hidden')

    // Positive control, so the assertion discriminates: the same component
    // OUTSIDE a fence must NOT match, or ':disabled' is true of everything and
    // this test would pass with the fence removed.
    render(
      <InlineNumberEditor
        readout="0.62"
        placeholder="No value set."
        value={0.62}
        onSave={vi.fn()}
        displayTestId="live-value-display"
        inputTestId="live-value-input"
      />,
    )
    expect(screen.getByTestId('live-value-display').matches(':disabled')).toBe(false)
  })

  it('the disabled state actually reaches a control inside a disabled fieldset', () => {
    // ⚠ PIN THE PRECONDITION IN-TEST. The `disabled:` variants above are inert
    // unless `:disabled` propagates from the fieldset to the control — which is
    // the whole reason the panels can fence at the fieldset without telling the
    // control. Assert the propagation, not just the class string.
    render(
      <fieldset disabled data-writer-fence="description">
        <textarea data-testid="fenced-writer" className={controls.editableTextarea} readOnly />
      </fieldset>,
    )
    // ⚠ `matches(':disabled')`, NOT `.disabled`. The IDL property reflects only
    // the element's OWN `disabled` content attribute and reads `false` on a
    // fenced control — the first version of this test asserted it and failed,
    // which is the whole reason the precondition is pinned rather than assumed.
    // Tailwind's `disabled:` variant compiles to the PSEUDO-CLASS, so the
    // pseudo-class is what has to match for the fenced treatment to render.
    expect(screen.getByTestId('fenced-writer').matches(':disabled')).toBe(true)

    // Positive control: the identical control OUTSIDE a fence must NOT match,
    // so the assertion above is discriminating rather than true of everything.
    render(<textarea data-testid="live-writer" className={controls.editableTextarea} />)
    expect(screen.getByTestId('live-writer').matches(':disabled')).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────
// 3 · A refusal replaces the border colour; it does not append one
// ─────────────────────────────────────────────────────────────────────

describe('the refusal border replaces rather than appends', () => {
  it('drops border-field when it adds border-danger', () => {
    // Two border-colour utilities of equal specificity are resolved by
    // STYLESHEET order, not by class-list order. Appending `border-danger`
    // beside `border-field` therefore leaves the winner to Tailwind's emit
    // order — green in a className assertion and possibly wrong on screen.
    const refusalClass = controls.editableField.replace('border-field', 'border-danger')
    const cls = classesOf(refusalClass)
    expect(cls.has('border-danger')).toBe(true)
    expect(cls.has('border-field')).toBe(false)
  })

  it('renders the refusal border on a rejected commit, and only then', () => {
    const onSave = vi.fn()
    render(
      <InlineNumberEditor
        readout="38%"
        placeholder="Not set"
        value={38}
        onSave={onSave}
        displayTestId="risk-probability-display"
        inputTestId="risk-probability-input"
        min={0}
        max={100}
      />,
    )
    fireEvent.click(screen.getByTestId('risk-probability-display'))
    const input = screen.getByTestId('risk-probability-input')

    // Before the refusal: the live field border, discriminating against the
    // danger state so a token that carried both would fail here.
    expect(classesOf(input.className).has('border-field')).toBe(true)
    expect(classesOf(input.className).has('border-danger')).toBe(false)

    fireEvent.change(input, { target: { value: '150' } })
    fireEvent.blur(input)

    const after = classesOf(screen.getByTestId('risk-probability-input').className)
    expect(after.has('border-danger')).toBe(true)
    expect(after.has('border-field')).toBe(false)
    expect(onSave).not.toHaveBeenCalled()
  })
})


// ─────────────────────────────────────────────────────────────────────
// 4 · The chip a user picks from
// ─────────────────────────────────────────────────────────────────────

describe('a selectable chip is visible in BOTH states, not only when chosen', () => {
  it('the unselected state carries the 3.70:1 border, not the 1.23:1 one', () => {
    // The external-factor quick-set range buttons are the primary, always
    // visible remedy for an analysis the product REFUSES when a factor has no
    // range — and 14 of 34 factors on the five shipped starters are external.
    // Their selected state was already visible; their unselected state was a
    // text label on a 1.23:1 edge against the panel's own background.
    const unselected = new Set(controls.selectableChip.unselected.split(/\s+/))
    expect(unselected.has('border-field')).toBe(true)
    expect(unselected.has('border-panel-border')).toBe(false)
  })

  it('⛔ and the SELECTED state is still distinguishable from it', () => {
    // The discriminating half. Raising the unselected border could make the two
    // states agree, which would destroy the radio semantics while passing the
    // assertion above — a fix that trades an invisible control for an
    // unreadable one.
    expect(controls.selectableChip.selected).not.toEqual(controls.selectableChip.unselected)
    expect(controls.selectableChip.selected).toContain('border-primary')
    expect(controls.selectableChip.unselected).not.toContain('border-primary bg')
  })

  it('the border width lives on the base, so neither state can forget it', () => {
    // `border` was previously repeated in both arms of the ternary. One of two
    // duplicated tokens is exactly what drifts (trap 12); on the base it cannot.
    expect(controls.selectableChip.base.split(/\s+/)).toContain('border')
  })
})
