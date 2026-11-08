/**
 * N3: the strategy screen draws core's words whole (olumi-core wip/n3-strategy-words, src/view/screen-words.ts). Each core string in a real
 * View (fixtures/v11/consulting-chain.view3.json, its N3 fields filled by core's own builders) is replaced by a marker no UI could compose,
 * bound to the record it belongs to (mark by card and kind, evidence by id, the viewer by id). The screen must draw each marker exactly where
 * core's field goes: a string composed in the UI from names, figures or a copy table cannot match.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render, screen, within } from '@testing-library/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { useReveal } from '../reveal'
import { CardEvidenceMarks, CardViewChips } from '../RevealMarks'
import { EvidenceDock } from '../EvidenceDock'
import { RevealDock } from '../RevealDock'
import { TeamPresence } from '../TeamPresence'
import { ViewLensBar } from '../ViewLensBar'

const real: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/v11', 'consulting-chain.view3.json'), 'utf8'))
const CARD = 'diagnostic_time_to_contract'
/** The real View with every N3 string replaced by a marker naming its owner. */
function marked(): View {
  const v: View = structuredClone(real)
  v.collab.marks = v.collab.marks!.map((m) => ({ ...m, title: `‹title ${m.card} ${m.kind}›`, label: `‹label ${m.card} ${m.kind}›` }))
  v.evidence = v.evidence.map((e) => ({ ...e, stance_text: `‹stance ${e.id}›`, switch_text: `‹switch ${e.id}›`, mark_label: `‹mark label ${e.id}›`, mark_title: `‹mark title ${e.id}›` }))
  v.evidence_words = { heading: '‹evidence heading›', close: '‹evidence close›', bearsOn: '‹bears on›', steps: { observation: '‹observation›', claim: '‹claim›', inference: '‹inference›', estimate: '‹estimate›' } }
  v.reveal_words = { revealedTogether: '‹revealed together›', close: '‹reveal close›', bringEvidence: '‹bring evidence›', keepOpen: '‹keep open›' }
  v.team_presence = { title: `‹team title ${v.you_id}›`, label: `‹team label ${v.you_id}›` }
  v.lens_words = { ...v.lens_words, bar: '‹lens bar›', rests_on_label: '‹rests on label›', label: { ...v.lens_words.label, full: '‹label full›' } }
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
    expect([...dock.querySelectorAll('[data-evidence-step] > p:first-child')].map((p) => p.textContent)).toEqual(expect.arrayContaining(['‹observation›']))
    cleanup()
    // The reveal dock, opened on view 19 from its chip.
    useReveal.setState({ selected: 19, card: CARD, chip: `${CARD}:disagreement` })
    render(<RevealDock view={v} />)
    const rd = screen.getByTestId('reveal-dock')
    expect(rd.textContent).toContain('‹revealed together›')
    expect(within(rd).getByTestId('reveal-dock-close').getAttribute('aria-label')).toBe('‹reveal close›')
    expect(within(rd).getByTestId('reveal-dock-bring-evidence').textContent).toBe('‹bring evidence›')
    expect(within(rd).getByTestId('reveal-dock-keep-open').textContent).toBe('‹keep open›')
    cleanup()
    // Team presence, for the viewer by id; the lens bar.
    render(<><TeamPresence /><ViewLensBar /></>)
    const tp = screen.getByTestId('team-presence')
    expect([tp.title, tp.getAttribute('aria-label')]).toEqual([`‹team title ${v.you_id}›`, `‹team label ${v.you_id}›`])
    expect(screen.getByRole('radiogroup').getAttribute('aria-label')).toBe('‹lens bar›')
    expect(document.querySelector('[data-lens-label="full"]')!.textContent).toBe('‹label full›')
    expect(document.querySelector('[data-testid$="-rests_on"]')!.getAttribute('aria-label')).toBe('‹rests on label›')
  })
})
