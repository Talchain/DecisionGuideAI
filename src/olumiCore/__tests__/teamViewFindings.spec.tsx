import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import { TeamTab } from '../team/TeamTab'
import { useTeamStore } from '../team/store'
import { resetDrafts } from '../team/drafts'
import { setTeamFetch } from '../team/api'
import { fakeApi, scenario } from './teamFixtures'
import type { TeamFigure, TeamScenario, TeamViewFact, TeamViewRow } from '../team/types'

/**
 * D7 (OLUMI_D7) reaches the Team tab: a revealed figure that reverses the leader, a refused figure, and a comparison gone stale (review 00008 #4).
 * The facts are olumi-core's own producer output (739b7e8: viewFindings on the hand models of src/run/__tests__/views.test.ts), served here as the
 * scenario view's `view_findings` the way API.md "Disagreement as what-ifs" gives them, with the flag on in core.
 */
const here = path.dirname(fileURLToPath(import.meta.url))
const S6 = JSON.parse(fs.readFileSync(path.join(here, 'fixtures', 'science', 's6-view-facts.json'), 'utf8')).facts as Record<string, TeamViewFact[]>
const UUID = '00000000-0000-4000-8000-75ba67edc0e5'
const reset = () => { useTeamStore.setState({ uuid: null, sid: null, scenario: null, status: 'none', error: null }); resetDrafts() }
beforeEach(reset)
afterEach(() => { cleanup(); setTeamFetch(null); reset() })

const records = [
  { id: 'x', family: 'quantity', label: 'Jobs added by the extra person' }, { id: 'tool_gain', family: 'quantity', label: 'Tool gain' },
  { id: 'add', family: 'option', label: 'Add a person' }, { id: 'tool', family: 'option', label: 'Buy the tool' }, { id: 'carry_on', family: 'option', label: 'Carry on' },
  { id: 'reach_100', family: 'goal', label: 'Reach 100 a week' },
]
const row = (id: number, by: string, figures?: TeamFigure[]): TeamViewRow => ({ id, by, mine: false, revealed: true, text: `${by} says`, skip: false, ...(figures ? { figures } : {}) })
const findings = (facts: TeamViewFact[], more: Record<string, unknown> = {}) => ({ status: 'current' as const, version: 1, reveal: 9, contributions: [], facts, science: { flags: ['OLUMI_D7'], modules: [{ module: 'views', status: 'spoke', reason: null }] }, ...more })
const served = (extra: Partial<TeamScenario>): TeamScenario => scenario({
  reveal: { state: 'revealed', at: 'x' },
  version: { id: 4, n: 1, form: { records } },
  views: [row(1, 'Priya', [{ quantity: 'tool_gain', unit: 'job/week', version: 1, value: 30 }]), row(2, 'Sam')],
  ...extra,
})
async function open(state: TeamScenario) {
  setTeamFetch(fakeApi(() => ({ json: state })).fetchImpl)
  render(<TeamTab scenarioUuid={UUID} />)
  await screen.findByTestId('team-revealed')
}

describe('Team tab: D7, where a member\'s figure and the model disagree', () => {
  it('a revealed figure that reverses the leader reaches the tab: core\'s word, the two leaders, and the chances on each side', async () => {
    await open(served({ view_findings: findings(S6.reversed!) }))
    const section = screen.getByTestId('team-view-findings')
    const item = within(section).getByTestId('team-view-finding-V1')
    expect(item.getAttribute('data-change')).toBe('reversed')
    expect(item.textContent).toContain('leader')
    expect(item.textContent).toContain('reversed')
    expect(item.textContent).toContain('‘Add a person’')
    expect(item.textContent).toContain('‘Buy the tool’')
    expect(item.textContent).toContain('Priya')
    expect(within(item).getByTestId('team-view-finding-V1-options').textContent).toMatch(/Buy the tool.*never meets on the model, always meets on Priya/)
    // labels, not a sentence of ours
    expect(item.textContent).not.toMatch(/ leads | instead of | still leads/)
  })
  it('a comparison gone stale reaches the tab as its status and nothing else, however much it carries', async () => {
    await open(served({ view_findings: { status: 'stale', code: 'version_moved', version: 1, reveal: 9, contributions: [], facts: S6.reversed } as never }))
    expect(screen.getByTestId('team-view-findings-stale').textContent).toMatch(/approved model has changed/)
    expect(screen.queryByTestId('team-view-finding-V1')).toBeNull()
    expect(screen.getByTestId('team-view-findings').textContent).not.toMatch(/Buy the tool|reversed/)
  })
  it('a figure core did not run says why, in DGAI\'s words for the code', async () => {
    await open(served({ view_findings: findings(S6.refused!) }))
    expect(screen.getByTestId('team-view-finding-V1').textContent).toMatch(/not run.*the model does not hold that figure/)
    expect(screen.getByTestId('team-view-finding-V1').textContent).not.toContain('unknown_figure')
  })
  it('with the flag off in core nothing is added: no section when view_findings is absent, and none when no comparison has been made', async () => {
    await open(served({}))
    expect(screen.queryByTestId('team-view-findings')).toBeNull()
    cleanup(); reset()
    await open(served({ view_findings: null }))
    expect(screen.queryByTestId('team-view-findings')).toBeNull()
  })
  it('two close chances are told apart on the page (about 1.3% and 0.9%, never both "about 1%")', async () => {
    const close = [{ ...S6.same![0]!, about: { ...S6.same![0]!.about, options: [{ option: 'add', model: 0.0133, view: 0.0089, gap: -0.0044, exact: false, model_exact: false, view_exact: false }] } }] as TeamViewFact[]
    await open(served({ view_findings: findings(close) }))
    const words = screen.getByTestId('team-view-finding-V1-options').textContent ?? ''
    expect(words).toContain('about 1.3%')
    expect(words).toContain('about 0.9%')
    expect(words).not.toContain('about 1%')
  })
  it('both provenance blocks are shown apart, with the Olumi mark on the side that rests on something Olumi proposed', async () => {
    await open(served({ view_findings: findings(S6.olumi_x!) }))
    const model = screen.getByTestId('team-view-finding-V1-model'), view = screen.getByTestId('team-view-finding-V1-view')
    expect(within(model).getByTestId('team-view-finding-V1-model-olumi')).toBeTruthy()
    expect(model.textContent).toMatch(/Olumi's what-if figures for ‘Jobs added by the extra person’ \(not yet approved\)/)
    expect(within(view).queryByTestId('team-view-finding-V1-view-olumi')).toBeNull()
    expect(view.textContent).not.toMatch(/what-if figures/)
  })
})
