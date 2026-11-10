/**
 * P1 (the approved J1 comp, DL 10 Nov): on a first look, Olumi's one question sits in the warm band at the brief panel's foot and stays
 * there while the brief's account scrolls above it, so it is never cut under the composer (the 71a8c91b shot cut it mid-sentence). On the
 * real bookshop View (fixtures/j1, core 5d8a009b).
 */
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render, screen } from '@testing-library/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { BriefPanel, useBriefPanelLeft } from '../BriefPanel'

const view: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/j1/bookshop-v1-open.core-5d8a009b.view3.json'), 'utf8'))
afterEach(() => { cleanup(); useBriefPanelLeft.setState({ left: new Set() }); useViewStore.setState({ view: null, sid: null }) })

describe('Olumi\'s question stays at the brief panel\'s foot', () => {
  it('BF1 catch: the question is in a foot pinned to the bottom of the panel\'s scroll, the last thing in the panel', () => {
    useViewStore.setState({ view, sid: view.id })
    render(<BriefPanel />)
    const panel = screen.getByTestId('brief-panel'), foot = screen.getByTestId('brief-panel-foot')
    expect(foot.className.split(/\s+/)).toEqual(expect.arrayContaining(['sticky', 'bottom-0']))
    expect(foot.parentElement).toBe(panel)
    expect(panel.lastElementChild).toBe(foot)
    expect(foot.contains(screen.getByTestId('brief-panel-question'))).toBe(true)
    expect(screen.getByTestId('brief-panel-question').textContent).toContain('Is revenue flat because fewer people come in')
  })
  it('BF2 contrast: the brief\'s account is not in the foot (it scrolls above)', () => {
    useViewStore.setState({ view, sid: view.id })
    render(<BriefPanel />)
    expect(screen.getByTestId('brief-panel-foot').contains(screen.getByTestId('brief-panel-brief'))).toBe(false)
  })
})
