/**
 * S4 pop-up lane (20 Nov): the version history drawer and the Summary stand on the canvas side, against the dock's left edge, and never over the chat.
 *
 * ⚠ SCOPE: jsdom loads no stylesheet, so it cannot measure a rectangle. What these rows pin is the ANCHOR each rendered surface draws: its right edge is
 * the dock's own variable (`--dock-right-offset`, the dock's width open or collapsed, written by OutputsDock) and not the window's. The pixel read
 * (surface right edge <= dock left edge at 1232 and 1.33) is S4's gate picture.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { WhatChangedPanel } from '../WhatChangedPanel'
import { SummaryPage } from '../../../olumiView/ViewSummary'
import { setTeamFetch } from '../../../olumiCore/team/api'

vi.mock('../../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: { auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) } } }))

afterEach(() => { cleanup(); vi.unstubAllEnvs(); setTeamFetch(null) })

/** Every class a surface draws that anchors its right edge to the window (it would run under the dock). */
const toTheWindow = /(^|\s)(right-0|inset-0|inset-x-0)(\s|$)/
const toTheDock = /(^|\s)right-\[var\(--dock-right-offset,0rem\)\](\s|$)/

describe('the version history drawer', () => {
  for (const lane of [true, false]) {
    it(`${lane ? 'on the lane' : 'off the lane'}: its right edge is the dock's left edge, not the window's`, () => {
      vi.stubEnv('VITE_OLUMI_CORE', lane ? '1' : '')
      render(<WhatChangedPanel isOpen onClose={() => {}} />)
      const drawer = screen.getByTestId('what-changed-panel')
      expect(drawer.className).toMatch(toTheDock)
      expect(drawer.className, 'CONTRAST: the window-anchored form it replaced').not.toMatch(toTheWindow)
      expect(drawer.getAttribute('style'), 'no inline style').toBeNull()
    })
  }
})

describe('the Summary', () => {
  it('its sheet and its backdrop end at the dock\'s left edge, so the chat is neither covered nor dimmed', () => {
    setTeamFetch((() => new Promise<Response>(() => {})) as unknown as typeof fetch)
    render(<SummaryPage sid="s_0123456789ab" at={null} onClose={() => {}} />)
    const page = screen.getByTestId('summary-page')
    expect(page.className).toMatch(toTheDock)
    expect(page.className, 'CONTRAST: the full-window backdrop it replaced').not.toMatch(toTheWindow)
    expect(page.getAttribute('style')).toBeNull()
  })
})
