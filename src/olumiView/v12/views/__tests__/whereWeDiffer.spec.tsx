/**
 * V12 "Where we differ": grouping by core's own fields, pre-reveal privacy (no differences asked, no count drawn), the one-line summary
 * only after an authorised reveal and a valid comparison, step actions to core's routes, and the Views switch.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { View } from '../../../client'
import { setPagePerson, setTeamFetch } from '../../../../olumiCore/team/api'
import { resetWrites } from '../../../../olumiCore/team/writes'
import { differencesShape, resetDifferences, type Differences } from '../../../../olumiCore/team/differences'
import { resetDrafts } from '../../../../olumiCore/team/drafts'
import { countDifferences, groupDifferences, groupOf, summaryLine } from '../differGroups'
import { WhereWeDiffer } from '../WhereWeDiffer'
import { useDifferLine } from '../SimpleSummary'
import { ViewsToggle } from '../ViewsToggle'
import { useViewsMarks } from '../viewsMarks'

const core = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/debate/differences.core.json'), 'utf8'))
const fx: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/r5/effects.view3.json'), 'utf8'))
const view = (over: Partial<View> = {}): View => ({ ...fx, gated: false, you_id: '1', ...over } as View)
const base = core.differences[0]
const figure = { ...base, status: 'changes', steps: [] }                                            // calculated: has chances
const link = { ...base, kind: 'link', record: 'link:a:b', cards: ['a', 'b'], status: 'pending', options: [], steps: [] } // not calculated
const factor = { ...base, kind: 'factor', record: 'factor:r1', cards: [], status: 'not_run', options: [], steps: [] }
const withheld = { ...base, record: 'wh', status: 'withheld', options: [], steps: [] }
const payload = (differences: unknown[]) => ({ ...core, differences })

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
afterEach(() => { cleanup(); setTeamFetch(null); setPagePerson(null); resetWrites(); resetDifferences(); resetDrafts(); useViewsMarks.setState({ on: true }) })

describe('grouping', () => {
  const data = differencesShape(payload([figure, link, factor, withheld])) as Differences
  it('puts each difference in a group by core\'s kind, status and supplied chances', () => {
    expect(groupOf(data.differences[0]!)).toBe('consequence')
    expect(groupOf(data.differences[1]!)).toBe('reasoning')
    expect(groupOf(data.differences[2]!)).toBe('question')
    expect(groupOf(data.differences[3]!)).toBe('reasoning') // not computable stays visible, never dropped
    expect(groupDifferences(data).map((g) => [g.id, g.rows.map((r) => r.record)])).toEqual([['question', ['factor:r1']], ['reasoning', ['link:a:b', 'wh']], ['consequence', ['per_specialist']]])
  })
  it('a calculated status with no chance from core is not drawn as a consequence', () => {
    const none = { ...figure, options: figure.options.map((o: { chances: unknown[] }) => ({ ...o, chances: [] })) }
    expect(groupOf(none)).toBe('reasoning')
  })
  it('counts distinct records, and says "changes the answer" only for core\'s `changes`', () => {
    const twoAims = { ...link, goal: 'other' }
    const d = differencesShape(payload([figure, link, twoAims, factor])) as Differences
    expect(countDifferences(d)).toEqual({ places: 3, changes: 1 })
    expect(summaryLine({ places: 3, changes: 1 })).toBe('3 places you differ; 1 changes which option is most likely')
    expect(summaryLine({ places: 1, changes: 0 })).toBe('1 place you differ')
    expect(summaryLine({ places: 0, changes: 0 })).toBeNull()
  })
})

describe('before a reveal', () => {
  // CHANGED BY DESIGN (overnight 18 Nov flow): the own-view entry and the reveal are the Team flow's steps 2 and 3 (teamFlow.spec); this
  // step, before a reveal, draws only core's held line and asks for nothing.
  it('asks core for no differences and draws no count or summary, only core\'s held line', async () => {
    const sent = serve(() => ({ status: 200, body: payload([figure]) }))
    const gated = view({ gated: true, collab: { ...fx.collab, shared: [], can_reveal: true, waiting: null } })
    render(<WhereWeDiffer sid="s_x" view={gated} onWrote={async () => true} />)
    expect(screen.getByTestId('team-revealed-held').textContent).toBe(gated.team_words.views.held)
    expect(screen.queryByTestId('differ-after')).toBeNull()
    expect(screen.queryByTestId('differ-summary')).toBeNull()
    expect(document.body.textContent).not.toMatch(/\d+ places? you differ/)
    await act(async () => { await Promise.resolve() })
    expect(sent.filter((s) => s.url.includes('/differences'))).toHaveLength(0)
  })
  it('the count line is nothing before a reveal, and nothing when only one person has given a view', async () => {
    serve(() => ({ status: 200, body: payload([figure]) }))
    const Line = ({ v }: { v: View }) => <>{useDifferLine('s_x', v)}</>
    const { container, rerender } = render(<Line v={view({ gated: true, collab: { ...fx.collab, shared: [] } })} />)
    expect(container.textContent).toBe('')
    rerender(<Line v={view({ collab: { ...fx.collab, shared: fx.collab.shared.slice(0, 1) } })} />)
    await act(async () => { await Promise.resolve() })
    expect(container.textContent).toBe('')
    // Contrast: two people revealed, core's read in: the line is drawn.
    rerender(<Line v={view()} />)
    await waitFor(() => expect(container.textContent).toBe('1 place you differ; 1 changes which option is most likely'))
  })
})

describe('the same mounted step across a reveal (Codex 008 P1: the Team flow keeps it mounted)', () => {
  it('gated, then not yet revealed, then revealed, on ONE mount: no hook-order error, and the revealed step draws core\'s differences', async () => {
    serve(() => ({ status: 200, body: payload([figure]) }))
    const errors: unknown[] = []
    const was = console.error
    console.error = (...a: unknown[]) => { errors.push(a[0]); }
    try {
      const { rerender } = render(<WhereWeDiffer sid="s_x" view={view({ gated: true, collab: { ...fx.collab, shared: [] } })} onWrote={async () => true} />)
      rerender(<WhereWeDiffer sid="s_x" view={view({ collab: { ...fx.collab, shared: [] } })} onWrote={async () => true} />)
      expect(screen.getByTestId('differ-later')).toBeTruthy()
      rerender(<WhereWeDiffer sid="s_x" view={view()} onWrote={async () => true} />)
      expect((await screen.findByTestId('differ-summary')).textContent).toBe('1 place you differ; 1 changes which option is most likely')
    } finally { console.error = was }
    expect(errors.filter((e) => /hooks|Rendered more hooks/i.test(String(e)))).toEqual([])
  })
})

describe('after an authorised reveal', () => {
  it('lists the groups in core\'s words with the one-line summary', async () => {
    serve(() => ({ status: 200, body: payload([figure, link, factor]) }))
    render(<WhereWeDiffer sid="s_x" view={view()} onWrote={async () => true} />)
    expect((await screen.findByTestId('differ-summary')).textContent).toBe('3 places you differ; 1 changes which option is most likely')
    expect(['question', 'reasoning', 'consequence'].map((g) => !!screen.getByTestId(`differ-group-${g}`))).toEqual([true, true, true])
    expect(screen.getByTestId('differ-row-per_specialist-capacity_goal-status').textContent).toBe(base.status_text)
    expect(document.body.textContent).not.toMatch(/\b(best|recommend|winner|should)\b/i)
  })
  it('a step posts core\'s body to core\'s route, once; commit opens the commitment form', async () => {
    const sent = serve((s) => (s.method === 'POST' ? { status: 201, body: { step: 5 } } : { status: 200, body: payload([figure]) }))
    render(<WhereWeDiffer sid="s_x" view={view()} onWrote={async () => true} />)
    fireEvent.click(await screen.findByTestId('differ-row-per_specialist-capacity_goal-research'))
    await waitFor(() => expect(sent.filter((s) => s.method === 'POST')).toHaveLength(1))
    expect(sent.find((s) => s.method === 'POST')).toMatchObject({ url: '/api/scenarios/s_x/differences/per_specialist/steps', body: { step: 'research' } })
    fireEvent.click(screen.getByTestId('differ-row-per_specialist-capacity_goal-dissent'))
    await waitFor(() => expect(sent.filter((s) => s.method === 'POST')).toHaveLength(2))
    expect(sent.filter((s) => s.method === 'POST')[1]!.body).toEqual({ step: 'dissent' })
  })
  it('a link\'s step keeps the colons in its record', async () => {
    const sent = serve((s) => (s.method === 'POST' ? { status: 201, body: { step: 6 } } : { status: 200, body: payload([{ ...link, status: 'not_run' }]) }))
    render(<WhereWeDiffer sid="s_x" view={view()} onWrote={async () => true} />)
    fireEvent.click(await screen.findByTestId('differ-row-link:a:b-capacity_goal-dissent'))
    await waitFor(() => expect(sent.some((s) => s.method === 'POST')).toBe(true))
    expect(sent.find((s) => s.method === 'POST')!.url).toBe('/api/scenarios/s_x/differences/link:a:b/steps')
  })
})

describe('views in words lead where nothing is plotted (Codex 008 #2, #4)', () => {
  it('no figure or chance from core: everyone\'s words are open, first; contrast: core plots a figure, the words fold under the chart', async () => {
    serve(() => ({ status: 200, body: payload([link]) }))
    const { unmount } = render(<WhereWeDiffer sid="s_x" view={view()} onWrote={async () => true} />)
    await screen.findByTestId('differ-row-link:a:b-capacity_goal')
    expect(screen.getByTestId('differ-views-open').contains(screen.getByTestId(`team-revealed-${fx.collab.shared[0]!.id}`))).toBe(true)
    expect(screen.queryByTestId('differ-views')).toBeNull()
    // the pending link's own status sentence leads its card at rest
    expect(screen.getByTestId('differ-row-link:a:b-capacity_goal-status').textContent).toBe(base.status_text)
    unmount(); resetDifferences()
    serve(() => ({ status: 200, body: payload([figure]) }))
    render(<WhereWeDiffer sid="s_x" view={view()} onWrote={async () => true} />)
    await screen.findByTestId('differ-row-per_specialist-capacity_goal')
    await waitFor(() => expect(screen.queryByTestId('differ-views-open')).toBeNull())
    expect(screen.getByTestId('differ-views')).toBeTruthy()
    // Crux first (Paul, 18 Nov): a plotted difference also leads with core's whole sentence, never only its short word
    expect(screen.getByTestId('differ-row-per_specialist-capacity_goal-status').textContent).toBe(figure.status_text)
    expect(screen.queryByTestId('differ-row-per_specialist-capacity_goal-mark')).toBeNull()
  })
})

describe('retaining a revealed difference, qualitative included', () => {
  const frame = (kind: string) => ({ ...base, kind, record: `frame:${kind}`, cards: [], goal: '', goal_label: '', label: `Different ${kind}`, status: 'not_run', options: [], steps: [] })
  for (const kind of ['question', 'aim', 'options']) {
    it(`frame:${kind}: Keep as a disagreement posts the step and the returned step is read back with the views still shown`, async () => {
      const row = frame(kind)
      let steps: unknown[] = []
      const sent = serve((s) => {
        if (s.method === 'POST') { steps = [{ id: 7, at: 't', by: 'Ann', by_id: '1', step: 'dissent', version: 1, text: 'Ann keeps this as a disagreement' }]; return { status: 201, body: { step: 7 } } }
        return { status: 200, body: payload([{ ...row, steps }]) }
      })
      render(<WhereWeDiffer sid="s_x" view={view()} onWrote={async () => true} />)
      const at = `differ-row-frame:${kind}`
      expect((await screen.findByTestId(`${at}-dissent`)).textContent).toBe('Keep as a disagreement')
      expect(screen.getByTestId(`${at}-research`).textContent).toBe('Agree to find out')
      fireEvent.click(screen.getByTestId(`${at}-dissent`))
      await waitFor(() => expect(screen.getByTestId(`${at}-steps`).textContent).toContain('Ann keeps this as a disagreement'))
      const post = sent.filter((s) => s.method === 'POST')
      expect(post).toHaveLength(1)
      expect(post[0]).toMatchObject({ url: `/api/scenarios/s_x/differences/frame:${kind}/steps`, body: { step: 'dissent' } })
      expect(Object.keys(post[0]!.body as object)).toEqual(['step'])
      expect(screen.getByTestId(`${at}-sides`).textContent).toContain(base.sides[0].holder)   // the original views stay visible
      expect(screen.getByTestId(`${at}-status`).textContent).toBe(base.status_text)
      expect(screen.getByTestId(`${at}-dissent`).getAttribute('aria-pressed')).toBe('true')
      expect(document.body.textContent).not.toMatch(/changes the model|updates the model/i)
    })
  }
  it('Agree to find out on an added link, still pending, posts research to the colon-kept record', async () => {
    const row = { ...link, kind: 'link_added', record: 'link_added:a:b' }
    const sent = serve((s) => (s.method === 'POST' ? { status: 201, body: { step: 8 } } : { status: 200, body: payload([row]) }))
    render(<WhereWeDiffer sid="s_x" view={view()} onWrote={async () => true} />)
    fireEvent.click(await screen.findByTestId('differ-row-link_added:a:b-capacity_goal-research'))
    await waitFor(() => expect(sent.some((s) => s.method === 'POST')).toBe(true))
    expect(sent.find((s) => s.method === 'POST')).toMatchObject({ url: '/api/scenarios/s_x/differences/link_added:a:b/steps', body: { step: 'research' } })
  })
  it('contrast: a difference not visible to this member offers no step and asks core for nothing', async () => {
    const sent = serve(() => ({ status: 200, body: payload([frame('question')]) }))
    render(<WhereWeDiffer sid="s_x" view={view({ gated: true })} onWrote={async () => true} />)
    await act(async () => { await Promise.resolve() })
    expect(screen.queryByTestId('differ-row-frame:question-dissent')).toBeNull()
    expect(screen.queryByTestId('differ-row-frame:question-research')).toBeNull()
    expect(sent.filter((s) => s.url.includes('/differences'))).toHaveLength(0)
    cleanup()
    serve(() => ({ status: 200, body: { ...payload([frame('question')]), gated: true } }))
    render(<WhereWeDiffer sid="s_x" view={view()} onWrote={async () => true} />)
    await act(async () => { await Promise.resolve() })
    expect(screen.queryByTestId('differ-row-frame:question-dissent')).toBeNull()
  })
})

describe('Views toggle', () => {
  it('is drawn only after a reveal, and flips the one marks switch', () => {
    const { rerender } = render(<ViewsToggle view={view({ gated: true, collab: { ...fx.collab, shared: [] } })} marks />)
    expect(screen.queryByTestId('views-toggle')).toBeNull()
    rerender(<ViewsToggle view={view()} marks />)
    const b = screen.getByTestId('views-toggle')
    expect(b.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(b)
    expect(useViewsMarks.getState().on).toBe(false)
    expect(screen.getByTestId('views-toggle').getAttribute('aria-pressed')).toBe('false')
  })
})

describe('the member\'s own entry stays whatever the differences do', () => {
  const revealed = () => view()   // shared views present and not gated: a reveal is authorised for this viewer
  it('is drawn while the differences are still loading', () => {
    serve(() => ({ status: 200, body: {} }))
    render(<WhereWeDiffer sid="s_x" view={revealed()} onWrote={async () => true} />)
    expect(screen.getByTestId('differ-after')).toBeTruthy()
    expect(document.querySelectorAll('[data-testid="team-views"]').length).toBeLessThanOrEqual(1)
  })
  it('is drawn when the read fails, with the failure said and no differences', async () => {
    serve(() => ({ status: 500, body: { error: 'the differences could not be read' } }))
    render(<WhereWeDiffer sid="s_x" view={revealed()} onWrote={async () => true} />)
    expect((await screen.findByTestId('differ-error')).textContent).toMatch(/could not be read/)
    expect(screen.getByTestId('differ-after')).toBeTruthy()
    expect(screen.queryByTestId('differ-empty')).toBeNull()
  })
  it('takes the group headings from core when it sends them', async () => {
    serve(() => ({ status: 200, body: { ...core, headings: { ...core.headings, groups: { framing: 'F', reasoning: 'R', consequence: 'C' } }, differences: [figure, link] } }))
    render(<WhereWeDiffer sid="s_x" view={revealed()} onWrote={async () => true} />)
    expect((await screen.findByTestId('differ-group-consequence-heading')).textContent).toBe('C')
    expect(screen.getByTestId('differ-group-reasoning-heading').textContent).toBe('R')
  })
})
