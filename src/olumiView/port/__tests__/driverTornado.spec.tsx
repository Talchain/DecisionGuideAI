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

  // Re-pinned, UI recovery row 15 (DL 10 Nov): "Your options" is restored between the hero and the chart, the previous product's order
  // (hero, your options, what could change the result). The chart still mounts once, after both.
  it('mounts once, after the hero and "Your options", before the other Analysis sections', () => {
    useViewStore.setState({ view: fixture, status: 'ready', error: null, at: null })
    const { getByTestId, getAllByTestId } = render(<PortAnalysisTab />)
    expect(getAllByTestId('port-driver-tornado')).toHaveLength(1)
    const chart = getByTestId('port-driver-tornado')
    expect(chart.previousElementSibling).toHaveAttribute('data-testid', 'port-your-options')
    expect(chart.previousElementSibling!.previousElementSibling).toHaveAttribute('data-testid', 'port-analysis-hero')
  })

  // Build 2b: core's per-aim driver key (`rows[].driver`, core 69dc9442). The aim being shown (core's lead aim) picks the row; bound by aim id.
  describe('per-aim driver key', () => {
    const [a, b] = options
    const keyed = (shown: string) => {
      const model = structuredClone(fixture.model!)
      for (const card of model.cards) {
        card.headline = { aim_id: shown } as never
        for (const r of card.rows) if (r.kind === 'chance') {
          r.driver = r.aim_id === 'boost_productivity' ? { figure: a!.id, low: 0.1, high: 0.2 } : { figure: b!.id, low: 0.7, high: 0.9 }
        }
      }
      return model
    }
    const barOf = (container: HTMLElement, id: string) => within(container.querySelector<HTMLElement>(`[data-tornado-row="${id}"]`)!).getByTestId('port-driver-tornado-bar')

    it('DT-A1: each shown aim draws its own row\'s driver, not the other aim\'s, and its own chance tick', () => {
      for (const [shown, low, high, figure] of [['boost_productivity', 10, 20, a!.id], ['meet_launch_deadline', 70, 90, b!.id]] as const) {
        const model = keyed(shown)
        const { container } = draw(model)
        for (const card of options) {
          expect(barOf(container, card.id)).toHaveStyle({ left: `${low}%`, width: `${high - low}%` })
          const row = container.querySelector(`[data-tornado-row="${card.id}"]`)!
          expect(row.querySelector('[data-testid="port-driver-tornado-figure"]')!.getAttribute('data-view')).toBe(`${figure}.heading`)
          const own = model.cards.find((c) => c.id === card.id)!.rows.find((r) => r.kind === 'chance' && r.aim_id === shown)!
          if (own.kind === 'chance') expect(within(row as HTMLElement).getByTestId('port-driver-tornado-chance')).toHaveStyle({ left: `${trackPct(own.chance!)}%` })
        }
        cleanup()
      }
    })

    it('DT-A2: an option whose row for the shown aim has a null driver is not drawn (it is never given another aim\'s driver)', () => {
      const model = keyed('meet_launch_deadline')
      const dropped = options[0]!.id
      for (const r of model.cards.find((c) => c.id === dropped)!.rows) if (r.kind === 'chance' && r.aim_id === 'meet_launch_deadline') r.driver = null
      const { container } = draw(model)
      expect(container.querySelector(`[data-tornado-row="${dropped}"]`)).toBeNull()
      expect(container.querySelectorAll('[data-tornado-row]')).toHaveLength(options.length - 1)
    })

    it('DT-A3: a scenario saved before the key (no row carries it) still draws every card\'s one driver, as before', () => {
      const model = structuredClone(fixture.model!)
      for (const card of model.cards) { card.headline = { aim_id: 'meet_launch_deadline' } as never; for (const r of card.rows) if (r.kind === 'chance') delete (r as { driver?: unknown }).driver }
      const { container } = draw(model)
      expect([...container.querySelectorAll('[data-tornado-row]')].map((r) => r.getAttribute('data-tornado-row'))).toEqual(options.map((c) => c.id))
    })
  })
})
