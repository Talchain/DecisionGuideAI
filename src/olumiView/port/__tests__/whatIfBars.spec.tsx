import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('../../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render, within } from '@testing-library/react'
import type { View, ViewModel } from '../../client'
import { optionCards } from '../../layout'
import { useViewStore } from '../../store'
import { WhatIfShown } from '../../ViewChances'
import { clearWhatIf, useWhatIf, type WhatIfAnswer, type WhatIfVariant } from '../../whatif'
import { WhatIfTrack } from '../WhatIfBars'
import { trackPct } from '../pick'

type ChanceFact = { id: string; about?: { kind: string; option?: string; goal?: string; chance?: number } }
type Capture = WhatIfAnswer & { variants: (WhatIfVariant & { facts: ChanceFact[] })[] }
const DIR = path.resolve('src/olumiView/fixtures/v11')
const view = JSON.parse(readFileSync(path.join(DIR, 'consulting-chain.view3.json'), 'utf8')) as View
const answer = JSON.parse(readFileSync(path.join(DIR, 'consulting-whatif-priya.json'), 'utf8')) as Capture
const captured = answer.variants[0]!

// UI recovery B4, DL 10 Nov: this older capture keeps exact chances in facts; bind them by option and aim for the row contract under test.
const variant: WhatIfVariant = {
  ...captured,
  rows: captured.rows.map((o) => ({
    ...o,
    rows: o.rows.map((row) => {
      if (row.kind !== 'chance' || row.chance != null) return row
      const fact = captured.facts.find((f) => f.about?.kind === 'chance' && f.about.option === o.option_id && f.about.goal === row.aim_id)
      if (fact?.about?.chance == null) throw new Error(`Missing captured chance: ${o.option_id}, ${row.aim_id}`)
      return { ...row, chance: fact.about.chance }
    }),
  })),
}
const Q = 'diagnostic_time_to_contract', TYPED = '6 to 12 months'
const draw = (tried: WhatIfVariant = variant, model: ViewModel = view.model!) => {
  useViewStore.setState({ view, sid: view.id })
  useWhatIf.setState({ shown: { sid: view.id, base: answer.version.id, quantity: Q, typed: TYPED, variant: tried } })
  return render(<WhatIfShown model={model} />)
}
const blockOf = (container: HTMLElement, id: string) => within(container.querySelector<HTMLElement>(`[data-whatif-card="${id}"]`)!)
const chanceRows = (o: WhatIfVariant['rows'][number]) => o.rows.filter((r) => r.kind === 'chance')
afterEach(() => { cleanup(); clearWhatIf(); useViewStore.setState(useViewStore.getInitialState(), true) })

describe('UI recovery B4: saved and tried chances, consulting version 18', () => {
  it('WB1: each option and aim gets its own saved ring and tried dot, between the heading and core rows', () => {
    expect([answer.scenario, answer.version.id]).toEqual([view.id, view.model!.edit_base])
    expect(variant.edits.map((e) => e.quantity)).toEqual([Q])
    const { container } = draw()
    for (const o of variant.rows) {
      const card = optionCards(view.model!).find((c) => c.id === o.option_id)!
      const block = blockOf(container, o.option_id), rows = chanceRows(o)
      expect(rows.length, o.option_id).toBe(o.option_id === 'focus_product_sales' ? 1 : 2)
      const tracks = block.getAllByTestId('view-whatif-track')
      expect(tracks, o.option_id).toHaveLength(rows.length)
      rows.forEach((row, i) => {
        const saved = card.rows.find((r) => r.kind === 'chance' && r.aim_id === row.aim_id)!
        expect(saved.kind, o.option_id).toBe('chance')
        if (saved.kind !== 'chance') return
        const track = tracks[i]!, marks = within(track)
        expect(marks.getByTestId('view-whatif-saved'), o.option_id).toHaveStyle({ left: `${trackPct(saved.chance!)}%` })
        expect(marks.getByTestId('view-whatif-tried'), o.option_id).toHaveStyle({ left: `${trackPct(row.chance!)}%` })
        expect(track, o.option_id).toHaveAttribute('aria-hidden', 'true')
        expect(track.textContent, o.option_id).toBe('')
        const firstRow = container.querySelector(`[data-view-row="whatif.${o.option_id}.rows.0"]`)!
        expect(track.compareDocumentPosition(firstRow) & Node.DOCUMENT_POSITION_FOLLOWING, o.option_id).not.toBe(0)
      })
      expect(tracks[0]!.previousElementSibling?.textContent, o.option_id).toBe(card.heading)
      expect(tracks.every((t) => t.classList.contains('w-full')), o.option_id).toBe(true)
    }
  })

  it('WB1: aim identity survives a different saved row order', () => {
    const model = structuredClone(view.model!)
    for (const card of optionCards(model)) card.rows.reverse()
    const { container } = draw(variant, model)
    for (const o of variant.rows) {
      const tracks = blockOf(container, o.option_id).getAllByTestId('view-whatif-track')
      const card = optionCards(view.model!).find((c) => c.id === o.option_id)!
      chanceRows(o).forEach((row, i) => {
        const saved = card.rows.find((r) => r.kind === 'chance' && r.aim_id === row.aim_id)!
        if (saved.kind !== 'chance') throw new Error(o.option_id)
        expect(within(tracks[i]!).getByTestId('view-whatif-saved'), o.option_id).toHaveStyle({ left: `${trackPct(saved.chance!)}%` })
      })
    }
  })

  it('WB1: without an aim id, the saved row at the same index supplies the ring', () => {
    const tried = structuredClone(variant), id = 'focus_product_sales'
    const o = tried.rows.find((r) => r.option_id === id)!
    const i = o.rows.findIndex((r) => r.kind === 'chance'), row = o.rows[i]!
    if (row.kind !== 'chance') throw new Error(id)
    delete (row as Partial<typeof row>).aim_id
    const saved = optionCards(view.model!).find((c) => c.id === id)!.rows[i]!
    if (saved.kind !== 'chance') throw new Error(id)
    const { container } = draw(tried)
    const track = within(blockOf(container, id).getByTestId('view-whatif-track'))
    expect(track.getByTestId('view-whatif-saved'), id).toHaveStyle({ left: `${trackPct(saved.chance!)}%` })
    expect(track.getByTestId('view-whatif-tried'), id).toHaveStyle({ left: `${trackPct(row.chance!)}%` })
  })

  it('WB2: real spans cover the smaller through larger percent; unchanged chances retain both marks and no span', () => {
    const { container } = draw()
    for (const o of variant.rows) {
      const card = optionCards(view.model!).find((c) => c.id === o.option_id)!
      const tracks = blockOf(container, o.option_id).getAllByTestId('view-whatif-track')
      chanceRows(o).forEach((row, i) => {
        const saved = card.rows.find((r) => r.kind === 'chance' && r.aim_id === row.aim_id)!
        if (saved.kind !== 'chance') throw new Error(o.option_id)
        const a = trackPct(saved.chance!), b = trackPct(row.chance!), track = within(tracks[i]!)
        if (a === b) expect(track.queryByTestId('view-whatif-span'), o.option_id).toBeNull()
        else expect(track.getByTestId('view-whatif-span'), o.option_id).toHaveStyle({ left: `${Math.min(a, b)}%`, width: `${Math.abs(a - b)}%` })
        expect(track.getByTestId('view-whatif-saved'), o.option_id).toBeInTheDocument()
        expect(track.getByTestId('view-whatif-tried'), o.option_id).toBeInTheDocument()
      })
    }
  })

  it('WB2: reversing a real pair reverses its marks while keeping the span on the same interval', () => {
    const id = 'paid_enterprise_diagnostic'
    const saved = optionCards(view.model!).find((c) => c.id === id)!.rows[0]!
    const tried = variant.rows.find((o) => o.option_id === id)!.rows[0]!
    if (saved.kind !== 'chance' || tried.kind !== 'chance') throw new Error(id)
    const a = trackPct(saved.chance!), b = trackPct(tried.chance!)
    const { container } = render(<div data-whatif-card={id}><WhatIfTrack saved={tried.chance} tried={saved.chance} /></div>)
    const track = blockOf(container, id)
    expect(track.getByTestId('view-whatif-saved'), id).toHaveStyle({ left: `${b}%` })
    expect(track.getByTestId('view-whatif-tried'), id).toHaveStyle({ left: `${a}%` })
    expect(track.getByTestId('view-whatif-span'), id).toHaveStyle({ left: `${Math.min(a, b)}%`, width: `${Math.abs(a - b)}%` })
  })

  it.each(['saved', 'tried'] as const)('WB3: null %s chances suppress that option alone', (side) => {
    const tried = structuredClone(variant), model = structuredClone(view.model!), id = 'paid_enterprise_diagnostic'
    const rows = side === 'saved' ? model.cards.find((c) => c.id === id)!.rows : tried.rows.find((o) => o.option_id === id)!.rows
    for (const row of rows) if (row.kind === 'chance') row.chance = null
    const { container } = draw(tried, model)
    for (const o of tried.rows) expect(blockOf(container, o.option_id).queryAllByTestId('view-whatif-track'), o.option_id)
      .toHaveLength(o.option_id === id ? 0 : chanceRows(o).length)
  })

  // Re-pinned (UI recovery B4, DL 10 Nov): core 55c0c03f sends what-if rows in words only, with the number in its chance facts (measured
  // on the capacity board, 10 Nov). Was: "the unmodified older capture draws no guessed chances from its words or facts" (so the chart
  // never drew on the real answer). Now the fact bound by option AND aim places the dot; the words never do.
  it('WB3: the capture as core sends it places each tried dot from the chance fact bound by option and aim, never from the words', () => {
    const { container, getAllByTestId } = draw(captured)
    let dots = 0
    for (const o of captured.rows) {
      const tracks = blockOf(container, o.option_id).getAllByTestId('view-whatif-track')
      const rows = chanceRows(o)
      expect(tracks, o.option_id).toHaveLength(rows.length)
      rows.forEach((row, i) => {
        expect(row.kind === 'chance' ? row.chance : 0, o.option_id).toBeUndefined()
        const fact = captured.facts.find((f) => f.about?.kind === 'chance' && f.about.option === o.option_id && f.about.goal === (row.kind === 'chance' ? row.aim_id : null))!
        expect(within(tracks[i]!).getByTestId('view-whatif-tried'), `${o.option_id} ${i}`).toHaveStyle({ left: `${trackPct(fact.about!.chance!)}%` })
        dots++
      })
    }
    expect(dots).toBeGreaterThan(1)
    expect(getAllByTestId('view-whatif-axis')).toHaveLength(1)
  })

  it('WB3b: a fact for another option, or no facts, places nothing (the binding is by identity)', () => {
    for (const facts of [[], captured.facts.map((f) => ({ ...f, about: f.about === undefined ? undefined : { ...f.about, option: 'somebody_else' } }))]) {
      const { container, queryByTestId, unmount } = draw({ ...captured, facts } as WhatIfVariant)
      for (const o of captured.rows) expect(blockOf(container, o.option_id).queryAllByTestId('view-whatif-track'), o.option_id).toHaveLength(0)
      expect(queryByTestId('view-whatif-axis')).toBeNull()
      expect(queryByTestId('view-whatif-legend')).toBeNull()
      unmount()
    }
  })

  it('WB4: one axis and legend, with exactly the five allowed labels, after all options and before most_likely', () => {
    const { container, getAllByTestId, getByTestId } = draw()
    expect(getAllByTestId('view-whatif-axis')).toHaveLength(1)
    expect(getAllByTestId('view-whatif-legend')).toHaveLength(1)
    const axis = getByTestId('view-whatif-axis'), legend = getByTestId('view-whatif-legend')
    expect([...axis.children].map((e) => e.textContent)).toEqual(['0%', '50%', '100%'])
    expect([...legend.children].map((e) => e.textContent)).toEqual(['Saved', 'What-if'])
    expect(axis.nextElementSibling).toBe(legend)
    expect(legend.nextElementSibling).toHaveAttribute('data-view', 'whatif.most_likely.text')
    expect([...legend.querySelectorAll('[aria-hidden="true"]')]).toHaveLength(2)
    expect(`${axis.className} ${legend.className}`).not.toContain('text-info')
    for (const o of variant.rows) {
      const card = container.querySelector(`[data-whatif-card="${o.option_id}"]`)!
      expect(card.compareDocumentPosition(axis) & Node.DOCUMENT_POSITION_FOLLOWING, o.option_id).not.toBe(0)
      expect(within(card as HTMLElement).queryByTestId('view-whatif-axis'), o.option_id).toBeNull()
      expect(within(card as HTMLElement).queryByTestId('view-whatif-legend'), o.option_id).toBeNull()
    }
  })

  it.each(['stopped', 'blocked'] as const)('WB5: %s draws no track, axis or legend even when chance rows are present', (state) => {
    const { container, queryByTestId } = draw({ ...variant, [state]: 'Cannot run this what-if.' })
    for (const o of variant.rows) expect(container.querySelector(`[data-whatif-card="${o.option_id}"] [data-testid="view-whatif-track"]`), o.option_id).toBeNull()
    expect(queryByTestId('view-whatif-track')).toBeNull()
    expect(queryByTestId('view-whatif-axis')).toBeNull()
    expect(queryByTestId('view-whatif-legend')).toBeNull()
  })
})
