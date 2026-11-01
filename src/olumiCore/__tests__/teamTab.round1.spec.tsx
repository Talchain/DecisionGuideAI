/**
 * Tier C fix round 1: the Codex review (00004) and the design QA, as specs. Each describe names the finding.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { TeamTab } from '../team/TeamTab'
import { askAboutEvidence, linkOf, MAX_ASK_CHARS } from '../team/EvidencePanel'
import { NOT_FOR_THIS_PAGE, setOnModelMoved, useTeamStore } from '../team/store'
import { draftOf, resetDrafts } from '../team/drafts'
import { setTeamFetch } from '../team/api'
import { teamEvidenceNotes, withTeamEvidence } from '../team/evidenceNotes'
import { fakeApi, scenario } from './teamFixtures'
import type { TeamCommitmentRow, TeamEvidenceRow, TeamScenario } from '../team/types'

const UUID = '00000000-0000-4000-8000-75ba67edc0e5'
const reset = () => { useTeamStore.setState({ uuid: null, sid: null, scenario: null, status: 'none', error: null }); resetDrafts() }
const asPage = (id: string | null) => { (globalThis as { __OLUMI_CORE__?: unknown }).__OLUMI_CORE__ = id === null ? undefined : { person: { id } } }
beforeEach(reset)
afterEach(() => { cleanup(); setTeamFetch(null); setOnModelMoved(null); asPage(null); reset() })

const view = (over: Partial<TeamScenario['views'][number]> = {}) => ({ id: 7, by: 'Ada', mine: true, revealed: false, text: 'my view', skip: false, ...over })
const ev = (over: Partial<TeamEvidenceRow> = {}): TeamEvidenceRow => ({ id: 11, at: 't', by: 'Bea', text: 'Our October export.', source: null, concerns: ['per_specialist'], stance: 'supports', version: 1, ...over })
const commitment = (over: Partial<TeamCommitmentRow> = {}): TeamCommitmentRow => ({ id: 12, at: 't', by: 'Ada', action: 'hire', owner: 'Bea', owner_id: '5', expect: 'x', reconsider: 'y', keeps: [], outcomes: [], ...over })

describe('Codex 1: a scenario read for somebody else is never shown', () => {
  it('a view whose person is not the one this page was opened for is refused in words, and nothing of it is kept', async () => {
    asPage('1')   // this page is Ada's
    setTeamFetch(fakeApi(() => ({ json: scenario({ you: 'Bea', members: [{ id: '1', name: 'Ada' }, { id: '5', name: 'Bea' }], views: [view({ id: 9, by: 'Bea', text: 'BEA PRIVATE' })] }) })).fetchImpl)
    render(<TeamTab scenarioUuid={UUID} />)
    expect((await screen.findByTestId('team-error')).textContent).toContain(NOT_FOR_THIS_PAGE)
    expect(document.body.textContent).not.toContain('BEA PRIVATE')
    expect(useTeamStore.getState().scenario).toBeNull()
  })
  it('a refusal on a later read (the server says the page is for someone else) drops what was held', async () => {
    asPage('1')
    let refuse = false
    setTeamFetch(fakeApi(() => (refuse ? { status: 409, json: { error: 'different private link' } } : { json: scenario({ waiting: ['Bea'], views: [view()] }) })).fetchImpl)
    render(<TeamTab scenarioUuid={UUID} />)
    await screen.findByTestId('team-view-held')
    refuse = true
    fireEvent.click(screen.getByTestId('team-check'))
    await screen.findByTestId('team-error')
    expect(screen.queryByTestId('team-view-held')).toBeNull()
  })
})

describe('Codex 2: a view given before someone joined does not hide the composer', () => {
  it('Ada is waiting for this round although core holds her earlier view: she sees the composer, says so, and can give one that counts', async () => {
    let state = scenario({ waiting: ['Ada', 'Bea'], views: [view({ text: 'my earlier view' })] })
    const api = fakeApi((method, path) => {
      if (method === 'POST' && path.endsWith('/views')) { state = { ...state, waiting: ['Bea'], views: [...state.views, view({ id: 9, text: 'for this round' })] }; return { status: 201, json: { contribution: 9 } } }
      return { json: state }
    })
    setTeamFetch(api.fetchImpl)
    render(<TeamTab scenarioUuid={UUID} />)
    expect(await screen.findByTestId('team-view-composer')).toBeTruthy()
    expect(screen.getByTestId('team-view-earlier').textContent).toContain('You gave a view before someone joined')
    fireEvent.change(screen.getByTestId('team-view-text'), { target: { value: 'for this round' } })
    fireEvent.click(screen.getByTestId('team-view-give'))
    await screen.findByTestId('team-view-held')
    expect(screen.getByTestId('team-view-held-text').textContent).toBe('for this round')
  })
})

describe('Codex 3: a write whose answer was lost is never called unsent, and is not sent twice', () => {
  const lose = (state: () => TeamScenario, after: (path: string, body: unknown) => void, readFails = () => false) => {
    const calls: Array<{ method: string; path: string; body: unknown }> = []
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input), method = init?.method ?? 'GET', body = init?.body ? JSON.parse(String(init.body)) : undefined
      calls.push({ method, path, body })
      if (method === 'POST') { after(path, body); throw new TypeError('connection dropped after the save') }
      if (readFails()) throw new TypeError('down')
      return { ok: true, status: 200, json: async () => state() } as Response
    }) as typeof fetch
    return { calls, fetchImpl }
  }
  it('a view that WAS saved: the tab reads back, shows it held, and never says nothing was sent', async () => {
    let state = scenario({ waiting: ['Ada', 'Bea'] })
    const net = lose(() => state, () => { state = { ...state, waiting: ['Bea'], views: [view({ text: 'saved words' })] } })
    setTeamFetch(net.fetchImpl)
    render(<TeamTab scenarioUuid={UUID} />)
    fireEvent.change(await screen.findByTestId('team-view-text'), { target: { value: 'saved words' } })
    fireEvent.click(screen.getByTestId('team-view-give'))
    await screen.findByTestId('team-view-held')
    expect(screen.getByTestId('team-view-held-text').textContent).toBe('saved words')
    expect(document.body.textContent).not.toMatch(/nothing was sent/i)
    expect(net.calls.filter((c) => c.method === 'POST')).toHaveLength(1)
  })
  it('a view that was NOT saved (read back ok): said so, and it can be sent again', async () => {
    const state = scenario({ waiting: ['Ada', 'Bea'] })
    const net = lose(() => state, () => undefined)
    setTeamFetch(net.fetchImpl)
    render(<TeamTab scenarioUuid={UUID} />)
    fireEvent.change(await screen.findByTestId('team-view-text'), { target: { value: 'words' } })
    fireEvent.click(screen.getByTestId('team-view-give'))
    expect((await screen.findByTestId('team-view-error')).textContent).toContain('nothing was saved')
    expect((screen.getByTestId('team-view-give') as HTMLButtonElement).disabled).toBe(false)
    expect((screen.getByTestId('team-view-text') as HTMLTextAreaElement).value).toBe('words')
  })
  it('when what Olumi holds cannot be read either, nothing is known and a second send is NOT offered', async () => {
    const state = scenario({ waiting: ['Ada', 'Bea'] })
    let down = false
    const net = lose(() => state, () => { down = true }, () => down)
    setTeamFetch(net.fetchImpl)
    render(<TeamTab scenarioUuid={UUID} />)
    fireEvent.change(await screen.findByTestId('team-view-text'), { target: { value: 'words' } })
    fireEvent.click(screen.getByTestId('team-view-give'))
    expect((await screen.findByTestId('team-view-error')).textContent).toContain('could not tell whether')
    expect(screen.queryByTestId('team-view-give')).toBeNull()
    expect(screen.queryByTestId('team-view-skip')).toBeNull()
    expect(screen.getByTestId('team-view-check')).toBeTruthy()
    expect(net.calls.filter((c) => c.method === 'POST')).toHaveLength(1)
  })
  it('a commitment that WAS saved is not saved again: it is found in what Olumi holds', async () => {
    let state = scenario()
    const net = lose(() => state, (_p, b) => { const x = b as { action: string; owner: string; expect: string; reconsider: string }; state = { ...state, commitments: [commitment({ action: x.action, owner_id: x.owner, expect: x.expect, reconsider: x.reconsider })] } })
    setTeamFetch(net.fetchImpl)
    render(<TeamTab scenarioUuid={UUID} />)
    fireEvent.click(await screen.findByTestId('team-commitment-open'))
    fireEvent.change(screen.getByTestId('team-c-action'), { target: { value: 'hire' } })
    fireEvent.change(screen.getByTestId('team-c-expect'), { target: { value: 'x' } })
    fireEvent.change(screen.getByTestId('team-c-reconsider'), { target: { value: 'y' } })
    fireEvent.change(screen.getByTestId('team-c-owner'), { target: { value: '5' } })
    fireEvent.click(screen.getByTestId('team-commitment-save'))
    await screen.findByTestId('team-commitment-12')
    expect(net.calls.filter((c) => c.method === 'POST')).toHaveLength(1)
    expect(screen.queryByTestId('team-commitment-save')).toBeNull()
  })
  it('evidence retried after a lost answer carries the SAME op, so core adds one row; the message says so', async () => {
    const state = scenario()
    const net = lose(() => state, () => undefined)
    setTeamFetch(net.fetchImpl)
    render(<TeamTab scenarioUuid={UUID} />)
    fireEvent.click(await screen.findByTestId('team-evidence-open'))
    fireEvent.change(screen.getByTestId('team-evidence-body'), { target: { value: 'export' } })
    fireEvent.change(screen.getByTestId('team-evidence-bears'), { target: { value: 'per_specialist' } })
    fireEvent.click(screen.getByLabelText('Supports it'))
    fireEvent.click(screen.getByTestId('team-evidence-add'))
    expect((await screen.findByTestId('team-evidence-error')).textContent).toContain('will not be added twice')
    fireEvent.click(screen.getByTestId('team-evidence-add'))
    await waitFor(() => expect(net.calls.filter((c) => c.method === 'POST')).toHaveLength(2))
    const ops = net.calls.filter((c) => c.method === 'POST').map((c) => (c.body as { op: string }).op)
    expect(ops[0]).toBe(ops[1])
  })
})

describe('Codex 4: what was typed survives a trip to another tab', () => {
  it('a view, an evidence form, a commitment and an outcome are all still there after the tab is unmounted and opened again', async () => {
    const state = scenario({ commitments: [commitment()], waiting: ['Ada', 'Bea'] })
    setTeamFetch(fakeApi(() => ({ json: state })).fetchImpl)
    const first = render(<TeamTab scenarioUuid={UUID} />)
    fireEvent.change(await screen.findByTestId('team-view-text'), { target: { value: 'a view I am still writing' } })
    fireEvent.click(screen.getByTestId('team-evidence-open'))
    fireEvent.change(screen.getByTestId('team-evidence-body'), { target: { value: 'evidence in progress' } })
    fireEvent.click(screen.getByTestId('team-commitment-open'))
    fireEvent.change(screen.getByTestId('team-c-action'), { target: { value: 'action in progress' } })
    fireEvent.click(screen.getByTestId('team-outcome-open-12'))
    fireEvent.change(screen.getByTestId('team-o-12-happened'), { target: { value: 'outcome in progress' } })
    first.unmount()   // the dock shows Model, then Team again
    reset2()
    render(<TeamTab scenarioUuid={UUID} />)
    expect(((await screen.findByTestId('team-view-text')) as HTMLTextAreaElement).value).toBe('a view I am still writing')
    expect((screen.getByTestId('team-evidence-body') as HTMLTextAreaElement).value).toBe('evidence in progress')
    expect((screen.getByTestId('team-c-action') as HTMLTextAreaElement).value).toBe('action in progress')
    expect((screen.getByTestId('team-o-12-happened') as HTMLTextAreaElement).value).toBe('outcome in progress')
    expect(draftOf('s_75ba67edc0e5:view')).toBe('a view I am still writing')
  })
  // the store (the scenario copy) is reset between visits, as a fresh mount reads it again; drafts are not
  function reset2() { useTeamStore.setState({ uuid: null, sid: null, scenario: null, status: 'none', error: null }) }
  it('a sent draft is dropped', async () => {
    let state = scenario({ waiting: ['Ada', 'Bea'] })
    setTeamFetch(fakeApi((method, path) => {
      if (method === 'POST' && path.endsWith('/views')) { state = { ...state, waiting: ['Bea'], views: [view()] }; return { status: 201, json: { contribution: 7 } } }
      return { json: state }
    }).fetchImpl)
    render(<TeamTab scenarioUuid={UUID} />)
    fireEvent.change(await screen.findByTestId('team-view-text'), { target: { value: 'sent' } })
    fireEvent.click(screen.getByTestId('team-view-give'))
    await screen.findByTestId('team-view-held')
    expect(draftOf('s_75ba67edc0e5:view')).toBeUndefined()
  })
})

describe('Codex 6: evidence is not reinterpreted against wording that has changed', () => {
  it('evidence added at version 1 says so when the model is now version 2, and its current words are shown as such', async () => {
    const base = scenario()
    const s = scenario({ evidence: [ev({ version: 1 }), ev({ id: 12, version: 2 })], version: { ...base.version!, n: 2 } })
    setTeamFetch(fakeApi(() => ({ json: s })).fetchImpl)
    render(<TeamTab scenarioUuid={UUID} />)
    expect((await screen.findByTestId('team-evidence-version-11')).textContent).toBe('Added when the model was version 1; it is version 2 now, so these words may have changed.')
    expect(screen.queryByTestId('team-evidence-version-12')).toBeNull()   // checked against the version that is current
  })
})

describe('Codex 7: the team\'s evidence and the model\'s evidence records are two identity spaces', () => {
  const nodes = [{ id: 'q', type: 'decision', data: { label: 'Question' } }]
  it('a canonical record called evidence_11 does not suppress the team\'s eleventh row: both notes are there', () => {
    const base = new Map([['evidence_11', { id: 'evidence_11', family: 'evidence' as const, text: 'the model\'s own', author: null, anchorId: 'q' }]])
    const merged = withTeamEvidence(base, [ev({ id: 11, concerns: [] })], nodes)
    expect(merged.size).toBe(2)
    expect(merged.get('evidence_11')!.text).toBe('the model\'s own')
    expect(merged.get('team-evidence:11')!.text).toBe('Our October export.')
    expect(teamEvidenceNotes([ev({ id: 11, concerns: [] })], nodes).has('team-evidence:11')).toBe(true)
  })
})

describe('Codex 8: two members named alike are two people', () => {
  it('"you" is marked on one row only, and a waiting name is not given to both', async () => {
    asPage('5')
    setTeamFetch(fakeApi(() => ({ json: scenario({ you: 'Chris', members: [{ id: '1', name: 'Chris' }, { id: '5', name: 'Chris' }], waiting: ['Chris'], views: [view({ by: 'Chris' })] }) })).fetchImpl)
    render(<TeamTab scenarioUuid={UUID} />)
    await screen.findByTestId('team-member-1')
    expect(screen.getByTestId('team-member-1').textContent).not.toContain('(you)')
    expect(screen.getByTestId('team-member-5').textContent).toContain('(you)')
    expect(screen.getByTestId('team-member-1').getAttribute('data-state')).toBe('waiting')
    expect(screen.getByTestId('team-member-5').getAttribute('data-state')).toBe('held')
  })
})

describe('Codex 9 and 10: evidence can be asked about, and a credential link is not a link', () => {
  it('a 4,000-character evidence entry becomes a message core takes (at most 3,900), cut where it says it is cut', () => {
    const long = 'x'.repeat(4000)
    const q = askAboutEvidence({ text: long })
    expect(q.length).toBeLessThanOrEqual(MAX_ASK_CHARS)
    expect(q.startsWith('What does this change? xxx')).toBe(true)
    expect(q).toMatch(/the evidence goes on; this is the first part\]$/)
    expect(askAboutEvidence({ text: 'short' })).toBe('What does this change? short')
  })
  it('an address with sign-in details is not a link however it is spelled', () => {
    for (const s of ['https:///user:pw@example.com/', 'https://user:pw@example.com/', 'http://u@example.com', 'https://example.com:pw@evil.com/', 'HTTPS://user:pw@example.com/', 'https:/user:pw@example.com/']) expect(linkOf(s), s).toBeNull()
    expect(linkOf('https://example.com/a?b=1')).toBe('https://example.com/a?b=1')
    expect(linkOf('https://example.com')).toBe('https://example.com/')
    expect(linkOf('ftp://example.com')).toBeNull()
  })
})

describe('Codex 11: a read cut short is a failed read, never a ready scenario', () => {
  it('headers arrive with a 200 but the body does not: the last good scenario stays, the failure is said, and nothing throws', async () => {
    let cut = false
    setTeamFetch((async () => (cut ? { ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected end of JSON input') } } : { ok: true, status: 200, json: async () => scenario({ waiting: ['Ada', 'Bea'] }) })) as unknown as typeof fetch)
    render(<TeamTab scenarioUuid={UUID} />)
    await screen.findByTestId('team-members')
    cut = true
    fireEvent.click(screen.getByTestId('team-check'))
    expect((await screen.findByTestId('team-stale')).textContent).toContain('could not be read')
    expect(screen.getByTestId('team-members')).toBeTruthy()
  })
  it('an empty object is not a scenario either (first read: an error, no crash)', async () => {
    setTeamFetch((async () => ({ ok: true, status: 200, json: async () => ({}) })) as unknown as typeof fetch)
    render(<TeamTab scenarioUuid={UUID} />)
    expect((await screen.findByTestId('team-error')).textContent).toContain('could not be read')
  })
})

describe('Codex 12: evidence before a model exists does not promise a tie it cannot make', () => {
  it('says it is kept with the question and cannot be tied to a card afterwards', async () => {
    setTeamFetch(fakeApi(() => ({ json: scenario({ version: null }) })).fetchImpl)
    render(<TeamTab scenarioUuid={UUID} />)
    fireEvent.click(await screen.findByTestId('team-evidence-open'))
    const said = screen.getByTestId('team-evidence-unapproved').textContent ?? ''
    expect(said).toContain('kept with the question')
    expect(said).toContain('cannot be tied to a card afterwards')
    expect(said).not.toMatch(/once the model is confirmed/)
  })
})

describe('design QA 1: a skip is a skip', () => {
  it('your row reads "Not answering" with its own icon, and the count says so', async () => {
    setTeamFetch(fakeApi(() => ({ json: scenario({ waiting: ['Bea'], views: [view({ text: '', skip: true })] }) })).fetchImpl)
    render(<TeamTab scenarioUuid={UUID} />)
    await screen.findByTestId('team-member-1')
    expect(screen.getByTestId('team-member-1').getAttribute('data-state')).toBe('notAnswering')
    expect(screen.getByTestId('team-member-1').textContent).toContain('Not answering')
    expect(screen.getByTestId('team-member-1').textContent).not.toContain('View held')
    expect(screen.getByTestId('team-held-count').textContent).toBe('1 of 2 in (1 not answering)')
  })
})

describe('design QA 2: after the reveal the empty composer is gone', () => {
  it('"Views revealed together", and what you gave or that you chose not to answer', async () => {
    setTeamFetch(fakeApi(() => ({ json: scenario({ reveal: { state: 'revealed', at: 't' }, views: [view({ revealed: true, text: '', skip: true }), view({ id: 8, by: 'Bea', mine: false, revealed: true, text: 'wait' })] }) })).fetchImpl)
    render(<TeamTab scenarioUuid={UUID} />)
    await screen.findByTestId('team-view-revealed')
    expect(screen.queryByTestId('team-view-composer')).toBeNull()
    expect(screen.getByTestId('team-view-revealed').textContent).toContain('Views revealed together')
    expect(screen.getByTestId('team-view-revealed-skip').textContent).toBe('You chose not to answer.')
  })
})

describe('design QA 3: the privacy promise is said once, and in the words of the moment', () => {
  it.each([
    ['open', [], 'Your view is private until the reveal.'],
    ['revealed', [view({ revealed: true })], 'Revealed to everyone, Olumi included.'],
  ] as const)('%s', async (state, views, words) => {
    setTeamFetch(fakeApi(() => ({ json: scenario({ reveal: { state, at: null }, views: [...views] }) })).fetchImpl)
    render(<TeamTab scenarioUuid={UUID} />)
    await screen.findByTestId('team-privacy')
    expect(screen.getAllByTestId('team-privacy')).toHaveLength(1)
    expect(screen.getByTestId('team-privacy-view').textContent).toBe(words)
    expect(document.body.textContent).not.toMatch(/never reads your figures/)
  })
})

describe('design QA 7: another member\'s approval reaches this person\'s canvas', () => {
  it('a read that finds a newer approved version tells the page, once, so the canvas reads the saved model again', async () => {
    const told: Array<[string, number]> = []
    setOnModelMoved((uuid, n) => told.push([uuid, n]))
    const base = scenario()
    let version = 1
    setTeamFetch(fakeApi(() => ({ json: scenario({ version: { ...base.version!, n: version } }) })).fetchImpl)
    render(<TeamTab scenarioUuid={UUID} />)
    await screen.findByTestId('team-members')
    expect(told).toEqual([])   // the first read is not a change
    version = 2
    fireEvent.click(screen.getByTestId('team-check'))
    await waitFor(() => expect(told).toEqual([[UUID, 2]]))
    fireEvent.click(screen.getByTestId('team-check'))
    await waitFor(() => expect(useTeamStore.getState().status).toBe('ready'))
    expect(told).toHaveLength(1)
  })
})
