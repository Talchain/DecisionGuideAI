import { readFileSync } from 'node:fs'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { View, ViewCard, ViewModel } from '../../../client'
import { TippingPerOption } from '../../../port/AnalysisReaders'
import { cardOf } from '../../../port/pick'
import { WhatMovesIt } from '../../../port/WhatMovesIt'
import { TipPoint } from '..'
import { spanAxisOf } from '../axis'

const model = (JSON.parse(readFileSync('src/olumiView/fixtures/cardface/studio.view3.json', 'utf8')) as View).model!
const tipping = model.run!.tipping[0]!
const figureCard = cardOf(model, tipping.figure.id)!
// Values chosen so the zoomed axis (spanAxisOf) runs exactly 0 to 100: positions read as plain percentages.
const tested = { ...tipping, at: 40, low: 0, high: 80 }

function withRange(by: 'olumi' | 'person') {
  return {
    ...figureCard,
    author: { by, text: '', title: '' },
    figure: { ...figureCard.figure!, range: { low: 0, likely: 50, high: 80, unit: 'classes/month' } },
  } satisfies ViewCard
}

const positionOf = (element: HTMLElement) => element.style.getPropertyValue('--scale-x')
const widthOf = (element: HTMLElement) => element.style.getPropertyValue('--scale-width')

describe('TipPoint', () => {
  it.each([
    { side: 'above' as const, start: '40%', width: '40%' },  // only what Core tested: 40 to 80, never the axis margin
    { side: 'below' as const, start: '0%', width: '40%' },
  ])('marks the tipping value and outlines the $side side of the same axis', ({ side, start, width }) => {
    render(<TipPoint tipping={{ ...tested, side }} card={withRange('person')} />)
    const picture = screen.getByTestId('tip-point')
    expect(picture).toHaveAttribute('aria-hidden', 'true')
    expect(positionOf(within(picture).getByTestId('tip-marker'))).toBe('40%')
    expect(positionOf(within(picture).getByText('40 classes/month'))).toBe('40%')
    expect(within(picture).getByText('0 classes/month')).toBeVisible()
    expect(within(picture).getByText('100 classes/month')).toBeVisible()
    const region = within(picture).getByTestId('tip-region')
    expect(positionOf(region)).toBe(start)
    expect(widthOf(region)).toBe(width)
  })

  it.each([
    { author: 'person' as const, whose: 'theirs' as const, style: 'solid' },
    { author: 'olumi' as const, whose: 'theirs' as const, style: 'dotted' },
    { author: 'person' as const, whose: 'olumi' as const, style: 'dotted' },
  ])('shows the figure range as $style for $author and $whose attribution', ({ author, whose, style }) => {
    render(<TipPoint tipping={{ ...tested, figure: { ...tipping.figure, whose } }} card={withRange(author)} />)
    const band = screen.getByTestId('range-band')
    expect(band).toHaveClass('ok-scale-range-band')
    expect(band).toHaveAttribute('data-style', style)
    expect(positionOf(band)).toBe('0%')
    expect(widthOf(band)).toBe('80%')
    expect(positionOf(screen.getByTestId('range-likely'))).toBe('50%')
    expect(screen.getByTestId('tip-point')).toHaveAttribute('data-by', style === 'dotted' ? 'olumi' : 'person')
  })

  it('zooms to the figure so which side of the line it sits on is visible (studio: tip 19.7 inside 18.3 to 20.7)', () => {
    render(<TipPoint tipping={tipping} card={figureCard} />)
    const ends = screen.getByTestId('tip-point').querySelector('.ok-scale-tip-ends')!
    const [min, max] = [ends.firstElementChild!, ends.lastElementChild!].map((e) => parseFloat(e.textContent!.replace(/,/g, '')))
    // The printed ends enclose everything drawn, and are not a 0-based axis.
    expect(min).toBeGreaterThan(0)
    expect(min).toBeLessThanOrEqual(Math.min(tipping.low, tipping.at))
    expect(max).toBeGreaterThanOrEqual(Math.max(tipping.high, tipping.at))
    // The marker sits where the printed ends say it should, and in the middle band of the track.
    const at = parseFloat(positionOf(screen.getByTestId('tip-marker')))
    expect(at).toBeCloseTo(((tipping.at - min) / (max - min)) * 100, 1)
    expect(at).toBeGreaterThan(20)
    expect(at).toBeLessThan(80)
    expect(screen.getByText(tipping.at.toFixed(1))).toBeVisible()
  })

  it.each([figureCard, null])('shows the threshold without a range, likely dot or unit when the card supplies no range (%#)', (card) => {
    render(<TipPoint tipping={{ ...tested, at: 25 }} card={card} />)
    expect(screen.queryByTestId('range-band')).toBeNull()
    expect(screen.queryByTestId('range-likely')).toBeNull()
    expect(positionOf(screen.getByText('25'))).toBe('25%')
    expect(screen.getByText('0')).toBeVisible()
    expect(screen.getByText('100')).toBeVisible()
  })

  it.each([{ at: NaN }, { low: -Infinity }, { high: Infinity }, { low: 20, high: 20 }])(
    'draws nothing for an invalid threshold or span (%j)',
    (invalid) => {
      const { container } = render(<TipPoint tipping={{ ...tested, ...invalid }} card={figureCard} />)
      expect(container.firstChild).toBeNull()
    },
  )

  it.each([[1, 1 + Number.EPSILON], [-1e308, 1e308], [0, Number.MIN_VALUE], [5, 4], [0, Infinity]])(
    'has no axis (so draws nothing) where none is honest: %s to %s', (lo, hi) => {
      expect(spanAxisOf(lo, hi)).toBeNull()
      const { container } = render(<TipPoint tipping={{ ...tested, at: lo, low: lo, high: hi }} card={null} />)
      expect(container.firstChild).toBeNull()
    })

  it('puts the picture below Core’s verbatim per-option line in the studio run', () => {
    render(<TippingPerOption model={model} />)
    const line = screen.getByText(tipping.line)
    expect(line).toHaveAttribute('data-view', 'run.tipping.0.line')
    const picture = screen.getByTestId('tip-point')
    expect(line.closest('p')?.nextElementSibling).toBe(picture)
    expect(within(picture).getByText('19.7')).toBeVisible()
  })

  it('puts the picture below the lead line once when Core marks the row as a lead crossing', () => {
    const leadModel: ViewModel = { ...model, run: { ...model.run!, tipping: [{ ...tipping, kind: 'lead' }] } }
    render(<><WhatMovesIt model={leadModel} /><TippingPerOption model={leadModel} /></>)
    const line = screen.getByTestId('analysis-lead-change')
    expect(within(line).getByText(tipping.line)).toBeVisible()
    expect(line.nextElementSibling).toBe(screen.getByTestId('tip-point'))
  })
})
