/**
 * V12 "Compare views" in the main workspace (proposal 005 "The centre: member views"; Codex 16:52Z): each revealed member's view as its own
 * column, bound by identity; core's differences with the same next steps as the dock; nothing before an authorised reveal; an obvious way back to
 * the model; never drawn twice beside the dock.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { View } from '../../../client'
import { setPagePerson, setTeamFetch } from '../../../../olumiCore/team/api'
import { resetWrites } from '../../../../olumiCore/team/writes'
import { resetDifferences } from '../../../../olumiCore/team/differences'
import { resetDrafts } from '../../../../olumiCore/team/drafts'
import { useViewStore } from '../../../store'
import { useUIStore } from '../../../../stores/uiStore'
import { useOverview } from '../../../strategy/overview/useOverview'
import { CompareViewsStage } from '../CompareViewsStage'
import { ViewsToggle } from '../ViewsToggle'
import { WhereWeDiffer, COMPARE_WORDS } from '../WhereWeDiffer'
import { useCompare } from '../useCompare'

const core = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/debate/differences.core.json'), 'utf8'))
const fx: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/r5/effects.view3.json'), 'utf8'))
const base = core.differences[0]
const figure = { ...base, status: 'changes', steps: [] }
const payload = (differences: unknown[]) => ({ ...core, differences })
// Two members, each with a whole view in words of their own (core's `frame`), distinct in every part.
const frames = {
  8: { question: 'Grow or hold this year?', aim: 'Keep the team whole', options: ['Hire two'], links: [] },
  9: { question: 'Which client first?', aim: 'Win the account', options: ['Wait a quarter'], links: [] },
} as const
const withFrames = (order: readonly (8 | 9)[] = [8, 9]): View => {
  const byId = new Map(fx.collab.shared.map((s) => [s.id, s]))
  const shared = order.map((id) => ({ ...byId.get(id)!, frame: frames[id] }))
  return { ...fx, gated: false, you_id: '1', collab: { ...fx.collab, shared } } as View
}
type Sent = { method: string; url: string; body: unknown }
function serve(answer: (s: Sent) => { status: number; body: unknown }): Sent[] {
  const sent: Sent[] = []
  setTeamFetch((async (url: string, init?: RequestInit) => {
    const s = { method: init?.method ?? 'GET', url, body: init?.body ? JSON.parse(String(init.body)) : undefined }
    sent.push(s)
    const a = answer(s)
    return new Response(JSON.stringify(a.body), { status: a.status, headers: { 'content-type': 'application/json' } })
  }) as unknown as typeof fetch)
  return sent
}
const show = (view: View) => useViewStore.setState({ sid: 's_x', view, at: null, status: 'ready', error: null, refresh: async () => true } as never)
afterEach(() => { cleanup(); setTeamFetch(null); setPagePerson(null); resetWrites(); resetDifferences(); resetDrafts(); useCompare.setState({ open: false }); useOverview.setState({ open: false }) })

describe('Compare views in the main workspace', () => {
  it('draws each person as their own column, bound by id: their name, words and whole view follow the person, never the position', async () => {
    serve(() => ({ status: 200, body: payload([figure]) }))
    for (const order of [[8, 9], [9, 8]] as const) {
      show(withFrames(order))
      useCompare.setState({ open: true })
      const { unmount } = render(<CompareViewsStage />)
      const byIdOf = (id: 8 | 9) => fx.collab.shared.find((x) => x.id === id)!
      const cols = [...screen.getByTestId('compare-members').querySelectorAll<HTMLElement>('[data-by]')]
      expect(cols.map((c) => c.dataset['by'])).toEqual(order.map((id) => byIdOf(id).by_id))
      for (const id of order) {
        const s = byIdOf(id)
        const col = screen.getByTestId(`compare-person-${s.by_id}`)
        expect(screen.getByTestId(`compare-person-${s.by_id}-name`).textContent).toBe(s.by)
        expect(col.textContent).toContain(frames[id].question)
        expect(col.textContent).not.toContain(frames[id === 8 ? 9 : 8].question)
      }
      unmount()
    }
  })
  it("one column per person: a person's several views sit together, each its own record, in core's order; none is marked current (Codex 014)", () => {
    serve(() => ({ status: 200, body: payload([]) }))
    const paul = fx.collab.shared.find((x) => x.id === 8)!, sam = fx.collab.shared.find((x) => x.id === 9)!
    const again = { ...paul, id: 12, text: 'My newer view', frame: undefined }
    show({ ...withFrames(), collab: { ...fx.collab, shared: [{ ...paul, frame: frames[8] }, { ...sam, frame: frames[9] }, again] } } as View)
    useCompare.setState({ open: true })
    render(<CompareViewsStage />)
    expect([...screen.getByTestId('compare-members').querySelectorAll<HTMLElement>('[data-by]')].map((c) => c.dataset['by'])).toEqual([paul.by_id, sam.by_id])
    const col = screen.getByTestId(`compare-person-${paul.by_id}`)
    expect([...col.querySelectorAll('[data-testid^="compare-view-"][data-testid$="-words"]')].map((e) => e.textContent)).toEqual([paul.text.trim(), 'My newer view'].filter((x) => x !== ''))
    expect(col.textContent).toContain(frames[8].question)
    expect(col.textContent).not.toMatch(/\b(Earlier|Latest|Current)\b/)
  })
  it('shows core\'s differences with the same next steps as the dock; a step posts to core\'s route and Commit brings the Team tab', async () => {
    const sent = serve((s) => (s.method === 'POST' ? { status: 201, body: { step: 5 } } : { status: 200, body: payload([figure]) }))
    show(withFrames())
    useCompare.setState({ open: true })
    render(<CompareViewsStage />)
    const at = 'differ-row-per_specialist-capacity_goal'
    expect((await screen.findByTestId(`${at}-dissent`)).textContent).toBe('Keep as a disagreement')
    expect(screen.getByTestId(`${at}-research`).textContent).toBe('Agree to find out')
    fireEvent.click(screen.getByTestId(`${at}-research`))
    await waitFor(() => expect(sent.filter((s) => s.method === 'POST')).toHaveLength(1))
    expect(sent.find((s) => s.method === 'POST')).toMatchObject({ url: '/api/scenarios/s_x/differences/per_specialist/steps', body: { step: 'research' } })
    useUIStore.setState({ activeOutputTab: 'olumi' } as never)
    fireEvent.click(screen.getByTestId(`${at}-commit`))
    expect(useUIStore.getState().activeOutputTab).toBe('team')
    expect(document.body.textContent).not.toMatch(/\b(best|recommend|winner|should)\b/i)
  })
  it('draws nothing and asks core for nothing before an authorised reveal, and closes itself; contrast: revealed, it draws the other member', async () => {
    const sent = serve(() => ({ status: 200, body: payload([figure]) }))
    show({ ...withFrames(), gated: true, collab: { ...fx.collab, shared: [] } } as View)
    useCompare.setState({ open: true })
    const { container, rerender } = render(<CompareViewsStage />)
    expect(container.textContent).toBe('')
    await waitFor(() => expect(useCompare.getState().open).toBe(false))
    expect(sent).toHaveLength(0)
    show(withFrames())
    act(() => { useCompare.getState().show() })
    rerender(<CompareViewsStage />)
    expect(screen.getByTestId(`compare-person-${fx.collab.shared.find((x) => x.id === 9)!.by_id}`).textContent).toContain(frames[9].question)
    await waitFor(() => expect(sent.length).toBeGreaterThan(0))
  })
  it('returns to the model: the Back button and Esc close it; an Esc inside a menu does not', () => {
    serve(() => ({ status: 200, body: payload([]) }))
    show(withFrames())
    useCompare.setState({ open: true })
    render(<><div role="menu"><button type="button" data-testid="in-menu">m</button></div><CompareViewsStage /></>)
    fireEvent.keyDown(screen.getByTestId('in-menu'), { key: 'Escape' })
    expect(useCompare.getState().open).toBe(true)
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(useCompare.getState().open).toBe(false)
    act(() => { useCompare.getState().show() })
    fireEvent.click(screen.getByTestId('compare-back'))
    expect([useCompare.getState().open, screen.queryByTestId('compare-stage')]).toEqual([false, null])
  })
  it('"Show it on the canvas" on a row returns to the model first', async () => {
    serve(() => ({ status: 200, body: payload([{ ...figure, cards: ['per_specialist'] }]) }))
    show(withFrames())
    useCompare.setState({ open: true })
    render(<CompareViewsStage />)
    fireEvent.click(await screen.findByTestId('differ-row-per_specialist-capacity_goal-focus'))
    expect(useCompare.getState().open).toBe(false)
  })
  it('a past version open holds every step (the fieldset), as in the dock', async () => {
    serve(() => ({ status: 200, body: payload([figure]) }))
    show(withFrames())
    useViewStore.setState({ at: 2 } as never)
    useCompare.setState({ open: true })
    render(<CompareViewsStage />)
    expect(((await screen.findByTestId('differ-row-per_specialist-capacity_goal-dissent')).closest('fieldset') as HTMLFieldSetElement).disabled).toBe(true)
  })
})

describe('one comparison at a time, never drawn twice', () => {
  it('the canvas control opens and closes it, beside the marks switch; drawn only after a reveal', () => {
    const { rerender } = render(<ViewsToggle view={{ ...withFrames(), gated: true, collab: { ...fx.collab, shared: [] } } as View} />)
    expect(screen.queryByTestId('views-compare')).toBeNull()
    rerender(<ViewsToggle view={withFrames()} />)
    expect([screen.getByTestId('views-compare').textContent, screen.getByTestId('views-compare').getAttribute('aria-pressed')]).toEqual([COMPARE_WORDS.control, 'false'])
    fireEvent.click(screen.getByTestId('views-compare'))
    expect(useCompare.getState().open).toBe(true)
    expect(screen.getByTestId('views-toggle')).toBeTruthy()
  })
  it('opening it closes the Strategy Overview', () => {
    useOverview.setState({ open: true })
    useCompare.getState().show()
    expect([useCompare.getState().open, useOverview.getState().open]).toEqual([true, false])
  })
  it('while it is open the dock draws a pointer and the way back, not a second copy of the rows and frames', async () => {
    serve(() => ({ status: 200, body: payload([figure]) }))
    show(withFrames())
    render(<><WhereWeDiffer sid="s_x" view={withFrames()} onWrote={async () => true} /></>)
    expect(await screen.findByTestId('differ-row-per_specialist-capacity_goal')).toBeTruthy()
    expect(screen.getByTestId('differ-open-centre').textContent).toBe(COMPARE_WORDS.open)
    fireEvent.click(screen.getByTestId('differ-open-centre'))
    render(<CompareViewsStage />)
    await screen.findByTestId('compare-stage')
    expect(await screen.findAllByTestId('differ-row-per_specialist-capacity_goal')).toHaveLength(1)
    expect(screen.getByTestId('differ-in-centre').textContent).toContain(COMPARE_WORDS.back)
    fireEvent.click(screen.getByTestId('differ-back-to-model'))
    expect(useCompare.getState().open).toBe(false)
  })
})
