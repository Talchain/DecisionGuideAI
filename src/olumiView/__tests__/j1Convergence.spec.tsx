/**
 * V11 convergence (DL 9 Nov, items 2 and 3 of the brief), bound by record id on core's OWN View: the bookshop first look served by
 * olumi-core candidate 272da4c5 (zero calls; fixtures/j1/bookshop-v1-open.core-272da4c5.view3.json).
 * - ED-12 (core 11df609): a left-out part is quoted as the brief has it (`collab.records[].quote`), with core's note on why (`why`).
 * - J1 #6 (core f44bd1c): the people the brief names whom no member matches (`team_presence.unjoined`), in core's words, beside the
 *   presence, on a team of one too.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render, screen } from '@testing-library/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { BriefPanel, useBriefPanelLeft } from '../BriefPanel'
import { briefAccountOf } from '../layout'
import { TeamPresence } from '../TeamPresence'

const load = (f: string): View => JSON.parse(readFileSync(path.resolve(`src/olumiView/fixtures/j1/${f}`), 'utf8'))
const now = load('bookshop-v1-open.core-272da4c5.view3.json'), before = load('bookshop-v1-open.core-5d8a009b.view3.json')
const record = (v: View, id: string) => v.collab.records.find((r) => r.id === id)!
afterEach(() => { cleanup(); useBriefPanelLeft.setState({ left: new Set() }); useViewStore.setState({ view: null, sid: null }) })

describe('Left out: the brief’s own words, and why', () => {
  it('the emails part is quoted as the brief has it, core’s reason after it; the record’s re-worded label is not drawn', () => {
    const r = record(now, 'emails_left_out')
    expect([r.quote, r.why]).toEqual(['Regulars tell us the emails are annoying', 'Nothing in the model is about the emails yet.'])
    useViewStore.setState({ view: now, sid: now.id })
    render(<BriefPanel />)
    const el = screen.getByTestId('brief-panel-left-out')
    expect(el.querySelector('[data-view="collab.records.emails_left_out.quote"]')!.textContent).toBe(r.quote)
    expect(el.querySelector('[data-view="collab.records.emails_left_out.why"]')!.textContent).toBe(r.why)
    expect(el.textContent!.trim()).toBe(`Left out: “${r.quote}”. ${r.why}`)
    expect(el.textContent).not.toContain(r.label!)
    expect(screen.getByTestId('brief-panel-notes-missing').textContent).toBe('Olumi’s own notes on why it used or inferred each part are not available yet.')
  })
  it('CONTRAST: a core before ED-12 (no quote, no why) names the part by its label, unquoted, with no reason', () => {
    useViewStore.setState({ view: before, sid: before.id })
    render(<BriefPanel />)
    const el = screen.getByTestId('brief-panel-left-out')
    expect(el.textContent!.trim()).toBe(`Left out: ${record(before, 'emails_left_out').label}.`)
    expect(el.querySelector('[data-view$=".why"]')).toBeNull()
    expect(screen.getByTestId('brief-panel-notes-missing').textContent).toContain('used, inferred or left out')
  })
})

describe('the people the brief names who are not on the team', () => {
  it('on a team of one, core’s line is drawn whole beside the presence, with no discs', () => {
    expect(now.members).toHaveLength(1)
    const u = now.team_presence.unjoined!
    expect(u.names).toEqual(['Tom'])
    useViewStore.setState({ view: now, sid: now.id })
    render(<TeamPresence />)
    const line = screen.getByTestId('team-presence-unjoined')
    expect([line.textContent, line.getAttribute('title')]).toEqual([u.text, u.text])
    expect(screen.queryByTestId('team-presence')).toBeNull()
  })
  it('CONTRAST: a team of one where core names no one draws nothing', () => {
    useViewStore.setState({ view: { ...now, team_presence: { ...now.team_presence, unjoined: null } }, sid: now.id })
    expect(render(<TeamPresence />).container.innerHTML).toBe('')
  })
})

describe('the brief panel’s version line carries core’s save date (core ad57a105 `version.at_text`)', () => {
  it('the account reads the date by the version, and a View without it has none', () => {
    const dated: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/version-at/app-launch.core-ad57a105.view3.json'), 'utf8'))
    expect(briefAccountOf(dated).versionAt).toBe(dated.version!.at_text)
    expect(briefAccountOf(dated).versionAt).toBe('2 Nov 2026')
    expect(briefAccountOf(now).versionAt).toBeNull()
  })
  it('drawn after the label in the first look’s meta line, by its own data-view', () => {
    useViewStore.setState({ view: { ...now, version: { ...now.version!, at_text: '9 Nov 2026' } }, sid: now.id })
    render(<BriefPanel />)
    const meta = screen.getByTestId('brief-panel-meta')
    expect(meta.querySelector('[data-view="version.at_text"]')!.textContent).toBe('9 Nov 2026')
    expect(meta.textContent).toBe(`${now.version!.label} · 9 Nov 2026 · ${now.chat[0]!.by}`)
  })
})
