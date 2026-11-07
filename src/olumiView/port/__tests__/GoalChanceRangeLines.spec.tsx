/**
 * The ported range lines draw, under each option, core's words for each link from it that core sizes (`links[].effect.text`), core's
 * sentence on hover, the figure's card by its heading; nothing when core sizes none. Fixtures: core's bakery golden, the real capacity board.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import type { View } from '../../client'
import { GoalChanceRangeLines } from '../GoalChanceRangeLines'
import { expectAllBound, viewOf } from './viewAt'

afterEach(cleanup)
const bakery = viewOf('golden/bakery')
const capacity = viewOf('real/capacity')

describe('the ported range lines', () => {
  for (const [name, v] of [['bakery', bakery], ['capacity', capacity]] as const) {
    it(`${name}: one line per sized link from each option, in core's words at its path, core's sentence on hover`, () => {
      const c = render(<GoalChanceRangeLines model={v.model!} />).container
      const m = v.model!
      // on the option's own path: from the option, or from a card the option sets by a plain link (an R24 lever card)
      const options = m.cards.filter((x) => x.family === 'option' && x.status === null).map((x) => x.id)
      const want = options.flatMap((o) => {
        const on = new Set([o, ...m.links.flatMap((l) => (l.from === o && l.kind === 'plain' ? [l.to] : []))])
        return m.links.flatMap((l, i) => (l.effect != null && on.has(l.from) ? [i] : []))
      })
      expect(want.length).toBeGreaterThan(0)
      const drawn = [...c.querySelectorAll<HTMLElement>('[data-testid="port-range-line"]')]
      expect(drawn.map((e) => e.querySelector<HTMLElement>('[data-view^="links."]')!.dataset['view'])).toEqual(want.map((i) => `links.${i}.effect.text`))
      drawn.forEach((e, k) => expect(e.getAttribute('title')).toBe(m.links[want[k]!]!.effect!.title))
      expect(expectAllBound(v, c, expect)).toBeGreaterThanOrEqual(want.length * 2)
    })
  }

  it('a line sits under its own option only (identity: second_oven\'s link under second_oven)', () => {
    const c = render(<GoalChanceRangeLines model={bakery.model!} />).container
    const i = bakery.model!.links.findIndex((l) => l.from === 'second_oven' && l.effect != null)
    expect(c.querySelector(`[data-option-id="second_oven"] [data-view="links.${i}.effect.text"]`)).not.toBeNull()
    expect(c.querySelector(`[data-option-id="longer_hours"] [data-view="links.${i}.effect.text"]`)).toBeNull()
  })

  it('with onOpenLink each line opens its own link by its two ends; without it, no buttons', () => {
    const opened: string[] = []
    const c = render(<GoalChanceRangeLines model={bakery.model!} onOpenLink={(f, t) => opened.push(`${f}->${t}`)} />).container
    const line = c.querySelector<HTMLElement>('[data-testid="port-range-line"]')!
    fireEvent.click(line)
    expect(opened).toEqual([line.dataset['link']])
    cleanup()
    expect(render(<GoalChanceRangeLines model={bakery.model!} />).container.querySelector('button')).toBeNull()
  })

  it('negative: a model whose links carry no size draws nothing', () => {
    const v: View = structuredClone(bakery)
    for (const l of v.model!.links) l.effect = null
    expect(render(<GoalChanceRangeLines model={v.model!} />).container.innerHTML).toBe('')
  })
})
