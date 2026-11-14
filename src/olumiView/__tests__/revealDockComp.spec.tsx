/**
 * P1 (the approved V11 Reveal comp, 10 Nov): the panel opened on a card reads as the comp's. On core's served strategy reveal
 * (fixtures/strategy growth-reveal-n1), opened on Cross-team adoption from its chip:
 * - the heading carries the card's own shape before its name;
 * - each person's pill for this card is beside their name, in their name row, never a separate line repeating the card;
 * - "Bring evidence" and "Keep it open" are 44 px targets.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render, screen } from '@testing-library/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { revealOf, useReveal } from '../reveal'
import { RevealDock } from '../RevealDock'
import { CardViewChips } from '../RevealMarks'
import { viewLinesOf } from '../strategy/strategy'

const view = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/strategy', 'growth-reveal-n1.view3.json'), 'utf8')) as View
const CARD = 'cross_team_adoption'
const chip = [...(revealOf(view)?.cardChips.get(CARD) ?? [])].find((c) => c.kind !== 'evidence')!
function open() {
  useViewStore.setState({ view, sid: view.id, at: null })
  useReveal.setState({ selected: chip.views[0]!, evidence: null, card: CARD, chip: chip.key })
  return render(<RevealDock view={view} />).container
}
afterEach(() => { cleanup(); useReveal.setState({ selected: null, evidence: null, card: null, chip: null }); useViewStore.setState(useViewStore.getInitialState(), true) })

describe('the Reveal panel, as the comp draws it', () => {
  it('RD1 precondition: the chip on Cross-team adoption gathers more than one person, each with a line on this card', () => {
    expect(chip.views.length).toBeGreaterThan(1)
    for (const id of chip.views) expect(viewLinesOf(view, id).some((l) => l.about.id === CARD)).toBe(true)
  })
  it('RD2 catch: the heading carries the card\'s shape before its name', () => {
    const h = open().querySelector('[data-testid="reveal-dock-heading"]')!
    expect(h.firstElementChild?.hasAttribute('data-reveal-dock-shape')).toBe(true)
    expect(h.querySelector('svg')).not.toBeNull()
    expect(h.textContent).toBe(view.model!.cards.find((c) => c.id === CARD)!.heading)
  })
  it('RD3 catch: each person\'s pill for this card is in their name row, beside their name', () => {
    open()
    for (const id of chip.views) {
      const line = viewLinesOf(view, id).find((l) => l.about.id === CARD)!
      const pill = screen.getByTestId(`strategy-pill-${id}-${CARD}`)
      expect(pill.textContent).toBe(line.pill)
      const row = screen.getByTestId(`reveal-dock-view-${id}`).querySelector('p')!
      expect(row.contains(pill)).toBe(true)
      expect(row.textContent!.startsWith(line.by)).toBe(true)
    }
  })
  it('RD4 Bring evidence is a 44 px target; a missing difference never offers a pretend save', () => {
    open()
    expect(screen.getByTestId('reveal-dock-bring-evidence').className.split(/\s+/)).toContain('min-h-[44px]')
    expect(screen.queryByTestId('reveal-dock-keep-open')).toBeNull()
  })
  it('RD5 a chip\'s words on the rail wrap in balanced lines, never one word alone on the last line', () => {
    useViewStore.setState({ view, sid: view.id, at: null })
    render(<CardViewChips card={CARD} />)
    const t = screen.getByTestId(`reveal-chips-${CARD}`).querySelector<HTMLElement>('[data-reveal-chip-text]')!
    expect(t.className.split(/\s+/)).toContain('[text-wrap:balance]')
  })
})
