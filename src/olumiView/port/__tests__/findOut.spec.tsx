/**
 * UI-9 (DL 11 Nov): what is worth finding out (`model.run.find_out`, science surface 4, SCI-8) drawn in the Analysis tab's existing worth
 * surface, "Strengthen your model". Bound by identity: each aim by its id, each figure by its record id and the Run's fact, each word at
 * its View path. The real path: core's own `viewOf` (olumi-core fd6728401c25c53ff9b7b9ea512168e8910dcdbc) over the saved LOOP-8 workshop
 * Full (core's fixture `src/view/__tests__/fixtures/loop8-20261111-workshop-ec692296.full.json`, the pending first model as the server
 * returned it), copied unedited as `fixtures/ui9-loop8-find-out.view3.json`. Nothing is run. The bakery golden carries the give control.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import type { View } from '../../client'
import { useViewStore } from '../../store'
import { useMe } from '../../../olumiCore/me'
import { PortAnalysisTab } from '../PortAnalysisTab'
import { Strengthen } from '../Strengthen'
import { viewOf } from './viewAt'

const ready = (view: View) => {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false, at: null } as never)
  useMe.setState({ me: { id: view.you_id, name: view.you }, status: 'ready' })
  render(<PortAnalysisTab />)
}
afterEach(() => { cleanup(); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none' } as never); useMe.setState({ me: null, status: 'none' }) })
const at = (p: string) => [...document.querySelectorAll<HTMLElement>(`[data-view="${p}"]`)]

describe('Worth finding out, on the saved LOOP-8 workshop model (core\'s own read)', () => {
  const view = viewOf('core/ui9-loop8-find-out'), run = view.model!.run!, aims = run.find_out!

  it('FO0 control: the fixture carries the field, one aim with four figures, and the science line for its first figure', () => {
    expect(aims.map((a) => [a.aim, a.figures.map((f) => f.fact)])).toEqual([['average_repair_wait_under_5_days_by_end_of_march', ['F27', 'F28', 'F26', 'F25']]])
    expect(run.science.map((l) => l.id)).toEqual(['F27'])
  })

  it('FO1: on the lane\'s Analysis tab, Strengthen draws core\'s heading, the aim\'s line and each figure\'s line, verbatim, in core\'s order', () => {
    ready(view)
    const box = within(screen.getByTestId('port-strengthen')).getByTestId('port-find-out')
    expect(at('run.find_out_heading').map((e) => e.textContent)).toEqual([run.find_out_heading])
    const aim = box.querySelector<HTMLElement>(`[data-find-out-aim="${aims[0]!.aim}"]`)!
    expect(within(aim).getByText(aims[0]!.line)).toHaveAttribute('data-view', 'run.find_out.0.line')
    expect([...aim.querySelectorAll('[data-find-out-figure]')].map((e) => [e.getAttribute('data-find-out-figure'), e.getAttribute('data-view-fact')]))
      .toEqual(aims[0]!.figures.map((f) => [f.id, f.fact]))
    // Core's order (the Run's estimate, largest first), pinned to the facts themselves so no reordering of the fixture can hide a reorder.
    expect([...aim.querySelectorAll('[data-find-out-figure]')].map((e) => e.getAttribute('data-view-fact'))).toEqual(['F27', 'F28', 'F26', 'F25'])
    aims[0]!.figures.forEach((f, k) => {
      expect(at(`run.find_out.0.figures.${k}.line`).map((e) => e.textContent)).toEqual([f.line])
      expect(at(`run.find_out.0.figures.${k}.mark.glyph`).map((e) => e.getAttribute('title'))).toEqual(f.mark ? [f.mark.title] : [])
      const li = aim.querySelector<HTMLElement>(`[data-find-out-figure="${f.id}"]`)!
      expect(li).toHaveAttribute('data-find-out-whose', f.whose)
      // The Run's estimate only on hover; its points never.
      expect(li.querySelector('p')).toHaveAttribute('title', f.estimate_text)
      expect(li.textContent).not.toContain(f.estimate_text)
      expect(li.textContent).not.toContain(String(f.points))
    })
  })

  it('FO2: the figure the science line names is said once: no worth row for F27 while it is drawn under Worth finding out', () => {
    ready(view)
    const section = screen.getByTestId('port-strengthen')
    expect(section.querySelector('[data-testid="focus-card"][data-row-id="worth:F27"]')).toBeNull()
    expect(section.querySelectorAll('[data-view-fact="F27"]')).toHaveLength(1)
  })

  it('FO3 contrast: the same model without the field draws the science line as its row, and no Worth finding out', () => {
    const run2 = { ...run } as Record<string, unknown>
    delete run2.find_out; delete run2.find_out_heading
    render(<Strengthen model={{ ...view.model!, run: run2 as never }} />)
    const section = screen.getByTestId('port-strengthen')
    expect(section.querySelector('[data-testid="focus-card"][data-row-id="worth:F27"]')).not.toBeNull()
    expect(screen.queryByTestId('port-find-out')).toBeNull()
    expect(section.textContent).not.toContain('Worth finding out')
  })
})

describe('the give control, where core offers one (bakery golden)', () => {
  it('FO4: each figure with a give draws core\'s give words in its own slot, by its id', () => {
    const view = viewOf('golden/bakery'), aims = view.model!.run!.find_out!
    ready(view)
    for (const f of aims.flatMap((a) => a.figures)) {
      const slot = document.querySelector<HTMLElement>(`[data-find-out-give="${f.id}"]`)
      if (f.give === null) { expect(slot).toBeNull(); continue }
      expect(slot).toHaveTextContent(f.give.text)
    }
    expect(aims.flatMap((a) => a.figures).filter((f) => f.give !== null).length).toBeGreaterThan(0)
  })
})
