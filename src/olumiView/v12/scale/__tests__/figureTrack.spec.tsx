import '@testing-library/jest-dom/vitest'
import { render, screen, within } from '@testing-library/react'
import { expect, it } from 'vitest'
import FigureTrack from '../FigureTrack'

const positionOf = (mark: HTMLElement) => mark.style.getPropertyValue('--scale-x')
const widthOf = (span: HTMLElement) => span.style.getPropertyValue('--scale-width')

it('draws both authors’ bands, discrete ticks, the tip and a dashed untested span on the same axis', () => {
  render(<FigureTrack min={-10} max={30}
    bands={[
      { low: -10, high: 0, style: 'olumi', id: 'estimate' },
      { low: 10, high: 20, style: 'person', id: 'given' },
    ]}
    ticks={[{ at: -5, kind: 'likely' }, { at: 20, kind: 'deadline' }, { at: 25, kind: 'tried' }]}
    tip={15} untested={[{ low: 0, high: 10 }]} />)
  const track = screen.getByTestId('range-bar')
  expect(track).toHaveAttribute('data-form', 'CH-range')
  const [estimate, given] = within(track).getAllByTestId('range-band')
  expect(estimate).toHaveAttribute('data-style', 'dotted')
  expect(given).toHaveAttribute('data-style', 'solid')
  expect([positionOf(estimate!), widthOf(estimate!)]).toEqual(['0%', '25%'])
  expect([positionOf(given!), widthOf(given!)]).toEqual(['50%', '25%'])

  expect(positionOf(within(track).getByTestId('range-likely'))).toBe('12.5%')
  expect(positionOf(within(track).getByTestId('range-deadline'))).toBe('75%')
  const tried = within(track).getByTestId('range-tried')
  expect(positionOf(tried)).toBe('87.5%')
  expect(tried).toHaveAttribute('data-at', '25')
  const tip = within(track).getByTestId('tip-marker')
  expect(tip).toHaveClass('ok-scale-tip-marker', 'ok-scale-figure-tip')
  expect(positionOf(tip)).toBe('62.5%')
  const untested = within(track).getByTestId('range-untested')
  expect(untested).toHaveClass('ok-scale-untested')
  expect(untested).not.toHaveClass('ok-scale-withheld')
  expect([positionOf(untested), widthOf(untested)]).toEqual(['25%', '25%'])
  expect(untested).toBeEmptyDOMElement()
})
