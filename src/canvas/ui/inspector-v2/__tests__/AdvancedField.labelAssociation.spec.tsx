/**
 * ⭐⭐ EVERY EDITABLE ADVANCED FIELD IN THE INSPECTOR WAS AN UNLABELLED INPUT.
 *
 * `AdvancedField` rendered its visible label as a bare `<span>` — no `htmlFor`,
 * no `id` on the control, no `aria-labelledby`. The text sat next to the input
 * and nothing associated the two, so a screen-reader user tabbing into the
 * technical detail editor was told the control's ROLE and nothing else: "edit
 * text", "combo box", over and over, for every field on the panel.
 *
 * ⚠ HOW IT WENT UNSEEN FOR SO LONG, AND WHY THAT MATTERS MORE THAN THE FIX.
 * The component's own existing spec (`AdvancedField.finiteGuard.spec.tsx`)
 * reaches the input with `screen.getByRole('textbox')`. That is a perfectly
 * good way to find the ONLY textbox in a one-field render, and it is exactly
 * the reach that cannot notice the field has no name — the role is present
 * whether or not the label is associated. The suite was green, thorough about
 * the behaviour it was written for, and structurally blind to this.
 *
 * ⚠ SCOPE — STATED PRECISELY, BECAUSE A CAPTURE PROVES WHAT IT WAS POINTED AT.
 * This spec drives `AdvancedField` DIRECTLY, once per rendered variant. It is
 * a claim about the shared component, not about any particular editor's
 * arrangement of it. The count that motivated it (35 editable call sites
 * across 8 advanced editors) is a count of JSX call sites, derived from the
 * tree; instances rendered inside a `.map()` vary at runtime.
 *
 * ⚠ THE CONTROLS ARE THE POINT. An accessible-name assertion is worth nothing
 * unless the same harness is shown reaching the control by some OTHER means —
 * otherwise a spec that fails to render at all looks identical to a spec that
 * rendered a nameless control. Every case here sits beside a `getByRole` reach
 * that passed at pristine, before the fix existed.
 *
 * ⚠ AND THE BINDING IS BY IDENTITY, NOT BY PRESENCE. `getByLabelText(X)`
 * returning *a* control proves nothing if another control could satisfy it, so
 * the two-field case asserts each label resolves to its OWN element and that
 * driving one commits through one `onChange` and not the other. Presence of a
 * name is not correctness of the binding.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { AdvancedField } from '../shared/AdvancedField'

const SELECT_OPTIONS = [
  { value: 'explicit', label: 'Explicit' },
  { value: 'inferred', label: 'Inferred' },
]

describe('AdvancedField — the visible label names the control it sits beside', () => {
  it('type="text": the label reaches the input itself, not merely something', () => {
    const { container } = render(
      <AdvancedField label="Unit" value="GBP" onChange={vi.fn()} type="text" />,
    )

    // CONTROL — green at pristine, so a RED below is about the NAME, never
    // about the component failing to render.
    const byRole = screen.getByRole('textbox')
    expect(byRole.tagName).toBe('INPUT')

    const byLabel = screen.getByLabelText('Unit')
    expect(byLabel).toBe(container.querySelector('input'))
    expect(byLabel).toBe(byRole)
  })

  it('type="number": the label reaches the numeric input', () => {
    const { container } = render(
      <AdvancedField label="Raw threshold" value={undefined} onChange={vi.fn()} type="number" />,
    )

    expect(screen.getByRole('textbox').tagName).toBe('INPUT') // control

    const byLabel = screen.getByLabelText('Raw threshold')
    expect(byLabel).toBe(container.querySelector('input'))
    expect(byLabel).toHaveAttribute('inputMode', 'decimal')
  })

  it('type="select": the label reaches the native select', () => {
    const { container } = render(
      <AdvancedField
        label="Extraction"
        value="explicit"
        onChange={vi.fn()}
        type="select"
        options={SELECT_OPTIONS}
      />,
    )

    expect(screen.getByRole('combobox').tagName).toBe('SELECT') // control

    const byLabel = screen.getByLabelText('Extraction')
    expect(byLabel).toBe(container.querySelector('select'))
    // The options really are this select's, not a sibling's.
    expect(within(byLabel as HTMLElement).getByRole('option', { name: 'Inferred' })).toBeTruthy()
  })

  it('type="textarea": the label reaches the textarea', () => {
    const { container } = render(
      <AdvancedField label="Notes" value="" onChange={vi.fn()} type="textarea" />,
    )

    expect(screen.getByRole('textbox').tagName).toBe('TEXTAREA') // control

    const byLabel = screen.getByLabelText('Notes')
    expect(byLabel).toBe(container.querySelector('textarea'))
  })

  it('two fields on one panel: each label names its OWN control, and drives only it', () => {
    const onLower = vi.fn()
    const onUpper = vi.fn()

    render(
      <div>
        <AdvancedField label="Range minimum" value={0} onChange={onLower} type="number" />
        <AdvancedField label="Range maximum" value={1} onChange={onUpper} type="number" />
      </div>,
    )

    // CONTROL — both inputs exist and are distinguishable without labels.
    expect(screen.getAllByRole('textbox')).toHaveLength(2)

    const lower = screen.getByLabelText('Range minimum')
    const upper = screen.getByLabelText('Range maximum')
    expect(lower).not.toBe(upper)

    // ⭐ THE DISCRIMINATION. A name that resolves to the wrong control passes
    // every presence assertion above and fails exactly here.
    fireEvent.change(lower, { target: { value: '0.25' } })
    fireEvent.blur(lower)
    expect(onLower).toHaveBeenCalledWith(0.25)
    expect(onUpper).not.toHaveBeenCalled()
  })

  it('the visible label is the ONLY source of the name — no duplicated string to drift', () => {
    render(<AdvancedField label="Unit" value="GBP" onChange={vi.fn()} type="text" />)

    // ⚠ Two sources of truth for one name is the hand-maintained mirror this
    // estate keeps paying for: an `aria-label` copy silently diverges from the
    // visible text the next time the wording changes. Exactly one element
    // carries the string, and the control's name comes from THAT element.
    expect(screen.getAllByText('Unit')).toHaveLength(1)
    expect(screen.getByLabelText('Unit')).not.toHaveAttribute('aria-label')
  })
})
