/**
 * DL 10 Nov, share dialog shot (seven people on the scenario, 1232 x 704, dock open), fault 5. jsdom has no layout, so the rects the
 * browser would measure are given to it; what is asserted is what the code does with them.
 * the top bar never overlaps the dock: when there is not room the avatars collapse into a "+N" chip;
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render, screen } from '@testing-library/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { TeamPresence, discsThatFit } from '../TeamPresence'

const real: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/v11', 'consulting-marks.view3.json'), 'utf8'))
const names = ['Candidate check', 'Measure', 'Measure two', 'Auditor', 'DL look', 'PL screen reviewer', 'Lee']
const seven: View = { ...real, members: names.map((name, i) => ({ ...real.members[i % real.members.length]!, id: `m${i}`, name })), you_id: 'm6' }
const rect = (o: Partial<DOMRect>): DOMRect => ({ left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}), ...o })

describe('the top bar never overlaps the dock (1232 wide, seven people)', () => {
  const DOCK_LEFT = 924 // the inset dock: 300 wide, 8 from the window's edge
  let bar: HTMLElement | undefined, dock: HTMLElement | undefined
  /** Where the bar's right edge is, given the discs and chip drawn inside it: the rest of the bar (name, Share, avatar) is `rest` px. */
  const setup = (rest: number) => {
    const b = document.createElement('div'); b.setAttribute('role', 'banner'); bar = b
    b.getBoundingClientRect = () => {
      const discs = b.querySelectorAll('[data-testid^="team-presence-"]:not([data-testid="team-presence-more"])').length
      const chip = b.querySelector('[data-testid="team-presence-more"]') === null ? 0 : 30
      return rect({ left: 12, right: 12 + rest + 6 + discs * 18 + chip })
    }
    const d = document.createElement('aside'); d.setAttribute('aria-label', 'Outputs dock'); dock = d
    d.getBoundingClientRect = () => rect({ left: DOCK_LEFT, right: 1224, top: 8, bottom: 696, width: 300, height: 688 })
    document.body.append(b, d)
    return render(<TeamPresence />, { container: b.appendChild(document.createElement('span')) })
  }
  beforeEach(() => { window.innerWidth = 1232; useViewStore.setState({ uuid: 'u', sid: seven.id, view: seven, status: 'ready', error: null, stale: false, at: null }) })
  afterEach(() => { cleanup(); bar?.remove(); dock?.remove(); useViewStore.setState({ view: null, sid: null, uuid: null, at: null }) })

  it('discsThatFit: all when they fit; otherwise the most that fit, the rest as one chip; stable once it fits', () => {
    expect([discsThatFit(6, 6, 40), discsThatFit(6, 6, -46), discsThatFit(6, 1, 14), discsThatFit(6, 1, 100), discsThatFit(6, 6, -999)]).toEqual([6, 1, 1, 6, 0])
  })
  it('seven people with no room: the discs that do not fit become "+N", and the bar ends before the dock', () => {
    setup(850 - 12 - 6) // the bar's right edge would be 958 with all six discs: 34 px under the dock
    const discs = screen.getAllByTestId(/^team-presence-m\d$/)
    expect(discs.map((d) => d.dataset['testid'])).toEqual(['team-presence-m0'])
    expect(screen.getByTestId('team-presence-more').textContent).toBe('+5')
    expect(bar!.getBoundingClientRect().right, 'the bar stays left of the dock').toBeLessThanOrEqual(DOCK_LEFT)
    expect(screen.queryByTestId('team-presence-m6'), 'the viewer is never a disc').toBeNull()
    expect(screen.getByTestId('team-presence')).toHaveAttribute('aria-label', seven.team_presence.label)
  })
  it('CONTRAST: with room, every other person is a disc and there is no chip', () => {
    setup(500)
    expect(screen.getAllByTestId(/^team-presence-m\d$/)).toHaveLength(6)
    expect(screen.queryByTestId('team-presence-more')).toBeNull()
  })
})
