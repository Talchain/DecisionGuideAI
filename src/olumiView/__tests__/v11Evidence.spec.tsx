/**
 * V11 change 1, the evidence chain (Paul, 6 Nov): each piece of shared evidence sits on the cards it concerns and opens in the dock as a
 * chain from what was seen to what the model uses. Bound by identity: evidence ids, card ids and core's exact words from a real View.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { useUIStore } from '../../stores/uiStore'
import { useReveal } from '../reveal'
import { chainOf, evidenceOn } from '../evidence'
import { CardEvidenceMarks } from '../RevealMarks'
import { EvidenceDock, evidenceDockShown } from '../EvidenceDock'

/** A real View (core wip/debate eaab1331 on a copy of Paul's board; seeded demo people; fixtures/v11/README.md). */
const real: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/v11', 'consulting-evidence.view3.json'), 'utf8'))
const PRIYA = real.evidence.find((e) => e.by === 'Priya')!, TOM = real.evidence.find((e) => e.by === 'Tom')!
const DIAG = 'paid_enterprise_diagnostic'

beforeEach(() => {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-a88ba245176e', sid: real.id, view: real, status: 'ready', error: null, stale: false, at: null })
  useReveal.setState({ selected: null, evidence: null })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('evidence on the model (real View)', () => {
  it('sits on the card of the record it concerns (an option’s own record on the option), and nowhere for a gated member', () => {
    expect(PRIYA.concerns).toEqual(['diagnostic_time_to_contract'])
    expect(evidenceOn(real, DIAG).map((e) => e.id)).toEqual([PRIYA.id, TOM.id])
    expect(evidenceOn(real, 'time_to_contract')).toEqual([])
    expect(evidenceOn({ ...real, gated: true }, DIAG)).toEqual([])
  })

  it('a mark says who brought it and their words; selecting it opens the evidence in the Team tab, closing any open view', () => {
    const force = vi.spyOn(useUIStore.getState(), 'forceActivateOutputTab')
    useReveal.setState({ selected: 19 })
    render(<CardEvidenceMarks card={DIAG} />)
    const mark = document.querySelector(`[data-evidence-mark="${PRIYA.id}"]`) as HTMLElement
    expect(mark.getAttribute('aria-label')).toBe(`Priya · ${PRIYA.text}`)
    fireEvent.click(mark)
    expect(useReveal.getState()).toMatchObject({ evidence: PRIYA.id, selected: null })
    expect(force).toHaveBeenCalledWith('team')
  })

  it('without core’s chain, the dock shows what was seen, what it bears on in core’s words, and no Olumi line before Olumi has considered it', () => {
    useReveal.setState({ evidence: PRIYA.id })
    expect(evidenceDockShown(real, PRIYA.id)).toBe(true)
    render(<EvidenceDock view={real} />)
    const dock = screen.getByTestId('evidence-dock')
    expect(within(dock).getByTestId('evidence-dock-words').textContent).toBe(PRIYA.text)
    expect(within(dock).getByTestId('evidence-dock-source').textContent).toBe(PRIYA.source)
    // The record it concerns by core's own label for it, and the option card it sits on beneath.
    const card = real.model!.cards.find((c) => c.id === DIAG)!, label = real.collab.records.find((r) => r.id === 'diagnostic_time_to_contract')!.label!
    const row = within(dock).getByTestId('evidence-dock-bears').querySelector('[data-evidence-record="diagnostic_time_to_contract"]') as HTMLElement
    expect(row.getAttribute('data-evidence-card')).toBe(DIAG)
    expect(row.textContent).toBe(`${label}${card.heading}`)
    expect(within(dock).getByTestId('evidence-dock-stance')).toHaveTextContent('Priya: Challenges it')
    expect(within(dock).queryByTestId('evidence-dock-considered')).toBeNull()
  })
})

describe('core’s requested chain (REQUESTED-FIELD FIXTURE: shape asked of the DL 7 Nov, values invented placeholders)', () => {
  it('draws each step in core’s words and status, the observation as the person’s own, and Olumi’s reply beneath', () => {
    const steps = [
      { level: 'observation', text: PRIYA.text, status: null, card: null },
      { level: 'claim', text: 'FIXTURE: enterprise contracts here take most of a year to sign', status: 'FIXTURE: Supported', card: null },
      { level: 'inference', text: 'FIXTURE: a paid diagnostic would take as long', status: 'FIXTURE: Not established', card: null },
      { level: 'estimate', text: 'FIXTURE: the estimate stays as it is', status: 'FIXTURE: unchanged', card: DIAG },
    ]
    const shaped: View = { ...real, evidence: real.evidence.map((e) => (e.id === PRIYA.id
      ? { ...e, chain: steps, considered: { at: e.at, by: 'Maya', proposal: null, why: { text: 'FIXTURE: Olumi’s reply', title: 'FIXTURE' } } }
      : e)) } as View
    expect(chainOf(shaped.evidence.find((e) => e.id === PRIYA.id)!)!.map((s) => s.level)).toEqual(['observation', 'claim', 'inference', 'estimate'])
    useReveal.setState({ evidence: PRIYA.id })
    render(<EvidenceDock view={shaped} />)
    const chain = screen.getByTestId('evidence-dock-chain')
    expect([...chain.querySelectorAll('[data-evidence-step]')].map((e) => e.getAttribute('data-evidence-step'))).toEqual(['observation', 'claim', 'inference', 'estimate'])
    expect(chain.querySelector('[data-evidence-step="inference"]')).toHaveTextContent('FIXTURE: Not established')
    expect(chain.querySelector('[data-evidence-step="estimate"]')).toHaveTextContent(real.model!.cards.find((c) => c.id === DIAG)!.heading)
    expect(screen.getByTestId('evidence-dock-considered').textContent).toBe('FIXTURE: Olumi’s reply')
  })
})
