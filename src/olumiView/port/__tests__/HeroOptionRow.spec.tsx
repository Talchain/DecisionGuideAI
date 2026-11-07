/**
 * The ported option row draws core's words only, at their View paths: the chance as the headline on the goal lens, core's own ◉ as the only
 * mark (never a rank), the outcome band only on the outcome lens's track, and the detail lines for this option and aim alone.
 * Fixtures: the real-AI bakery board (fixtures/real) and core's bakery golden, which carries the tipping lines.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import type { View } from '../../client'
import { HeroOptionRow, type HeroLensId } from '../HeroOptionRow'
import { aimGroupsOf, outcomeDomainOf, tippingFor, type AimRow } from '../pick'
import { figureCard } from '../../ViewChances'
import { expectAllBound, viewOf } from './viewAt'

afterEach(cleanup)

const real = viewOf('real/bakery-r5')
const golden = viewOf('golden/bakery')

function draw(view: View, card: string, i: number, lens: HeroLensId = 'goal', open = false) {
  const model = view.model!, run = model.run!
  const c = model.cards.find((x) => x.id === card)!
  const entry: AimRow = { card: c, row: c.rows[i]!, i }
  const group = aimGroupsOf(model).find((g) => g.rows.some((r) => r.card.id === card && r.i === i))!
  const out = render(
    <HeroOptionRow entry={entry} lens={lens} isOpen={open} onToggle={() => {}} domain={outcomeDomainOf(group.rows)}
      tipping={tippingFor(run, card, entry.row.aim_id ?? null)} figure={c.driver == null ? null : figureCard(model, c.driver)} />,
  )
  return { ...out, row: out.container.querySelector<HTMLElement>('[data-testid="port-option-row"]')!, entry }
}

describe('the ported option row, goal lens: the chance is the headline, in core\'s words', () => {
  it('catch: the readout is core\'s chance at its path, the ◉ is core\'s likely mark with its sentence, the hover is core\'s definition', () => {
    const { row, entry, container } = draw(real, 'second_oven', 1)
    const r = entry.row as Extract<typeof entry.row, { kind: 'chance' }>
    expect(row.dataset['viewRow']).toBe('second_oven.rows.1')
    expect(row.getAttribute('title')).toBe(r.title)
    expect(container.querySelector('[data-view="second_oven.rows.1.value"]')!.textContent).toBe('about 72% chance')
    expect(container.querySelector('[data-view="second_oven.heading"]')!.textContent).toBe('A second oven')
    const mark = container.querySelector('[data-view="second_oven.rows.1.likely.glyph"]')!
    expect([mark.textContent, mark.getAttribute('aria-label')]).toEqual([r.likely!.glyph, r.likely!.title])
    expect(row.dataset['leader']).toBe('true')
    // Olumi's mark on the value (its estimate) is core's, after the value
    expect(container.querySelector('[data-view="second_oven.rows.1.olumi.glyph"]')!.getAttribute('title')).toBe(r.olumi!.title)
    // a chance is not a range: no track on the goal lens
    expect(container.querySelector('[data-testid="port-row-track"]')).toBeNull()
    expect(expectAllBound(real, container, expect)).toBeGreaterThan(3)
  })

  it('negative: an option without core\'s likely mark draws an empty mark slot, no number badge and no leader', () => {
    const { row, container } = draw(real, 'carry_on', 1)
    expect(row.dataset['leader']).toBe('false')
    expect(container.querySelector('[data-testid="port-row-mark"]')!.textContent).toBe('')
    expect(container.querySelector('[data-view="carry_on.rows.1.value"]')!.textContent).toBe('under 1% chance')
  })

  it('what the chance rests on is drawn at rest, in core\'s words at its path (DL 7 Nov: in place of a bare ◆)', () => {
    const { container, entry } = draw(real, 'second_oven', 1)
    const r = entry.row as Extract<typeof entry.row, { kind: 'chance' }>
    expect(r.rests_on_text).toBe("Rests on Olumi's what-if for 'extra sold per oven'.")
    const el = container.querySelector('[data-testid="port-row-rests-on"]')!
    expect([el.getAttribute('data-view'), el.textContent]).toEqual(['second_oven.rows.1.rests_on_text', r.rests_on_text])
    expect(el.closest('[data-testid="port-option-detail"]')).toBeNull() // at rest, not behind the disclosure
  })

  it('negative: a chance core gives no rests-on line draws none', () => {
    const { container, entry } = draw(real, 'carry_on', 1)
    expect((entry.row as { rests_on_text?: string }).rests_on_text ?? null).toBeNull()
    expect(container.querySelector('[data-testid="port-row-rests-on"]')).toBeNull()
  })

  it('the option name is never cut: no clamp or truncation on it', () => {
    const { container } = draw(real, 'second_oven', 1)
    expect(container.querySelector('[data-view="second_oven.heading"]')!.className).not.toMatch(/line-clamp|truncate/)
  })
})

describe('the detail: core\'s lines for this option and aim only', () => {
  it('opened: the outcome band (as an outcome, not the chance), the driver once with its marker, and this option\'s tipping lines', () => {
    const { container } = draw(golden, 'second_oven', 1, 'goal', true)
    const m = golden.model!, c = m.cards.find((x) => x.id === 'second_oven')!
    const r = c.rows[1] as Extract<(typeof c.rows)[number], { kind: 'chance' }>
    const detail = container.querySelector('[data-testid="port-option-detail"]')!
    expect(detail.querySelector('[data-view="second_oven.rows.1.outcome.text"]')!.textContent).toBe(r.outcome!.text)
    expect(detail.querySelector('[data-view="second_oven.driver.text"]')!.textContent).toBe(c.driver!.text)
    expect(detail.querySelector('[data-testid="port-row-driver-second_oven"]')!.getAttribute('title')).toBe(c.driver!.title)
    expect(detail.querySelector('[data-testid="port-row-driver-range-second_oven"]')).not.toBeNull()
    const drawn = [...detail.querySelectorAll<HTMLElement>('[data-view^="run.tipping."]')].map((e) => e.dataset['view'])
    const want = m.run!.tipping.flatMap((t, i) => (t.option === 'second_oven' && t.aim === r.aim_id ? [`run.tipping.${i}.line`] : []))
    expect(want.length).toBeGreaterThan(0)
    expect(drawn).toEqual(want)
    expect(expectAllBound(golden, container, expect)).toBeGreaterThan(4)
  })

  it('negative: another option\'s detail draws none of second_oven\'s tipping lines', () => {
    const { container } = draw(golden, 'longer_hours', 1, 'goal', true)
    expect(container.querySelectorAll('[data-view^="run.tipping."]').length).toBe(0)
  })

  it('a row with nothing behind it is not a disclosure: no button, core\'s words as its readout', () => {
    const { container, entry } = draw(real, 'carry_on', 0)
    const r = entry.row as Extract<typeof entry.row, { kind: 'none' }>
    expect(container.querySelector('button')).toBeNull()
    expect(container.querySelector('[data-view="carry_on.rows.0.text"]')!.textContent).toBe(r.text)
  })
})

describe('the outcome lens: core\'s band on the aim\'s shared track, no leader', () => {
  it('catch: the readout is the band\'s words; the bar and its middle dot are drawn; no ◉ on this lens', () => {
    const { row, container, entry } = draw(real, 'second_oven', 1, 'outcome')
    const r = entry.row as Extract<typeof entry.row, { kind: 'chance' }>
    expect(container.querySelector('[data-view="second_oven.rows.1.outcome.text"]')!.textContent).toBe(r.outcome!.text)
    expect(container.querySelector('[data-testid="port-row-bar"]')!.getAttribute('data-visible')).toBe('true')
    expect(container.querySelector('[data-testid="port-row-dot"]')!.getAttribute('data-visible')).toBe('true')
    expect(row.dataset['leader']).toBe('false')
    expect(container.querySelector('[data-view$=".likely.glyph"]')).toBeNull()
  })

  it('negative: a chance row with no outcome band draws no bar and no chance under "Likely outcome", even opened (checker, 7 Nov)', () => {
    const v = structuredClone(real)
    const c = v.model!.cards.find((x) => x.id === 'second_oven')!
    ;(c.rows[1] as { outcome: unknown }).outcome = null
    const { container } = draw(v, 'second_oven', 1, 'outcome', true)
    expect(container.querySelector('[data-testid="port-row-bar"]')!.getAttribute('data-visible')).toBe('false')
    expect(container.querySelector('[data-testid="port-row-readout"]')!.textContent).toBe('')
    expect(container.querySelector('[data-view$=".value"], [data-view$=".approx"]')).toBeNull()
    expect(container.textContent).not.toContain('about 72% chance')
  })

  it('the outcome lens with a band never draws the chance either, not even in the detail', () => {
    const { container } = draw(real, 'second_oven', 1, 'outcome', true)
    expect(container.querySelector('[data-view="second_oven.rows.1.value"]')).toBeNull()
    expect(container.textContent).not.toContain('about 72% chance')
  })

  it('negative: a limit row draws no value under "Likely outcome"', () => {
    const e = viewOf('golden/european')
    const card = e.model!.cards.find((x) => x.id === 'broader_entry')!
    const i = card.rows.findIndex((r) => r.kind === 'limit')
    const { container } = draw(e, 'broader_entry', i, 'outcome')
    expect(container.querySelector('[data-testid="port-row-readout"]')!.textContent).toBe('')
    cleanup()
    expect(draw(e, 'broader_entry', i, 'goal').container.querySelector(`[data-view="broader_entry.rows.${i}.value"]`)).not.toBeNull()
  })

  it('toggling: the row button reports its state and calls back', () => {
    let n = 0
    const m = real.model!, c = m.cards.find((x) => x.id === 'second_oven')!
    const { container } = render(<HeroOptionRow entry={{ card: c, row: c.rows[1]!, i: 1 }} lens="goal" isOpen={false} onToggle={() => { n++ }} domain={null} />)
    const b = container.querySelector('button')!
    expect(b.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(b)
    expect(n).toBe(1)
  })
})
