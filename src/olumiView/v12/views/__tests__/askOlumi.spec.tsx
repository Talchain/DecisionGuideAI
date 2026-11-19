/**
 * Crux first and Ask Olumi, sent on the press (Paul, 18 Nov ~23:45Z, after his critique: "Send it and ensure it's optimal and contextually
 * optimised"). Fixtures: core's own TM-04 round (src/olumiView/fixtures/debate/tm04-cara.view3.json, viewer Cara; tm04-differences.core.json,
 * the same round's differences read: a figure Priya and Tom differ on, links Ana/Ben and Cara/Dan read differently, a factor Ana thinks the
 * model leaves out). Every assertion is bound to a record id or an exact core field.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { View } from '../../../client'
import { setPagePerson, setTeamFetch } from '../../../../olumiCore/team/api'
import { resetWrites } from '../../../../olumiCore/team/writes'
import { resetDifferences, type Difference } from '../../../../olumiCore/team/differences'
import { resetDrafts } from '../../../../olumiCore/team/drafts'
import { useGuidanceStore } from '../../../../canvas/stores/guidanceStore'
import { useViewStore } from '../../../store'
import { useViewChat } from '../../../ViewChat'
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
/** The chat's ask path as ViewChat registers it (`_dispatchAction` → press → say → act), in its real order: `say` takes the one selected model card
 *  as the message's `about` at once; `act` is busy while the write is out; on a refusal it says its sentence and stops being busy, and only a
 *  promise step later are the words put back in the message box (Codex review 3 #1). `settle(ok)` ends the write. */
function composer(): { prefill: ReturnType<typeof vi.fn>; send: ReturnType<typeof vi.fn>; about: (string | null)[]; settle: (ok: boolean) => Promise<void>; direct: ReturnType<typeof vi.fn> } {
  const prefill = vi.fn(), send = vi.fn(), direct = vi.fn(), about: (string | null)[] = []
  let last = ''
  const dispatch = (o: { message: string }) => {
    send(o.message); last = o.message
    const ids = [...useCanvasStore.getState().selection.nodeIds]
    about.push(ids.length === 1 ? ids[0]! : null)
    useViewChat.setState({ busy: true, said: null })
  }
  useGuidanceStore.setState({ _prefillChat: prefill, _dispatchAction: dispatch, _sendMessage: direct, _isConversationBusy: () => false } as never)
  const settle = async (ok: boolean) => {
    await act(async () => {
      useViewChat.setState({ busy: false, said: ok ? null : 'That did not go through. Nothing was saved.' })
      await Promise.resolve()
      if (!ok) useViewChat.setState({ text: last })
      await new Promise((r) => setTimeout(r, 5))
    })
  }
  return { prefill, send, about, settle, direct }
}
const show = (v: View) => useViewStore.setState({ sid: 's_x', view: v, at: null, status: 'ready', error: null, refresh: async () => true } as never)
afterEach(() => {
  cleanup(); setTeamFetch(null); setPagePerson(null); resetWrites(); resetDifferences(); resetDrafts()
  useGuidanceStore.setState({ _prefillChat: null, _sendMessage: null, _dispatchAction: null, _isConversationBusy: null } as never)
  useViewChat.setState({ busy: false, text: '', said: null }); useCanvasStore.setState({ selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null } })
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

describe('sent on the press, through the chat\'s ask path', () => {
  it('Ask Olumi about this difference sends that difference\'s question once, bound to its card, never through _sendMessage; "Sent" only once the write went through', async () => {
    serve(); show(tm04)
    const { prefill, send, about, settle, direct } = composer()
    // The person has another card selected: the ask still goes about its own card.
    useCanvasStore.setState({ selection: { nodeIds: new Set(['contract_to_cash']), edgeIds: new Set(), anchorPosition: null } })
    render(<WhereWeDiffer sid="s_x" view={tm04} onWrote={async () => true} />)
    const go = await screen.findByTestId(`${rowOf(FIGURE)}-ask-go`)
    fireEvent.click(go)
    expect(send.mock.calls).toEqual([[differenceQuestion(tm04, FIGURE)]])
    expect(about).toEqual([FIGURE.record])
    expect(direct).not.toHaveBeenCalled()
    expect(prefill).not.toHaveBeenCalled()
    expect(screen.getByTestId(`${rowOf(FIGURE)}-ask-said`).textContent).toBe(ASK_SAID.sending)
    fireEvent.click(go)
    expect(send).toHaveBeenCalledTimes(1)
    await settle(true)
    expect(screen.getByTestId(`${rowOf(FIGURE)}-ask-said`).textContent).toBe(ASK_SAID.sent)
    // Contrast: a missing factor has no card: it is sent about nothing, and the person's selection is put back at once.
    useCanvasStore.setState({ selection: { nodeIds: new Set(['contract_to_cash']), edgeIds: new Set(), anchorPosition: null } })
    fireEvent.click(screen.getByTestId(`${rowOf(FACTOR)}-ask-go`))
    expect(send.mock.calls[1]).toEqual([differenceQuestion(tm04, FACTOR)])
    expect(about[1]).toBeNull()
    expect([...useCanvasStore.getState().selection.nodeIds]).toEqual(['contract_to_cash'])
  })
  it('a challenge waiting for a card stands down before the ask selects its card, so only the ask is sent (Codex review 4 #1)', async () => {
    serve(); show(tm04)
    const { send } = composer()
    const fired: string[] = []
    useViewChat.setState({ armed: 'assumption' } as never)
    const stop = useCanvasStore.subscribe((s) => { if (useViewChat.getState().armed != null && s.selection.nodeIds.size === 1) fired.push('challenge') })
    render(<WhereWeDiffer sid="s_x" view={tm04} onWrote={async () => true} />)
    fireEvent.click(await screen.findByTestId(`${rowOf(FIGURE)}-ask-go`))
    stop()
    expect(fired).toEqual([])
    expect(useViewChat.getState().armed ?? null).toBeNull()
    expect(send.mock.calls).toEqual([[differenceQuestion(tm04, FIGURE)]])
  })
  it('a send that does not go through says so and can be pressed again (Codex review 2 #1); the words are in the message box', async () => {
    serve(); show(tm04)
    const { send, settle } = composer()
    render(<WhereWeDiffer sid="s_x" view={tm04} onWrote={async () => true} />)
    const go = await screen.findByTestId(`${rowOf(FIGURE)}-ask-go`) as HTMLButtonElement
    fireEvent.click(go)
    await settle(false)
    expect(useViewChat.getState().text).toBe(differenceQuestion(tm04, FIGURE))
    expect(screen.getByTestId(`${rowOf(FIGURE)}-ask-said`).textContent).toBe(ASK_SAID.failed)
    expect(go.disabled).toBe(false)
    fireEvent.click(go)
    expect(send).toHaveBeenCalledTimes(2)
  })
  it('while Olumi is still answering it says so (the ask path keeps the words in the message box)', async () => {
    serve(); show(tm04)
    const { send } = composer()
    useViewChat.setState({ busy: true })
    render(<WhereWeDiffer sid="s_x" view={tm04} onWrote={async () => true} />)
    fireEvent.click(await screen.findByTestId(`${rowOf(FIGURE)}-ask-go`))
    expect(send).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId(`${rowOf(FIGURE)}-ask-said`).textContent).toBe(ASK_SAID.busy)
  })
  it('Olumi\'s question for the round (core\'s collab.next): the person\'s own answer is sent with the question; an empty one sends nothing', async () => {
    serve(); show(tm04)
    const { send } = composer()
    render(<WhereWeDiffer sid="s_x" view={tm04} onWrote={async () => true} />)
    expect(screen.getByTestId('team-views-next').textContent).toBe(tm04.collab.next!.text)
    fireEvent.click(screen.getByTestId('team-views-next-answer'))
    const sendBtn = screen.getByTestId('team-views-next-send') as HTMLButtonElement
    expect(sendBtn.disabled).toBe(true)
    fireEvent.click(sendBtn)
    expect(send).not.toHaveBeenCalled()
    fireEvent.change(screen.getByTestId('team-views-next-words'), { target: { value: '  A past diagnostic took four months to sign.  ' } })
    fireEvent.click(screen.getByTestId('team-views-next-send'))
    expect(send.mock.calls).toEqual([[`Answering your question "${tm04.collab.next!.text}": A past diagnostic took four months to sign.`]])
  })
  it('an answer stays with the question it was typed under when core\'s question changes (Codex review 2 #2)', async () => {
    serve(); show(tm04)
    const { send } = composer()
    const r = render(<WhereWeDiffer sid="s_x" view={tm04} onWrote={async () => true} />)
    fireEvent.click(screen.getByTestId('team-views-next-answer'))
    fireEvent.change(screen.getByTestId('team-views-next-words'), { target: { value: 'Four months' } })
    const later = { ...tm04, collab: { ...tm04.collab, next: { text: 'How many sales hours are free each week?', about: [] } } } as View
    r.rerender(<WhereWeDiffer sid="s_x" view={later} onWrote={async () => true} />)
    expect(screen.getByTestId('team-views-next').textContent).toBe('How many sales hours are free each week?')
    expect(screen.getByTestId('team-views-next-earlier').textContent).toContain(tm04.collab.next!.text)
    fireEvent.click(screen.getByTestId('team-views-next-send'))
    expect(send.mock.calls).toEqual([[answerMessage(tm04.collab.next!.text, 'Four months')]])
  })
  it('before a model is saved the chat would take words as a new brief: the question is only put in the message box, never sent', async () => {
    serve()
    const { prefill, send } = composer()
    const unsaved = { ...tm04, version: null, proposal: null } as View
    show(unsaved)
    render(<WhereWeDiffer sid="s_x" view={unsaved} onWrote={async () => true} />)
    fireEvent.click(await screen.findByTestId(`${rowOf(FIGURE)}-ask-go`))
    expect(send).not.toHaveBeenCalled()
    expect(prefill.mock.calls).toEqual([[differenceQuestion(unsaved, FIGURE)]])
    expect(screen.getByTestId(`${rowOf(FIGURE)}-ask-said`).textContent).toBe(ASK_SAID.placed)
  })
})
