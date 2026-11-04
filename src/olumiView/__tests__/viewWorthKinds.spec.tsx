/**
 * Worth checking first draws only the science kinds it knows (DL 4 Nov, before core's D2 adds View kinds such as middle/better and an
 * 'unresolved' status): a `run.science` line of any other kind is drawn as nothing, never as a worth line. Fixture: the bakery View from
 * the wire (one worth line), with lines of kinds core has not served yet added beside it.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render } from '@testing-library/react'
import type { View, ViewModel } from '../client'
import { ViewChances } from '../ViewChances'

const model = (JSON.parse(readFileSync(path.resolve('src/olumiView/golden/bakery.view.json'), 'utf8')) as View).model!
afterEach(cleanup)
const worth = model.run!.science[0]!
/** The model with lines of kinds this page does not know beside its worth line (core's D2, not served yet). */
const withKinds = (...kinds: string[]): ViewModel => ({ ...model, run: { ...model.run!, science: [
  ...kinds.map((kind, k) => ({ ...worth, id: `unknown_${k}`, kind, line: `A ${kind} line` }) as unknown as typeof worth), worth,
] } })

describe('Worth checking first: only the kinds it knows', () => {
  it('bakery: its worth line drawn, in core\'s words', () => {
    const c = render(<ViewChances model={model} />).container
    expect(c.querySelector(`[data-view-fact="${worth.id}"]`)?.textContent).toContain(worth.line)
  })
  it('a line of an unknown kind (middle, better, unresolved) is drawn as nothing; the worth line beside it still is', () => {
    const c = render(<ViewChances model={withKinds('middle', 'better', 'unresolved')} />).container
    expect([...c.querySelectorAll('[data-view-fact]')].map((e) => e.getAttribute('data-view-fact'))).toEqual([worth.id])
    expect(c.textContent).not.toMatch(/A (middle|better|unresolved) line/)
    // The worth line keeps its own path in the View (index 3 of 4).
    expect(c.querySelector('[data-view="run.science.3.line"]')?.textContent).toBe(worth.line)
  })
  it('only unknown kinds: no Worth checking first block at all', () => {
    const only = { ...model, run: { ...model.run!, science: withKinds('middle').run!.science.slice(0, 1) } }
    expect(render(<ViewChances model={only} />).container.querySelector('[data-testid="view-run-worth"]')).toBeNull()
  })
})
