/**
 * R5 (the design lead's R3 look check, item 6): on the real capacity board a lone "◆" wrapped onto its own line after "…does not happen".
 * 6 Nov: the card's compact face keeps the rule by a no-wrap mark column beside the clamped value (first describe); the panel keeps the inline form.
 * A chance row's marks were flex items of their own, so each could wrap alone. Now each mark follows the value's last word, joined by a
 * no-break space, so it wraps with that word. Fixture: the real capacity View (fixtures/real/capacity.view3.json), card add_specialist.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render } from '@testing-library/react'
import type { View } from '../client'
import { ViewCard } from '../../canvas/nodes/ViewCardNode'
import { Row } from '../ViewChances'

afterEach(cleanup)
const capacity: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/real', 'capacity.view3.json'), 'utf8'))
const card = capacity.model!.cards.find((c) => c.id === 'add_specialist')!
const i = card.rows.findIndex((r) => r.kind === 'chance' && r.value.endsWith('does not happen'))

describe('a chance row\'s marks on the card never wrap alone and are never clipped by the compact face', () => {
  // 6 Nov (compact face, C1 4 Nov / R3 "two lines a row at most, the whole row on hover"): the card clamps the value to two lines, so a
  // mark inline after the value's last word would be clipped with it. R5's rule (never a lone mark on its own line) is kept by a
  // no-wrap column beside the value, outside the clamp: always shown, never alone. The panel keeps R5's inline form (below).
  it('the real row: "…does not happen" with ◆ ◉ beside the value, outside its clamp, in one no-wrap run; every word of the row drawn', () => {
    expect(i).toBeGreaterThanOrEqual(0)
    const at = `${card.id}.rows.${i}`
    const c = render(<ViewCard card={card} />).container
    const row = c.querySelector<HTMLElement>(`[data-view-row="${at}"]`)!
    const value = row.querySelector<HTMLElement>(`[data-row-value="${at}"]`)!, marks = row.querySelector<HTMLElement>(`[data-row-marks="${at}"]`)!
    expect(value.className).toContain('line-clamp-2')
    expect(value.contains(row.querySelector(`[data-view="${at}.value"]`))).toBe(true)
    expect(marks.className).toContain('whitespace-nowrap')
    expect(marks.className).toContain('flex-none')
    for (const m of ['olumi', 'likely']) {
      const mark = row.querySelector<HTMLElement>(`[data-view="${at}.${m}.glyph"]`)!
      expect(mark, m).not.toBeNull()
      expect(value.contains(mark), m).toBe(false) // never inside the clamp, so never clipped
      expect(marks.contains(mark), m).toBe(true) // both in one run: neither alone
    }
    expect(marks.textContent).toBe('◆\u00a0◉')
    // Option a2 (Paul's item 1, 6 Nov): this row is the option's first chance, so it is the previous PoC's big line: the aim is read by
    // screen readers and is on the row's hover, not drawn; the value is clamped to two lines in the big type (a conditional value never
    // overflows the card); the aim's target mark ◎ leads it. Every R5 check above holds unchanged.
    expect(row.querySelector(`[data-view="${at}.aim"]`)!.className).toContain('sr-only')
    expect(value.className).toContain('text-[17px]') // the 17px variant of the big chance (coordinator, 6 Nov); was 20px
    expect(value.className).not.toContain('whitespace-nowrap') // the big line may wrap to two lines, never overflow
    const r = card.rows[i] as { aim: string; approx: string; value: string; title: string }
    expect(row.getAttribute('title')).toBe(`${r.aim} · ${r.title}`)
    expect(row.textContent).toBe(`${r.aim}◎${r.approx}${r.value}◆\u00a0◉`)
  })
})

describe('the same in the panel (Analysis and Reasoning, ViewChances Row; R3 witness shot k-analysis)', () => {
  it('the real row: each mark in the value\'s own run, after a no-break space, never a flex item of its own', () => {
    const at = `${card.id}.rows.${i}`
    const c = render(<Row card={card} row={card.rows[i]!} i={i} />).container
    const row = c.querySelector<HTMLElement>(`[data-view-row="${at}"]`)!
    for (const m of ['olumi', 'likely']) {
      const mark = row.querySelector<HTMLElement>(`[data-view="${at}.${m}.glyph"]`)!
      expect(mark.parentElement!.contains(row.querySelector(`[data-view="${at}.value"]`)), m).toBe(true)
      expect(mark.previousSibling?.textContent?.endsWith('\u00a0') ?? false, m).toBe(true)
    }
  })
})
