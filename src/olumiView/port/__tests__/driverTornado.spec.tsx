import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, within } from '@testing-library/react'
import type { ViewModel } from '../../client'
import { useViewStore } from '../../store'
import { driverRange } from '../../ViewChances'
import { DriverTornado } from '../DriverTornado'
import { PortAnalysisTab } from '../PortAnalysisTab'
import { trackPct } from '../pick'
import { viewOf } from './viewAt'

// Real core output includes three reversed ranges, so low and high cannot be mistaken for left and right.
const fixture = viewOf('real/hiring')
const options = fixture.model!.cards.filter((c) => c.family === 'option' && c.driver?.low != null && c.driver.high != null)
const draw = (model: ViewModel = fixture.model!) => {
  useViewStore.setState({ view: fixture })
  return render(<DriverTornado model={model} />)
}
afterEach(() => { cleanup(); useViewStore.setState({ view: null }) })

describe('driver tornado, on fixtures/real/hiring.view3.json', () => {
  it('DT1: one row per numeric driver, in the View\'s card order, including when that order changes', () => {
    expect(options).toHaveLength(3)
    const { container, rerender } = draw()
    const ids = () => [...container.querySelectorAll('[data-tornado-row]')].map((r) => r.getAttribute('data-tornado-row'))
    expect(ids()).toEqual(options.map((c) => c.id))
    const reversed = structuredClone(fixture.model!)
    reversed.cards.reverse()
    rerender(<DriverTornado model={reversed} />)
    expect(ids()).toEqual([...options].reverse().map((c) => c.id))
    const partial = structuredClone(fixture.model!)
    partial.cards.find((c) => c.id === options[1]!.id)!.driver!.low = null
    rerender(<DriverTornado model={partial} />)
    expect(ids()).toEqual([options[0]!.id, options[2]!.id])
  })

  it('DT2: bars and endpoints use driverRange; each own chance tick uses trackPct', () => {
    const { container } = draw()
    for (const card of options) {
      const row = within(container.querySelector<HTMLElement>(`[data-tornado-row="${card.id}"]`)!)
      const range = driverRange(card.driver!)!
      expect(row.getByTestId('port-driver-tornado-bar')).toHaveStyle({ left: `${Math.min(range.lowPct, range.highPct)}%`, width: `${Math.abs(range.highPct - range.lowPct)}%` })
      expect(row.getByTestId('port-driver-tornado-low')).toHaveStyle({ left: `${range.lowPct}%` })
      expect(row.getByTestId('port-driver-tornado-high')).toHaveStyle({ left: `${range.highPct}%` })
      const chance = card.rows.find((r) => r.kind === 'chance')!
      expect(chance.kind).toBe('chance')
      if (chance.kind === 'chance') expect(row.getByTestId('port-driver-tornado-chance')).toHaveStyle({ left: `${trackPct(chance.chance!)}%` })
    }
  })

  // Re-pinned (UI recovery, driver tornado, DL 10 Nov): the driver sentence is said once, under the option's own row (sayOnce SC-02).
  // Was: the tornado drew `driver.text` again under each bar. Now the bar carries it as its name, and the caption is the figure's heading.
  it('DT3: each row shows the option heading and the driver figure\'s heading, and names its bar with core\'s driver sentence, never drawing it again', () => {
    const { container } = draw()
    let captions = 0
    for (const card of options) {
      const row = container.querySelector(`[data-tornado-row="${card.id}"]`)!
      expect(row.querySelector(`[data-view="${card.id}.heading"]`)!.textContent).toBe(card.heading)
      expect(row.querySelector(`[data-view="${card.id}.driver.text"]`)).toBeNull()
      const track = row.querySelector('[data-testid="port-driver-tornado-track"]')!
      expect(track).toHaveAttribute('role', 'img')
      expect(track).toHaveAttribute('aria-label', card.driver!.text)
      expect(track).toHaveAttribute('title', card.driver!.title)
      const figure = fixture.model!.cards.find((c) => c.id === card.driver!.figure)
      if (figure == null) { expect(row.querySelector('[data-testid="port-driver-tornado-figure"]')).toBeNull(); continue }
      const caption = row.querySelector(`[data-view="${figure.id}.heading"]`)!
      expect(caption.textContent).toBe(figure.heading)
      expect(caption.className).not.toMatch(/truncate|line-clamp/)
      captions++
    }
    expect(captions).toBeGreaterThan(0)
  })

  it('DT4: fewer than two options with numeric low and high draws nothing', () => {
    for (const kept of [0, 1]) {
      const model = structuredClone(fixture.model!)
      const keep = options.slice(0, kept).map((c) => c.id)
      for (const card of model.cards) if (!keep.includes(card.id)) card.driver = null
      expect(draw(model).container).toBeEmptyDOMElement()
      cleanup()
    }
  })

  it('DT5: one shared axis below every row, labelled exactly 0%, 50%, 100%', () => {
    const { getByTestId, getAllByTestId } = draw()
    expect(getAllByTestId('port-driver-tornado-axis')).toHaveLength(1)
    const axis = getByTestId('port-driver-tornado-axis')
    expect([...axis.children].map((e) => e.textContent)).toEqual(['0%', '50%', '100%'])
    for (const row of getByTestId('port-driver-tornado').querySelectorAll('[data-tornado-row]')) {
      expect(row.compareDocumentPosition(axis) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    }
  })

  it('uses core\'s what-changes heading and its View path to name the group', () => {
    const { getByRole } = draw()
    const heading = getByRole('heading', { name: fixture.lens_words.label.what_changes })
    expect(heading).toHaveAttribute('data-view', 'lens_words.label.what_changes')
    expect(getByRole('group')).toHaveAccessibleName(fixture.lens_words.label.what_changes)
  })

  it('without core\'s heading, names the group from the first driver title and adds no heading', () => {
    useViewStore.setState({ view: null })
    const { getByRole, queryByRole } = render(<DriverTornado model={fixture.model!} />)
    expect(queryByRole('heading')).toBeNull()
    expect(getByRole('group')).toHaveAttribute('aria-label', options[0]!.driver!.title)
  })

  it('keeps a range without a chance, but draws no chance tick for it', () => {
    const model = structuredClone(fixture.model!)
    const card = model.cards.find((c) => c.id === options[0]!.id)!
    for (const row of card.rows) if (row.kind === 'chance') row.chance = null
    const { container } = draw(model)
    const row = within(container.querySelector<HTMLElement>(`[data-tornado-row="${card.id}"]`)!)
    expect(row.getByTestId('port-driver-tornado-bar')).toBeInTheDocument()
    expect(row.queryByTestId('port-driver-tornado-chance')).toBeNull()
  })

  it('mounts once immediately after the hero and before the other Analysis sections', () => {
    useViewStore.setState({ view: fixture, status: 'ready', error: null, at: null })
    const { getByTestId } = render(<PortAnalysisTab />)
    const chart = getByTestId('port-driver-tornado')
    expect(chart.previousElementSibling).toHaveAttribute('data-testid', 'port-analysis-hero')
  })
})
