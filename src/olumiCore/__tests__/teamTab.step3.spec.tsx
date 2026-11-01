import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { TeamTab } from '../team/TeamTab'
import { askAboutEvidence, linkOf } from '../team/EvidencePanel'
import { teamEvidenceNotes, withTeamEvidence } from '../team/evidenceNotes'
import { noteLine } from '../../canvas/domain/noteRecordsModel'
import { useTeamStore } from '../team/store'
import { setTeamFetch } from '../team/api'
import { fakeApi, scenario } from './teamFixtures'
import type { TeamEvidenceRow, TeamScenario } from '../team/types'

const UUID = '00000000-0000-4000-8000-75ba67edc0e5'
const reset = () => useTeamStore.setState({ uuid: null, sid: null, scenario: null, status: 'none', error: null })
beforeEach(reset)
afterEach(() => { cleanup(); setTeamFetch(null); reset() })

const ev = (over: Partial<TeamEvidenceRow> = {}): TeamEvidenceRow => ({ id: 11, at: '2026-11-01T18:38:05.823Z', by: 'Bea', text: 'Our October export: 2 in 100 unsubscribed.', source: 'https://example.com/x', concerns: ['per_specialist'], stance: 'challenges', version: 1, ...over })

describe('Team tab, step 3: evidence', () => {
  it('adds evidence only once it says which record it bears on and how, with the words exactly as typed, and an op for a safe retry', async () => {
    let state: TeamScenario = scenario()
    const api = fakeApi((method, path, body) => {
      if (method === 'POST' && path.endsWith('/evidence')) { state = { ...state, evidence: [ev({ text: (body as { text: string }).text })] }; return { status: 201, json: { evidence: 11 } } }
      return { json: state }
    })
    setTeamFetch(api.fetchImpl)
    render(<TeamTab scenarioUuid={UUID} />)
    fireEvent.click(await screen.findByTestId('team-evidence-open'))
    const add = screen.getByTestId('team-evidence-add') as HTMLButtonElement
    fireEvent.change(screen.getByTestId('team-evidence-body'), { target: { value: 'Our October export: 2 in 100 unsubscribed' } })
    expect(add.disabled).toBe(true)
    // No default stance: nothing in the group is chosen, and the picker starts unchosen.
    expect((screen.getByTestId('team-evidence-stance').querySelectorAll('input:checked'))).toHaveLength(0)
    expect((screen.getByTestId('team-evidence-bears') as HTMLSelectElement).value).toBe('')
    fireEvent.change(screen.getByTestId('team-evidence-bears'), { target: { value: 'per_specialist' } })
    expect(add.disabled).toBe(true)
    fireEvent.click(screen.getByLabelText('Challenges it'))
    expect(add.disabled).toBe(false)
    fireEvent.change(screen.getByTestId('team-evidence-source'), { target: { value: ' https://example.com/x ' } })
    fireEvent.click(add)
    await screen.findByTestId('team-evidence-11')
    const post = api.calls.find((c) => c.method === 'POST')!
    expect(post.body).toMatchObject({ text: 'Our October export: 2 in 100 unsubscribed', source: ' https://example.com/x ', concerns: ['per_specialist'], stance: 'challenges' })
    expect((post.body as { op: string }).op).toMatch(/^[A-Za-z0-9-]{8,64}$/)
  })

  it('before a model is confirmed, evidence can only be kept (concerns []), and the form says why', async () => {
    const state = scenario({ version: null })
    const api = fakeApi((method) => (method === 'POST' ? { status: 201, json: { evidence: 1 } } : { json: state }))
    setTeamFetch(api.fetchImpl)
    render(<TeamTab scenarioUuid={UUID} />)
    fireEvent.click(await screen.findByTestId('team-evidence-open'))
    expect((screen.getByTestId('team-evidence-bears') as HTMLSelectElement).disabled).toBe(true)
    expect(screen.getByTestId('team-evidence-unapproved').textContent).toContain('no confirmed model yet')
    fireEvent.change(screen.getByTestId('team-evidence-body'), { target: { value: 'a note' } })
    fireEvent.click(screen.getByLabelText('Not clear yet'))
    fireEvent.click(screen.getByTestId('team-evidence-add'))
    await waitFor(() => expect(api.calls.some((c) => c.method === 'POST')).toBe(true))
    expect(api.calls.find((c) => c.method === 'POST')!.body).toMatchObject({ concerns: [], stance: 'unclear' })
  })

  it('shows what the team brought, attributed, with the source a link only when it is an http(s) address, and asks Olumi by quoting it', async () => {
    const state = scenario({ evidence: [ev(), ev({ id: 12, by: 'Ada', source: 'the Q3 deck, slide 4', concerns: [], stance: 'supports', text: 'raw   text' })] })
    setTeamFetch(fakeApi(() => ({ json: state })).fetchImpl)
    const asked = vi.fn()
    render(<TeamTab scenarioUuid={UUID} onAskOlumi={asked} />)
    await screen.findByTestId('team-evidence-11')
    expect(screen.getByTestId('team-evidence-11').textContent).toContain('Bears on: Tickets added per specialist')
    expect(screen.getByTestId('team-evidence-source-11').querySelector('a')!.getAttribute('href')).toBe('https://example.com/x')
    expect(screen.getByTestId('team-evidence-source-12').querySelector('a')).toBeNull()
    expect(screen.getByTestId('team-evidence-12').textContent).toContain('Nothing in the model yet')
    expect(screen.getByTestId('team-evidence-text-12').textContent).toBe('raw   text')
    fireEvent.click(screen.getByTestId('team-evidence-ask-11'))
    expect(asked).toHaveBeenCalledWith('What does this change? Our October export: 2 in 100 unsubscribed.')
  })

  it('a source with sign-in details or a script scheme is never a link', () => {
    expect(linkOf('https://example.com/a?b=1')).toBe('https://example.com/a?b=1')
    expect(linkOf('https://user:pw@example.com/')).toBeNull()
    expect(linkOf('javascript:alert(1)')).toBeNull()
    expect(linkOf('http://a b')).toBeNull()
    expect(linkOf(null)).toBeNull()
    expect(askAboutEvidence({ text: 'x' })).toBe('What does this change? x')
  })
})

describe('the canvas counts what the team brought (the lane\'s evidence adapter into the card notes)', () => {
  const nodes = [
    { id: 'q', type: 'decision', data: { label: 'Question' } },
    { id: 'per_specialist', type: 'factor', data: { label: 'Tickets added per specialist' } },
  ]
  it('anchors evidence on the first visible card it concerns, in the member\'s words, with its source', () => {
    const notes = teamEvidenceNotes([ev()], nodes)
    const n = notes.get('evidence_11')!
    expect(n).toMatchObject({ family: 'evidence', anchorId: 'per_specialist', author: 'person', text: 'Our October export: 2 in 100 unsubscribed. Source: https://example.com/x' })
    expect(noteLine(n)).toBe('Evidence: Our October export: 2 in 100 unsubscribed. Source: https://example.com/x')
  })
  it('falls back to the question card when its record is not a card (a link, or a record a later version dropped)', () => {
    expect(teamEvidenceNotes([ev({ concerns: ['morale_link'] }), ev({ id: 12, concerns: [] })], nodes).get('evidence_11')!.anchorId).toBe('q')
    expect(teamEvidenceNotes([ev({ id: 12, concerns: [] })], nodes).get('evidence_12')!.anchorId).toBe('q')
  })
  it('joins the notes beside the saved graph\'s own and never replaces one', () => {
    const base = new Map([['evidence_11', { id: 'evidence_11', family: 'evidence' as const, text: 'mine', author: null, anchorId: 'q' }]])
    const merged = withTeamEvidence(base, [ev(), ev({ id: 12 })], nodes)
    expect(merged.get('evidence_11')!.text).toBe('mine')
    expect(merged.has('evidence_12')).toBe(true)
    expect(withTeamEvidence(base, undefined, nodes)).toBe(base)
  })
})
