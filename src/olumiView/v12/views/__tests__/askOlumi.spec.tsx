/**
 * Crux first and Ask Olumi, sent on the press (Paul, 18 Nov ~23:45Z, after his critique: "Send it and ensure it's optimal and contextually
 * optimised"). Fixtures: core's own TM-04 round (src/olumiView/fixtures/debate/tm04-cara.view3.json, viewer Cara; tm04-differences.core.json,
 * the same round's differences read: a figure Priya and Tom differ on, links Ana/Ben and Cara/Dan read differently, a factor Ana thinks the
 * model leaves out). Every assertion is bound to a record id or an exact core field.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { View } from '../../../client'
import { setPagePerson, setTeamFetch } from '../../../../olumiCore/team/api'
import { resetWrites } from '../../../../olumiCore/team/writes'
import { resetDifferences, type Difference } from '../../../../olumiCore/team/differences'
import { resetDrafts } from '../../../../olumiCore/team/drafts'
import { useGuidanceStore } from '../../../../canvas/stores/guidanceStore'
import { useViewStore } from '../../../store'
import { useAnswersAsks, useViewChat } from '../../../ViewChat'
import { useCanvasStore } from '../../../../canvas/store'
import { WhereWeDiffer } from '../WhereWeDiffer'
import { answerMessage, ASK_SAID, differenceQuestion } from '../askOlumi'

const tm04: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/debate/tm04-cara.view3.json'), 'utf8'))
const read = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/debate/tm04-differences.core.json'), 'utf8'))
const diffs: Difference[] = read.differences
const byRecord = (r: string, goal?: string) => diffs.find((d) => d.record === r && (goal === undefined || d.goal === goal))!
const FIGURE = byRecord('diagnostic_time_to_contract')
const LINK_CARA = byRecord('link:first_cash_timing:contract_to_cash', 'generate_revenue_quickly')
const FACTOR = byRecord('factor:38')
const rowOf = (d: Difference) => `differ-row-${d.record}${d.goal ? `-${d.goal}` : ''}`

function serve(): void {
  setTeamFetch((async () => new Response(JSON.stringify(read), { status: 200, headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch)
}
/**
 * The production path end to end (Codex ROOT HOLD 01:11:46Z): Team's press → ViewChat askOnPress → press → say → write/act → team api call →
 * this fake network. A POST to …/messages waits until `answer(ok)` settles it, after the press, in the real order. `posts` are the bodies on
 * the wire (`text`, `about`, `op`); `prefill` is the message box's prefill door.
 */
function network(): { posts: Array<{ text: string; about?: string; press?: string; op: string }>; others: string[]; prefill: ReturnType<typeof vi.fn>; answer: (ok: boolean) => Promise<void> } {
  const posts: Array<{ text: string; about?: string; press?: string; op: string }> = [], others: string[] = [], waiting: Array<(r: Response) => void> = []
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
  setTeamFetch((async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET', path = String(url)
    if (path === '/api/me') return json({ me: { id: tm04.you_id } })
    if (method === 'POST' && path.endsWith('/messages')) { posts.push(JSON.parse(String(init!.body))); return new Promise<Response>((res) => waiting.push(res)) }
    if (method === 'POST') { others.push(path); return json({ error: 'not in this spec' }, 500) }
    return json(read)
  }) as unknown as typeof fetch)
  const prefill = vi.fn()
  useGuidanceStore.setState({ _prefillChat: prefill } as never)
  const answer = async (ok: boolean) => {
    await act(async () => {
      waiting.shift()!(ok ? json({ scenario: 's_x', job: 7, proposal: null, discussion: null }, 202) : json({ error: 'Olumi could not take this message just now.' }, 409))
      await new Promise((r) => setTimeout(r, 20))
    })
  }
  return { posts, others, prefill, answer }
}
/** The page's own registration of the chat's asks. */
function Asks(): null { useAnswersAsks(); return null }
const show = (v: View) => useViewStore.setState({ uuid: '00000000-0000-4000-8000-0000000000aa', sid: 's_x', view: v, at: null, status: 'ready', error: null, refresh: async () => true } as never)
afterEach(() => {
  cleanup(); setTeamFetch(null); setPagePerson(null); resetWrites(); resetDifferences(); resetDrafts()
  useGuidanceStore.setState({ _prefillChat: null, _sendMessage: null, _dispatchAction: null, _isConversationBusy: null } as never)
  useViewChat.setState({ busy: false, text: '', said: null, ops: new Map() } as never); useCanvasStore.setState({ selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null } })
})

describe('crux first', () => {
  it('each card leads with core\'s own sentence and what would tell the views apart, at rest; the drawing comes after', async () => {
    serve(); show(tm04)
    render(<WhereWeDiffer sid="s_x" view={tm04} onWrote={async () => true} />)
    const card = await screen.findByTestId(rowOf(FIGURE))
    expect(within(card).getByTestId(`${rowOf(FIGURE)}-status`).textContent).toBe(FIGURE.status_text)
    const settle = within(card).getByTestId(`${rowOf(FIGURE)}-settle`)
    expect([...settle.querySelectorAll('li')].map((l) => [l.getAttribute('data-settle'), l.textContent])).toEqual(FIGURE.settle.map((s) => [s.kind, s.text]))
    expect(within(card).getByText(read.headings.settle)).toBeTruthy()
    // Nothing of it is folded: the card has no <details> at all.
    expect(card.querySelector('details')).toBeNull()
    // Sentence, then the actions, then the drawing (document order).
    const order = (a: Element, b: Element) => a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING
    expect(order(within(card).getByTestId(`${rowOf(FIGURE)}-status`), within(card).getByTestId(`${rowOf(FIGURE)}-actions`))).toBeTruthy()
    expect(order(within(card).getByTestId(`${rowOf(FIGURE)}-actions`), within(card).getByTestId(`${rowOf(FIGURE)}-drawn`))).toBeTruthy()
  })

  it('Olumi\'s reading is on its own card\'s difference, with core\'s unconfirmed note, bound by the mark\'s card id, and not drawn again in the marks fold', async () => {
    const mark = tm04.collab.marks!.find((m) => m.reading != null)!
    expect(mark.card).toBe(FIGURE.record)
    serve(); show(tm04)
    render(<WhereWeDiffer sid="s_x" view={tm04} onWrote={async () => true} />)
    const r = await screen.findByTestId(`${rowOf(FIGURE)}-reading`)
    expect(r.getAttribute('data-mark-card')).toBe(mark.card)
    expect(r.textContent).toBe(`${mark.reading!.text}${mark.reading!.note}`)
    // Contrast: a difference about another card shows no reading.
    expect(screen.queryByTestId(`${rowOf(FACTOR)}-reading`)).toBeNull()
    expect(screen.queryByTestId(`team-reading-${mark.card}-${mark.kind}`)).toBeNull()
  })

  it('the canvas marks fold never says "common ground": core\'s shared mark means several spoke to a card, not that they agree', async () => {
    // The round with one more mark of core's kind `shared` (two people spoke to the unique card too): the count still says marks.
    const marked = tm04.collab.marks!
    const spoke = { ...marked[1]!, kind: 'shared' as const, text: 'Maya and Cara spoke to it' }
    const v = { ...tm04, collab: { ...tm04.collab, marks: [...marked, spoke] } } as View
    serve(); show(v)
    render(<WhereWeDiffer sid="s_x" view={v} onWrote={async () => true} />)
    await screen.findByTestId(rowOf(FIGURE))
    const marks = screen.getByTestId('differ-marks')
    expect(marks.textContent).toContain(`Marked on the canvas · ${marked.length + 1}`)
    expect(marks.textContent).not.toMatch(/common ground/i)
  })
})

describe('the question for each difference', () => {
  it('names the card and the aim by core\'s exact labels, the people by name, and carries nobody\'s figure, words or chance', () => {
    const q = differenceQuestion(tm04, FIGURE)
    expect(q).toBe(`On '${FIGURE.label}' for '${FIGURE.goal_label}': what could explain why Priya and Tom's figures differ, and what evidence would tell them apart?`)
    for (const s of FIGURE.sides) { expect(q).not.toContain(s.figure); expect(q).not.toContain(s.text) }
    for (const o of FIGURE.options) for (const c of o.chances) expect(q).not.toContain(c.text)
  })
  it('says "we" when the viewer is a side (Cara, on the link she doubts), and asks a link\'s own question; a factor asks whether it matters', () => {
    expect(LINK_CARA.sides.some((s) => s.holder_id === tm04.you_id)).toBe(true)
    expect(differenceQuestion(tm04, LINK_CARA)).toBe(`On the link ${LINK_CARA.label} for '${LINK_CARA.goal_label}': what could explain why we read it differently, and what evidence would show whether it holds?`)
    // Contrast: the same link seen by someone who is not a side names its people.
    expect(differenceQuestion({ ...tm04, you_id: '12' } as View, LINK_CARA)).toContain('why Cara and Dan read it differently')
    // Core's text-only framing kinds are compared as views, never as "figures" (Codex review 2 #3, its wording).
    expect(differenceQuestion(tm04, { ...FIGURE, kind: 'aim' as never, label: 'Generate revenue as quickly as possible' })).toBe(`Compare the revealed views on 'Generate revenue as quickly as possible': where do they differ, and what could help us clarify those differences?`)
    expect(differenceQuestion(tm04, FACTOR)).toBe(`Ana thinks the model leaves out '${FACTOR.label}'. How could we tell whether it matters for the aim, and what figure, with a range, could it take?`)
  })
})

describe('sent on the press, through the chat\'s ask path (production path, fake network)', () => {
  it('sends the difference\'s question once, about its own card on the wire; "Sent" only when the write\'s own result says so', async () => {
    const { posts, prefill, answer } = network(); show(tm04)
    // The person has another card selected: the ask still goes about its own card.
    useCanvasStore.setState({ selection: { nodeIds: new Set(['contract_to_cash']), edgeIds: new Set(), anchorPosition: null } })
    render(<WhereWeDiffer sid="s_x" view={tm04} onWrote={async () => true} />)
    const go = await screen.findByTestId(`${rowOf(FIGURE)}-ask-go`) as HTMLButtonElement
    fireEvent.click(go)
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]).toMatchObject({ text: differenceQuestion(tm04, FIGURE), about: FIGURE.record })
    // The difference's question is the page's template: it declares its press (typed fields 13b), so the row reads core's label, not the words.
    expect(posts[0]!.press).toBe('ask_about')
    expect(prefill).not.toHaveBeenCalled()
    expect(screen.getByTestId(`${rowOf(FIGURE)}-ask-said`).textContent).toBe(ASK_SAID.sending)
    expect(go.getAttribute('aria-disabled')).toBe('true')
    await answer(true)
    expect(screen.getByTestId(`${rowOf(FIGURE)}-ask-said`).textContent).toBe(ASK_SAID.sent)
    // Contrast: a missing factor has no card: no about on the wire, and the person's selection is put back at once.
    useCanvasStore.setState({ selection: { nodeIds: new Set(['contract_to_cash']), edgeIds: new Set(), anchorPosition: null } })
    fireEvent.click(screen.getByTestId(`${rowOf(FACTOR)}-ask-go`))
    await waitFor(() => expect(posts).toHaveLength(2))
    expect(posts[1]!.text).toBe(differenceQuestion(tm04, FACTOR))
    expect('about' in posts[1]!).toBe(false)
    expect([...useCanvasStore.getState().selection.nodeIds]).toEqual(['contract_to_cash'])
    await answer(true)
  })
  it('Codex ROOT HOLD: a refusal that arrives later says "Not sent" (never "Sent"), the press works again, the words are in the message box; a retry that goes through says Sent', async () => {
    const { posts, answer } = network(); show(tm04)
    // The chat's own asks registered as the page registers them (ViewChat useAnswersAsks), so every path through the guidance store is real too.
    render(<><Asks /><WhereWeDiffer sid="s_x" view={tm04} onWrote={async () => true} /></>)
    const go = await screen.findByTestId(`${rowOf(FIGURE)}-ask-go`) as HTMLButtonElement
    fireEvent.click(go)
    await waitFor(() => expect(posts).toHaveLength(1))
    await answer(false)
    expect(screen.getByTestId(`${rowOf(FIGURE)}-ask-said`).textContent).toBe(ASK_SAID.failed)
    expect(go.getAttribute('aria-disabled')).toBeNull()
    expect(useViewChat.getState().text).toBe(differenceQuestion(tm04, FIGURE))
    fireEvent.click(go)
    await waitFor(() => expect(posts).toHaveLength(2))
    expect(posts[1]!.op).toBe(posts[0]!.op) // the same write retried, never a second one
    await answer(true)
    expect(screen.getByTestId(`${rowOf(FIGURE)}-ask-said`).textContent).toBe(ASK_SAID.sent)
  })
  it('the person\'s own identical draft in the message box survives a successful send (Codex ROOT 01:51:41Z: the ask never removes words from the box)', async () => {
    const { posts, answer } = network(); show(tm04)
    const q = differenceQuestion(tm04, FIGURE)
    useViewChat.setState({ text: `${q}\nand my own note` })
    render(<WhereWeDiffer sid="s_x" view={tm04} onWrote={async () => true} />)
    fireEvent.click(await screen.findByTestId(`${rowOf(FIGURE)}-ask-go`))
    await waitFor(() => expect(posts).toHaveLength(1))
    await answer(true)
    expect(screen.getByTestId(`${rowOf(FIGURE)}-ask-said`).textContent).toBe(ASK_SAID.sent)
    expect(useViewChat.getState().text).toBe(`${q}\nand my own note`)
  })
  it('a challenge waiting for a card stands down before the ask selects its card, so only the ask is sent (Codex review 4 #1)', async () => {
    const { posts, others, answer } = network(); show(tm04)
    useViewChat.setState({ armed: 'assumption' } as never)
    render(<WhereWeDiffer sid="s_x" view={tm04} onWrote={async () => true} />)
    fireEvent.click(await screen.findByTestId(`${rowOf(FIGURE)}-ask-go`))
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(others).toEqual([])
    expect(useViewChat.getState().armed ?? null).toBeNull()
    await answer(true)
  })
  it('while Olumi is still answering, a second ask waits in the message box and the first still says Sent when it goes through (Codex review 7 #1)', async () => {
    const { posts, prefill, answer } = network(); show(tm04)
    render(<WhereWeDiffer sid="s_x" view={tm04} onWrote={async () => true} />)
    fireEvent.click(await screen.findByTestId(`${rowOf(FIGURE)}-ask-go`))
    await waitFor(() => expect(posts).toHaveLength(1))
    fireEvent.click(screen.getByTestId(`${rowOf(FACTOR)}-ask-go`))
    expect(prefill.mock.calls).toEqual([[differenceQuestion(tm04, FACTOR)]])
    expect(screen.getByTestId(`${rowOf(FACTOR)}-ask-said`).textContent).toBe(ASK_SAID.busy)
    await answer(true)
    expect(posts).toHaveLength(1)
    expect(screen.getByTestId(`${rowOf(FIGURE)}-ask-said`).textContent).toBe(ASK_SAID.sent)
  })
  it('Olumi\'s question for the round (core\'s collab.next): the person\'s own answer is sent with the question, about its one card; an empty one sends nothing', async () => {
    const { posts, answer } = network(); show(tm04)
    render(<WhereWeDiffer sid="s_x" view={tm04} onWrote={async () => true} />)
    expect(screen.getByTestId('team-views-next').textContent).toBe(tm04.collab.next!.text)
    fireEvent.click(screen.getByTestId('team-views-next-answer'))
    expect((screen.getByTestId('team-views-next-send') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByTestId('team-views-next-words'), { target: { value: '  A past diagnostic took four months to sign.  ' } })
    fireEvent.click(screen.getByTestId('team-views-next-send'))
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]).toMatchObject({ text: `Answering your question "${tm04.collab.next!.text}": A past diagnostic took four months to sign.`, about: tm04.collab.next!.about[0] })
    // The answer is the person's own words: no press, so their row shows what they wrote (Codex ROOT 03:07:18Z).
    expect('press' in posts[0]!).toBe(false)
    await answer(true)
    expect(screen.getByTestId('team-views-next-said').textContent).toBe(ASK_SAID.sent)
  })
  it('an answer stays with the question it was typed under when core\'s question changes (Codex review 2 #2)', async () => {
    const { posts, answer } = network(); show(tm04)
    const r = render(<WhereWeDiffer sid="s_x" view={tm04} onWrote={async () => true} />)
    fireEvent.click(screen.getByTestId('team-views-next-answer'))
    fireEvent.change(screen.getByTestId('team-views-next-words'), { target: { value: 'Four months' } })
    const later = { ...tm04, collab: { ...tm04.collab, next: { text: 'How many sales hours are free each week?', about: [] } } } as View
    r.rerender(<WhereWeDiffer sid="s_x" view={later} onWrote={async () => true} />)
    expect(screen.getByTestId('team-views-next').textContent).toBe('How many sales hours are free each week?')
    expect(screen.getByTestId('team-views-next-earlier').textContent).toContain(tm04.collab.next!.text)
    fireEvent.click(screen.getByTestId('team-views-next-send'))
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]!.text).toBe(answerMessage(tm04.collab.next!.text, 'Four months'))
    await answer(true)
  })
  it('a past version open: nothing is sent and it says not sent, the words untouched (Codex review 6 #1)', async () => {
    const { posts } = network(); show(tm04)
    useViewStore.setState({ at: 1 } as never)
    useViewChat.setState({ text: 'my own draft' })
    render(<WhereWeDiffer sid="s_x" view={tm04} onWrote={async () => true} />)
    fireEvent.click(await screen.findByTestId(`${rowOf(FIGURE)}-ask-go`))
    await new Promise((r) => setTimeout(r, 20))
    expect(posts).toEqual([])
    expect(screen.getByTestId(`${rowOf(FIGURE)}-ask-said`).textContent).toBe(ASK_SAID.failed)
    expect(useViewChat.getState().text).toBe('my own draft')
  })
  it('before a model is saved the chat would take words as a new brief: the question is only put in the message box, never sent', async () => {
    const { posts, prefill } = network()
    const unsaved = { ...tm04, version: null, proposal: null } as View
    show(unsaved)
    render(<WhereWeDiffer sid="s_x" view={unsaved} onWrote={async () => true} />)
    fireEvent.click(await screen.findByTestId(`${rowOf(FIGURE)}-ask-go`))
    await new Promise((r) => setTimeout(r, 20))
    expect(posts).toEqual([])
    expect(prefill.mock.calls).toEqual([[differenceQuestion(unsaved, FIGURE)]])
    expect(screen.getByTestId(`${rowOf(FIGURE)}-ask-said`).textContent).toBe(ASK_SAID.placed)
  })
})
