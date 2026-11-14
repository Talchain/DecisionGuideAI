/**
 * N3: the strategy screen draws core's words whole (olumi-core wip/n3-strategy-words, src/view/screen-words.ts). Each core string in a real
 * View (fixtures/v11/consulting-chain.view3.json, its N3 fields filled by core's own builders) is replaced by a marker no UI could compose,
 * bound to the record it belongs to (mark by card and kind, evidence by id, the viewer by id). The screen must draw each marker exactly where
 * core's field goes: a string composed in the UI from names, figures or a copy table cannot match.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { useReveal } from '../reveal'
import { CardEvidenceMarks, CardViewChips } from '../RevealMarks'
import { EvidenceDock } from '../EvidenceDock'
import { RevealDock } from '../RevealDock'
import { TeamPresence } from '../TeamPresence'
import { ViewLensBar } from '../ViewLensBar'
import { Compare } from '../WhatIfCompare'
import { StrategyOverviewPage } from '../strategy/overview/StrategyOverviewPage'
import { EvidencePanel } from '../../olumiCore/team/EvidencePanel'
import { ViewsPanel } from '../../olumiCore/team/ViewsPanel'
import { setPagePerson, setTeamFetch } from '../../olumiCore/team/api'
import { resetWrites } from '../../olumiCore/team/writes'
import { resetDrafts } from '../../olumiCore/team/drafts'

const real: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/v11', 'consulting-chain.view3.json'), 'utf8'))
const CARD = 'diagnostic_time_to_contract'
/** The real View with every N3 string replaced by a marker naming its owner. */
function marked(): View {
  const v: View = structuredClone(real)
  v.collab.marks = v.collab.marks!.map((m) => ({ ...m, title: `‹title ${m.card} ${m.kind}›`, label: `‹label ${m.card} ${m.kind}›` }))
  // Evidence 31's chain as core gives it (observation, claim, estimate), with an inference step added so every step heading is drawn.
  v.evidence = v.evidence.map((e) => (e.id !== 31 ? e : { ...e, chain: [...e.chain!.filter((st) => st.level !== 'estimate'), { level: 'inference' as const, text: '‹inference step›', status: null, card: null }, ...e.chain!.filter((st) => st.level === 'estimate')] }))
  v.evidence = v.evidence.map((e) => ({ ...e, stance_text: `‹stance ${e.id}›`, switch_text: `‹switch ${e.id}›`, mark_label: `‹mark label ${e.id}›`, mark_title: `‹mark title ${e.id}›` }))
  v.evidence_words = { heading: '‹evidence heading›', close: '‹evidence close›', bearsOn: '‹bears on›', steps: { observation: '‹observation›', claim: '‹claim›', inference: '‹inference›', estimate: '‹estimate›' },
    stances: v.evidence_words.stances.map((x) => ({ ...x, text: `‹stance word ${x.id}›` })) }
  v.reveal_words = { revealedTogether: '‹revealed together›', close: '‹reveal close›', bringEvidence: '‹bring evidence›', keepOpen: '‹keep open›' }
  // Every Team-tab word (N3 `team_words`), each marked by its own path, and what each piece of evidence bears on, by its id.
  const mark = (o: Record<string, unknown>, at: string): Record<string, unknown> => Object.fromEntries(Object.entries(o).map(([k, x]) => [k, typeof x === 'string' ? `‹tw ${at}${k}›` : mark(x as Record<string, unknown>, `${at}${k}.`)]))
  v.team_words = mark(v.team_words, '') as View['team_words']
  v.evidence = v.evidence.map((e) => ({ ...e, bears_on_text: `‹bears on text ${e.id}›` }))
  v.team_presence = { title: `‹team title ${v.you_id}›`, label: `‹team label ${v.you_id}›`, members: v.members.map((m) => ({ id: m.id, text: `‹member ${m.id}›` })) }
  v.lens_words = { ...v.lens_words, bar: '‹lens bar›', explore: '‹explore›', team: '‹team›', rests_on_label: '‹rests on label›', label: { ...v.lens_words.label, full: '‹label full›' } }
  return v
}
const setView = (view: View) => useViewStore.setState({ uuid: '00000000-0000-4000-8000-a88ba245176e', sid: view.id, view, status: 'ready', error: null, stale: false, at: null })
beforeEach(() => useReveal.setState({ selected: null, evidence: null, card: null, chip: null }))
afterEach(() => { cleanup(); useViewStore.setState({ view: null }) })

describe('N3: every strategy-screen word is core\'s field, drawn by identity', () => {
  it('marks, evidence, both docks, team presence and the lens bar draw the marker core put in each field', () => {
    const v = marked()
    setView(v)
    // Canvas chips: each core mark's hover and name, by card and kind.
    render(<CardViewChips card={CARD} />)
    const chip = (kind: string) => document.querySelector<HTMLElement>(`[data-reveal-card-chip="${CARD}"][data-reveal-kind="${kind}"]`)!
    expect([chip('disagreement').title, chip('disagreement').getAttribute('aria-label')]).toEqual([`‹title ${CARD} disagreement›`, `‹label ${CARD} disagreement›`])
    expect([chip('evidence').title, chip('evidence').getAttribute('aria-label')]).toEqual([`‹title ${CARD} evidence›`, `‹label ${CARD} evidence›`])
    cleanup()
    // An evidence mark no chip gathers: its own name and hover, by evidence id.
    const loose: View = { ...v, collab: { ...v.collab, marks: v.collab.marks!.filter((m) => m.kind !== 'evidence') } }
    setView(loose)
    render(<CardEvidenceMarks card={CARD} />)
    const em = document.querySelector<HTMLElement>('[data-evidence-mark="31"]')!
    expect([em.getAttribute('aria-label'), em.title]).toEqual(['‹mark label 31›', '‹mark title 31›'])
    cleanup()
    // The evidence dock, opened on 31 from its chip: its words, its stance line and the switch to 32.
    setView(v)
    useReveal.setState({ evidence: 31, card: CARD, chip: `${CARD}:evidence` })
    render(<EvidenceDock view={v} />)
    const dock = screen.getByTestId('evidence-dock')
    expect(dock.getAttribute('aria-label')).toBe('‹evidence heading›')
    expect(within(dock).getByTestId('evidence-dock-heading').textContent).toBe('‹evidence heading›')
    expect(within(dock).getByTestId('evidence-dock-close').getAttribute('aria-label')).toBe('‹evidence close›')
    expect(dock.querySelector('[data-evidence-also="32"]')!.textContent).toBe('T‹switch 32›')
    // Every step heading of the chain, in its order: core's words for observation, claim, causal inference and model estimate.
    expect([...dock.querySelectorAll('[data-evidence-step] > p:first-child')].map((p) => p.textContent)).toEqual(['‹observation›', '‹claim›', '‹inference›', '‹estimate›'])
    cleanup()
    // The reveal dock, opened on view 19 from its chip.
    useReveal.setState({ selected: 19, card: CARD, chip: `${CARD}:disagreement` })
    render(<RevealDock view={v} />)
    const rd = screen.getByTestId('reveal-dock')
    expect(rd.textContent).toContain('‹revealed together›')
    expect(within(rd).getByTestId('reveal-dock-close').getAttribute('aria-label')).toBe('‹reveal close›')
    expect(within(rd).getByTestId('reveal-dock-bring-evidence').textContent).toBe('‹bring evidence›')
    // DL journey (6), Codex 085d4c57e: the dock's keep is core's differences action, offered only where core holds the difference (its words
    // are the differences heading); with none read, no pretend save is drawn.
    expect(within(rd).queryByTestId('reveal-dock-keep-open')).toBeNull()
    cleanup()
    // Team presence, for the viewer by id; the lens bar.
    render(<><TeamPresence /><ViewLensBar /></>)
    const tp = screen.getByTestId('team-presence')
    expect([tp.title, tp.getAttribute('aria-label')]).toEqual([`‹team title ${v.you_id}›`, `‹team label ${v.you_id}›`])
    expect(screen.getByRole('radiogroup').getAttribute('aria-label')).toBe('‹lens bar›')
    expect(document.querySelector('[data-lens-label="full"]')!.textContent).toBe('‹label full›')
    expect(document.querySelector('[data-testid$="-rests_on"]')!.getAttribute('aria-label')).toBe('‹rests on label›')
    cleanup()
    // The lens bar as the canvas mounts it (ViewCanvas: <ViewLensBar nav />): Model, Explore and its menu, Team.
    render(<ViewLensBar nav />)
    const nav = screen.getByRole('toolbar')
    expect(nav.getAttribute('aria-label')).toBe('‹lens bar›')
    expect(within(nav).getByTestId('lens-bar-explore').textContent).toBe('‹explore›')
    expect(nav.textContent).toContain('‹team›')
    fireEvent.click(within(nav).getByTestId('lens-bar-explore'))
    expect(screen.getByTestId('lens-bar-explore-menu').getAttribute('aria-label')).toBe('‹explore›')
  })

  it('the Team tab: each evidence line, the evidence form\'s labels and stance picker, and each member\'s own line are core\'s', async () => {
    const v = marked()
    setView(v)
    resetWrites(); resetDrafts(); setPagePerson(v.you_id)
    // A write core answers, then a failure that is not core's refusal (the page's own re-read throws): core's sentence for it is shown.
    const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { 'content-type': 'application/json' } })
    setTeamFetch(vi.fn(async (url: RequestInfo | URL) => (String(url).endsWith('/api/me') ? json({ me: { id: v.you_id } }) : json({ ok: true }))))
    const broken = async (): Promise<boolean> => { throw new Error('re-read failed') }
    render(<><ViewsPanel sid={v.id} view={v} onWrote={broken} /><EvidencePanel sid={v.id} view={v} onWrote={broken} /></>)
    const ev = screen.getByTestId('team-evidence')
    expect([ev.getAttribute('aria-label'), ev.querySelector('h3')!.textContent]).toEqual(['‹evidence heading›', '‹evidence heading›'])
    const withSource = v.evidence.find((e) => e.source !== null)!
    expect(screen.getByTestId(`team-evidence-about-${withSource.id}`).textContent).toBe(`‹bears on text ${withSource.id}›`)
    expect(screen.getByTestId(`team-evidence-source-${withSource.id}`).textContent).toBe(`‹tw evidence.sourcePrefix› ${withSource.source}`)
    expect(screen.getByTestId(`team-evidence-consider-${withSource.id}`).textContent).toBe('‹tw evidence.consider›')
    const asked = v.evidence.find((e) => e.considered != null)
    if (asked) expect(screen.getByTestId(`team-evidence-considered-by-${asked.id}`).textContent).toBe(`‹tw evidence.consideredBy› ${asked.considered!.by}`)
    fireEvent.click(screen.getByTestId(`team-evidence-consider-${withSource.id}`))
    expect((await screen.findByTestId(`team-evidence-consider-error-${withSource.id}`)).textContent).toBe('‹tw failed›')
    // The views panel's own words: who is held, the skip, the give.
    expect(screen.getByTestId('team-view-give').textContent).toBe('‹tw views.give›')
    expect(screen.getByTestId('team-view-skip').textContent).toBe('‹tw views.skip›')
    fireEvent.click(screen.getByTestId('team-view-skip'))
    expect((await screen.findByTestId('team-views-error')).textContent).toBe('‹tw failed›')
    setTeamFetch(null); setPagePerson(null)
    // Each member's line, by member id.
    for (const m of v.members) expect(screen.getByTestId(`team-member-${m.id}`).textContent).toBe(`‹‹member ${m.id}›`) // its initial, then core's line
    // Each piece of evidence says who holds it and how, in core's line for that piece.
    for (const e of v.evidence) expect(screen.getByTestId(`team-evidence-${e.id}`).querySelector('p')!.textContent).toBe(`‹stance ${e.id}›`)
    expect(screen.getByTestId('team-evidence-open').textContent).toBe('‹tw evidence.add›')
    fireEvent.click(screen.getByTestId('team-evidence-open'))
    const form = screen.getByTestId('team-evidence-form')
    expect(document.querySelector('label[for="team-evidence-bears"]')!.textContent).toBe('‹bears on›')
    expect([document.querySelector('label[for="team-evidence-text"]')!.textContent, document.querySelector('label[for="team-evidence-source"]')!.textContent,
      screen.getByTestId('team-evidence-source').getAttribute('placeholder')]).toEqual(['‹tw evidence.text›', '‹tw evidence.source›', '‹tw evidence.sourcePlaceholder›'])
    expect([...screen.getByTestId('team-evidence-bears').querySelectorAll('option')].slice(0, 2).map((o) => o.textContent)).toEqual(['‹tw evidence.choose›', '‹tw evidence.nothingYet›'])
    expect(form.querySelector('legend')!.textContent).toBe('‹tw evidence.stanceLegend›')
    expect(form.textContent).toContain('‹tw evidence.sharedNote›')
    expect([screen.getByTestId('team-evidence-add').textContent, [...form.querySelectorAll('button')].at(-1)!.textContent]).toEqual(['‹tw evidence.add›', '‹tw evidence.cancel›'])
    const picker = screen.getByTestId('team-evidence-stance')
    expect([...picker.querySelectorAll('label')].map((l) => [l.querySelector('input')!.value, l.textContent])).toEqual(v.evidence_words.stances.map((x) => [x.id, `‹stance word ${x.id}›`]))
  })

  it('the Overview\'s close and a refused what-if say core\'s words, whole', () => {
    // The Strategy Overview's Close is core's close word (the same meaning as the docks': close this panel).
    const growth: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/strategy', 'growth-reveal-n1.view3.json'), 'utf8'))
    render(<StrategyOverviewPage view={{ ...growth, evidence_words: { ...growth.evidence_words, close: '‹overview close›' } }} onClose={() => {}} />)
    expect(screen.getByTestId('strategy-overview-page').querySelector('button[aria-label]')!.getAttribute('aria-label')).toBe('‹overview close›')
    cleanup()
    // A what-if core could not run: core's own reason is the words on the key card, not a UI sentence.
    const variant = { stopped: null, blocked: '‹core blocked reason›', rows: [], moved: false, why_not: null, most_likely: null }
    render(<Compare model={real.model!} shown={{ sid: real.id, base: 1, quantity: 'q', typed: '1', variant } as unknown as Parameters<typeof Compare>[0]['shown']} />)
    expect(screen.getByTestId('view-whatif-key-blocked').textContent).toBe('‹core blocked reason›')
  })
})
