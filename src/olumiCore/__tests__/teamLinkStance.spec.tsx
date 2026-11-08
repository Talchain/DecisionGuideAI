/**
 * A revealed disagreement people can act on (core API v1.30, DL 8 Nov; X2 step 3). On core's own View and differences for the capacity case
 * (fixtures/disagree, written by olumi-core wip/disagree-actionable from its link-stance rows): the morale link is folded into the
 * 'Add one specialist' card, never drawn, and before this no one could doubt it after the reveal.
 *  - "Links you doubt" offers the View's `model.holdable` (the folded link too), in core's words, sent verbatim.
 *  - "Where you stand on a link" draws only core's words, chooses neither stance, holds Send until a link, a stance and words are given,
 *    posts { record, part, stance, words, op }, and says core's refusal verbatim.
 *  - "Where your explanations differ" draws each side's own words under its line.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { View } from '../../olumiView/client'
import { setPagePerson, setTeamFetch } from '../team/api'
import { resetDoubts, sendDoubts, ViewDoubts } from '../team/ViewDoubts'
import { resetDifferences, useDifferences, type Differences } from '../team/differences'
import { LinkStance } from '../team/LinkStance'
import { DifferencesPanel } from '../team/DifferencesPanel'
import { resetWrites } from '../team/writes'
import { TeamTab } from '../team/TeamTab'
import { useMe } from '../me'
import { useViewStore } from '../../olumiView/store'

const DIR = path.resolve('src/olumiView/fixtures/disagree')
const read = <T,>(n: string): T => JSON.parse(readFileSync(path.join(DIR, n), 'utf8'))
const revealed = read<View>('x2-revealed.view3.json'), stances = read<View>('x2-stances.view3.json')
const diffRevealed = read<Differences>('x2-revealed.differences.core.json'), diffStances = read<Differences>('x2-stances.differences.core.json')
const SID = revealed.id
const MORALE = { record: 'morale_link', part: null }
const BEA = 'Morale here does not move with headcount; it moves with workload.', ADA = 'Last time we hired, the team picked up within a month.'
type Sent = { method: string; url: string; body: unknown }
function serve(answer: (s: Sent) => { status: number; body: unknown }): Sent[] {
  const sent: Sent[] = []
  setTeamFetch((async (url: string, init?: RequestInit) => {
    const s = { method: init?.method ?? 'GET', url, body: init?.body ? JSON.parse(String(init.body)) : undefined }
    sent.push(s)
    const a = url === '/api/me' ? { status: 200, body: { me: null } } : answer(s)
    return new Response(JSON.stringify(a.body), { status: a.status, headers: { 'content-type': 'application/json' } })
  }) as unknown as typeof fetch)
  return sent
}
const differences = (data: Differences | null) => useDifferences.setState({ sid: SID, key: 'k', read: 'k', data, error: null })
const words = () => (diffRevealed as unknown as { link_stance: Record<string, string | number> }).link_stance
afterEach(() => {
  cleanup(); setTeamFetch(null); setPagePerson(null); resetDoubts(); resetDifferences(); resetWrites()
  useViewStore.setState(useViewStore.getInitialState(), true)
})

describe('Links you doubt: the View\'s holdable links', () => {
  it('LS1 offers every link core holds, the folded morale link too, in core\'s words, and sends the picked one verbatim', async () => {
    const sent = serve(() => ({ status: 201, body: { doubt: 5 } }))
    differences(diffRevealed)
    render(<ViewDoubts sid={SID} view={revealed} disabled={false} />)
    const offered = [...screen.getByTestId('team-view-doubts').querySelectorAll('[data-view="holdable.text"]')].map((x) => x.textContent)
    expect(offered).toEqual(revealed.model!.holdable!.map((h) => h.text))
    expect(offered).toContain("'Add one specialist' → 'team morale'")
    fireEvent.click(screen.getByTestId('team-view-doubt-morale_link|'))
    await sendDoubts(SID, 7)
    expect(sent.find((s) => s.method === 'POST')).toEqual({ method: 'POST', url: `/api/scenarios/${SID}/views/7/doubts`, body: { links: [MORALE], missing: null, stance: null } })
  })
})

describe('Where you stand on a link, after the reveal', () => {
  it('LS2 every word is core\'s, neither stance is chosen, Send waits for a link, a stance and words, then posts them with an op', async () => {
    const sent = serve((s) => (s.method === 'POST' ? { status: 201, body: { stance: 9 } } : { status: 200, body: diffStances }))
    differences(diffRevealed)
    const onWrote = vi.fn(async () => true)
    render(<LinkStance sid={SID} view={revealed} onWrote={onWrote} />)
    const w = words(), form = screen.getByTestId('team-link-stance')
    expect(screen.getByTestId('team-link-stance-heading').textContent).toBe(w['heading'])
    expect(screen.getByTestId('team-link-stance-note').textContent).toBe(w['note'])
    expect(form.textContent).toContain(String(w['link']))
    expect([screen.getByTestId('team-link-stance-doubt').closest('label')!.textContent, screen.getByTestId('team-link-stance-keep').closest('label')!.textContent]).toEqual([w['doubt'], w['keep']])
    expect(form.textContent).toContain(String(w['words']))
    expect(screen.getByTestId('team-link-stance-send').textContent).toBe(w['send'])
    // The heading is said once: the region and the stance group are named by it, with no second copy to read out.
    expect(form.textContent!.split(String(w['heading'])).length - 1).toBe(1)
    expect([screen.getByRole('region', { name: String(w['heading']) }), screen.getByRole('group', { name: String(w['heading']) })].map((x) => x.dataset['testid'])).toEqual(['team-link-stance', 'team-link-stance-stance'])
    expect((screen.getByTestId('team-link-stance-words') as HTMLTextAreaElement).maxLength).toBe(w['limit'])
    // The links are core's, each once, and none is picked; neither stance is chosen.
    const options = [...(screen.getByTestId('team-link-stance-link') as HTMLSelectElement).options].map((o) => o.textContent)
    expect(options).toEqual([w['pick'], ...revealed.model!.holdable!.map((h) => h.text)]) // core's prompt, then core's links
    expect(form.querySelector('[data-testid="team-link-stance-yours"]')).toBeNull() // nothing said yet
    expect([(screen.getByTestId('team-link-stance-doubt') as HTMLInputElement).checked, (screen.getByTestId('team-link-stance-keep') as HTMLInputElement).checked]).toEqual([false, false])
    const send = screen.getByTestId('team-link-stance-send') as HTMLButtonElement
    expect(send.disabled).toBe(true)
    fireEvent.change(screen.getByTestId('team-link-stance-link'), { target: { value: 'morale_link|' } })
    expect(send.disabled).toBe(true)
    fireEvent.click(screen.getByTestId('team-link-stance-doubt'))
    expect(send.disabled).toBe(true)
    fireEvent.change(screen.getByTestId('team-link-stance-words'), { target: { value: `  ${BEA}  ` } })
    expect(send.disabled).toBe(false)
    await act(async () => { fireEvent.click(send) })
    const post = sent.find((s) => s.method === 'POST')!
    expect(post.url).toBe(`/api/scenarios/${SID}/links/stance`)
    const { op, ...body } = post.body as Record<string, unknown>
    expect(body).toEqual({ record: 'morale_link', part: null, stance: 'doubt', words: BEA })
    expect(typeof op).toBe('string')
    // Said: the form is empty again, the differences are read again, and the page reads the View.
    expect([(screen.getByTestId('team-link-stance-link') as HTMLSelectElement).value, (screen.getByTestId('team-link-stance-words') as HTMLTextAreaElement).value]).toEqual(['', ''])
    expect(sent.some((s) => s.method === 'GET' && s.url === `/api/scenarios/${SID}/differences`)).toBe(true)
    expect(onWrote).toHaveBeenCalledTimes(1)
  })

  it('LS3 core\'s refusal is said verbatim, and what the person wrote stays', async () => {
    serve(() => ({ status: 400, body: { error: 'keep it to 200 characters' } }))
    differences(diffRevealed)
    render(<LinkStance sid={SID} view={revealed} onWrote={async () => true} />)
    fireEvent.change(screen.getByTestId('team-link-stance-link'), { target: { value: 'morale_link|' } })
    fireEvent.click(screen.getByTestId('team-link-stance-keep'))
    fireEvent.change(screen.getByTestId('team-link-stance-words'), { target: { value: ADA } })
    await act(async () => { fireEvent.click(screen.getByTestId('team-link-stance-send')) })
    expect(screen.getByTestId('team-link-stance-error').textContent).toBe('keep it to 200 characters')
    expect((screen.getByTestId('team-link-stance-words') as HTMLTextAreaElement).value).toBe(ADA)
  })

  it('LS4 draws nothing on a core without the form\'s words, for a gated viewer, before anything is revealed, or with no holdable links', () => {
    const none = (view: View, data: Differences | null) => { cleanup(); differences(data); return render(<LinkStance sid={SID} view={view} onWrote={async () => true} />).container.querySelector('[data-testid="team-link-stance"]') }
    const { link_stance: _gone, ...older } = diffRevealed as unknown as Record<string, unknown>
    expect(none(revealed, older as unknown as Differences)).toBeNull()
    expect(none({ ...revealed, gated: true } as View, diffRevealed)).toBeNull()
    expect(none({ ...revealed, collab: { ...revealed.collab, shared: [] } } as View, diffRevealed)).toBeNull()
    expect(none({ ...revealed, model: { ...revealed.model!, holdable: undefined } } as View, diffRevealed)).toBeNull()
    expect(none(revealed, null)).toBeNull()
    expect(none(revealed, diffRevealed)).not.toBeNull()
  })
})

describe('What you have said', () => {
  it('LS6 once Ada has kept the morale link, the form lists that, in core\'s words and hers, under core\'s heading; never Bea\'s word', () => {
    differences(diffStances)
    render(<LinkStance sid={SID} view={stances} onWrote={async () => true} />)
    const w = (diffStances as unknown as { link_stance: Record<string, string> }).link_stance, yours = screen.getByTestId('team-link-stance-yours')
    expect(yours.querySelector('p')!.textContent).toBe(w['yours'])
    expect([...yours.querySelectorAll('li')].map((li) => [li.getAttribute('data-link-said'), [...li.querySelectorAll('span')].map((x) => x.textContent)])).toEqual([['morale_link|', ["'Add one specialist' → 'team morale'", w['keep'], ADA]]])
    expect(yours.textContent).not.toContain(BEA)
  })
})

describe('Its place in the Team tab', () => {
  it('LS7 the form comes before "Where your explanations differ", which shows what it does (the UI gate: below, it read as part of the figures\' section)', async () => {
    serve((s) => (s.url.endsWith('/differences') ? { status: 200, body: diffRevealed } : { status: 200, body: {} }))
    useMe.setState({ me: { id: revealed.you_id, name: revealed.you }, status: 'ready' } as never)
    useViewStore.setState({ uuid: '00000000-0000-4000-8000-0123456789ab', sid: SID, view: revealed, status: 'ready', error: null, stale: false })
    render(<TeamTab />)
    const [form, diffs] = await waitFor(() => { const f = screen.getByTestId('team-link-stance'), d = screen.getByTestId('team-differences'); return [f, d] as const })
    expect(form.compareDocumentPosition(diffs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    useMe.setState({ me: null, status: 'none' } as never)
  })
})

describe('Where your explanations differ: each side in its own words', () => {
  it('LS5 a stance\'s words are drawn under its line, as core gives them; a side without words draws none', () => {
    serve(() => ({ status: 200, body: diffStances }))
    differences(diffStances)
    useDifferences.setState({ key: `${SID}|none` })
    const { container } = render(<DifferencesPanel sid={SID} view={stances} onWrote={async () => true} />)
    const card = container.querySelector('[data-testid="team-difference-link:morale_link"]')!
    expect([...card.querySelectorAll('[data-difference-words]')].map((x) => [x.getAttribute('data-difference-words'), x.textContent])).toEqual([['2', BEA], ['1', ADA]])
    expect(card.querySelector('[data-testid="team-difference-link:morale_link-status"]')!.textContent).toBe('This link is a claim in words: the model does not calculate it, so no chance here turns on whether it holds.')
    expect(container.querySelectorAll('[data-difference-words]').length).toBe(2)
  })
})
