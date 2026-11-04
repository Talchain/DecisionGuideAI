/**
 * R5 (the design lead's R3 look check, item 6): on the real capacity board a lone "◆" wrapped onto its own line after "…does not happen".
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

describe('a chance row\'s marks wrap with the value\'s last word, never alone', () => {
  it('the real row: "…does not happen" ◆ ◉, each mark in the value\'s own run, after a no-break space', () => {
    expect(i).toBeGreaterThanOrEqual(0)
    const at = `${card.id}.rows.${i}`
    const c = render(<ViewCard card={card} />).container
    const row = c.querySelector<HTMLElement>(`[data-view-row="${at}"]`)!
    for (const m of ['olumi', 'likely']) {
      const mark = row.querySelector<HTMLElement>(`[data-view="${at}.${m}.glyph"]`)!
      expect(mark, m).not.toBeNull()
      // In the same inline run as the value (no flex row of its own), and glued to what is before it.
      expect(mark.parentElement!.contains(row.querySelector(`[data-view="${at}.value"]`)), m).toBe(true)
      expect(mark.previousSibling?.textContent?.endsWith(' ') ?? false, m).toBe(true)
    }
    expect(getComputedStyle(row).display === 'flex' ? row.className.includes('flex-wrap') : false).toBe(false)
    expect(row.textContent).toContain(`does not happen\u00a0◆\u00a0◉`)
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
