/**
 * Every advanced field is reachable BY ITS LABEL.
 *
 * ⚠⚠ WHAT WAS WRONG: the label was a bare `<span>` — no `htmlFor`, no
 * `aria-label`, no association of any kind. The text was on screen and the
 * CONTROL was anonymous, so every advanced field in the inspector announced as
 * an unlabelled input. Fourteen of them sit on the controllable-factor pane.
 *
 * ⭐ HOW IT WAS FOUND, because the method generalises: a spec for something else
 * tried `getByLabelText(/Normalised value/i)` and could not reach a single
 * field. Testing-library queries the accessibility tree — the same tree a
 * screen reader reads — which is exactly why it could not find text that was
 * plainly visible. **A query that fails on something you can see with your eyes
 * is evidence about the accessibility tree, not a broken selector.**
 *
 * ⚠ SO EVERY ASSERTION HERE GOES THROUGH `getByLabelText` / `toHaveAccessibleDescription`
 * DELIBERATELY. Asserting `<label htmlFor>` in the markup would pass on markup
 * that no assistive technology can use; these queries fail if the association
 * is not real.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AdvancedField } from '../shared/AdvancedField'

describe('an advanced field is reachable by its label', () => {
  it.each(['text', 'number', 'textarea'] as const)(
    'type %s — the control carries the label as its accessible name',
    (type) => {
      render(<AdvancedField label="Normalised value" value="" onChange={vi.fn()} type={type} />)
      // Fails outright if the label is not ASSOCIATED, however visible it is.
      expect(screen.getByLabelText('Normalised value')).toBeTruthy()
    },
  )

  it('select — the same, through a different element', () => {
    render(
      <AdvancedField
        label="Factor category"
        value="controllable"
        onChange={vi.fn()}
        type="select"
        options={[{ value: 'controllable', label: 'Controllable' }]}
      />,
    )
    expect(screen.getByLabelText('Factor category')).toBeTruthy()
  })

  it('DISCRIMINATES — two fields on one screen resolve to DIFFERENT controls', async () => {
    // ⭐ Without this, every assertion above passes on a change that gave every
    // field ONE shared id: `getByLabelText` would still find "a" control, and
    // clicking either label would focus the same box. Ids are generated
    // per-instance and this is what proves it.
    render(
      <>
        <AdvancedField label="Raw value" value="" onChange={vi.fn()} type="text" />
        <AdvancedField label="Unit" value="" onChange={vi.fn()} type="text" />
      </>,
    )
    const raw = screen.getByLabelText('Raw value')
    const unit = screen.getByLabelText('Unit')
    expect(raw).not.toBe(unit)
    expect(raw.id).not.toBe(unit.id)
    expect(raw.id).toBeTruthy()

    // And the association is the browser's, not ours: focus follows the label.
    await userEvent.click(screen.getByText('Unit'))
    expect(document.activeElement).toBe(unit)
  })
})

describe('a refusal is announced, not merely displayed', () => {
  it('binds the error to the control it refuses', async () => {
    // The predicate refuses non-finite input. Before this change the sentence
    // saying WHY was visible text with no owner: the control just refused and
    // stayed silent to anyone not reading the screen.
    render(<AdvancedField label="Cap" value="" onChange={vi.fn()} type="number" />)
    const input = screen.getByLabelText('Cap')
    await userEvent.type(input, 'abc')
    await userEvent.tab()

    // PRECONDITION, PINNED IN-TEST: an error must actually be on screen, or the
    // assertion below passes by describing nothing (trap 13).
    const message = await screen.findByText(/number/i)
    expect(message).toBeTruthy()

    expect(input).toHaveAccessibleDescription(message.textContent as string)
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })

  it('CONTRAST — a field with nothing to say describes nothing, and is not invalid', () => {
    render(<AdvancedField label="Cap" value="" onChange={vi.fn()} type="number" />)
    const input = screen.getByLabelText('Cap')
    // A permanently-set `aria-describedby` pointing at an absent node, or a
    // standing `aria-invalid`, would make the assertions above meaningless.
    expect(input).not.toHaveAttribute('aria-describedby')
    expect(input).not.toHaveAttribute('aria-invalid')
  })
})
