/**
 * You can edit a value ON THE GRAPH.
 *
 * FOUNDER REPORT, four times: *"I still can't edit the graph."* Measured on
 * served `e6551858`, the factor card had **zero editable fields** — every edit
 * required opening the side panel first. The earlier repair made the panel's
 * transparent field visible, which is a different surface. A panel is not the
 * graph.
 *
 * ⛔ THE OUTCOME IS NEVER FLATTENED TO "SAVED". `proposeFactorValue` answers
 * `dispatched` / `local_only` / `not_encodable`, and `ModelTabV2Panel` learned
 * the expensive way that throwing them away makes a refusal indistinguishable
 * from a save — a confirmed edit evaporated with no message and zero network
 * calls. These tests pin all three apart.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NodeValueEditor } from '../NodeValueEditor'

const setup = (outcome: 'dispatched' | 'local_only' | 'not_encodable', value: number | null = 60000) => {
  const onCommit = vi.fn(() => outcome)
  render(
    <NodeValueEditor
      value={value}
      readout="£60,000"
      onCommit={onCommit}
      ariaLabel="Value for Annual Platform Cost"
      testId="nve"
    />,
  )
  return { onCommit }
}

describe('editing a value on the card', () => {
  it('⭐ shows the readout as a real control — a button in the tab order that says it edits', () => {
    setup('dispatched')
    const rest = screen.getByTestId('nve')
    expect(rest.tagName).toBe('BUTTON')
    expect(rest.textContent).toContain('£60,000')
    expect(rest.getAttribute('aria-label')).toMatch(/click to edit/i)
    expect(rest.getAttribute('title')).toBe('Click to edit')
  })

  /**
   * ⭐ NODE-ANATOMY v3.2 principle 4 — "no chips around values at rest" — and
   * its Factor row: "`<value> <mark> <unit>`, plain text with no chip". Paul,
   * 24 Sep: the `0.25 est.` bordered chip was part of "the content on the nodes
   * is an absolute mess". This SUPERSEDES the card half of the earlier ruling
   * that the canvas value wear the inspector's field box at rest; the inspector
   * keeps that box (`controls.editableResting`, untouched).
   *
   * ⚠ TOKENS, NOT SUBSTRINGS: `hover:border-field` contains `border-field`, so
   * the old `toContain('border-field')` would read the new hover cue as the old
   * resting chip and pass either way.
   */
  it('⭐ v3.2: at rest the value is plain text; the 3.70:1 frame appears on hover and on focus', () => {
    setup('dispatched')
    const rest = new Set(screen.getByTestId('nve').className.split(/\s+/))
    for (const chip of ['border-field', 'bg-panel-hover', 'w-full', 'px-2', 'py-1']) {
      expect(rest.has(chip), `resting value still carries "${chip}"`).toBe(false)
    }
    expect(rest.has('border-transparent')).toBe(true)
    expect(rest.has('hover:border-field')).toBe(true)
    expect(rest.has('focus-visible:border-field')).toBe(true)
  })

  it('⭐ opening the editor moves nothing: the input takes the SAME box, now framed', () => {
    setup('dispatched')
    const box = (el: HTMLElement) =>
      el.className.split(/\s+/).filter((t) => ['border', '-mx-1', '-my-px', 'px-[3px]', 'py-0', 'rounded-sm'].includes(t)).sort()
    const restBox = box(screen.getByTestId('nve'))
    expect(restBox).toHaveLength(6)
    fireEvent.click(screen.getByTestId('nve'))
    const input = screen.getByTestId('nve-input')
    expect(box(input)).toEqual(restBox)
    expect(input.className.split(/\s+/)).toContain('border-field')
  })

  it('⭐ opens an input seeded with the EXACT value, not the formatted readout', () => {
    setup('dispatched', 0.376)
    fireEvent.click(screen.getByTestId('nve'))
    // Seeding from a rounded display string once committed 0.38 for a 0.376.
    expect((screen.getByTestId('nve-input') as HTMLInputElement).value).toBe('0.376')
  })

  it('commits on Enter and closes when the authority DISPATCHED it', () => {
    const { onCommit } = setup('dispatched')
    fireEvent.click(screen.getByTestId('nve'))
    fireEvent.change(screen.getByTestId('nve-input'), { target: { value: '70000' } })
    fireEvent.keyDown(screen.getByTestId('nve-input'), { key: 'Enter' })
    expect(onCommit).toHaveBeenCalledWith(70000, expect.objectContaining({ onSendSettled: expect.any(Function) }))
    expect(screen.queryByTestId('nve-input')).toBeNull()
  })

  it('⛔ a LOCAL_ONLY outcome keeps the field open and says so — it must not read as saved', () => {
    const { onCommit } = setup('local_only')
    fireEvent.click(screen.getByTestId('nve'))
    fireEvent.change(screen.getByTestId('nve-input'), { target: { value: '70000' } })
    fireEvent.keyDown(screen.getByTestId('nve-input'), { key: 'Enter' })
    expect(onCommit).toHaveBeenCalledWith(70000, expect.objectContaining({ onSendSettled: expect.any(Function) }))
    expect(screen.getByTestId('nve-input')).toBeDefined()
    expect(screen.getByTestId('nve-refusal').textContent).toMatch(/not sent to the model/i)
  })

  it('⛔ a NOT_ENCODABLE outcome also keeps it open, with a different reason', () => {
    setup('not_encodable')
    fireEvent.click(screen.getByTestId('nve'))
    fireEvent.change(screen.getByTestId('nve-input'), { target: { value: '70000' } })
    fireEvent.keyDown(screen.getByTestId('nve-input'), { key: 'Enter' })
    expect(screen.getByTestId('nve-input')).toBeDefined()
    expect(screen.getByTestId('nve-refusal').textContent).toMatch(/cannot be sent/i)
  })

  it('⛔ CONTROL: the three outcomes are DISTINGUISHABLE, which is the whole point', () => {
    // Without this, the two tests above could both pass on one generic message
    // and the distinction that killed a Model-tab edit would be unguarded.
    const seen = new Set<string>()
    for (const outcome of ['local_only', 'not_encodable'] as const) {
      const { unmount } = render(
        <NodeValueEditor value={1} readout="1" onCommit={() => outcome}
          ariaLabel="v" testId={`t-${outcome}`} />,
      )
      fireEvent.click(screen.getByTestId(`t-${outcome}`))
      fireEvent.change(screen.getByTestId(`t-${outcome}-input`), { target: { value: '2' } })
      fireEvent.keyDown(screen.getByTestId(`t-${outcome}-input`), { key: 'Enter' })
      seen.add(screen.getByTestId(`t-${outcome}-refusal`).textContent ?? '')
      unmount()
    }
    expect(seen.size, 'the two non-dispatched outcomes must not share one message').toBe(2)
  })

  it('an unchanged value is a no-op — it never dispatches', () => {
    const { onCommit } = setup('dispatched', 60000)
    fireEvent.click(screen.getByTestId('nve'))
    fireEvent.keyDown(screen.getByTestId('nve-input'), { key: 'Enter' })
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('Escape abandons the edit without committing', () => {
    const { onCommit } = setup('dispatched')
    fireEvent.click(screen.getByTestId('nve'))
    fireEvent.change(screen.getByTestId('nve-input'), { target: { value: '99' } })
    fireEvent.keyDown(screen.getByTestId('nve-input'), { key: 'Escape' })
    expect(onCommit).not.toHaveBeenCalled()
    expect(screen.queryByTestId('nve-input')).toBeNull()
  })

  it('carries nodrag/nopan so React Flow does not swallow the gesture', () => {
    setup('dispatched')
    expect(screen.getByTestId('nve').className).toContain('nodrag')
    expect(screen.getByTestId('nve').className).toContain('nopan')
  })
})
