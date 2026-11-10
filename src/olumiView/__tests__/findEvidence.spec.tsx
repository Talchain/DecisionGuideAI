/**
 * "Find evidence" (research/FindEvidence.tsx) in the dock's "Selected:" row: offered for a figure or assumption card (never an option); the
 * panel draws core's proposals as they came, each marked as Olumi's and provisional; nothing is posted until a press; "Use to set the
 * range" only where core says the proposal is settable (else core's reason); a press posts core's choice contract; core's plain refusal and
 * what to look for are drawn with no proposal to choose. Zero provider calls: core is a scripted fetch.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { SelectionPill } from '../../canvas/components/SelectionPill'
import { useCanvasStore } from '../../canvas/store'
import { selectedRename } from '../SelectedRename'
import { FindEvidence } from '../research/FindEvidence'
import { NOT_FOR_THIS_PAGE, setTeamFetch } from '../../olumiCore/team/api'
import { resetWrites } from '../../olumiCore/team/writes'
import { useMe } from '../../olumiCore/me'
import type { ResearchItem, ResearchProposal } from '../research/api'

const SID = 's_0123456789ab'
const approved: View = { ...JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/real', 'european-22cards.view3.json'), 'utf8')), id: SID }
const figure = approved.model!.cards.find((c) => c.family === 'quantity')!
const option = approved.model!.cards.find((c) => c.family === 'option')!
const MARK = "Olumi's proposal from a web search. Check the source before you rely on it."
const proposal = (k: number, over: Partial<ResearchProposal> = {}): ResearchProposal => ({ k, title: `Source ${k}`, url: `https://example.org/s${k}`, published: '2025-03-01', quote: `Passage ${k} says 90 to 120.`,
  implies: { kind: 'range', low: 90, high: 120, unit: 'ticket/week', words: '90 to 120 tickets/week' }, relevance: 'A survey of similar teams.', strength: 'moderate', strength_why: 'A credible survey.',
  settable: true, why_not: null, by: 'olumi', provisional: true, mark: MARK, stance: 'challenges', choice: null,
  // Core's own sentences (wip/research-r2 linesOf), deliberately unlike anything the page could compose from the fields above.
  lines: { passage: `core passage ${k}`, badge: `core badge ${k}`, where: `core where ${k}`, suggests: `core suggests ${k}`, relevance: `core relevance ${k}`, strength: `core strength ${k}`, stance: `core stance ${k}`, cannot_set: null, choice: null }, ...over })
const item = (over: Partial<ResearchItem> = {}): ResearchItem => ({ id: 41, record: figure.id, about: figure.heading, heading: 'core heading', intro: 'core intro', kind: 'figure', at: '2026-11-07T15:00:00Z', by: 'Paul', by_id: approved.you_id!, version: 1, in_model: true,
  status: 'found', said: null, look_for: [], proposals: [proposal(1), proposal(2, { settable: false, why_not: 'core why not', implies: { kind: 'none', words: 'core no range' } })].map((p) => p.k === 2 ? { ...p, lines: { ...p.lines, suggests: 'core no range', relevance: null, strength: null, stance: null } } : p), ...over })

let calls: Array<{ method: string; path: string; body: unknown }> = []
let list: ResearchItem[] = []
/** Whose private link the browser holds now, as core's GET /api/me answers; another person's after a second link was opened here. */
let meNow: string | undefined
/** Called when a research list is asked for, before it is answered (to move the page meanwhile). */
let onList: (() => void) | null = null
/** Whose list core answered with, when it differs from whose link the browser holds by the time anything else is asked. */
let listReader: string | undefined
beforeEach(() => {
  calls = []; list = [item()]; meNow = approved.you_id ?? undefined; onList = null; listReader = undefined
  setTeamFetch((async (u: unknown, init?: RequestInit) => {
    const method = init?.method ?? 'GET', p = String(u)
    calls.push({ method, path: p, body: init?.body ? JSON.parse(String(init.body)) : undefined })
    if (method === 'GET' && p === '/api/me') return new Response(JSON.stringify({ me: { id: meNow, name: approved.you } }), { status: 200 })
    if (method === 'GET' && p.endsWith('/research')) {
      onList?.(); onList = null
      // Another scenario's list never answers here, so only the first scenario's answer could ever be drawn.
      // core names the list's reader: whoever's private link the browser held when it answered
      return p.includes(SID) ? new Response(JSON.stringify({ you_id: listReader ?? meNow, research: list }), { status: 200 }) : new Promise<Response>(() => {})
    }
    if (method === 'GET') return new Response(JSON.stringify(approved), { status: 200 })
    return new Response(JSON.stringify({ choice: 'accept', evidence: 7, version: null }), { status: 201 })
  }) as unknown as typeof fetch)
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-0123456789ab', sid: SID, view: approved, status: 'ready', error: null, stale: false, at: null })
  useMe.setState({ me: { id: approved.you_id, name: approved.you }, status: 'ready' })
})
afterEach(() => { cleanup(); useCanvasStore.setState({ selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null }, nodes: [], edges: [] } as never); setTeamFetch(null); resetWrites(); useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none' }); useMe.setState({ me: null, status: 'none' }) })
const selectedRow = (id: string, heading: string) => {
  useCanvasStore.setState({ nodes: [{ id, position: { x: 0, y: 0 }, data: { label: heading } }] as never, edges: [] as never, selection: { nodeIds: new Set([id]), edgeIds: new Set(), anchorPosition: null } })
  // N1 does not mount it (see the row below); this suite keeps its behaviour covered for N2, mounted the way it was.
  return render(<SelectionPill after={(s) => <FindEvidence key={`${s.kind}:${s.id}`} s={s} />} />).container
}
const posts = () => calls.filter((c) => c.method === 'POST')
const panel = () => document.querySelector(`[data-research-panel="${figure.id}"]`) as HTMLElement | null

describe('Find evidence', () => {
  it('is offered for a figure card, not for an option card', () => {
    selectedRow(option.id, option.heading)
    expect(document.querySelector('[data-research-find]')).toBeNull()
    cleanup()
    selectedRow(figure.id, figure.heading)
    expect(document.querySelector(`[data-research-find="${figure.id}"]`)).not.toBeNull()
  })

  it("draws core's proposals as Olumi's and provisional; nothing is posted until a press; set range only where core allows it", async () => {
    selectedRow(figure.id, figure.heading)
    fireEvent.click(screen.getByText('Find evidence'))
    await waitFor(() => expect(panel()?.querySelectorAll('[data-research-proposal]')).toHaveLength(2))
    const cards = [...panel()!.querySelectorAll('[data-research-proposal]')] as HTMLElement[]
    for (const [i, c] of cards.entries()) {
      expect(c).toHaveAttribute('data-olumi')
      expect(c).toHaveAttribute('data-provisional')
      expect(c.querySelector(`[title="${MARK}"]`)).not.toBeNull()
      // Every sentence is core's, drawn verbatim: each line's text is exactly core's string, and nothing else is said around it.
      const k = i + 1, want = list[0]!.proposals[i]!.lines
      for (const [name, text] of Object.entries(want)) if (text !== null) expect(c.querySelector(`[data-research-line="${name}"]`)!.textContent).toBe(text)
      // the passage is core's line (quote marks only on a checked passage), never the raw quote drawn as a quotation (Codex N1r item 3)
      expect(c.textContent).not.toContain(`Passage ${k} says`)
    }
    expect(panel()!.textContent).toContain('core heading')
    expect(panel()!.textContent).toContain('core intro')
    expect(cards[0]!.querySelector('a')).toHaveAttribute('href', 'https://example.org/s1')
    expect(cards[0]!.querySelector('[data-research-range]')).not.toBeNull()
    expect(cards[1]!.querySelector('[data-research-range]')).toBeNull()
    for (const line of ['relevance', 'strength', 'stance']) expect(cards[1]!.querySelector(`[data-research-line="${line}"]`), line).toBeNull() // core sent no such line: nothing is drawn in its place
    expect(cards[1]!.querySelector('[data-research-line="cannot_set"]')).toBeNull() // core said no range in `suggests`; nothing composed here
    expect(panel()!.textContent).not.toMatch(/Suggests|Relevance:|Strength:|Cannot set the range|Olumi’s proposal/)
    expect(posts()).toHaveLength(0)
    fireEvent.click(cards[0]!.querySelector('[data-research-accept="1"]')!)
    await waitFor(() => expect(posts().map((c) => c.path)).toContain(`/api/scenarios/${SID}/research/41/choice`))
    const sent = posts().find((c) => c.path.endsWith('/choice'))!.body as Record<string, unknown>
    expect(sent).toMatchObject({ proposal: 1, choice: 'accept', base: null })
    expect(typeof sent['op']).toBe('string')
  })

  it("draws core's plain refusal and what to look for, with no proposal to choose", async () => {
    list = [item({ status: 'none', said: 'Olumi’s search found no source it could use for this, so it proposes nothing. Nothing in the model has changed.', look_for: ['Your own ticket logs'], proposals: [] })]
    selectedRow(figure.id, figure.heading)
    fireEvent.click(screen.getByText('Find evidence'))
    await waitFor(() => expect(panel()).toHaveTextContent('so it proposes nothing'))
    expect(panel()).toHaveTextContent('Your own ticket logs')
    expect(panel()!.querySelector('[data-research-proposal]')).toBeNull()
    expect(panel()!.querySelector('[data-research-start]')).toHaveTextContent('Search again')
  })
  it("draws research only for the page's own person and scenario (PL-37): a list answered after another private link was opened, or after the page moved, is not drawn", async () => {
    selectedRow(figure.id, figure.heading)
    fireEvent.click(screen.getByText('Find evidence'))
    await waitFor(() => expect(panel()?.querySelectorAll('[data-research-proposal]')).toHaveLength(2)) // contrast: this page's person sees them
    // Another private link is opened in this browser; the panel is opened again, and its list read is answered for whoever holds it now.
    fireEvent.click(screen.getByLabelText('Close'))
    expect(panel()).toBeNull()
    meNow = 'u_someone_else'
    const before = posts().length
    fireEvent.click(screen.getByText('Find evidence'))
    await waitFor(() => expect(panel()).toHaveTextContent(NOT_FOR_THIS_PAGE))
    expect(posts()).toHaveLength(before) // a read only: nothing was sent
    expect(panel()!.querySelector('[data-research-proposal]')).toBeNull()
    expect(panel()!.textContent).not.toContain('core passage')
    cleanup(); resetWrites()
    // Another person's link answered the list, and this page's person's link was reopened before anything else was asked: core named the
    // list's reader, so it is still refused (Codex PL-37 review: a later "who is this?" read would have passed it).
    meNow = approved.you_id ?? undefined; listReader = 'u_someone_else'
    selectedRow(figure.id, figure.heading)
    fireEvent.click(screen.getByText('Find evidence'))
    await waitFor(() => expect(panel()).toHaveTextContent(NOT_FOR_THIS_PAGE))
    expect(panel()!.querySelector('[data-research-proposal]')).toBeNull()
    cleanup(); resetWrites(); listReader = undefined
    // Until the page knows whose it is, Find evidence is not offered and nothing is read.
    useMe.setState({ me: null, status: 'loading' })
    const lists = calls.filter((c) => c.path.endsWith('/research')).length
    selectedRow(figure.id, figure.heading)
    expect(document.querySelector('[data-research-find]')).toBeNull()
    expect(calls.filter((c) => c.path.endsWith('/research'))).toHaveLength(lists)
    cleanup(); useMe.setState({ me: { id: approved.you_id!, name: approved.you! }, status: 'ready' })
    // The page moves to another scenario while the list is in flight: the answer is dropped, never drawn on the new page.
    meNow = approved.you_id ?? undefined
    onList = () => { useViewStore.setState({ sid: 's_ffffffffffff' }) }
    selectedRow(figure.id, figure.heading)
    fireEvent.click(screen.getByText('Find evidence'))
    await waitFor(() => expect(calls.filter((c) => c.path.endsWith('/research')).length).toBeGreaterThan(1))
    await new Promise((r) => setTimeout(r, 20))
    expect(document.querySelector('[data-research-proposal]')).toBeNull()
  })
  it('N1 does not offer Find evidence in the Selected row: web research returns in N2', () => {
    selectedRow(figure.id, figure.heading) // contrast: with the panel mounted, a figure card offers it
    expect(document.querySelector(`[data-research-find="${figure.id}"]`)).not.toBeNull()
    cleanup()
    useCanvasStore.setState({ nodes: [{ id: figure.id, position: { x: 0, y: 0 }, data: { label: figure.heading } }] as never, edges: [] as never, selection: { nodeIds: new Set([figure.id]), edgeIds: new Set(), anchorPosition: null } } as never)
    const c = render(<SelectionPill after={selectedRename} />).container // the Selected row as N1 mounts it
    expect(c.textContent ?? '').toContain(figure.heading)
    expect(c.querySelector('[data-research-find]')).toBeNull()
  })
})
