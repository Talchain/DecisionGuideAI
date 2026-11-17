/**
 * "Ask Olumi to compare these views" (Codex root, 17 Nov 22:23Z): after a reveal with two people's views, one press puts an editable request
 * in the person's own message box. Nothing is sent, no one's words are in it, it is offered before a model is approved, and never before a
 * reveal or with one person's view alone. Core's own state and sentence are drawn as sent.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { View } from '../../../client'
import { setPagePerson, setTeamFetch } from '../../../../olumiCore/team/api'
import { resetWrites } from '../../../../olumiCore/team/writes'
import { resetDifferences } from '../../../../olumiCore/team/differences'
import { resetDrafts } from '../../../../olumiCore/team/drafts'
import { useGuidanceStore } from '../../../../canvas/stores/guidanceStore'
import { useViewStore } from '../../../store'
import { ASK_TO_COMPARE } from '../AskToCompare'
import { CompareViewsStage } from '../CompareViewsStage'
import { WhereWeDiffer } from '../WhereWeDiffer'
import { useCompare } from '../useCompare'

const core = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/debate/differences.core.json'), 'utf8'))
const fx: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/r5/effects.view3.json'), 'utf8'))
const figure = { ...core.differences[0], status: 'changes', steps: [] }
/** Core 4dfc05ee's sentence for views revealed in words (drawn verbatim; this row would be as true of any other sentence core sent). */
const IN_WORDS = 'These views are revealed under each writer’s name. Ask Olumi to explore shared ground, differences, and what could help resolve them.'
const inWords = { ...core, differences: [], state: 'before_approval_in_words', empty: IN_WORDS }
const view = (over: Partial<View> = {}): View => ({ ...fx, gated: false, you_id: '1', ...over } as View)
/** No model approved yet: the two people's views are revealed in words. */
const beforeApproval = (): View => view({ version: null } as Partial<View>)

type Sent = { method: string; url: string }
function serve(body: unknown): Sent[] {
  const sent: Sent[] = []
  setTeamFetch((async (url: string, init?: RequestInit) => {
    sent.push({ method: init?.method ?? 'GET', url })
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
  }) as unknown as typeof fetch)
  return sent
}
/** The message box's two doors, as the conversation registers them: a prefill (never sends) and a send. */
function composer(): { prefill: ReturnType<typeof vi.fn>; send: ReturnType<typeof vi.fn> } {
  const prefill = vi.fn(), send = vi.fn()
  useGuidanceStore.setState({ _prefillChat: prefill, _sendMessage: send } as never)
  return { prefill, send }
}
const show = (v: View) => useViewStore.setState({ sid: 's_x', view: v, at: null, status: 'ready', error: null, refresh: async () => true } as never)
afterEach(() => {
  cleanup(); setTeamFetch(null); setPagePerson(null); resetWrites(); resetDifferences(); resetDrafts()
  useCompare.setState({ open: false }); useGuidanceStore.setState({ _prefillChat: null, _sendMessage: null } as never)
})

describe('Ask Olumi to compare these views', () => {
  it('before a model is approved: core\'s sentence and state are drawn as sent, and one press puts the request in the message box without sending anything', async () => {
    const sent = serve(inWords)
    const { prefill, send } = composer()
    render(<WhereWeDiffer sid="s_x" view={beforeApproval()} onWrote={async () => true} />)
    await waitFor(() => expect(screen.getByTestId('differ-empty').textContent).toBe(IN_WORDS))
    expect(screen.getByTestId('differ-differences').getAttribute('data-differences-state')).toBe('before_approval_in_words')
    expect(screen.getByTestId('differ-ask-compare-placed').textContent).toBe('')
    fireEvent.click(screen.getByTestId('differ-ask-compare-go'))
    expect(prefill.mock.calls).toEqual([[ASK_TO_COMPARE.request]])
    expect(send).not.toHaveBeenCalled()
    expect(sent.every((s) => s.method === 'GET')).toBe(true)
    expect(screen.getByTestId('differ-ask-compare-placed').textContent).toBe(ASK_TO_COMPARE.placed)
  })

  it('the request holds no one\'s words and no one\'s name: only what to compare', () => {
    const shared = fx.collab.shared
    expect(shared.filter((s) => !s.skip && s.text.trim() !== '').length).toBeGreaterThanOrEqual(2) // the fixture has words to leak
    for (const s of shared) {
      if (s.text.trim() !== '') expect(ASK_TO_COMPARE.request).not.toContain(s.text.trim())
      expect(ASK_TO_COMPARE.request).not.toContain(s.by)
    }
  })

  it('is offered beside core\'s figure differences too, and never before a reveal, nor with one person\'s view alone', async () => {
    serve({ ...core, differences: [figure], state: 'figures' })
    composer()
    const two = render(<WhereWeDiffer sid="s_x" view={view()} onWrote={async () => true} />)
    await waitFor(() => expect(screen.getByTestId('differ-group-consequence')).toBeTruthy())
    expect(screen.getByTestId('differ-ask-compare-go').textContent).toBe(ASK_TO_COMPARE.label)
    two.unmount()

    const [paul, sam] = fx.collab.shared as [View['collab']['shared'][number], View['collab']['shared'][number]]
    expect(paul.by_id).not.toBe(sam.by_id)
    // One person's view alone (the other's is a skip, which is not a view).
    const alone = render(<WhereWeDiffer sid="s_x" view={view({ collab: { ...fx.collab, shared: [paul, { ...sam, skip: true }] } })} onWrote={async () => true} />)
    await waitFor(() => expect(screen.getByTestId('differ-differences')).toBeTruthy())
    expect(screen.queryByTestId('differ-ask-compare')).toBeNull()
    alone.unmount()

    // Before a reveal: nothing of anyone else's, and no ask.
    render(<WhereWeDiffer sid="s_x" view={view({ gated: true, collab: { ...fx.collab, shared: [], can_reveal: true, waiting: null } })} onWrote={async () => true} />)
    expect(screen.queryByTestId('differ-ask-compare')).toBeNull()
  })

  it('in the main workspace it stands once, under each person\'s words; the dock does not draw a second one', async () => {
    serve(inWords)
    const { prefill, send } = composer()
    const v = beforeApproval()
    show(v)
    useCompare.setState({ open: true })
    render(<><CompareViewsStage /><WhereWeDiffer sid="s_x" view={v} onWrote={async () => true} /></>)
    await waitFor(() => expect(screen.getByTestId('differ-empty').textContent).toBe(IN_WORDS))
    expect(screen.getAllByTestId('differ-ask-compare-go')).toHaveLength(1)
    expect(screen.getByTestId('compare-stage').contains(screen.getByTestId('differ-ask-compare-go'))).toBe(true)
    expect(screen.getByTestId('differ-in-centre')).toBeTruthy()
    fireEvent.click(screen.getByTestId('differ-ask-compare-go'))
    expect(prefill.mock.calls).toEqual([[ASK_TO_COMPARE.request]])
    expect(send).not.toHaveBeenCalled()
    // Each person's own words are still on the page beside the ask, exactly as they wrote them.
    for (const s of v.collab.shared) expect(screen.getByTestId(`compare-view-${s.id}-words`).textContent).toBe(s.text.trim())
  })
})
