/**
 * V12 "My whole view, in words": the additive frame on the private view (request shape, silence, caps, the current version), its draw from
 * core's View exactly as given (`frame`, `frame_words`), privacy before a reveal, and core's group for text-only differences.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { useViewStore } from '../../../store'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { View } from '../../../client'
import { setPagePerson, setTeamFetch } from '../../../../olumiCore/team/api'
import { resetWrites } from '../../../../olumiCore/team/writes'
import { differencesShape, resetDifferences, type Differences } from '../../../../olumiCore/team/differences'
import { putDraft, resetDrafts } from '../../../../olumiCore/team/drafts'
import { groupDifferences, groupOf, countDifferences } from '../differGroups'
import { frameBody, frameOf, frameWordsOf, EMPTY_FRAME } from '../frame'
import { FrameEntry, MyFrames, NOT_KEPT } from '../FrameEntry'
import { frameSupport } from '../frame'
import { WhereWeDiffer } from '../WhereWeDiffer'

const core = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/debate/differences.core.json'), 'utf8'))
const fx: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/r5/effects.view3.json'), 'utf8'))
const limits = { question: 300, aim: 300, option: 120, options: 5, link_words: 200, links: 5 }
const fw = { heading: 'My whole view', question: 'Q', aim: 'A', options: 'O', links: 'L', not_expressed: 'Not said', note: 'Core runs none of this.', limits }
// A core that reads a frame sends `collab.frame_words` (API v1.41); the base View carries it.
const view = (over: Partial<View> = {}): View => ({ ...fx, gated: false, you_id: '1', collab: { ...fx.collab, frame_words: fw }, ...over } as View)
const base = core.differences[0]
const textOnly = (kind: string, group: string, record: string) => ({ ...base, kind, group, record, goal: '', goal_label: '', status: 'not_run', status_text: 'These are different words, not a calculated difference. Olumi has not run them.', options: [], settle: [], steps: [],
  sides: [{ view: 8, holder: 'Ada', holder_id: '1', figure: 'Hold the line on price', title: '', leader: null, text: '' }, { view: 9, holder: 'Bea', holder_id: '2', figure: 'Win the account', title: '', leader: null, text: '' }] })
const frame = { question: 'Should we grow or hold?', aim: 'Keep the team whole', options: ['Hire two', 'Wait a quarter'], links: [{ from_label: 'Hiring', to_label: 'Morale', words: 'Hiring lifts morale' }] }
const words = { question: 'Their question', aim: 'Their aim', options: 'Their options', links: 'Their links' }

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
afterEach(() => { cleanup(); setTeamFetch(null); setPagePerson(null); resetWrites(); resetDifferences(); resetDrafts() })

describe('the frame request', () => {
  it('leaves silence out, trims, and caps options at 5 and links at 5', () => {
    expect(frameBody(EMPTY_FRAME)).toBeNull()
    expect(frameBody({ question: '  ', aim: ' Aim ', options: ['', ' a ', 'b', 'c', 'd', 'e', 'f'], links: [{ from_label: 'x', to_label: '', words: 'w' }, { from_label: 'x', to_label: 'y', words: ' w ' }] }))
      .toEqual({ aim: 'Aim', options: ['a', 'b', 'c', 'd', 'e'], links: [{ from_label: 'x', to_label: 'y', words: 'w' }] })
  })
  it('typing keeps the same field and its focus: no field is remounted between keystrokes (Codex UI chat, 16 Nov)', () => {
    render(<FrameEntry sid="s_x" view={view()} onWrote={async () => true} />)
    fireEvent.click(screen.getByTestId('frame-open'))
    for (const id of ['frame-text', 'frame-question', 'frame-aim']) {
      const first = screen.getByTestId(id) as HTMLTextAreaElement
      first.focus()
      fireEvent.change(first, { target: { value: 'G' } })
      fireEvent.change(screen.getByTestId(id), { target: { value: 'Gr' } })
      expect(screen.getByTestId(id), id).toBe(first)
      expect(document.activeElement, id).toBe(first)
    }
  })
  it('J3: words written against version 1 are never sent as a view of version 2; they are kept, the change is said, and only an explicit move sends them', async () => {
    const all = serve(() => ({ status: 201, body: { contribution: 4 } }))
    const v1 = view(), v2 = view({ version: { ...(fx as View).version!, n: 2 } } as Partial<View>)
    const { rerender } = render(<FrameEntry sid="s_x" view={v1} onWrote={async () => true} />)
    fireEvent.click(screen.getByTestId('frame-open'))
    fireEvent.change(screen.getByTestId('frame-text'), { target: { value: 'My view' } })
    fireEvent.change(screen.getByTestId('frame-question'), { target: { value: 'Grow or hold?' } })
    rerender(<FrameEntry sid="s_x" view={v2} onWrote={async () => true} />)
    expect(screen.getByTestId('frame-stale-base').textContent).toContain('version 1')
    expect((screen.getByTestId('frame-give') as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByTestId('frame-text') as HTMLTextAreaElement).value).toBe('My view')
    expect(all.filter((x) => x.method === 'POST')).toHaveLength(0)
    fireEvent.click(screen.getByTestId('frame-use-current'))
    expect(screen.queryByTestId('frame-stale-base')).toBeNull()
    fireEvent.click(screen.getByTestId('frame-give'))
    await waitFor(() => expect(all.filter((x) => x.method === 'POST')).toHaveLength(1))
    expect(all.find((x) => x.method === 'POST')!.body).toMatchObject({ version: 2 })
  })
  it("J3 from the first keystroke anywhere: an answer to Olumi's question typed first, against version 1, is never sent as a view of version 2 (Codex 16:48Z)", () => {
    serve(() => ({ status: 201, body: { contribution: 4 } }))
    const ask = (n: number) => view({ version: { ...(fx as View).version!, n }, collab: { ...fx.collab, frame_words: fw, private_view_prompt: 'What would change your mind?' } } as Partial<View>)
    const { rerender } = render(<FrameEntry sid="s_x" view={ask(1)} onWrote={async () => true} />)
    fireEvent.click(screen.getByTestId('frame-open'))
    fireEvent.change(screen.getByTestId('frame-olumi-ask'), { target: { value: 'A competitor cutting prices' } })
    rerender(<FrameEntry sid="s_x" view={ask(2)} onWrote={async () => true} />)
    fireEvent.change(screen.getByTestId('frame-question'), { target: { value: 'Grow or hold?' } })
    expect(screen.getByTestId('frame-stale-base').textContent).toContain('version 1')
    expect((screen.getByTestId('frame-give') as HTMLButtonElement).disabled).toBe(true)
  })
  it('finding 15: an option row copied from the shared titles and never typed in is never sent as this member\'s own, even after the shared title is renamed', async () => {
    const all = serve(() => ({ status: 201, body: { contribution: 4 } }))
    const v1 = view()
    const v2 = { ...v1, version: { ...v1.version!, n: 2 }, model: { ...v1.model!, cards: v1.model!.cards.map((c) => (c.family === 'option' ? { ...c, heading: `${c.heading} (renamed)` } : c)) } } as View
    const { rerender } = render(<FrameEntry sid="s_x" view={v1} onWrote={async () => true} />)
    fireEvent.click(screen.getByTestId('frame-open'))
    fireEvent.change(screen.getByTestId('frame-text'), { target: { value: 'My view' } })
    fireEvent.change(screen.getByTestId('frame-question'), { target: { value: 'Grow or hold?' } })
    rerender(<FrameEntry sid="s_x" view={v2} onWrote={async () => true} />)
    fireEvent.click(screen.getByTestId('frame-use-current'))
    fireEvent.click(screen.getByTestId('frame-give'))
    await waitFor(() => expect(all.filter((x) => x.method === 'POST')).toHaveLength(1))
    const body = all.find((x) => x.method === 'POST')!.body as { version: number; frame: { options?: string[] } }
    expect(body.version).toBe(2)
    expect(body.frame.options ?? []).toEqual([])
  })
  it('finding 15: a draft with words but no recorded version is never bound to the latest silently; it asks for review first', () => {
    putDraft<string>('s_x:viewframe:text', () => 'Words from before')
    serve(() => ({ status: 201, body: { contribution: 4 } }))
    render(<FrameEntry sid="s_x" view={view()} onWrote={async () => true} />)
    fireEvent.click(screen.getByTestId('frame-open'))
    expect(screen.getByTestId('frame-stale-base').textContent).toContain('before Olumi recorded which version')
    expect((screen.getByTestId('frame-give') as HTMLButtonElement).disabled).toBe(true)
  })
  it('posts text, the current version and only the parts said, on the existing views route, with an op', async () => {
    const all = serve(() => ({ status: 201, body: { contribution: 4 } }))
    const sent = { get length() { return all.filter((x) => x.method === 'POST').length }, 0: undefined as unknown as Sent }
    render(<FrameEntry sid="s_x" view={view()} onWrote={async () => true} />)
    fireEvent.click(screen.getByTestId('frame-open'))
    expect((screen.getByTestId('frame-give') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByTestId('frame-text'), { target: { value: 'My view' } })
    expect((screen.getByTestId('frame-give') as HTMLButtonElement).disabled).toBe(true) // words alone are the plain view's job; this one needs a frame part
    fireEvent.change(screen.getByTestId('frame-question'), { target: { value: 'Grow or hold?' } })
    fireEvent.change(screen.getByTestId('frame-option-0'), { target: { value: 'Hire two' } })
    fireEvent.click(screen.getByTestId('frame-link-add'))
    fireEvent.change(screen.getByTestId('frame-link-0-from'), { target: { value: 'Hiring' } })
    fireEvent.change(screen.getByTestId('frame-link-0-to'), { target: { value: 'Morale' } })
    fireEvent.change(screen.getByTestId('frame-link-0-words'), { target: { value: 'lifts it' } })
    fireEvent.click(screen.getByTestId('frame-give'))
    await waitFor(() => expect(sent.length).toBe(1))
    const posts = all.filter((x) => x.method === 'POST')
    expect(posts[0]).toMatchObject({ method: 'POST', url: '/api/scenarios/s_x/views', body: { text: 'My view', version: 1, frame: { question: 'Grow or hold?', options: ['Hire two'], links: [{ from_label: 'Hiring', to_label: 'Morale', words: 'lifts it' }] } } })
    expect((posts[0]!.body as { frame: object }).frame).not.toHaveProperty('aim')
    expect(typeof (posts[0]!.body as { op: unknown }).op).toBe('string')
  })
  it('silence is not agreement: options left as the shared model\'s own titles are never sent as this person\'s position', async () => {
    const all = serve(() => ({ status: 201, body: { contribution: 5 } }))
    render(<FrameEntry sid="s_x" view={view()} onWrote={async () => true} />)
    fireEvent.click(screen.getByTestId('frame-open'))
    expect(screen.getByTestId('frame-option-0-from-model')).toBeTruthy()   // a suggestion is drawn, marked as the shared model's
    fireEvent.change(screen.getByTestId('frame-text'), { target: { value: 'My view' } })
    fireEvent.change(screen.getByTestId('frame-question'), { target: { value: 'Grow or hold?' } })
    fireEvent.click(screen.getByTestId('frame-give'))
    await waitFor(() => expect(all.filter((x) => x.method === 'POST').length).toBe(1))
    const body = all.find((x) => x.method === 'POST')!.body as { frame: Record<string, unknown> }
    expect(body.frame).toEqual({ question: 'Grow or hold?' })
  })
  it('draws core\'s refusal as core words it, and keeps what was typed', async () => {
    serve(() => ({ status: 409, body: { error: 'give the version this view is about: the model has moved on' } }))
    render(<FrameEntry sid="s_x" view={view()} onWrote={async () => true} />)
    fireEvent.click(screen.getByTestId('frame-open'))
    fireEvent.change(screen.getByTestId('frame-text'), { target: { value: 'v' } })
    fireEvent.change(screen.getByTestId('frame-aim'), { target: { value: 'a' } })
    fireEvent.click(screen.getByTestId('frame-give'))
    expect((await screen.findByTestId('frame-error')).textContent).toMatch(/the model has moved on/)
    expect((screen.getByTestId('frame-aim') as HTMLInputElement).value).toBe('a')
  })
  it('is not offered when core sends no frame_words: a core that would drop the frame is never given one', () => {
    const { container } = render(<FrameEntry sid="s_x" view={view({ collab: { ...fx.collab } as View['collab'] })} onWrote={async () => true} />)
    expect(container.textContent).toBe('')
    expect(frameSupport({ collab: { frame_words: { heading: 'x' } } })).toBeNull() // no limits: not the shape
  })
  it('keeps what was typed, and says so, when a 201 comes back and the View shows no frame', async () => {
    serve(() => ({ status: 201, body: { contribution: 4 } }))
    useViewStore.setState({ view: view({ collab: { ...fx.collab, frame_words: fw, mine: [{ id: 4, text: 'v', skip: false, figures: [], can_share: false, earlier: false } as never] } as View['collab'] }) })
    render(<FrameEntry sid="s_x" view={view()} onWrote={async () => true} />)
    fireEvent.click(screen.getByTestId('frame-open'))
    fireEvent.change(screen.getByTestId('frame-text'), { target: { value: 'v' } })
    fireEvent.change(screen.getByTestId('frame-aim'), { target: { value: 'a' } })
    fireEvent.click(screen.getByTestId('frame-give'))
    expect((await screen.findByTestId('frame-error')).textContent).toBe(NOT_KEPT)
    expect((screen.getByTestId('frame-aim') as HTMLInputElement).value).toBe('a')
    useViewStore.setState({ view: null })
  })
  it('closes and clears when the View shows the frame back on the contribution that was written', async () => {
    serve(() => ({ status: 201, body: { contribution: 4 } }))
    useViewStore.setState({ view: view({ collab: { ...fx.collab, frame_words: fw, mine: [{ id: 4, text: 'v', skip: false, figures: [], can_share: false, earlier: false, frame: { aim: 'a' } } as never] } as View['collab'] }) })
    render(<FrameEntry sid="s_x" view={view()} onWrote={async () => true} />)
    fireEvent.click(screen.getByTestId('frame-open'))
    fireEvent.change(screen.getByTestId('frame-text'), { target: { value: 'v' } })
    fireEvent.change(screen.getByTestId('frame-aim'), { target: { value: 'a' } })
    fireEvent.click(screen.getByTestId('frame-give'))
    await waitFor(() => expect(screen.queryByTestId('frame-entry')).toBeNull())
    useViewStore.setState({ view: null })
  })
  it('uses core\'s headings and core\'s limits, not our own numbers', () => {
    const lim = { ...limits, question: 40, options: 2, option: 10 }
    render(<FrameEntry sid="s_x" view={view({ collab: { ...fx.collab, frame_words: { ...fw, limits: lim } } as View['collab'] })} onWrote={async () => true} />)
    expect(screen.getByTestId('frame-open').textContent).toBe('My whole view')
    fireEvent.click(screen.getByTestId('frame-open'))
    expect(screen.getByTestId('frame-note').textContent).toBe('Core runs none of this.')
    expect((screen.getByTestId('frame-question') as HTMLInputElement).maxLength).toBe(40)
    // The shared model's options fill the rows up to core's cap (2 here), so no further row is offered.
    expect(screen.queryByTestId('frame-option-add')).toBeNull()
    expect(frameBody({ ...EMPTY_FRAME, options: ['a', 'b', 'c'] }, lim)).toEqual({ options: ['a', 'b'] })
  })
  it('is not offered with no version of the model to hold a view against', () => {
    const { container } = render(<FrameEntry sid="s_x" view={view({ version: null })} onWrote={async () => true} />)
    expect(container.textContent).toBe('')
  })
})

describe('the frame as core gives it', () => {
  it('reads frame and frame_words only in their shape; a core that sends none draws nothing', () => {
    expect(frameOf({})).toBeNull()
    expect(frameOf({ frame: { options: 'x' } })).toBeNull()
    expect(frameOf({ frame })).toEqual(frame)
    expect(frameWordsOf({ frame_words: { ...words, extra: 'x', aim: 3 } })).toEqual({ question: 'Their question', options: 'Their options', links: 'Their links' })
  })
  const shared = (over: object[]) => view({ collab: { ...fx.collab, shared: fx.collab.shared.map((s, i) => ({ ...s, ...(over[i] ?? {}) })) } as View['collab'] })
  it('before a reveal draws only the viewer\'s own frame, under core\'s headings, and nothing of anyone else\'s', () => {
    serve(() => ({ status: 200, body: {} }))
    const v = view({ gated: true, collab: { ...fx.collab, shared: [], mine: [{ id: 3, text: 'mine', skip: false, figures: [], can_share: false, earlier: false, frame, frame_words: words } as never] } })
    // The own frame is drawn in the flow's "Your view" step (MyFrames); "Where you differ" beside it draws nothing of anyone's.
    render(<><MyFrames view={v} /><WhereWeDiffer sid="s_x" view={v} onWrote={async () => true} /></>)
    const mine = screen.getByTestId('frame-mine-3-frame')
    expect(mine.textContent).toContain('Their question: Should we grow or hold?')
    expect(mine.textContent).toContain('Hiring to Morale: Hiring lifts morale')
    expect(screen.queryByTestId('differ-frames')).toBeNull()
    expect(document.body.textContent).not.toMatch(/\d+ places? you differ/)
  })
  it('after a reveal lists each person\'s own words, only for those who gave a frame', async () => {
    serve(() => ({ status: 200, body: { ...core, differences: [] } }))
    render(<WhereWeDiffer sid="s_x" view={shared([{ frame, frame_words: words }, {}])} onWrote={async () => true} />)
    await screen.findByTestId('differ-after')
    expect(screen.getByTestId('differ-frame-8-frame').textContent).toContain('Keep the team whole')
    expect(screen.queryByTestId('differ-frame-9')).toBeNull()
  })
})

describe('text-only differences', () => {
  const rows = [textOnly('question', 'framing', 'frame:question'), textOnly('option', 'framing', 'frame:option:hire'), { ...base, group: 'reasoning', status: 'not_run', options: [], steps: [], record: 'r1' }, { ...base, status: 'changes', steps: [] }]
  const data = differencesShape({ ...core, differences: rows }) as Differences
  it('group by core\'s own group field, in core\'s order, never ranked, and are not counted as changing the answer', () => {
    expect(groupOf(data.differences[0]!)).toBe('question')
    expect(groupDifferences(data).map((g) => [g.id, g.rows.map((r) => r.record)])).toEqual([['question', ['frame:question', 'frame:option:hire']], ['reasoning', ['r1']], ['consequence', ['per_specialist']]])
    expect(countDifferences(data)).toEqual({ places: 4, changes: 1 })
  })
  it('a text-only row shows each person\'s words and core\'s status words, and offers core\'s next steps', async () => {
    serve(() => ({ status: 200, body: { ...core, differences: [rows[0]] } }))
    render(<WhereWeDiffer sid="s_x" view={view()} onWrote={async () => true} />)
    const at = 'differ-row-frame:question'
    expect((await screen.findByTestId(`${at}-status`)).textContent).toBe('These are different words, not a calculated difference. Olumi has not run them.')
    expect(screen.getByTestId(`${at}-sides`).textContent).toContain('Hold the line on price')
    expect(screen.getByTestId(`${at}-sides`).textContent).toContain('Win the account')
    expect(screen.getByTestId(`${at}-dissent`)).toBeTruthy()
    expect(screen.getByTestId('differ-group-question')).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/\b(best|recommend|winner|important)\b/i)
  })
})
