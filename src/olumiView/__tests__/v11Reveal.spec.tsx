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
import { CardViewChips, CardViewInitials, OptionMarkLine } from '../RevealMarks'
import { RevealDock } from '../RevealDock'
import { clearWhatIf, useWhatIf } from '../whatif'
import { setTeamFetch } from '../../olumiCore/team/api'
import { ViewLensBar } from '../ViewLensBar'
import { useViewLens } from '../lens'

/** A real View (core e38d9f4c on a copy of Paul's board, seeded demo people; fixtures/v11/README.md). */
const real: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/v11', 'consulting-reveal.view3.json'), 'utf8'))
const byName = (n: string) => real.collab.shared.find((v) => v.by === n)!
const PRIYA = byName('Priya'), TOM = byName('Tom'), MAYA = byName('Maya')
const DIAG = 'paid_enterprise_diagnostic'

beforeEach(() => {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-a88ba245176e', sid: real.id, view: real, status: 'ready', error: null, stale: false, at: null })
  useReveal.setState({ selected: null, card: null, evidence: null })
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

describe('core’s V11 fields as shipped (core wip/debate eaab1331; values below are placeholders of that shape)', () => {
  it('a view’s `about` puts its initials on each card it names; `next: null` means no line at the foot', () => {
    const shaped: View = { ...real, collab: { ...real.collab, next: null,
      shared: real.collab.shared.map((v) => (v.id === MAYA.id ? { ...v, kind: 'unique', about: ['contract_to_cash', DIAG] } : { ...v, kind: 'shared', about: [] })) } } as View
    const r = revealOf(shaped)!
    // Priya's figure (now `shared`, not a disagreement) is initials on the option; Maya's words name it too, so hers sit there as well.
    expect(marksOn(r, DIAG).initials.map((m) => [m.view, m.figure?.quantity ?? null])).toEqual([[PRIYA.id, 'diagnostic_time_to_contract'], [MAYA.id, null]])
    expect(marksOn(r, 'contract_to_cash').initials.map((m) => m.view)).toEqual([MAYA.id])
    // No view is a disagreement here, so no chip, whatever the effect statuses say.
    expect(r.marks.filter((m) => m.isChip)).toEqual([])
    useReveal.setState({ selected: PRIYA.id })
    render(<RevealDock view={shaped} />)
    expect(screen.queryByTestId('reveal-dock-next')).toBeNull()
  })
})

describe('core’s own V11 fields (real View, core wip/debate eaab1331, seed 2)', () => {
  const debate: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/v11', 'consulting-disagreement.view3.json'), 'utf8'))
  const who = (n: string) => debate.collab.shared.find((v) => v.by === n)!
  const P = who('Priya'), T = who('Tom'), M = who('Maya')
  const tomChip = (T.effects.find((e) => 'chip' in e) as { chip: string }).chip
  it('the two people core calls a disagreement are chips on the card they differ on; the unique view is initials', () => {
    const r = revealOf(debate)!
    expect(marksOn(r, DIAG).chips.map((m) => [m.view, m.status, m.chip])).toEqual([[P.id, 'moves', null], [T.id, 'changes', tomChip]])
    expect(marksOn(r, 'contract_to_cash')).toMatchObject({ chips: [], initials: [{ view: M.id }] })
  })
  it('the chip shows who and their figure; core’s sentence is its hover and leads the dock; core’s question is at the foot', () => {
    useViewStore.setState({ view: debate })
    render(<CardViewChips card={DIAG} />)
    const chip = document.querySelector(`[data-reveal-chip="${T.id}"]`) as HTMLElement
    expect(chip).toHaveTextContent(`Tom: ${T.figures[0]!.text}`)
    expect(chip.getAttribute('title')).toBe(tomChip)
    cleanup()
    useReveal.setState({ selected: T.id })
    render(<RevealDock view={debate} />)
    expect(screen.getByTestId('reveal-dock-chip').textContent).toBe(tomChip)
    expect(screen.getByTestId('reveal-dock-next').textContent).toBe((debate.collab as unknown as { next: { text: string } }).next.text)
  })
})

describe('core’s per-card marks (real View, core wip/debate-r2 5a61369a)', () => {
  const marked: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/v11', 'consulting-marks.view3.json'), 'utf8'))
  const id = (n: string) => marked.collab.shared.find((v) => v.by === n)!.id
  it('one chip per card in core’s own words, of every kind, gathering its people', () => {
    const r = revealOf(marked)!
    expect(marksOn(r, DIAG).chip).toEqual({ card: DIAG, kind: 'disagreement', text: 'Priya and Tom differ', views: [id('Priya'), id('Tom')], people: [{ view: id('Priya'), by: 'Priya' }, { view: id('Tom'), by: 'Tom' }], reading: null, options: [] })
    expect(marksOn(r, DIAG).initials).toEqual([])
    // Every kind is a chip (Paul's approved grammar, 7 Nov v2.1): "Only Maya raised it" too, so the kind reads without a click.
    expect(marksOn(r, 'contract_to_cash')).toMatchObject({ chip: { kind: 'unique', text: 'Only Maya raised it', views: [id('Maya')] }, initials: [] })
    useViewStore.setState({ view: marked })
    render(<><CardViewChips card={DIAG} /><CardViewChips card="contract_to_cash" /></>)
    const chips = screen.getByTestId(`reveal-chips-${DIAG}`).querySelectorAll('button')
    expect(chips).toHaveLength(1)
    expect(chips[0]!.querySelector('[data-reveal-chip-text]')!.textContent).toBe('Priya and Tom differ')
    expect(screen.getByTestId('reveal-chips-contract_to_cash').querySelector('[data-reveal-chip-text]')!.textContent).toBe('Only Maya raised it')
    fireEvent.click(chips[0]!)
    expect(useReveal.getState()).toMatchObject({ selected: id('Priya'), card: DIAG })
  })
  it('opened from the chip, the panel leads with both people, then Olumi’s reading, then core’s question with one primary action', () => {
    useViewStore.setState({ view: marked })
    useReveal.setState({ selected: id('Priya'), card: DIAG, evidence: null })
    render(<RevealDock view={marked} />)
    expect(screen.getByTestId('reveal-dock-heading').textContent).toBe(marked.model!.cards.find((c) => c.id === DIAG)!.heading)
    expect([...screen.getByTestId('reveal-dock').querySelectorAll('[data-testid^="reveal-dock-view-"]')].map((e) => e.getAttribute('data-testid'))).toEqual([`reveal-dock-view-${id('Priya')}`, `reveal-dock-view-${id('Tom')}`])
    expect(screen.getByTestId('reveal-dock-next').textContent).toBe((marked.collab as unknown as { next: { text: string } }).next.text)
    expect(screen.getByTestId('reveal-dock-bring-evidence')).toHaveTextContent('Bring evidence')
    fireEvent.click(screen.getByTestId('reveal-dock-keep-open'))
    expect(useReveal.getState()).toMatchObject({ selected: null, card: null })
  })
  it('while a chip is open, an option card shows core’s words for it from the mark (REQUESTED-FIELD FIXTURE); none when closed', () => {
    const shaped = { ...marked, collab: { ...marked.collab, marks: (marked.collab as unknown as { marks: object[] }).marks.map((m, i) => (i === 0
      ? { ...m, options: [{ option: DIAG, text: 'FIXTURE: 49% → under 1% with Priya’s figure' }] } : m)) } } as unknown as View
    useViewStore.setState({ view: shaped })
    const { rerender } = render(<OptionMarkLine card={DIAG} />)
    expect(document.querySelector(`[data-reveal-option-line="${DIAG}"]`)).toBeNull()
    act(() => { useReveal.setState({ selected: id('Priya'), card: DIAG, evidence: null }) })
    rerender(<OptionMarkLine card={DIAG} />)
    expect(document.querySelector(`[data-reveal-option-line="${DIAG}"]`)!.textContent).toBe('FIXTURE: 49% → under 1% with Priya’s figure')
    expect(document.querySelector('[data-reveal-option-line="add_consulting"]')).toBeNull()
  })
  it('with core’s requested stance and reading (REQUESTED-FIELD FIXTURE values), each is drawn as given', () => {
    const shaped = { ...marked, collab: { ...marked.collab,
      shared: marked.collab.shared.map((v) => (v.by === 'Priya' ? { ...v, stance: 'FIXTURE: Observed, three prospects' } : v)),
      marks: (marked.collab as unknown as { marks: object[] }).marks.map((m, i) => (i === 0 ? { ...m, reading: { text: 'FIXTURE: Olumi’s reading', note: 'FIXTURE: unconfirmed; Priya and Tom can correct it' } } : m)) } } as unknown as View
    useViewStore.setState({ view: shaped })
    useReveal.setState({ selected: id('Priya'), card: DIAG, evidence: null })
    render(<RevealDock view={shaped} />)
    expect(screen.getByTestId(`reveal-dock-stance-${id('Priya')}`).textContent).toBe('FIXTURE: Observed, three prospects')
    expect(screen.getByTestId('reveal-dock-reading')).toHaveTextContent('FIXTURE: Olumi’s reading')
    expect(screen.getByTestId('reveal-dock-reading-note').textContent).toBe('FIXTURE: unconfirmed; Priya and Tom can correct it')
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
    expect(within(dock).getByTestId('reveal-dock-next').textContent).toBe(real.model!.run!.most_likely!.text)
    fireEvent.click(within(dock).getByTestId('reveal-dock-keep-open'))
    expect(useReveal.getState().selected).toBeNull()
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

describe('V11 navigation: Model, Explore, Team (Paul 6 Nov)', () => {
  it('holds three; Explore lists the other lenses in their own words and names the one on; Team opens the Team tab', () => {
    const force = vi.spyOn(useUIStore.getState(), 'forceActivateOutputTab')
    useViewLens.setState({ lens: 'full' })
    render(<ViewLensBar nav />)
    const bar = screen.getByTestId('lens-bar')
    expect([...bar.querySelectorAll(':scope > button, :scope > div > button')].map((b) => b.textContent)).toEqual(['Model', 'Explore', 'Team'])
    fireEvent.click(screen.getByTestId('lens-bar-explore'))
    const menu = screen.getByTestId('lens-bar-explore-menu')
    expect([...menu.querySelectorAll('[role="menuitemradio"]')].map((b) => b.getAttribute('data-testid'))).toEqual(['lens-bar-tradeoffs', 'lens-bar-rests_on', 'lens-bar-premortem', 'lens-bar-what_changes', 'lens-bar-what_if'])
    fireEvent.click(screen.getByTestId('lens-bar-tradeoffs'))
    expect(useViewLens.getState().lens).toBe('tradeoffs')
    expect(screen.queryByTestId('lens-bar-explore-menu')).toBeNull()
    expect(screen.getByTestId('lens-bar-explore')).toHaveTextContent('Trade-offs')
    fireEvent.click(screen.getByTestId('lens-bar-full'))
    expect(useViewLens.getState().lens).toBe('full')
    fireEvent.click(screen.getByTestId('lens-bar-team'))
    expect(force).toHaveBeenCalledWith('team')
  })
})
