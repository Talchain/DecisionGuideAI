/**
 * DL 10 Nov, Codex at 900 x 704 with eight people: with every avatar already collapsed, the top bar's Summary control still covered the Team
 * panel's heading. The bar never reaches the dock: avatars collapse first (TeamPresence), then the other controls give way one step at a time
 * (useTopBarFit): Share keeps its icon alone, the version pill goes, and last the scenario name shortens. jsdom has no layout, so the bar's right
 * edge is given as the sum of its parts (the discs and chip drawn, and what each step saves); what is asserted is what the code does with it.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { useRef, useState } from 'react'
import { act, cleanup, render, screen } from '@testing-library/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { TeamPresence } from '../TeamPresence'
import { useTopBarFit, TIGHT_STEPS } from '../../components/layout/useTopBarFit'

const real: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/v11', 'consulting-marks.view3.json'), 'utf8'))
const eight: View = { ...real, members: Array.from({ length: 8 }, (_, i) => ({ ...real.members[i % real.members.length]!, id: `m${i}`, name: `Person ${i}` })), you_id: 'm7' }
const rect = (o: Partial<DOMRect>): DOMRect => ({ left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}), ...o })

/** The saving of each step, in the order the bar takes them: Share's label, the version pill (and its gap), the name 250 -> 110 px. */
const SAVES = [0, 45, 155, 140]
const REST = 700 // everything in the bar except the discs, at step 0 (name, version pill, controls, Share, avatar)

function Bar() {
  const ref = useRef<HTMLDivElement | null>(null)
  const level = useTopBarFit(ref, 'hiring')
  return <div role="banner" data-tight={level > 0 ? level : undefined} ref={ref}><TeamPresence /></div>
}
// The banner's right edge as the sum of its parts, in place before anything mounts (a child's layout effect measures first).
const realRect = HTMLElement.prototype.getBoundingClientRect
const bannerRect = function (this: HTMLElement): DOMRect {
  if (this.getAttribute('role') !== 'banner') return realRect.call(this)
  const discs = this.querySelectorAll('[data-presence-disc]').length, chip = this.querySelector('[data-testid="team-presence-more"]') === null ? 0 : 30
  const l = Number(this.dataset['tight'] ?? 0)
  return rect({ left: 12, right: 12 + REST + 6 + discs * 18 + chip - SAVES.slice(0, l + 1).reduce((a, b) => a + b, 0) })
}

let dock: HTMLElement
const openDock = (left: number) => {
  dock = document.createElement('aside'); dock.setAttribute('aria-label', 'Outputs dock')
  dock.getBoundingClientRect = () => rect({ left, right: left + 300, top: 8, bottom: 696, width: 300, height: 688 })
  document.body.append(dock)
}
beforeEach(() => { HTMLElement.prototype.getBoundingClientRect = bannerRect; useViewStore.setState({ uuid: 'u', sid: eight.id, view: eight, status: 'ready', error: null, stale: false, at: null }) })
afterEach(() => { cleanup(); dock.remove(); HTMLElement.prototype.getBoundingClientRect = realRect; useViewStore.setState({ view: null, sid: null, uuid: null, at: null }) })

describe('the top bar never overlaps the dock (eight people)', () => {
  it('900 wide: every avatar is collapsed into "+7", then the other controls give way until the bar ends before the dock', () => {
    window.innerWidth = 900; openDock(592) // the inset dock: 300 wide, 8 from the window's edge
    render(<Bar />)
    const bar = screen.getByRole('banner')
    expect(screen.getByTestId('team-presence-more').textContent).toBe('+7')
    expect(bar.querySelectorAll('[data-presence-disc]')).toHaveLength(0)
    expect(Number(bar.dataset['tight']), 'Share keeps its icon, then the version pill goes: two steps are enough, the name is never reached').toBe(TIGHT_STEPS.version)
    expect(bar.getBoundingClientRect().right, 'the bar ends before the dock (592) less its gap').toBeLessThanOrEqual(592 - 12)
  })
  it('the scenario name is the LAST to give way: only when Share and the version pill are not enough does the name step come (and the stylesheet clips the name at that step alone)', () => {
    window.innerWidth = 700; openDock(500) // 488 for the bar: 748 - 45 - 155 = 548 still runs past it
    render(<Bar />)
    expect(Number(screen.getByRole('banner').dataset['tight'])).toBe(TIGHT_STEPS.name)
    const css = readFileSync(path.resolve('src/components/layout/TopBar.module.css'), 'utf8')
    const clipped = [...css.matchAll(/([^{}]*)\{[^{}]*max-width:\s*110px/g)].map((m) => m[1]!)
    expect(clipped.length, 'the name has one clip rule').toBe(1)
    expect(clipped[0], 'CONTRAST: it applies at the last step only, never at Share (1) or the version pill (2)').toMatch(new RegExp(`data-tight="${TIGHT_STEPS.name}"`))
    expect(clipped[0]).not.toMatch(/:not\(/)
  })
  it('CONTRAST: 1232 wide with the dock open, everything fits: all seven discs, no chip, no step', () => {
    window.innerWidth = 1232; openDock(924)
    render(<Bar />)
    const bar = screen.getByRole('banner')
    expect(bar.querySelectorAll('[data-presence-disc]')).toHaveLength(7)
    expect(screen.queryByTestId('team-presence-more')).toBeNull()
    expect(bar.dataset['tight']).toBeUndefined()
    expect(bar.getBoundingClientRect().right).toBeLessThanOrEqual(924 - 12)
  })
})

/**
 * DL 10 Nov, 21:16Z live run and four zero-call replays: on Builds 1e to 2a the board crashed mid-draft ("Maximum update depth", React 185).
 * The hook scheduled a state update from its layout effect on EVERY render, even when the measurement changed nothing; on a bar that was
 * rendering for its own reasons that never ended. The spec: a measurement that changes nothing schedules nothing.
 */
describe('a measurement that changes nothing schedules no update', () => {
  it('the bar re-renders once for its own update, never a second time for an unchanged measurement', () => {
    window.innerWidth = 1232; openDock(924)
    let renders = 0, bump: () => void = () => {}
    function Counted() {
      const ref = useRef<HTMLDivElement | null>(null)
      const [n, setN] = useState(0); bump = () => setN((x) => x + 1)
      renders++
      const level = useTopBarFit(ref, 'hiring')
      return <div role="banner" data-n={n} data-tight={level > 0 ? level : undefined} ref={ref} />
    }
    render(<Counted />)
    for (let i = 0; i < 3; i++) {
      const before = renders
      act(() => bump())
      expect(renders - before, `own update ${i + 1}: one render, and the unchanged measurement asks for no other`).toBe(1)
    }
    expect(screen.getByRole('banner').dataset['n']).toBe('3')
    expect(screen.getByRole('banner').dataset['tight'], 'CONTRAST: nothing gave way, the bar fits').toBeUndefined()
  })
})
