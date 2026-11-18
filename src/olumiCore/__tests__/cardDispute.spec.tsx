/**
 * A revealed difference is marked on the card it is about, and its details say each person's figure, each person's chance and whether it
 * changes the finding, in core's words (experience review 18 Nov, change 5). Fixtures are core's own output (see cardDiffers.spec.tsx): the
 * View Cara reads and core's GET …/differences for her; the figure Priya and Tom differ on is `diagnostic_time_to_contract`.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { View } from '../../olumiView/client'
import { useViewStore } from '../../olumiView/store'
import { ToastProvider } from '../../canvas/ToastContext'
import { LaneInspector } from '../../olumiView/v12/edit/LaneInspector'
import { useLaneInspector } from '../../olumiView/v12/edit/inspectorStore'
import { CardDisputeMark } from '../team/CardDispute'
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'
import { CoreCard } from '../../olumiView/previous/CoreCard'
import { setLevel, useSimpleLevel } from '../../olumiView/v12/simpleStore'
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
afterEach(() => { cleanup(); setTeamFetch(null); resetDifferences(); vi.unstubAllEnvs(); useLaneInspector.setState({ current: null, peek: null }); delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView; vi.restoreAllMocks() })

const details = (card: string) => {
  useLaneInspector.getState().open({ kind: 'card', id: card })
  return render(<ToastProvider><LaneInspector /></ToastProvider>)
}

/** A card drawn as the lane draws it (CoreCard through BaseNode), at the level the spec sets. */
const drawCard = (id: string) => {
  const card = view.model!.cards.find((c) => c.id === id)!
  const Node = CoreCard as unknown as (p: NodeProps) => JSX.Element
  return render(<ReactFlowProvider><Node {...({ id, type: 'viewCard', data: { card, label: card.heading }, selected: false, dragging: false, zIndex: 0, isConnectable: false,
    positionAbsoluteX: 0, positionAbsoluteY: 0, selectable: true, deletable: false, draggable: false } as unknown as NodeProps)} /></ReactFlowProvider>).container
}

describe('a revealed difference on the card it is about', () => {
  it('at Simple (the default level) the record card\'s face carries the difference mark, named with core\'s sentence; CONTRAST: a card that is no difference\'s record has none', async () => {
    setLevel('simple', view.id)
    try {
      const mine = drawCard(CARD)
      expect(mine.querySelector(`[data-core-card="${CARD}"]`), 'precondition: the Simple face is drawn').not.toBeNull()
      const mark = await waitFor(() => { const m = mine.querySelector(`[data-core-card="${CARD}"] [data-differ-mark="${CARD}"]`); expect(m).not.toBeNull(); return m as HTMLElement })
      expect(mark.getAttribute('aria-label')).toBe(figure.status_text)
      cleanup()
      const theirs = drawCard(other)
      await waitFor(() => expect(theirs.querySelector(`[data-core-card="${other}"]`)).not.toBeNull())
      expect(theirs.querySelector('[data-differ-mark]')).toBeNull()
    } finally { useSimpleLevel.setState({ levels: {} }); try { window.localStorage.removeItem(`olumi.v12.level.${view.id}`) } catch { /* none */ } }
  })

  it('the record card carries one mark named and hovered with core\'s sentence; pressing it opens that card\'s details', async () => {
    const c = render(<CardDisputeMark card={CARD} />)
    const mark = await waitFor(() => { const m = c.container.querySelector(`[data-differ-mark="${CARD}"]`); expect(m).not.toBeNull(); return m as HTMLElement })
    expect(figure.status_text.length).toBeGreaterThan(20)
    expect(mark.getAttribute('aria-label')).toBe(figure.status_text)
    expect(mark.getAttribute('title')).toBe(figure.status_text)
    fireEvent.click(mark)
    expect(useLaneInspector.getState().current).toMatchObject({ kind: 'details', target: { kind: 'card', id: CARD }, section: 'differ' })
  })

  it('surfaces step A: opened from the mark, "Where you differ" is drawn open; opened by a press on the card it is a closed fold whose line is core\'s sentence; previewed, it is that one sentence and nothing to open', async () => {
    const m = render(<CardDisputeMark card={CARD} />)
    fireEvent.click(await waitFor(() => { const b = m.container.querySelector(`[data-differ-mark="${CARD}"]`); expect(b).not.toBeNull(); return b as HTMLElement }))
    const brought: Element[] = []
    Element.prototype.scrollIntoView = function (this: Element) { brought.push(this) } as never
    render(<ToastProvider><LaneInspector /></ToastProvider>)
    const fromMark = await screen.findByTestId('lane-differ')
    expect(fromMark.tagName).toBe('DETAILS')
    expect((fromMark as HTMLDetailsElement).open, 'from the mark: open').toBe(true)
    await waitFor(() => expect(brought, 'and brought into view in the box (it sits below the Value row)').toContain(fromMark))
    cleanup(); useLaneInspector.setState({ current: null }); brought.length = 0
    details(CARD)
    const plain = await screen.findByTestId('lane-differ')
    expect((plain as HTMLDetailsElement).open, 'CONTRAST, from a press on the card: folded').toBe(false)
    await new Promise((r) => setTimeout(r, 30))
    expect(brought, 'CONTRAST: a press on the card moves nothing').not.toContain(plain)
    expect(plain.querySelector('summary [data-differ-status-text]')?.textContent, 'the fold\'s own line is core\'s sentence').toBe(figure.status_text)
    // Closed, that line is two lines at most; its OWN details open (never an outer one) shows it whole.
    expect(plain.querySelector('summary [data-differ-status-text]')?.className).toContain('line-clamp-2 [details[open]>summary>&]:line-clamp-none')
    // Core's sentence runs to many lines: the chevron and the mark stay on its first line (seen on the built page at its middle, 140 px down).
    expect(plain.querySelector('summary')!.className.split(/\s+/).filter((c) => c.startsWith('items-'))).toEqual(['items-start'])
    cleanup(); useLaneInspector.setState({ current: null, peek: { kind: 'card', id: CARD } })
    render(<ToastProvider><LaneInspector /></ToastProvider>)
    const line = await screen.findByTestId('lane-differ-line')
    expect(line.textContent).toBe(figure.status_text)
    expect(screen.queryByTestId('lane-differ'), 'a preview has nothing to open').toBeNull()
    expect(document.querySelector('[data-testid="lane-peek"] [data-differ-side], [data-testid="lane-peek"] [data-differ-chance]')).toBeNull()
  })

  it('surfaces step A: opened from the mark, a second press on the same card keeps "Where you differ" open (the section is not shut under the reader); CONTRAST another card\'s details start with no section', async () => {
    useLaneInspector.getState().show({ kind: 'details', target: { kind: 'card', id: CARD }, section: 'differ' })
    render(<ToastProvider><LaneInspector /></ToastProvider>)
    expect(((await screen.findByTestId('lane-differ')) as HTMLDetailsElement).open).toBe(true)
    act(() => { useLaneInspector.getState().open({ kind: 'card', id: CARD }) })
    expect((screen.getByTestId('lane-differ') as HTMLDetailsElement).open, 'pressed again: still open').toBe(true)
    act(() => { useLaneInspector.getState().open({ kind: 'card', id: other }) })
    expect((useLaneInspector.getState().current as { section?: string }).section, 'CONTRAST: another card').toBeUndefined()
  })

  it('surfaces step A: where it sits in the box: after the value and before "Where this comes from" and the actions', async () => {
    details(CARD)
    const differ = await screen.findByTestId('lane-differ')
    const follows = (a: Element, b: Element | null) => b !== null && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
    expect(follows(screen.getByTestId('lane-inspector-value'), differ)).toBe(true)
    expect(follows(differ, screen.getByTestId('lane-inspector-actions'))).toBe(true)
    const from = screen.queryByTestId('lane-inspector-from')
    if (view.model!.cards.find((c) => c.id === CARD)!.detail !== '') expect(follows(differ, from), 'before the fold').toBe(true)
  })

  it('surfaces step A: a card with two differences (two aims) says each of core\'s sentences ONCE, under its aim; the fold\'s own line is then the fixed label, not the sentences again', async () => {
    const second = { ...structuredClone(figure), goal: `${figure.goal}_2`, goal_label: 'A second aim', status_text: 'Core\'s own sentence for the second aim.' }
    const two = { ...structuredClone(core), differences: [...core.differences, second] } as Differences
    serve(two)
    details(CARD)
    const section = await screen.findByTestId('lane-differ')
    expect(section.querySelectorAll('[data-differ-entry]').length, 'precondition: two entries').toBe(2)
    for (const said of [figure.status_text, second.status_text]) expect(section.textContent!.split(said).length - 1, said).toBe(1)
    expect(section.querySelector('summary')!.textContent).toBe('Where you differ')
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
