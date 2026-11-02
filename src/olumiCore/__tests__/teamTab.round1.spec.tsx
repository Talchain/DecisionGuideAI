/**
 * Tier C fix round 1: the Codex review (00004) and the design QA, as specs. Each describe names the finding.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { TeamTab } from '../team/TeamTab'
import { askAboutEvidence, linkOf, MAX_ASK_CHARS } from '../team/EvidencePanel'
import { NOT_FOR_THIS_PAGE, resetCanvasSync, setOnModelMoved, useTeamStore } from '../team/store'
import { draftOf, resetDrafts } from '../team/drafts'
import { MAY_HAVE_SAVED, NOT_CONFIRMED, resetWrites } from '../team/writes'
import { setTeamFetch } from '../team/api'
import { teamEvidenceNotes, withTeamEvidence } from '../team/evidenceNotes'
import { fakeApi, scenario } from './teamFixtures'
import type { TeamCommitmentRow, TeamEvidenceRow, TeamScenario } from '../team/types'

const UUID = '00000000-0000-4000-8000-75ba67edc0e5'
const reset = () => { useTeamStore.setState({ uuid: null, sid: null, scenario: null, status: 'none', error: null }); resetDrafts(); resetWrites(); resetCanvasSync() }
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

describe('Codex 3: a write whose answer was lost is never guessed from a later read', () => {
  /** A network that loses the answer to every write (`savedByCore` says what core did with it), and answers reads from `state`. */
  const lose = (state: () => TeamScenario, after: (path: string, body: unknown) => void, lost: (nth: number) => boolean = () => true) => {
    const calls: Array<{ method: string; path: string; body: unknown }> = []
    let posts = 0
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input), method = init?.method ?? 'GET', body = init?.body ? JSON.parse(String(init.body)) : undefined
      calls.push({ method, path, body })
      if (method === 'POST') { posts += 1; after(path, body); if (lost(posts)) throw new TypeError('connection dropped after the save'); return { ok: true, status: 201, json: async () => ({ evidence: 1, outcome: 1 }) } as Response }
      return { ok: true, status: 200, json: async () => state() } as Response
    }) as typeof fetch
    return { calls, fetchImpl }
  }
  const fillView = async (text: string) => { fireEvent.change(await screen.findByTestId('team-view-text'), { target: { value: text } }); fireEvent.click(screen.getByTestId('team-view-give')) }
  it('a view has no operation id in core: after a lost answer it is locked, whatever a read shows, and is never sent again', async () => {
    const state = scenario({ waiting: ['Ada', 'Bea'] })   // a read made right now shows nothing, yet the write may still land: that proves nothing
    const net = lose(() => state, () => undefined)
    setTeamFetch(net.fetchImpl)
    render(<TeamTab scenarioUuid={UUID} />)
    await fillView('words')
    expect((await screen.findByTestId('team-view-error')).textContent).toBe(MAY_HAVE_SAVED)
    expect(document.body.textContent).not.toMatch(/nothing was saved/i)
    expect((screen.getByTestId('team-view-give') as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByTestId('team-view-skip') as HTMLButtonElement).disabled).toBe(true)
    expect(net.calls.filter((c) => c.method === 'POST')).toHaveLength(1)
  })
  it('the lock is in the store, not the component: Team, Model, Team again gives the send back to nobody', async () => {
    const state = scenario({ waiting: ['Ada', 'Bea'] })
    const net = lose(() => state, () => undefined)
    setTeamFetch(net.fetchImpl)
    const first = render(<TeamTab scenarioUuid={UUID} />)
    await fillView('words')
    await screen.findByTestId('team-view-error')
    first.unmount()
    useTeamStore.setState({ uuid: null, sid: null, scenario: null, status: 'none', error: null })
    render(<TeamTab scenarioUuid={UUID} />)
    expect((await screen.findByTestId('team-view-error')).textContent).toBe(MAY_HAVE_SAVED)
    expect((screen.getByTestId('team-view-give') as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByTestId('team-view-text') as HTMLTextAreaElement).value).toBe('words')
    expect(net.calls.filter((c) => c.method === 'POST')).toHaveLength(1)
  })
  it('a commitment is locked the same way, and what core trimmed does not matter: no read is compared with what was typed', async () => {
    let state = scenario()
    const net = lose(() => state, (_p, b) => { const x = b as { action: string; owner: string; expect: string; reconsider: string }; state = { ...state, commitments: [commitment({ action: x.action.trim(), owner_id: x.owner, expect: x.expect, reconsider: x.reconsider })] } })
    setTeamFetch(net.fetchImpl)
    render(<TeamTab scenarioUuid={UUID} />)
    fireEvent.click(await screen.findByTestId('team-commitment-open'))
    fireEvent.change(screen.getByTestId('team-c-action'), { target: { value: '  hire  ' } })
    fireEvent.change(screen.getByTestId('team-c-expect'), { target: { value: 'x' } })
    fireEvent.change(screen.getByTestId('team-c-reconsider'), { target: { value: 'y' } })
    fireEvent.change(screen.getByTestId('team-c-owner'), { target: { value: '5' } })
    fireEvent.click(screen.getByTestId('team-commitment-save'))
    expect((await screen.findByTestId('team-commitment-error')).textContent).toBe(MAY_HAVE_SAVED)
    expect((screen.getByTestId('team-commitment-save') as HTMLButtonElement).disabled).toBe(true)
    expect(net.calls.filter((c) => c.method === 'POST')).toHaveLength(1)
  })
  const openEvidence = async () => {
    fireEvent.click(await screen.findByTestId('team-evidence-open'))
    fireEvent.change(screen.getByTestId('team-evidence-body'), { target: { value: 'export' } })
    fireEvent.change(screen.getByTestId('team-evidence-bears'), { target: { value: 'per_specialist' } })
    fireEvent.click(screen.getByLabelText('Supports it'))
    fireEvent.click(screen.getByTestId('team-evidence-add'))
  }
  it('evidence has an operation id: a lost answer sends the SAME request with the SAME op at once, and core\'s answer is the truth', async () => {
    const net = lose(() => scenario(), () => undefined, (n) => n === 1)
    setTeamFetch(net.fetchImpl)
    render(<TeamTab scenarioUuid={UUID} />)
    await openEvidence()
    await waitFor(() => expect(net.calls.filter((c) => c.method === 'POST')).toHaveLength(2))
    const posts = net.calls.filter((c) => c.method === 'POST')
    expect(posts[1]!.body).toEqual(posts[0]!.body)
    expect((posts[0]!.body as { op: string }).op).toMatch(/^[A-Za-z0-9-]{8,64}$/)
    await waitFor(() => expect(screen.queryByTestId('team-evidence-error')).toBeNull())
  })
  it('when the resend is lost too, the person is told it was not confirmed, and the next press still carries that op', async () => {
    const net = lose(() => scenario(), () => undefined, (n) => n <= 2)
    setTeamFetch(net.fetchImpl)
    render(<TeamTab scenarioUuid={UUID} />)
    await openEvidence()
    expect((await screen.findByTestId('team-evidence-error')).textContent).toBe(NOT_CONFIRMED)
    fireEvent.click(screen.getByTestId('team-evidence-add'))
    await waitFor(() => expect(net.calls.filter((c) => c.method === 'POST')).toHaveLength(3))
    const ops = net.calls.filter((c) => c.method === 'POST').map((c) => (c.body as { op: string }).op)
    expect(new Set(ops).size).toBe(1)
  })
  it('an op belongs to its content: evidence edited after a lost answer is a new request with a new op', async () => {
    const net = lose(() => scenario(), () => undefined, (n) => n <= 2)
    setTeamFetch(net.fetchImpl)
    render(<TeamTab scenarioUuid={UUID} />)
    await openEvidence()
    await screen.findByTestId('team-evidence-error')
    fireEvent.change(screen.getByTestId('team-evidence-body'), { target: { value: 'export, corrected' } })
    fireEvent.click(screen.getByTestId('team-evidence-add'))
    await waitFor(() => expect(net.calls.filter((c) => c.method === 'POST')).toHaveLength(3))
    const ops = net.calls.filter((c) => c.method === 'POST').map((c) => (c.body as { op: string }).op)
    expect(ops[2]).not.toBe(ops[0])
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

describe('design QA 6 and Codex 10: a range is never turned into a point by rounding, and code states no finding of its own', () => {
  it('two ends that differ by a hair are both shown as they are; no sentence says the runs "land on" one figure', async () => {
    const base = scenario()
    const s = scenario({ commitments: [commitment()], version: { ...base.version!, facts: [{ id: 'F2', value: '99.96 to 100.04 ticket/week', text: 'Core says this in its own words.', about: { kind: 'range', option: 'add_one', low: 99.96, high: 100.04, median: 100, unit: 'ticket/week' } }] } })
    setTeamFetch(fakeApi(() => ({ json: s })).fetchImpl)
    render(<TeamTab scenarioUuid={UUID} />)
    expect((await screen.findByTestId('team-commitment-band-line-F2')).textContent).toBe('Core says this in its own words.')
    expect(screen.getByTestId('team-commitment-band-low-F2').textContent).toBe('100 ticket/week')
    expect(screen.getByTestId('team-commitment-band-high-F2').textContent).toBe('100 ticket/week')
    expect(screen.getByTestId('team-commitment-band').textContent).not.toMatch(/land on|runs in 10|between 100 and 100/)
  })
})

describe('design QA 7: another member\'s approval reaches this person\'s canvas, and a failed read of it is tried again', () => {
  it('a read that finds a newer approved version tells the page, once, so the canvas reads the saved model again', async () => {
    const told: Array<[string, number]> = []
    setOnModelMoved(async (uuid, n) => { told.push([uuid, n]); return true })
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
  it('the canvas could not read the newer model: the next read asks again, until the canvas has it', async () => {
    const told: number[] = []
    let canvasWorks = false
    setOnModelMoved(async (_uuid, n) => { told.push(n); return canvasWorks })
    const base = scenario()
    let version = 1
    setTeamFetch(fakeApi(() => ({ json: scenario({ version: { ...base.version!, n: version } }) })).fetchImpl)
    render(<TeamTab scenarioUuid={UUID} />)
    await screen.findByTestId('team-members')
    version = 2
    fireEvent.click(screen.getByTestId('team-check'))
    await waitFor(() => expect(told).toEqual([2]))              // failed: the Team tab shows 2, the canvas still 1
    fireEvent.click(screen.getByTestId('team-check'))
    await waitFor(() => expect(told).toEqual([2, 2]))           // the same version again, though the tab already shows it
    canvasWorks = true
    fireEvent.click(screen.getByTestId('team-check'))
    await waitFor(() => expect(told).toEqual([2, 2, 2]))
    fireEvent.click(screen.getByTestId('team-check'))
    await waitFor(() => expect(useTeamStore.getState().status).toBe('ready'))
    expect(told).toHaveLength(3)                                // adopted: no more asking
  })
})
