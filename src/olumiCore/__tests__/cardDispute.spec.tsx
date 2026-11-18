/**
 * A revealed difference is marked on the card it is about, and its details say each person's figure, each person's chance and whether it
 * changes the finding, in core's words (experience review 18 Nov, change 5). Fixtures are core's own output (see cardDiffers.spec.tsx): the
 * View Cara reads and core's GET …/differences for her; the figure Priya and Tom differ on is `diagnostic_time_to_contract`.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { View } from '../../olumiView/client'
import { useViewStore } from '../../olumiView/store'
import { ToastProvider } from '../../canvas/ToastContext'
import { LaneInspector } from '../../olumiView/v12/edit/LaneInspector'
import { useLaneInspector } from '../../olumiView/v12/edit/inspectorStore'
import { CardDisputeMark } from '../team/CardDispute'
import { setTeamFetch } from '../team/api'
import { resetDifferences, type Differences } from '../team/differences'

const FX = path.resolve('src/olumiView/fixtures/debate')
const view: View = JSON.parse(readFileSync(path.join(FX, 'tm04-cara.view3.json'), 'utf8'))
const core: Differences = JSON.parse(readFileSync(path.join(FX, 'tm04-differences.core.json'), 'utf8'))
const figure = core.differences.find((d) => (d.kind ?? 'figure') === 'figure')!
const CARD = figure.record
const linkEnd = core.differences.find((d) => d.kind === 'link')!.cards![0]!
const other = view.model!.cards.find((c) => c.id !== CARD && !core.differences.some((d) => (d.cards ?? []).includes(c.id)))!.id

const serve = (answer: Differences) => setTeamFetch((async (url: string) =>
  String(url).endsWith('/differences') ? new Response(JSON.stringify(answer), { status: 200, headers: { 'content-type': 'application/json' } })
    : new Response(JSON.stringify({ error: 'not here' }), { status: 404, headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch)

beforeEach(() => {
  vi.stubEnv('VITE_OLUMI_CORE', '1')
  serve(core)
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000000', sid: view.id, view, status: 'ready', error: null, stale: false, at: null })
})
afterEach(() => { cleanup(); setTeamFetch(null); resetDifferences(); vi.unstubAllEnvs(); useLaneInspector.setState({ current: null }); vi.restoreAllMocks() })

const details = (card: string) => {
  useLaneInspector.getState().open({ kind: 'card', id: card })
  return render(<ToastProvider><LaneInspector /></ToastProvider>)
}

describe('a revealed difference on the card it is about', () => {
  it('the record card carries one mark named and hovered with core\'s sentence; pressing it opens that card\'s details', async () => {
    const c = render(<CardDisputeMark card={CARD} />)
    const mark = await waitFor(() => { const m = c.container.querySelector(`[data-differ-mark="${CARD}"]`); expect(m).not.toBeNull(); return m as HTMLElement })
    expect(figure.status_text.length).toBeGreaterThan(20)
    expect(mark.getAttribute('aria-label')).toBe(figure.status_text)
    expect(mark.getAttribute('title')).toBe(figure.status_text)
    fireEvent.click(mark)
    expect(useLaneInspector.getState().current).toMatchObject({ kind: 'details', target: { kind: 'card', id: CARD } })
  })

  it('CONTRAST: a card that is no difference\'s record has no mark (nor does the end of a doubted link)', async () => {
    const c = render(<><CardDisputeMark card={CARD} /><CardDisputeMark card={other} /><CardDisputeMark card={linkEnd} /></>)
    await waitFor(() => expect(c.container.querySelector(`[data-differ-mark="${CARD}"]`)).not.toBeNull())
    expect(c.container.querySelectorAll('[data-differ-mark]').length).toBe(1)
    expect(c.container.querySelector(`[data-differ-mark="${other}"], [data-differ-mark="${linkEnd}"]`)).toBeNull()
  })

  it('the details say each side\'s figure and each holder\'s chance for each option, verbatim, then core\'s sentence', async () => {
    details(CARD)
    const section = await screen.findByTestId('lane-differ')
    expect(section.querySelector('[data-differ-status-text]')?.textContent).toBe(figure.status_text)
    expect([...section.querySelectorAll('[data-differ-side]')].map((e) => e.textContent)).toEqual(figure.sides.map((s) => s.text))
    for (const o of figure.options) {
      const row = section.querySelector(`[data-differ-option="${o.option}"]`)!
      expect(row.querySelector('p')?.textContent).toBe(o.label)
      for (const ch of o.chances) {
        const li = row.querySelector(`[data-differ-chance="${ch.holder_id}"]`)!
        expect(li.querySelector('[data-differ-chance-text]')?.textContent).toBe(ch.text)
        expect(li.textContent).toBe(`${figure.sides.find((s) => s.holder_id === ch.holder_id)!.holder}: ${ch.text}`)
      }
    }
    expect([...section.querySelectorAll('[data-differ-settle] li')].map((e) => e.textContent)).toEqual(figure.settle.map((s) => s.text))
  })

  it('a card that is not a difference\'s record has no "Where you differ" in its details', async () => {
    details(other)
    await screen.findByTestId('lane-inspector')
    await new Promise((r) => setTimeout(r, 30))
    expect(screen.queryByTestId('lane-differ')).toBeNull()
  })

  it('not_run says core\'s sentence alone: no figure and no chance is drawn', async () => {
    const said = 'Olumi has not run this difference yet: core\'s own sentence.'
    const notRun = structuredClone(core)
    const f = notRun.differences.find((d) => d.record === CARD)! as { status: string; status_text: string }
    f.status = 'not_run'; f.status_text = said
    serve(notRun)
    details(CARD)
    const section = await screen.findByTestId('lane-differ')
    expect(section.querySelector('[data-differ-status-text]')?.textContent).toBe(said)
    expect(section.querySelector('[data-differ-chance], [data-differ-side], [data-differ-settle]')).toBeNull()
    for (const o of figure.options) for (const ch of o.chances) expect(section.textContent).not.toContain(ch.text)
    expect(section.textContent).not.toContain(figure.sides[0]!.text)
  })

  it('PRIVATE UNTIL REVEALED: before two views are shown, or while gated, neither the mark nor "Where you differ" is drawn (contrast: the revealed View draws both)', async () => {
    for (const v of [{ ...view, collab: { ...view.collab, shared: view.collab.shared.slice(0, 1) } }, { ...view, gated: true }] as View[]) {
      useViewStore.setState({ view: v })
      const m = render(<CardDisputeMark card={CARD} />)
      await new Promise((r) => setTimeout(r, 30))
      expect(m.container.querySelector('button')).toBeNull()
      m.unmount()
      const d = details(CARD)
      await new Promise((r) => setTimeout(r, 30))
      expect(screen.queryByTestId('lane-differ')).toBeNull()
      d.unmount(); cleanup(); resetDifferences(); useLaneInspector.setState({ current: null })
    }
    useViewStore.setState({ view })
    details(CARD)
    expect(await screen.findByTestId('lane-differ')).toBeInTheDocument()
  })
})
