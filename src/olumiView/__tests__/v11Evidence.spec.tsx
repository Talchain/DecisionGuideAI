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
import { Proposal } from '../ViewChat'

/** A real View (core wip/debate eaab1331 on a copy of Paul's board; seeded demo people; fixtures/v11/README.md). */
const real: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/v11', 'consulting-evidence.view3.json'), 'utf8'))
const PRIYA = real.evidence.find((e) => e.by === 'Priya')!, TOM = real.evidence.find((e) => e.by === 'Tom')!
const DIAG = 'paid_enterprise_diagnostic'

beforeEach(() => {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-a88ba245176e', sid: real.id, view: real, status: 'ready', error: null, stale: false, at: null })
  useReveal.setState({ selected: null, evidence: null, card: null, chip: null })
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

describe('the dock’s source and the rest of an evidence chip (real Views)', () => {
  it('only a plain web address is a link; any other source is words', () => {
    const at = (link: string) => ({ ...real, evidence: real.evidence.map((e) => (e.id === PRIYA.id ? { ...e, link, source: link } : e)) }) as View
    useReveal.setState({ evidence: PRIYA.id })
    const { unmount } = render(<EvidenceDock view={at('https://example.com/report')} />)
    expect(screen.getByTestId('evidence-dock-source').tagName).toBe('A')
    expect(screen.getByTestId('evidence-dock-source').getAttribute('href')).toBe('https://example.com/report')
    unmount()
    render(<EvidenceDock view={at('javascript:alert(1)')} />)
    expect(screen.getByTestId('evidence-dock-source').tagName).toBe('P')
  })
  it('opened from core’s evidence chip, the other evidence it gathers opens in its bringer’s name, on the same card (core f3aedd9a, seed 3)', () => {
    const st: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/v11', 'consulting-stance.view3.json'), 'utf8'))
    const [first, second] = st.evidence
    useViewStore.setState({ view: st, sid: st.id })
    const EVID = `${(st.collab as unknown as { marks: { card: string; kind: string }[] }).marks.find((m) => m.kind === 'evidence')!.card}:evidence`
    useReveal.setState({ evidence: first!.id, card: DIAG, chip: EVID })
    render(<EvidenceDock view={st} />)
    const also = screen.getByTestId('evidence-dock-also').querySelector(`[data-evidence-also="${second!.id}"]`) as HTMLElement
    expect(also.textContent).toBe(`${second!.by.slice(0, 1)}${second!.by}’s evidence`)
    fireEvent.click(also)
    expect(useReveal.getState()).toMatchObject({ evidence: second!.id, card: DIAG, chip: EVID })
    expect(screen.getByTestId('evidence-dock-words').textContent).toBe(second!.text)
  })
  it('CONTRAST: opened from a document mark (no chip), there is no switch', () => {
    useReveal.setState({ evidence: PRIYA.id })
    render(<EvidenceDock view={real} />)
    expect(screen.queryByTestId('evidence-dock-also')).toBeNull()
  })
})

describe('core’s chain as served (real View, core wip/debate-n1 53477b92, seed 3; not put to Olumi, so no inference step)', () => {
  const n1: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/v11', 'consulting-chain.view3.json'), 'utf8'))
  const e = n1.evidence[0]!
  const steps = chainOf(e)!
  it('draws core’s observation lines as one step, then the claim and the model estimate in core’s words, each with core’s status', () => {
    expect(steps.map((st) => st.level)).toEqual(['observation', 'observation', 'claim', 'estimate'])
    useViewStore.setState({ view: n1, sid: n1.id })
    useReveal.setState({ evidence: e.id })
    render(<EvidenceDock view={n1} />)
    const chain = screen.getByTestId('evidence-dock-chain')
    expect([...chain.querySelectorAll('[data-evidence-step]')].map((x) => x.getAttribute('data-evidence-step'))).toEqual(['observation', 'claim', 'estimate'])
    expect(screen.getByTestId('evidence-dock-words').textContent).toBe(steps[0]!.text)
    expect(steps[0]!.text).toBe(e.text)
    expect(screen.getByTestId('evidence-dock-source').textContent).toBe(steps[1]!.text)
    const claim = chain.querySelector('[data-evidence-step="claim"]')!, estimate = chain.querySelector('[data-evidence-step="estimate"]')!
    expect(claim).toHaveTextContent(steps[2]!.text)
    expect(claim.querySelector('[data-evidence-status]')!.textContent).toBe(steps[2]!.status)
    expect(estimate).toHaveTextContent(steps[3]!.text)
    expect(estimate.querySelector('[data-evidence-status]')!.textContent).toBe(steps[3]!.status)
    // The step's record is drawn as its own card here, and core's words already name it: no second heading.
    expect(n1.model!.cards.some((c) => c.id === steps[2]!.card)).toBe(true)
    expect(claim.querySelector('[data-evidence-step-card]')).toBeNull()
    expect(chain.querySelector('[data-evidence-step="inference"]')).toBeNull()
  })
})

describe('core’s requested chain (REQUESTED-FIELD FIXTURE: shape asked of the DL 7 Nov, values invented placeholders)', () => {
  it('draws each step in core’s words and status, the observation as the person’s own, and Olumi’s reply beneath', () => {
    const steps = [
      { level: 'observation', text: PRIYA.text, status: null, card: null },
      { level: 'claim', text: 'FIXTURE: enterprise contracts here take most of a year to sign', status: 'FIXTURE: Supported', card: null },
      { level: 'inference', text: 'FIXTURE: a paid diagnostic would take as long', status: 'FIXTURE: Not established', card: null },
      { level: 'estimate', text: 'FIXTURE: the estimate stays as it is', status: 'FIXTURE: unchanged', card: 'diagnostic_time_to_contract' },
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
    // A record folded into an option (this View draws it in the diagnostic's badge): the step says which card it sits on.
    expect(real.model!.cards.some((c) => c.id === 'diagnostic_time_to_contract')).toBe(false)
    expect(chain.querySelector('[data-evidence-step="estimate"] [data-evidence-step-card]')!.textContent).toBe(real.model!.cards.find((c) => c.id === DIAG)!.heading)
    expect(screen.getByTestId('evidence-dock-considered').textContent).toBe('FIXTURE: Olumi’s reply')
  })
})

describe('V11 change 6: core’s verdict on a held proposal (real proposal; verdict is a REQUESTED-FIELD FIXTURE)', () => {
  const held: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/v11', 'consulting-proposal.view3.json'), 'utf8'))
  const p = held.proposal!
  it('a change the evidence does not support shows core’s words and what would, and no Approve; Set aside stays', () => {
    const refused = { ...p, verdict: { supported: false, text: 'FIXTURE: Evidence does not support this change.', asks: 'FIXTURE: Buying evidence would.' } } as typeof p
    render(<Proposal p={refused} busy={false} evidence={[]} />)
    expect(screen.getByTestId('view-proposal-verdict').getAttribute('data-supported')).toBe('false')
    expect(screen.getByTestId('view-proposal-verdict')).toHaveTextContent('FIXTURE: Evidence does not support this change.')
    expect(screen.getByTestId('view-proposal-verdict-asks').textContent).toBe('FIXTURE: Buying evidence would.')
    expect(screen.queryByTestId('view-approve')).toBeNull()
    expect(screen.queryByTestId('view-approve-ticked')).toBeNull()
    expect(screen.getByRole('button', { name: 'Set aside' })).toBeTruthy()
  })
  it('CONTRAST: a supported change keeps Approve beside core’s words; a core without a verdict offers Approve as before', () => {
    const ok = { ...p, verdict: { supported: true, text: 'FIXTURE: The evidence supports this change.', asks: null } } as typeof p
    const { unmount } = render(<Proposal p={ok} busy={false} evidence={[]} />)
    expect(screen.getByTestId('view-approve')).toBeTruthy()
    expect(screen.getByTestId('view-proposal-verdict').getAttribute('data-supported')).toBe('true')
    unmount()
    render(<Proposal p={p} busy={false} evidence={[]} />)
    expect(screen.getByTestId('view-approve')).toBeTruthy()
    expect(screen.queryByTestId('view-proposal-verdict')).toBeNull()
  })
})
