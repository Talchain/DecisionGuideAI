/**
 * DL 09:30Z (the lead's PL-1056.3): an effect term is a driver times its coefficient, two operands with their own authors. A person's driver
 * times Olumi's coefficient must credit each to its own author, beside its own figure, for the selected option; never "Your figure" alone.
 * The control: the served twin View (core 4352bfa3, live-4352bfa3-twin-cut13-v2) whose effect card core serves with a base only; ONE term is
 * added in core's own `Worked` shape (view/schema.ts), its two operands copied from served operands: the person's figure from the served
 * copy View (live-4352bfa3-copy-v5: "14 weeks · Your figure") as the driver, Olumi's from the twin ("8 to 30 weeks · Olumi's estimate") as the
 * coefficient, each with a row for the selected option. No served View yet carries an effect term, so this is the control, not a wire claim.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render } from '@testing-library/react'
import type { View } from '../client'
import { WorkedSteps } from '../look/WorkedSteps'

const load = (f: string) => JSON.parse(readFileSync(path.resolve('src/olumiView/__tests__/fixtures', f), 'utf8')) as View
afterEach(cleanup)

describe('a mixed-author effect term: each operand credited to its own author (DL 09:30Z)', () => {
  const twin = load('live-4352bfa3-twin-cut13-v2.view.json'), copy = load('live-4352bfa3-copy-v5.view.json')
  const card = twin.model!.cards.find((c) => c.worked?.form === 'effect')!
  const olumi = card.worked!.steps[0]!, person = copy.model!.cards.find((c) => c.id === card.id)!.worked!.steps[0]!
  const option = twin.model!.cards.find((c) => c.family === 'option')!.id
  const operand = (s: typeof olumi, id: string) => ({ id, label: s.label, author: s.author, edit: s.edit,
    figure: { ...s.figure, options: [{ ...s.figure.options.find((o) => o.option === option)!, option, id, author: s.author, edit: s.edit }] } })
  const view = structuredClone(twin)
  const at = view.model!.cards.find((c) => c.id === card.id)!
  at.worked = { form: 'effect', steps: [...at.worked!.steps, { ...operand(person, 'driver_given'), role: 'term', coefficient: operand(olumi, 'coefficient_estimated') }] }
  it('MX1 the driver keeps "Your figure" beside its figure; the coefficient carries Olumi\'s own credit beside its own figure; its ✎ where core offers one', () => {
    expect([person.author?.by, olumi.author?.by]).toEqual(['person', 'olumi'])
    const el = render(<WorkedSteps view={view} id={card.id} option={option} open />).container
    const li = el.querySelector(`[data-view="${card.id}.worked.steps.1"]`)!
    const by = [...li.querySelectorAll('.ok-step-by')].map((b) => [b.getAttribute('data-step-by'), b.textContent, b.previousElementSibling?.textContent ?? null])
    expect(by).toEqual([['person', ` · ${person.author!.text}`, person.figure.text], ['olumi', ` · ${olumi.author!.text}`, olumi.figure.text]])
    expect(li.querySelector('[data-step-coefficient]')?.getAttribute('data-step-coefficient')).toBe('coefficient_estimated')
    expect(li.querySelectorAll('[data-figure-edit-wrap]').length).toBe([person.edit, olumi.edit].filter((e) => e != null).length)
  })
})
