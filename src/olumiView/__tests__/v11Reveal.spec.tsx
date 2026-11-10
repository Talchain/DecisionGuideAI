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
import { marksOn, openChipOf, revealOf, useReveal, withChipsAbove, withOpenCard } from '../reveal'
import { useCanvasStore } from '../../canvas/store'
import { CardEvidenceMarks, CardViewChips, CardViewInitials, OptionMarkLine } from '../RevealMarks'
import { EvidenceDock } from '../EvidenceDock'
import { RevealDock } from '../RevealDock'
import { ViewLensBar } from '../ViewLensBar'
import { useViewLens } from '../lens'

/** A real View (core e38d9f4c on a copy of Paul's board, seeded demo people; fixtures/v11/README.md). */
const real: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/v11', 'consulting-reveal.view3.json'), 'utf8'))
const byName = (n: string) => real.collab.shared.find((v) => v.by === n)!
const PRIYA = byName('Priya'), TOM = byName('Tom'), MAYA = byName('Maya')
const DIAG = 'paid_enterprise_diagnostic'

beforeEach(() => {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-a88ba245176e', sid: real.id, view: real, status: 'ready', error: null, stale: false, at: null })
  useReveal.setState({ selected: null, card: null, evidence: null, chip: null })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('where each revealed view sits (real View)', () => {
  it('puts each figure on its card, an option’s own figure on that option; with no core mark gathering a view, each is initials (N3)', () => {
    const r = revealOf(real)!
    // Priya's figure is the diagnostic's own record, held in that option's badge: it sits on the option, and core says it moves the chances.
    // N3: only core's marks make chips; this View (a core before marks) has none, so the UI ranks nothing and draws Priya as initials.
    expect(PRIYA.figures[0]!.quantity).toBe('diagnostic_time_to_contract')
    expect(marksOn(r, DIAG).chips).toEqual([])
    expect(marksOn(r, DIAG).initials.map((m) => [m.view, m.status])).toEqual([[PRIYA.id, 'moves']])
    // Tom's and Maya's figures leave the chances as they are: initials in their own cards, never chips.
    expect(marksOn(r, 'time_to_contract')).toMatchObject({ chips: [], initials: [{ view: TOM.id, status: 'same' }] })
    expect(marksOn(r, 'contract_to_cash')).toMatchObject({ chips: [], initials: [{ view: MAYA.id, status: 'same' }] })
  })

  it('draws nothing for a member core still holds (gated), or before any view is revealed', () => {
    expect(revealOf({ ...real, gated: true })).toBeNull()
    expect(revealOf({ ...real, collab: { ...real.collab, shared: [] } })).toBeNull()
  })
  // N3 removed the interim rules for cores before `collab.marks` (a chip by `kind` alone, or by the highest effect status): ranking and
  // sorting left the UI (contract lint), and core sends its marks with every revealed view. Their rows went with them.
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
  const T = who('Tom')
  const tomChip = (T.effects.find((e) => 'chip' in e) as { chip: string }).chip
  it('core’s sentence leads the dock; core’s question is at the foot', () => {
    useReveal.setState({ selected: T.id })
    render(<RevealDock view={debate} />)
    expect(screen.getByTestId('reveal-dock-chip').textContent).toBe(tomChip)
    expect(screen.getByTestId('reveal-dock-next').textContent).toBe((debate.collab as unknown as { next: { text: string } }).next.text)
  })
})

describe('core’s per-card marks (real View, core wip/debate-r2 5a61369a)', () => {
  const marked: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/v11', 'consulting-marks.view3.json'), 'utf8'))
  const id = (n: string) => marked.collab.shared.find((v) => v.by === n)!.id
  const rec = (marked.collab as unknown as { marks: { card: string }[] }).marks[0]!.card
  it('one chip per card in core’s own words, of every kind, gathering its people', () => {
    const r = revealOf(marked)!
    // Bound by identity (DL ruling 9 Nov): core's mark gained `question` (holds), so the row checks the one chip and who and what it is,
    // not a key count.
    const chips0 = marksOn(r, DIAG).cardChips
    expect(chips0.map((c) => c.key)).toEqual([`${rec}:disagreement`])
    expect(chips0[0]).toMatchObject({ key: `${rec}:disagreement`, card: DIAG, kind: 'disagreement', text: 'Priya and Tom differ', views: [id('Priya'), id('Tom')], evidence: [], people: [{ id: id('Priya'), by: 'Priya' }, { id: id('Tom'), by: 'Tom' }], reading: null, options: [],
      title: marked.collab.marks![0]!.title, label: marked.collab.marks![0]!.label })
    expect(marksOn(r, DIAG).initials).toEqual([])
    // Every kind is a chip (Paul's approved grammar, 7 Nov v2.1): "Only Maya raised it" too, so the kind reads without a click.
    expect(marksOn(r, 'contract_to_cash')).toMatchObject({ cardChips: [{ kind: 'unique', text: 'Only Maya raised it', views: [id('Maya')] }], initials: [] })
    useViewStore.setState({ view: marked })
    render(<><CardViewChips card={DIAG} /><CardViewChips card="contract_to_cash" /></>)
    const chips = screen.getByTestId(`reveal-chips-${DIAG}`).querySelectorAll('button')
    expect(chips).toHaveLength(1)
    expect(chips[0]!.querySelector('[data-reveal-chip-text]')!.textContent).toBe('Priya and Tom differ')
    expect(screen.getByTestId('reveal-chips-contract_to_cash').querySelector('[data-reveal-chip-text]')!.textContent).toBe('Only Maya raised it')
    fireEvent.click(chips[0]!)
    expect(useReveal.getState()).toMatchObject({ selected: id('Priya'), card: DIAG, chip: `${rec}:disagreement` })
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
  it('the initials say core’s words for each figure (N3 `mark_label`, whole); selecting one opens it in the Team tab', () => {
    const force = vi.spyOn(useUIStore.getState(), 'forceActivateOutputTab')
    render(<><CardViewInitials card={DIAG} /><CardViewInitials card="time_to_contract" /></>)
    const chip = screen.getByTestId(`reveal-initials-${DIAG}`).querySelector(`[data-reveal-initial="${PRIYA.id}"]`) as HTMLElement
    expect(chip).toHaveTextContent('P')
    expect(PRIYA.figures[0]!.mark_label).toBe(`Priya · ${PRIYA.figures[0]!.label}: ${PRIYA.figures[0]!.text} · ${real.collab.effect_headings.moves}`)
    expect([chip.getAttribute('title'), chip.getAttribute('aria-label')]).toEqual([PRIYA.figures[0]!.mark_label, PRIYA.figures[0]!.mark_label])
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

describe('core’s marks with stance, reading, options and evidence (real View, core wip/debate-r2 f3aedd9a, seed 3)', () => {
  const st: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/v11', 'consulting-stance.view3.json'), 'utf8'))
  const who = (n: string) => st.collab.shared.find((v) => v.by === n)!
  const P = who('Priya'), T = who('Tom')
  type CoreMarkJson = { card: string; kind: string; views: number[]; evidence: number[]; text: string; reading: { text: string; note: string } | null; options: { option: string; text: string }[]; title: string; label: string }
  const marks = (st.collab as unknown as { marks: CoreMarkJson[] }).marks
  const differ = marks.find((m) => m.kind === 'disagreement')!
  const DIFFER = `${differ.card}:disagreement`, EVID = `${marks.find((m) => m.kind === 'evidence')!.card}:evidence`
  const ev = st.evidence.map((e) => e.id)
  const withMarks = (ms: CoreMarkJson[]) => ({ ...st, collab: { ...st.collab, marks: ms } }) as unknown as View
  beforeEach(() => { useViewStore.setState({ view: st, sid: st.id }) })

  it('a card with two marks has two chips in core’s words, the disagreement first; the evidence chip gathers its bringers', () => {
    const r = revealOf(st)!
    expect(marksOn(r, DIAG).cardChips.map((c) => [c.kind, c.text, c.views, c.evidence, c.people.map((p) => p.by)])).toEqual([
      ['disagreement', 'Priya and Tom differ', [P.id, T.id], [], ['Priya', 'Tom']],
      ['evidence', 'Priya and Tom added evidence', [], ev, ['Priya', 'Tom']],
    ])
    render(<><CardViewChips card={DIAG} /><CardEvidenceMarks card={DIAG} /></>)
    expect([...screen.getByTestId(`reveal-chips-${DIAG}`).querySelectorAll('[data-reveal-chip-text]')].map((e) => e.textContent)).toEqual(['Priya and Tom differ', 'Priya and Tom added evidence'])
    // The evidence core gathers in its chip is not drawn a second time as document marks in the card.
    expect(screen.queryByTestId(`evidence-marks-${DIAG}`)).toBeNull()
  })

  it('the evidence chip opens its first piece on that card; the disagreement chip opens the people who differ', () => {
    const force = vi.spyOn(useUIStore.getState(), 'forceActivateOutputTab')
    render(<CardViewChips card={DIAG} />)
    fireEvent.click(document.querySelector('[data-reveal-kind="evidence"]')!)
    expect(useReveal.getState()).toMatchObject({ evidence: ev[0], card: DIAG, chip: EVID, selected: null })
    expect(document.querySelector('[data-reveal-kind="evidence"]')!.getAttribute('aria-pressed')).toBe('true')
    expect(document.querySelector('[data-reveal-kind="disagreement"]')!.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(document.querySelector('[data-reveal-kind="disagreement"]')!)
    expect(useReveal.getState()).toMatchObject({ selected: P.id, card: DIAG, chip: DIFFER, evidence: null })
    expect(force).toHaveBeenCalledWith('team')
  })

  it('the panel draws core’s stance words, reading and note, and question; it holds no try of its own', () => {
    useReveal.setState({ selected: P.id, card: DIAG, chip: DIFFER })
    render(<RevealDock view={st} />)
    expect(screen.getByTestId(`reveal-dock-stance-${P.id}`).textContent).toBe('Knows from experience')
    expect(screen.getByTestId(`reveal-dock-stance-${T.id}`).textContent).toBe('Suspects')
    expect(screen.getByTestId('reveal-dock-reading')).toHaveTextContent(differ.reading!.text)
    expect(screen.getByTestId('reveal-dock-reading-note').textContent).toBe(differ.reading!.note)
    expect(screen.getByTestId('reveal-dock-next').textContent).toBe((st.collab as unknown as { next: { text: string } }).next.text)
    expect(screen.queryByTestId('reveal-dock-try')).toBeNull()
    expect(screen.getByTestId('reveal-dock').querySelectorAll('button')).toHaveLength(3)
  })

  it('while the disagreement is open, each option card shows core’s words for it; the evidence chip open shows none', () => {
    const lines = () => differ.options.map((o) => document.querySelector(`[data-reveal-option-line="${o.option}"]`)?.textContent ?? null)
    const all = () => <>{differ.options.map((o) => <OptionMarkLine key={o.option} card={o.option} />)}</>
    const { rerender } = render(all())
    expect(differ.options.length).toBeGreaterThan(1)
    act(() => { useReveal.setState({ selected: P.id, card: DIAG, chip: DIFFER, evidence: null }) })
    rerender(all())
    expect(lines()).toEqual(differ.options.map((o) => o.text))
    act(() => { useReveal.setState({ selected: null, card: DIAG, chip: EVID, evidence: ev[0] }) })
    rerender(all())
    expect(lines()).toEqual(differ.options.map(() => null))
  })

  it('closing the panel gives focus back to the chip that opened it', async () => {
    render(<><CardViewChips card={DIAG} /><RevealDock view={st} /></>)
    const chip = document.querySelector('[data-reveal-kind="disagreement"]') as HTMLButtonElement
    chip.focus()
    fireEvent.click(chip)
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('reveal-dock-heading')))
    fireEvent.click(screen.getByTestId('reveal-dock-keep-open'))
    await waitFor(() => expect(document.activeElement).toBe(chip))
  })

  it('a second view by a person whose first is in a chip is still drawn as their initials (each person once among initials)', () => {
    const again = { ...P, id: 999, figures: [], about: [DIAG], kind: 'shared' }
    const r = revealOf({ ...st, collab: { ...st.collab, shared: [...st.collab.shared, again] } } as View)!
    expect(marksOn(r, DIAG).initials.map((m) => m.view)).toEqual([999])
  })

  it('a selection is cleared on another version, or when the View no longer holds it; an equal View keeps it', () => {
    useReveal.setState({ selected: P.id, card: DIAG, chip: DIFFER })
    act(() => { useViewStore.setState({ view: { ...st } }) })
    expect(useReveal.getState()).toMatchObject({ selected: P.id, card: DIAG })
    act(() => { useViewStore.setState({ at: 2 }) })
    expect(useReveal.getState()).toMatchObject({ selected: null, card: null, chip: null })
    act(() => { useViewStore.setState({ at: null }) })
    useReveal.setState({ selected: P.id, card: DIAG, chip: DIFFER })
    act(() => { useViewStore.setState({ view: { ...st, collab: { ...st.collab, shared: st.collab.shared.filter((v) => v.id !== P.id) } } }) })
    expect(useReveal.getState()).toMatchObject({ selected: null, card: null })
  })

  it('chips on a card keep core’s order exactly (N3: core gives a card its view mark before its evidence mark; the UI reorders nothing)', () => {
    expect(marksOn(revealOf(withMarks(marks))!, DIAG).cardChips.map((c) => c.kind)).toEqual(['disagreement', 'evidence'])
    expect(marksOn(revealOf(withMarks([...marks].reverse()))!, DIAG).cardChips.map((c) => c.kind)).toEqual(['evidence', 'disagreement'])
  })

  it('two marks of one kind on one card are two chips; each opens itself, and only it is pressed (second mark: FIXTURE words)', () => {
    // A real View with one more disagreement mark of core's shape on another of the option's records (badge.records); its words are invented.
    const other = st.model!.cards.find((c) => c.id === DIAG)!.badge!.records.find((x) => x !== differ.card)!
    const second: CoreMarkJson = { card: other, kind: 'disagreement', views: [P.id, T.id], evidence: [], text: 'FIXTURE: Priya and Tom differ again', reading: null, options: [{ option: differ.options[0]!.option, text: 'FIXTURE: the second mark’s line' }],
      title: 'FIXTURE: Priya and Tom differ again', label: 'FIXTURE: Priya and Tom differ again' }
    const two = withMarks([...marks.filter((m) => m.kind !== 'evidence'), second, ...marks.filter((m) => m.kind === 'evidence')])
    useViewStore.setState({ view: two })
    render(<><CardViewChips card={DIAG} /><OptionMarkLine card={differ.options[0]!.option} /></>)
    const chips = [...screen.getByTestId(`reveal-chips-${DIAG}`).querySelectorAll('button')]
    expect(chips.map((c) => c.querySelector('[data-reveal-chip-text]')!.textContent)).toEqual(['Priya and Tom differ', 'FIXTURE: Priya and Tom differ again', 'Priya and Tom added evidence'])
    fireEvent.click(chips[1]!)
    expect(useReveal.getState()).toMatchObject({ selected: P.id, card: DIAG, chip: `${other}:disagreement` })
    expect(chips.map((c) => c.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false'])
    expect(openChipOf(revealOf(two), useReveal.getState())!.text).toBe('FIXTURE: Priya and Tom differ again')
    expect(document.querySelector(`[data-reveal-option-line="${differ.options[0]!.option}"]`)!.textContent).toBe('FIXTURE: the second mark’s line')
  })

  it('the chips stay on one row: the first shows core’s words, a later one is compact with its words in its name (the browser shot measures it)', () => {
    render(<CardViewChips card={DIAG} />)
    const rail = screen.getByTestId(`reveal-chips-${DIAG}`), [a, b] = [...rail.querySelectorAll('button')]
    expect(rail.className).toContain('flex-nowrap')
    expect(a!.querySelector('[data-reveal-chip-text]')!.className).not.toContain('sr-only')
    expect(b!.querySelector('[data-reveal-chip-text]')!.className).toContain('sr-only')
    expect(b!.getAttribute('aria-label')).toContain('Priya and Tom added evidence')
    expect(b!.getAttribute('title')).toContain('Priya and Tom added evidence')
  })

  it('opening a chip selects its card on the canvas, as clicking the card would (design session, 7 Nov)', () => {
    useCanvasStore.setState({ nodes: [{ id: DIAG, position: { x: 0, y: 0 }, data: {}, selected: false }, { id: 'time_to_contract', position: { x: 0, y: 0 }, data: {}, selected: true }] } as never)
    render(<CardViewChips card={DIAG} />)
    fireEvent.click(document.querySelector('[data-reveal-kind="disagreement"]')!)
    expect(useCanvasStore.getState().nodes.filter((n) => n.selected).map((n) => n.id)).toEqual([DIAG])
  })

  it('a card that carries chips paints above the resting cards, so the row below never covers its rail', () => {
    const nodes = [{ id: DIAG }, { id: 'time_to_contract' }]
    const got = withChipsAbove(nodes, new Set([DIAG]))
    expect(got.map((n) => (n as { zIndex?: number }).zIndex ?? 0)).toEqual([1, 0])
    expect(got[1]).toBe(nodes[1])
    expect(withChipsAbove(nodes, new Set())).toBe(nodes)
  })

  it('closing the evidence dock after switching inside it gives focus back to the chip that opened it', async () => {
    render(<><CardViewChips card={DIAG} /><EvidenceDock view={st} /></>)
    const chip = document.querySelector('[data-reveal-kind="evidence"]') as HTMLButtonElement
    chip.focus(); fireEvent.click(chip)
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('evidence-dock-heading')))
    const also = document.querySelector(`[data-evidence-also="${ev[1]}"]`) as HTMLButtonElement
    also.focus(); fireEvent.click(also)
    await waitFor(() => expect(screen.getByTestId('evidence-dock-words').textContent).toBe(st.evidence[1]!.text))
    fireEvent.click(screen.getByTestId('evidence-dock-close'))
    await waitFor(() => expect(document.activeElement).toBe(chip))
  })

  it('the open card’s node is marked v11-open, and only it; nothing changes when none is open', () => {
    const nodes = [{ id: 'time_to_contract' }, { id: DIAG, className: 'react-flow__node-viewCard' }]
    const got = withOpenCard(nodes, DIAG)
    expect(got.map((n) => n.className ?? '')).toEqual(['', 'react-flow__node-viewCard v11-open'])
    expect(got[0]).toBe(nodes[0])
    expect(withOpenCard(nodes, null)).toBe(nodes)
    expect(withOpenCard(nodes, 'not_drawn')).toBe(nodes)
  })

  it('nothing opens on an earlier version', () => {
    useViewStore.setState({ at: 2 })
    render(<CardViewChips card={DIAG} />)
    fireEvent.click(document.querySelector('[data-reveal-kind="disagreement"]')!)
    expect(useReveal.getState()).toMatchObject({ selected: null, card: null })
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

  it('DL ruling 9 Nov: Model and Team are one destination each, the canvas bar and the dock tab always in sync', () => {
    const force = vi.spyOn(useUIStore.getState(), 'forceActivateOutputTab')
    useViewLens.setState({ lens: 'tradeoffs' })
    act(() => { useUIStore.getState().setActiveOutputTab('olumi') })
    render(<ViewLensBar nav />)
    expect(screen.getByTestId('lens-bar-full')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('lens-bar-team')).toHaveAttribute('aria-pressed', 'false')
    // Re-pinned (demo rehearsal 0ce8 step 4, DL 10 Nov: choosing a lens never takes Analysis away). From a lens, the canvas Model turns
    // the lens off and leaves the dock as it was; pressed again on the plain model, it opens the dock's Model outline. Was: the first press
    // opened the outline, hiding Analysis until ×.
    fireEvent.click(screen.getByTestId('lens-bar-full'))
    expect(useViewLens.getState().lens).toBe('full')
    expect(force).not.toHaveBeenCalledWith('diagnostics')
    expect(useUIStore.getState().activeOutputTab).toBe('olumi')
    fireEvent.click(screen.getByTestId('lens-bar-full'))
    expect(force).toHaveBeenCalledWith('diagnostics')
    // The dock's Model tab turns a lens off and presses the canvas Model; the dock's Team presses the canvas Team, never both.
    act(() => { useViewLens.setState({ lens: 'tradeoffs' }); useUIStore.getState().setActiveOutputTab('olumi') })
    act(() => { useUIStore.getState().setActiveOutputTab('diagnostics') })
    expect(useViewLens.getState().lens).toBe('full')
    expect(screen.getByTestId('lens-bar-full')).toHaveAttribute('aria-pressed', 'true')
    act(() => { useUIStore.getState().setActiveOutputTab('team') })
    expect(screen.getByTestId('lens-bar-team')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('lens-bar-full')).toHaveAttribute('aria-pressed', 'false')
  })

  it('demo rehearsal step 4 (DL 10 Nov): after Team, Model gives the dock back the tab it had (Analysis), never the Model outline', () => {
    useViewLens.setState({ lens: 'full' })
    act(() => { useUIStore.getState().setActiveOutputTab('analysisNew') })
    render(<ViewLensBar nav />)
    fireEvent.click(screen.getByTestId('lens-bar-team'))
    expect(useUIStore.getState().activeOutputTab).toBe('team')
    fireEvent.click(screen.getByTestId('lens-bar-full'))
    expect(useUIStore.getState().activeOutputTab).toBe('analysisNew')
    expect(useViewLens.getState().lens).toBe('full')
  })
})

describe('every selection brings its card to the centre (design owner, 8 Nov)', () => {
  it('selecting the same chip again counts as a new open, so the camera centres it again after the person moved away', () => {
    const before = useReveal.getState().opens
    useReveal.getState().select(PRIYA.id, DIAG, `${DIAG}:disagreement`)
    useReveal.getState().select(PRIYA.id, DIAG, `${DIAG}:disagreement`)
    expect(useReveal.getState().opens).toBe(before + 2)
  })
  it('CONTRAST: closing is not an open', () => {
    useReveal.getState().select(PRIYA.id, DIAG, `${DIAG}:disagreement`)
    const open = useReveal.getState().opens
    useReveal.getState().select(null)
    useReveal.getState().selectEvidence(null)
    expect(useReveal.getState().opens).toBe(open)
  })
})
