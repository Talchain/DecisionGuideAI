/**
 * The ported "What to act on next" draws core's rows in core's order (what the chances wait on, then the prompts about the model's shape),
 * each title and reason verbatim at its View path, the caller's action in each row's cluster, the rest behind "+N more"; no steps or
 * minutes (core holds none); nothing when core sends no row. Fixtures: core's bakery and studio goldens.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import type { View } from '../../client'
import { ActOnIt } from '../ActOnIt'
import { expectAllBound, viewOf } from './viewAt'

afterEach(cleanup)
const bakery = viewOf('golden/bakery')
const studio = viewOf('golden/studio')
const order = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>('[data-act]')].map((e) => e.dataset['act'])

describe('the ported act-on-it section', () => {
  it('bakery: the waited-on figure first, then the prompt; titles and reasons in core\'s words at their paths', () => {
    const m = bakery.model!
    const c = render(<ActOnIt model={m} />).container
    expect(order(c)).toEqual([...m.run!.waits_on!.items.map((i) => `wait:${i.id}`), ...m.sharpen.map((s) => `sharpen:${s.id}`)])
    expect(c.querySelector('[data-view="run.waits_on.items.0.title"]')!.textContent).toBe(m.run!.waits_on!.items[0]!.title)
    expect(c.querySelector('[data-view="sharpen.0.rationale"]')!.textContent).toBe(m.sharpen[0]!.rationale)
    expect(expectAllBound(bakery, c, expect)).toBe(m.run!.waits_on!.items.length * 2 + m.sharpen.length * 3)
    expect(c.textContent).not.toMatch(/Try this|About \d+ min/)
  })

  it('studio: four rows, three shown and one behind "+1 more", in core\'s order', () => {
    const m = studio.model!
    const want = [...m.run!.waits_on!.items.map((i) => `wait:${i.id}`), ...m.sharpen.map((s) => `sharpen:${s.id}`)]
    expect(want.length).toBe(4)
    const c = render(<ActOnIt model={m} />).container
    expect(order(c)).toEqual(want)
    const more = c.querySelector('[data-testid="port-act-on-it-more"]')!
    expect(more.querySelector('summary')!.textContent).toBe('+1 more')
    expect([...more.querySelectorAll<HTMLElement>('[data-act]')].map((e) => e.dataset['act'])).toEqual(want.slice(3))
    expectAllBound(studio, c, expect)
  })

  it('the action cluster is the caller\'s, per row; without one, no cluster', () => {
    const m = bakery.model!
    const c = render(<ActOnIt model={m} action={(r) => <button type="button" data-for={r.key}>x</button>} />).container
    expect([...c.querySelectorAll<HTMLElement>('[data-testid="port-act-row-actions"] [data-for]')].map((e) => e.dataset['for'])).toEqual(order(c))
    cleanup()
    expect(render(<ActOnIt model={m} />).container.querySelector('[data-testid="port-act-row-actions"]')).toBeNull()
  })

  it('negative: nothing waits and no prompt, no section', () => {
    const v: View = structuredClone(bakery)
    v.model!.run!.waits_on = null
    v.model!.sharpen = []
    expect(render(<ActOnIt model={v.model!} />).container.innerHTML).toBe('')
  })
})
