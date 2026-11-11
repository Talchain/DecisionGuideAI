/**
 * Science on screen, first finding (DL S5, 11 Nov): the uncertainty shares figure by figure, under core's "How much rests on Olumi's guesses"
 * line, in the Analysis tab's Stress test. The data is the saved A6 journey View (run 20261111-journey-646657a6, PL-after-cold) with
 * `run.rests` as core's science-surface-1 (998e47bd) emits it for that same fact (the parent line and every share are byte-equal to the
 * View's). Bound by IDENTITY: each row is the figure's record id, in core's order; every word is core's string at its path.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render, screen, within } from '@testing-library/react'
import type { View } from '../../client'
import { useViewStore } from '../../store'
import { useMe } from '../../../olumiCore/me'
import { PortAnalysisTab } from '../PortAnalysisTab'
import { at } from './viewAt'

const A6: View = JSON.parse(readFileSync(path.resolve('src/olumiView/port/__tests__/fixtures/a6-rests-figures.view3.json'), 'utf8'))
const ready = (view: View) => {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false, at: null } as never)
  useMe.setState({ me: { id: view.you_id, name: view.you }, status: 'ready' })
  render(<PortAnalysisTab />)
}
afterEach(() => { cleanup(); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none' } as never); useMe.setState({ me: null, status: 'none' }) })

describe('the uncertainty shares, figure by figure', () => {
  it('RF1: under core\'s parent line (what is not attributed, always shown), one row per figure, by id, in core\'s order, each line core\'s', () => {
    ready(A6)
    const run = A6.model!.run!, r = run.rests[0]!, figures = r.figures!
    expect(figures.map((f) => f.id)).toEqual(['average_wait_for_a_repair_per_hours_week', 'current_average_wait_for_a_repair', 'average_wait_for_a_repair_per_times_as_long', 'average_wait_for_a_repair_per_hours_sunday'])
    const group = screen.getByTestId('port-stress-rests')
    // The parent line: the shares are of the variation, counting each figure on its own, and it says what no one figure carries.
    const parent = within(group).getByText(r.line)
    expect(parent).toHaveAttribute('data-view', 'run.rests.0.line')
    expect(r.line).toMatch(/counting each figure on its own; about 64% is not attributed to any one range/)
    const block = screen.getByTestId(`port-rests-figures-${r.id}`)
    expect(group).toContainElement(block)
    expect(parent.compareDocumentPosition(block) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(block).getByText(run.rests_figures_heading!)).toHaveAttribute('data-view', 'run.rests_figures_heading')
    const rows = [...block.querySelectorAll<HTMLElement>('[data-rests-figure]')]
    expect(rows.map((x) => x.dataset['restsFigure'])).toEqual(figures.map((f) => f.id))
    rows.forEach((row, j) => {
      const f = figures[j]!
      const line = row.querySelector<HTMLElement>(`[data-view="run.rests.0.figures.${j}.line"]`)!
      expect(line.textContent).toBe(f.line)
      expect(line.textContent).toBe(at(A6, `run.rests.0.figures.${j}.line`))
      expect(row.dataset['whose']).toBe(f.whose)
      expect(within(row).getByTestId('port-rests-figure-mark')).toHaveAttribute('title', f.mark!.title)
      expect(within(row).getByTestId('port-rests-figure-bar').style.width).toBe(`${f.share * 100}%`)
      // The share is a position only: never drawn as a number of the UI's own (core's "about 23%" is inside its line).
      expect(row.textContent).not.toContain(String(f.share).slice(0, 5))
    })
  })

  it('RF2: each figure core offers an edit for has the card\'s own edit, in core\'s words; no other write', () => {
    ready(A6)
    const figures = A6.model!.run!.rests[0]!.figures!
    for (const f of figures) {
      const row = document.querySelector<HTMLElement>(`[data-rests-figure="${f.id}"]`)!
      expect(f.give).not.toBeNull()
      expect(within(row).getByTestId(`rests-give-${f.id}`)).toHaveTextContent(f.give!.text)
      expect(within(row).getByTestId(`rests-edit-${f.id}`)).toHaveAttribute('title', f.give!.edit.ask)
    }
  })

  it('RF3: CONTRAST: core\'s line without figures (an older stored fact) draws the line alone, unchanged', () => {
    const run = A6.model!.run!
    const bare = { ...A6, model: { ...A6.model!, run: { ...run, rests: run.rests.map(({ figures: _f, ...r }) => r) } } } as View
    ready(bare)
    const group = screen.getByTestId('port-stress-rests')
    expect(within(group).getByText(run.rests[0]!.line)).toBeInTheDocument()
    expect(document.querySelector('[data-rests-figure]')).toBeNull()
    expect(screen.queryByText(run.rests_figures_heading!)).toBeNull()
  })
})
