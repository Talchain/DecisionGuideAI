/**
 * The Run's science lines (olumi.view/3 `model.run.science[]`, ALPHA-PLAN "Science → screen path"), drawn by the olumi-core lane's dock:
 * each line and its hover exactly as core built them (core's page draws the same strings), in the Run's order, with ◆ when the figure is
 * Olumi's estimate and the partial mark ◐ when it is a person's figure with Olumi's range. Nothing is formatted, reordered or worded here.
 * Bound by identity: each line's element is found by its F# id and its own index.
 */
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render } from '@testing-library/react'
import type { ViewModel } from '../client'
import { ViewChances } from '../ViewChances'

const golden = (n: string): ViewModel => JSON.parse(readFileSync(path.join(path.resolve('src/olumiView'), 'golden', n), 'utf8')).model
const science = { model: golden('bakery-science.view3.json') }
const lineOf = (c: HTMLElement, id: string) => c.querySelector(`[data-view-science="${id}"]`) as HTMLElement | null

describe('the Run\'s science lines on the lane', () => {
  it('each line is core\'s line, verbatim, with core\'s hover, in the Run\'s order', () => {
    const lines = science.model.run!.science
    const { container } = render(<ViewChances model={science.model} />)
    expect([...container.querySelectorAll('[data-view-science]')].map((e) => e.getAttribute('data-view-science'))).toEqual(lines.map((l) => l.id))
    lines.forEach((l, i) => {
      const el = lineOf(container, l.id)!
      expect(el.querySelector(`[data-view="run.science.${i}.line"]`)!.textContent).toBe(l.line)
      expect(el.getAttribute('title')).toBe(l.hover)
    })
  })

  it('◆ marks a line whose figure is Olumi\'s estimate, and only that line', () => {
    const { container } = render(<ViewChances model={science.model} />)
    expect(lineOf(container, 'F21')!.querySelector('[data-view="run.science.1.whose"]')!.textContent).toBe('◆')
    expect(lineOf(container, 'F20')!.querySelector('[data-view="run.science.0.whose"]')).toBeNull()
    expect(lineOf(container, 'F22')!.querySelector('[data-view="run.science.2.whose"]')).toBeNull()
  })

  it('a person\'s figure with Olumi\'s range carries the partial mark ◐, never ◆; a line naming no single figure carries none', () => {
    const model: ViewModel = structuredClone(science.model)
    model.run!.science[0]!.figure = { label: 'extra hours sold', whose: 'mixed' }
    model.run!.science[2]!.figure = null
    const { container } = render(<ViewChances model={model} />)
    const mark = lineOf(container, 'F20')!.querySelector('[data-view="run.science.0.whose"]')!
    expect(mark.textContent).toBe('◐')
    expect(mark).toHaveAttribute('aria-label')
    expect(lineOf(container, 'F22')!.querySelector('[data-view="run.science.2.whose"]')).toBeNull()
    expect(lineOf(container, 'F22')!.querySelector('[data-view="run.science.2.line"]')!.textContent).toBe(science.model.run!.science[2]!.line)
  })

  it('a Run with no science lines, or a View from a core before olumi.view/3, draws none', () => {
    const none = render(<ViewChances model={golden('bakery.view3.json')} />).container
    expect(golden('bakery.view3.json').run!.science).toEqual([])
    expect(none.querySelector('[data-testid="view-run-science"]')).toBeNull()
    const v2 = render(<ViewChances model={golden('bakery.view.json')} />).container
    expect(v2.querySelector('[data-testid="view-run-science"]')).toBeNull()
    expect(v2.querySelector('[data-testid="view-chances"]')).not.toBeNull()
  })
})
