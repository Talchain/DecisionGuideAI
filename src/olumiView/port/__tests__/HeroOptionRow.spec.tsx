/**
 * The ported option row draws core's words only, at their View paths: the chance as the headline on the goal lens, core's own ◉ as the only
 * mark (never a rank), the outcome band only on the outcome lens's track, and the detail lines for this option and aim alone.
 * Fixtures: the real-AI bakery board (fixtures/real) and core's bakery golden, which carries the tipping lines.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import type { View } from '../../client'
import { HeroOptionRow, type HeroLensId } from '../HeroOptionRow'
import { TYPE } from '../type'
import { aimGroupsOf, outcomeDomainOf, tippingFor, type AimRow } from '../pick'
import { figureCard } from '../../ViewChances'
import { expectAllBound, viewOf } from './viewAt'

afterEach(cleanup)

const real = viewOf('real/bakery-r5')
const golden = viewOf('golden/bakery')

/** A View as a core before AN-01 drew it: no card carries a headline. The goldens are re-read from the paired core, which carries them. */
const beforeAn01 = (view: View): View => { const v = structuredClone(view); for (const c of v.model!.cards) c.headline = null; return v }

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

  it('stacked (UI\'s 1232 look): the name on its own full-width line first, then the mark, readout and chevron; no indent; a 44px target', () => {
    const { container } = draw(real, 'second_oven', 1, 'goal', true)
    const button = container.querySelector('button')!
    expect(button.className).toContain('min-h-[44px]')
    expect(button.className).toContain('flex-col')
    const name = container.querySelector('[data-view="second_oven.heading"]')!
    expect(button.firstElementChild).toBe(name)
    expect(name.className).toContain('w-full')
    const line2 = name.nextElementSibling!
    expect(line2.querySelector('[data-testid="port-row-mark"]')).not.toBeNull()
    expect(line2.querySelector('[data-view="second_oven.rows.1.value"]')).not.toBeNull()
    expect(line2.lastElementChild!.tagName.toLowerCase()).toBe('svg')
    for (const el of container.querySelectorAll<HTMLElement>('[data-testid="port-option-detail"], [data-testid="port-row-rests-on"]')) expect(el.className).not.toMatch(/\bpl-10\b/)
  })

  it('the option name is never cut: no clamp or truncation on it', () => {
    const { container } = draw(real, 'second_oven', 1)
    expect(container.querySelector('[data-view="second_oven.heading"]')!.className).not.toMatch(/line-clamp|truncate/)
  })
})

describe('the headline at rest (track 4 step 1): the chance, its uncertainty, and what would change it, in core\'s words', () => {
  const chanceLine = (v: View, option: string, aim: string | null) => {
    const k = v.model!.run!.tipping.findIndex((t) => t.option === option && t.aim === aim && t.kind === 'chance' && t.line !== '')
    return k < 0 ? null : { k, line: v.model!.run!.tipping[k]! }
  }

  it('catch: under the chance, closed, v10\'s marker named by core\'s driver sentence with the chance ticked on it, then this option\'s own "what would have to be true" line verbatim', () => {
    const { container, entry } = draw(golden, 'second_oven', 1)
    const c = entry.card, r = entry.row as Extract<typeof entry.row, { kind: 'chance' }>
    const head = container.querySelector('[data-testid="port-row-headline"]')!
    expect(head).not.toBeNull()
    expect(head.closest('button')).toBeNull() // at rest, beside the row's toggle, never inside it
    expect(container.querySelector('[data-testid="port-option-detail"]')).toBeNull() // closed
    const track = head.querySelector('[data-testid="port-row-driver-range-second_oven"]')!
    expect([track.getAttribute('role'), track.getAttribute('aria-label'), track.getAttribute('title')]).toEqual(['img', c.driver!.text, c.driver!.title])
    expect(head.querySelector('[data-testid="port-row-driver-chance-second_oven"]')!.getAttribute('style')).toContain(`left: ${r.chance! * 100}%`)
    const want = chanceLine(golden, 'second_oven', r.aim_id)!
    const line = head.querySelector(`[data-view="run.tipping.${want.k}.line"]`)!
    expect([line.textContent, line.getAttribute('data-view-fact')]).toEqual([want.line.line, want.line.id])
    expect(line.closest('[title]')!.getAttribute('title')).toBe(want.line.hover)
    expect(head.textContent).not.toMatch(/\b(best|winner|recommend)/i)
    expect(expectAllBound(golden, container, expect)).toBeGreaterThan(3)
  })

  it('negative: an option core gives no driver and no tipping line keeps its face as it was: no headline block at all', () => {
    const v = viewOf('golden/whatif')
    const c = v.model!.cards.find((x) => x.family === 'option' && x.rows.some((r) => r.kind === 'chance'))!
    expect(c.driver ?? null).toBeNull()
    const { container } = draw(v, c.id, c.rows.findIndex((r) => r.kind === 'chance'))
    expect(container.querySelector('[data-testid="port-row-headline"]')).toBeNull()
  })

  it('a driver but no tipping line: core\'s driver sentence is the headline\'s line, once, never repeated in the detail', () => {
    const v = beforeAn01(golden)
    v.model!.run!.tipping = []
    const { container } = draw(v, 'second_oven', 1, 'goal', true)
    const c = v.model!.cards.find((x) => x.id === 'second_oven')!
    const words = container.querySelectorAll('[data-view="second_oven.driver.text"]')
    expect(words.length).toBe(1)
    expect(words[0]!.textContent).toBe(c.driver!.text)
    expect(words[0]!.closest('[data-testid="port-row-headline"]')).not.toBeNull()
  })

  it('AN-01 on the paired golden: the headline draws core\'s range once; core\'s driver sentence is said once, whole, in the detail only', () => {
    const c = golden.model!.cards.find((x) => x.id === 'second_oven')!
    expect(c.headline!.range).not.toBeNull()
    expect(c.driver!.text.startsWith(c.headline!.range!)).toBe(true)
    const shut = draw(golden, 'second_oven', 1, 'goal', false).container
    expect(shut.querySelectorAll('[data-view="second_oven.headline.range"]')).toHaveLength(1)
    expect(shut.querySelector('[data-view="second_oven.headline.range"]')!.textContent).toBe(c.headline!.range)
    expect(shut.querySelector('[data-view="second_oven.headline.range"]')!.closest('[data-testid="port-row-headline"]')).not.toBeNull()
    expect(shut.querySelectorAll('[data-view="second_oven.driver.text"]')).toHaveLength(0)
    cleanup()
    const open = draw(golden, 'second_oven', 1, 'goal', true).container
    const words = open.querySelectorAll('[data-view="second_oven.driver.text"]')
    expect(words).toHaveLength(1)
    expect(words[0]!.textContent).toBe(c.driver!.text)
    expect(words[0]!.closest('[data-testid="port-option-detail"]')).not.toBeNull()
    expect(open.querySelectorAll('[data-view="second_oven.headline.range"]')).toHaveLength(1)
  })

  it('negative: the outcome lens draws no headline (the goal lens owns the chance)', () => {
    const { container } = draw(golden, 'second_oven', 1, 'outcome')
    expect(container.querySelector('[data-testid="port-row-headline"]')).toBeNull()
  })
})

describe('the detail: core\'s lines for this option and aim only', () => {
  it('opened: the outcome band (as an outcome, not the chance), the driver\'s sentence and figure, and this option\'s other tipping lines; nothing the headline already shows', () => {
    const { container } = draw(golden, 'second_oven', 1, 'goal', true)
    const m = golden.model!, c = m.cards.find((x) => x.id === 'second_oven')!
    const r = c.rows[1] as Extract<(typeof c.rows)[number], { kind: 'chance' }>
    const detail = container.querySelector('[data-testid="port-option-detail"]')!
    expect(detail.querySelector('[data-view="second_oven.rows.1.outcome.text"]')!.textContent).toBe(r.outcome!.text)
    expect(detail.querySelector('[data-view="second_oven.driver.text"]')!.textContent).toBe(c.driver!.text)
    expect(detail.querySelector('[data-testid="port-row-driver-second_oven"]')!.getAttribute('title')).toBe(c.driver!.title)
    // the marker is drawn once, on the headline
    expect(container.querySelectorAll('[data-testid="port-row-driver-range-second_oven"]').length).toBe(1)
    expect(detail.querySelector('[data-testid="port-row-driver-range-second_oven"]')).toBeNull()
    // every tipping line for this option and aim is drawn exactly once, across the headline and the detail
    const drawn = [...container.querySelectorAll<HTMLElement>('[data-view^="run.tipping."]')].map((e) => e.dataset['view']).sort()
    const want = m.run!.tipping.flatMap((t, i) => (t.option === 'second_oven' && t.aim === r.aim_id ? [`run.tipping.${i}.line`] : [])).sort()
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

// 1232 polish (track 4 step 3, against the Reveal Paul approved 7 Nov): the chance is the finding and the name its label; blue is Olumi's only.
describe('the row reads its finding first', () => {
  it('catch: core\'s chance is full weight on the leader and on every other row (none dims); the option name is the 12px label', () => {
    for (const [card, leader] of [['second_oven', 'true'], ['carry_on', 'false']] as const) {
      const { row, container } = draw(real, card, 1)
      expect(row.dataset['leader']).toBe(leader)
      const readout = container.querySelector('[data-testid="port-row-readout"]')!
      expect(readout.querySelector(`[data-view="${card}.rows.1.value"]`)).not.toBeNull()
      expect(readout.className.split(' ')).toEqual(expect.arrayContaining(['font-semibold', 'text-text-header']))
      expect(readout.className).not.toContain('text-text-body')
      const name = container.querySelector(`[data-view="${card}.heading"]`)!
      expect(name.className.startsWith(TYPE.meta)).toBe(true)
      expect(name.className).not.toContain('font-medium')
      cleanup()
    }
  })

  it('the headline\'s line is whole, however long: no clamp and no Show all (Paul\'s gate, 8 Nov: nothing cut)', () => {
    const sh = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight'), ch = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight')
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get: () => 200 })
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 40 })
    try {
      const { container } = draw(golden, 'second_oven', 1)
      const head = container.querySelector('[data-testid="port-row-headline"]')!
      // The headline's own line (core's tipping line, or its driver sentence where it has none), not the range above it.
      const line = head.querySelector('[data-view^="run.tipping."], [data-view$=".driver.text"]')
      expect(line).not.toBeNull()
      expect(line!.closest('p')!.className).not.toMatch(/line-clamp|truncate/)
      expect(head.querySelectorAll('button')).toHaveLength(0)
      // Contrast: the row still opens its detail with its own control.
      expect(container.querySelector('[data-testid="port-option-row"] > button[aria-expanded]')).not.toBeNull()
    } finally {
      if (sh) Object.defineProperty(HTMLElement.prototype, 'scrollHeight', sh)
      if (ch) Object.defineProperty(HTMLElement.prototype, 'clientHeight', ch)
    }
  })

})


describe('a withheld row says its question in the row, at rest (DL 11 Nov, UI-7 item 1)', () => {
  // Every withheld row core asks a question on, in core's bakery golden (core SCI-10 fd672840): second_oven, longer_hours, carry_on.
  const asked = golden.model!.cards.flatMap((c) => c.rows.flatMap((r, i) => (r.kind === 'none' && (r.question ?? '') !== '' ? [{ card: c.id, i, q: r.question! }] : [])))
  it('the golden holds withheld rows that ask', () => expect(asked.map((a) => a.card)).toEqual(['second_oven', 'longer_hours', 'carry_on']))
  for (const a of asked) {
    it(`${a.card}: core's question is drawn closed (not behind the chevron, not hover), at its path, once`, () => {
      const { row, container } = draw(golden, a.card, a.i, 'goal', false)
      const q = container.querySelectorAll<HTMLElement>(`[data-view="${a.card}.rows.${a.i}.question"]`)
      expect(q).toHaveLength(1)
      expect(q[0]!.textContent).toBe(a.q)
      expect(q[0]!.closest('[title]')?.getAttribute('title') === a.q).toBe(false)
      expect(row.contains(q[0]!)).toBe(true)
      expect(q[0]!.closest('[id$="-detail"], [role="region"]')).toBeNull()
    })
  }
  it('a chance row draws no question', () => {
    const { container } = draw(golden, 'second_oven', 1)
    expect(container.querySelector('[data-testid="port-row-question"]')).toBeNull()
  })
})
