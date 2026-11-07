/**
 * V11 "reveal as a model event" (Paul, 6 Nov): each revealed view is drawn on the card it is about; the consequential disagreement is a chip
 * below its card, the others are initials in theirs; selecting one opens the dock with the person's words, Olumi's model consequence and the
 * other views, and Olumi's one line at the foot. Bound by identity: view ids, card ids and core's exact words from a real View.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { useUIStore } from '../../stores/uiStore'
import { marksOn, revealOf, useReveal } from '../reveal'
import { CardViewChips, CardViewInitials } from '../RevealMarks'
import { RevealDock } from '../RevealDock'
import { clearWhatIf, useWhatIf } from '../whatif'
import { setTeamFetch } from '../../olumiCore/team/api'

/** A real View (core e38d9f4c on a copy of Paul's board, seeded demo people; fixtures/v11/README.md). */
const real: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/v11', 'consulting-reveal.view3.json'), 'utf8'))
const byName = (n: string) => real.collab.shared.find((v) => v.by === n)!
const PRIYA = byName('Priya'), TOM = byName('Tom'), MAYA = byName('Maya')
const DIAG = 'paid_enterprise_diagnostic'

beforeEach(() => {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-a88ba245176e', sid: real.id, view: real, status: 'ready', error: null, stale: false, at: null })
  useReveal.setState({ selected: null })
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); setTeamFetch(null); clearWhatIf() })

describe('where each revealed view sits (real View)', () => {
  it('puts each figure on its card, an option’s own figure on that option, and the moving one as the chip', () => {
    const r = revealOf(real)!
    // Priya's figure is the diagnostic's own record, held in that option's badge: it sits on the option, and core says it moves the chances.
    expect(PRIYA.figures[0]!.quantity).toBe('diagnostic_time_to_contract')
    expect(marksOn(r, DIAG).chips.map((m) => [m.view, m.status])).toEqual([[PRIYA.id, 'moves']])
    expect(marksOn(r, DIAG).initials).toEqual([])
    // Tom's and Maya's figures leave the chances as they are: initials in their own cards, never chips.
    expect(marksOn(r, 'time_to_contract')).toMatchObject({ chips: [], initials: [{ view: TOM.id, status: 'same' }] })
    expect(marksOn(r, 'contract_to_cash')).toMatchObject({ chips: [], initials: [{ view: MAYA.id, status: 'same' }] })
  })

  it('draws nothing for a member core still holds (gated), or before any view is revealed', () => {
    expect(revealOf({ ...real, gated: true })).toBeNull()
    expect(revealOf({ ...real, collab: { ...real.collab, shared: [] } })).toBeNull()
  })

  it('with core’s requested `kind`, only a disagreement is a chip, labelled in core’s own words (FIXTURE fields)', () => {
    // REQUESTED-FIELD FIXTURE (DL 7 Nov): `kind` and `chip` are placeholders of the shape asked of core, not core output.
    const withKind: View = { ...real, collab: { ...real.collab, shared: real.collab.shared.map((v) => (v.id === TOM.id
      ? { ...v, kind: 'disagreement', effects: v.effects.map((e) => ({ ...e, chip: 'FIXTURE: Tom sees a longer wait to the first contract' })) }
      : { ...v, kind: 'shared' })) } }
    const r = revealOf(withKind)!
    expect(marksOn(r, 'time_to_contract').chips.map((m) => [m.view, m.chip])).toEqual([[TOM.id, 'FIXTURE: Tom sees a longer wait to the first contract']])
    expect(marksOn(r, DIAG).chips).toEqual([])
    expect(marksOn(r, DIAG).initials.map((m) => m.view)).toEqual([PRIYA.id])
  })
})

describe('on the canvas and in the dock', () => {
  it('the chip and initials say core’s words; selecting one opens it in the Team tab', () => {
    const force = vi.spyOn(useUIStore.getState(), 'forceActivateOutputTab')
    render(<><CardViewChips card={DIAG} /><CardViewInitials card="time_to_contract" /></>)
    const chip = screen.getByTestId(`reveal-chips-${DIAG}`).querySelector(`[data-reveal-chip="${PRIYA.id}"]`) as HTMLElement
    expect(chip).toHaveTextContent(`Priya: ${PRIYA.figures[0]!.text}`)
    expect(chip.getAttribute('title')).toBe(`Priya · ${PRIYA.figures[0]!.label}: ${PRIYA.figures[0]!.text} · ${real.collab.effect_headings.moves}`)
    fireEvent.click(chip)
    expect(useReveal.getState().selected).toBe(PRIYA.id)
    expect(force).toHaveBeenCalledWith('team')
    expect(screen.getByTestId('reveal-initials-time_to_contract').querySelector(`[data-reveal-initial="${TOM.id}"]`)).toHaveTextContent('T')
  })

  it('the dock shows their words, core’s consequence, the others, and Olumi’s one line at the foot', () => {
    useReveal.setState({ selected: PRIYA.id })
    render(<RevealDock view={real} />)
    const dock = screen.getByTestId('reveal-dock')
    expect(within(dock).getByTestId('reveal-dock-words').textContent).toBe(PRIYA.text)
    const consequence = within(dock).getByTestId('reveal-dock-consequence')
    const run = PRIYA.effects.find((e) => !('refused' in e) && e.status === 'moves') as Extract<typeof PRIYA.effects[number], { status: string }>
    expect(consequence).toHaveTextContent(real.collab.effect_headings.moves)
    expect(consequence).toHaveTextContent(run.gap_text!)
    expect(within(dock).getByTestId(`reveal-dock-other-${TOM.id}`)).toHaveTextContent('Tom')
    expect(within(dock).getByTestId(`reveal-dock-other-${MAYA.id}`)).toHaveTextContent('Maya')
    expect(within(dock).getByTestId('reveal-dock-next').textContent).toBe(real.model!.run!.most_likely!.text)
    fireEvent.click(within(dock).getByTestId(`reveal-dock-other-${TOM.id}`))
    expect(useReveal.getState().selected).toBe(TOM.id)
  })
})

describe('try their figure in place (V11 change 4)', () => {
  /** Core's real what-if answer for Priya's figure on the same copy (fixtures/v11/README.md). */
  const whatif = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/v11', 'consulting-whatif-priya.json'), 'utf8'))
  it('runs their figure, as core words it, on a copy; shows each option saved beside what-if; back drops it', async () => {
    const posts: unknown[] = []
    setTeamFetch((async (u: unknown, init?: RequestInit) => {
      if ((init?.method ?? 'GET') === 'GET') return new Response(JSON.stringify({ me: { id: real.you_id, name: real.you } }), { status: 200 })
      posts.push({ path: String(u), body: JSON.parse(String(init!.body)) })
      return new Response(JSON.stringify(whatif), { status: 200 })
    }) as unknown as typeof fetch)
    useReveal.setState({ selected: PRIYA.id })
    render(<RevealDock view={real} />)
    await act(async () => { fireEvent.click(screen.getByTestId('reveal-dock-try')) })
    expect(posts).toEqual([{ path: `/api/scenarios/${real.id}/whatif`, body: { base: real.model!.edit_base, variants: [{ edits: [{ quantity: 'diagnostic_time_to_contract', typed: PRIYA.figures[0]!.text }] }] } }])
    const tried = await screen.findByTestId('reveal-dock-tried')
    expect(tried).toHaveTextContent(whatif.variants[0].edits[0].words)
    const aim = tried.querySelector('[data-side-by-side-aim="generate_revenue_quickly"]') as HTMLElement
    const diag = aim.querySelector(`[data-side-by-side-option="${DIAG}"]`) as HTMLElement
    // Only the option whose chance core words differently on the copy is marked as changed.
    expect([...aim.querySelectorAll('[data-changed]')].map((e) => e.getAttribute('data-side-by-side-option'))).toEqual([DIAG])
    const savedChance = real.model!.cards.find((c) => c.id === DIAG)!.rows.find((r) => r.kind === 'chance')!
    const triedChance = whatif.variants[0].rows.find((o: { option_id: string }) => o.option_id === DIAG).rows.find((r: { kind: string }) => r.kind === 'chance')
    expect(diag.querySelector('[data-side-by-side-saved]')!.textContent).toBe((savedChance as { value: string }).value)
    expect(diag.querySelector('[data-side-by-side-copy]')!.textContent).toBe(triedChance.value)
    expect(screen.queryByTestId('reveal-dock-consequence')).toBeNull()
    fireEvent.click(screen.getByTestId('reveal-dock-untry'))
    await waitFor(() => expect(screen.queryByTestId('reveal-dock-tried')).toBeNull())
    expect(useWhatIf.getState().shown).toBeNull()
  })
})
