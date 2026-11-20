/**
 * The panel-system rules, extended to the Team tab (V12 lane, 20 Nov): hover is the one Tip (no native `title` is drawn, and each hover is
 * reachable by REAL keyboard focus), every disclosure names the region it opens, a held button is aria-disabled and still says why, and the
 * Team files carry no direct lucide-react import (their icons come from the registry).
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render, screen } from '@testing-library/react'
import golden from '../../olumiView/golden/european.view.json'
import type { View } from '../../olumiView/client'
import { useViewStore } from '../../olumiView/store'
import { setTeamFetch } from '../team/api'
import { resetDrafts } from '../team/drafts'
import { resetWrites } from '../team/writes'
import { TeamTab } from '../team/TeamTab'
import { resetTeamFlow } from '../team/flow'
import { useMe } from '../me'
import { tipOnFocus } from '../../olumiView/__tests__/tipHelpers'
import { ICONS, duplicateIconIds } from '../../olumiView/look/icons'

const SID = 's_0123456789ab'
const base = golden as unknown as View
const twoPeople = (over: Partial<View['collab']> = {}, view: Partial<View> = {}): View => ({
  ...base, id: SID, you: 'Ada', you_id: 'p_1',
  members: [{ id: 'p_1', name: 'Ada' }, { id: 'p_2', name: 'Bea' }],
  // N3: core's lines for these members (olumi-core screen-words.ts teamPresenceOf), "(you)" by `you_id`.
  team_presence: { title: 'Ada (you), Bea', label: 'Team: Ada (you), Bea', members: [{ id: 'p_1', text: 'Ada (you)' }, { id: 'p_2', text: 'Bea' }] },
  collab: {
    alone: false, heading: 'Team views · 2', open: true,
    shared: [{ id: 3, by: 'Bea', by_id: 'p_2', text: 'Hold until the pilot reports.', skip: false, figures: [], effects: [] }],
    mine: [{ id: 4, text: 'Enter one country first.', shared: false, skip: false, figures: [], can_share: false, earlier: false }],
    placeholder: 'Your own view, private until revealed', can_reveal: false, waiting: 'waiting for Bea',
    commitments: [{ id: 9, at: '2026-11-03T10:00:00Z', by: 'Ada', by_id: 'p_1', action: 'Pilot in Germany', owner: 'Bea', owner_id: 'p_2', expect: 'Ten customers by March', reconsider: 'Fewer than five by February', keeps: ['d_1'], option: null, version: null, expect_band: null, review_on: null, trigger: null,
      outcomes: [{ id: 2, at: '2026-11-03T11:00:00Z', by: 'Bea', by_id: 'p_2', happened: 'Seven customers.', versus: 'worse', reconsider_triggered: false, note: null, figure: null, dissent: [] }] }],
    owners: [{ id: 'p_1', name: 'Ada' }, { id: 'p_2', name: 'Bea' }],
    records: [...base.collab.records, { id: 'd_1', family: 'dissent', label: 'Bea: wait for the pilot' }, { id: 'gone', family: 'quantity', label: null }],
    dissent: [{ id: 'd_1', holder: 'Bea', position: 'Wait for the pilot before entering a second country.', holder_id: 'p_2', confirmed: null }],
    effect_headings: base.collab.effect_headings,
    suggested_triggers: [], suggested_triggers_caption: base.collab.suggested_triggers_caption, max_view_figures: base.collab.max_view_figures, view_figures_limit_text: base.collab.view_figures_limit_text, private_view_prompt: null,
    ...over,
  },
  evidence: [{ id: 5, at: '2026-11-03T09:00:00Z', by: 'Bea', by_id: 'p_2', text: 'Churn in DACH was 2 in 100.', source: 'https://example.org/churn', link: 'https://example.org/churn', concerns: [base.collab.records[0]!.id], stance: 'challenges', version: 1, considered: null,
    // N3: core's own words for this evidence (olumi-core src/view/screen-words.ts evidenceWordsOf).
    stance_text: 'Bea: Challenges it', switch_text: 'Bea’s evidence', mark_label: 'Bea · Churn in DACH was 2 in 100.', mark_title: 'Bea · Churn in DACH was 2 in 100. · https://example.org/churn',
    bears_on_text: `Bears on: ${base.collab.records[0]!.label}` }],
  gated: false, // a member who has given their own view: core holds them no longer
  ...view,
})

let served: View
beforeEach(() => {
  served = twoPeople({ shared: [] }, { gated: true })
  setTeamFetch((async () => new Response(JSON.stringify(served), { status: 200 })) as unknown as typeof fetch)
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-0123456789ab', sid: SID, view: served, status: 'ready', error: null, stale: false })
  useMe.setState({ me: { id: 'p_1', name: 'Ada' }, status: 'ready' })
})
afterEach(() => { cleanup(); resetTeamFlow(); setTeamFetch(null); resetDrafts(); resetWrites(); useMe.setState({ me: null, status: 'none' }) })

/** The Team tab's source: its own folder, the two docks it hands the panel to, the difference cards and the strategy overview. */
const TEAM_FILES = [
  ...['CardDiffers', 'CardDispute', 'CommitmentPanel', 'ComparePanel', 'DissentPanel', 'EvidencePanel', 'InvitePanel', 'LinkStance', 'OutcomePanel', 'SavedActions', 'TeamTab', 'ViewDoubts', 'ViewsPanel', 'steps'].map((n) => `olumiCore/team/${n}.tsx`),
  'olumiView/RevealDock.tsx', 'olumiView/EvidenceDock.tsx', 'olumiView/v12/views/WhereWeDiffer.tsx', 'olumiView/strategy/StrategyOverview.tsx',
  'olumiView/strategy/overview/StrategyOverviewOpener.tsx', 'olumiView/strategy/overview/StrategyOverviewPage.tsx',
]
const SRC = path.resolve('src')

describe('Team tab: hover is the one Tip, icons are the registry\'s', () => {
  it('the Team source writes no title= attribute and imports no lucide-react (contrast: the registry does)', () => {
    const titles = TEAM_FILES.flatMap((f) => readFileSync(path.join(SRC, f), 'utf8').split('\n').flatMap((line, i) => (/(^|[\s<])title=[{"']/.test(line) ? [`${f}:${i + 1}`] : [])))
    const lucide = TEAM_FILES.filter((f) => /from 'lucide-react'/.test(readFileSync(path.join(SRC, f), 'utf8')))
    expect({ titles, lucide }).toEqual({ titles: [], lucide: [] })
    expect(readFileSync(path.join(SRC, 'olumiView/look/icons.tsx'), 'utf8')).toMatch(/from 'lucide-react'/)
  })
  it('the Team ids are in the registry, each its own glyph', () => {
    expect(['differ-link', 'private-view', 'strategy-overview', 'trigger-taken'].filter((id) => !(id in ICONS))).toEqual([])
    expect(duplicateIconIds(ICONS).filter((id) => ['differ-link', 'private-view', 'strategy-overview', 'trigger-taken'].includes(id))).toEqual([])
  })
  it('the tab draws no native title, and a member whose view is in says so through the Tip on real keyboard focus', async () => {
    served = twoPeople()
    useViewStore.setState({ view: served })
    const { container } = render(<TeamTab />)
    expect([...container.querySelectorAll('[title]')].map((e) => `${e.tagName.toLowerCase()}[${e.getAttribute('data-testid') ?? ''}]`)).toEqual([])
    const hover = screen.getByTestId('team-member-p_2').querySelector<HTMLElement>('[tabindex]')!
    expect(await tipOnFocus(hover)).toBe('Their view is revealed')
  })
  it('a held "Add my view" is aria-disabled, stays a keyboard stop, and says why on real keyboard focus', async () => {
    render(<TeamTab />)
    const give = screen.getByTestId('team-view-give')
    expect(give).toHaveAttribute('aria-disabled', 'true')
    expect(give).not.toBeDisabled()
    expect(await tipOnFocus(give)).toBe('Write your view first')
  })
})

describe('Team tab: every disclosure names the region it opens', () => {
  it('each step row says expanded or not and its aria-controls resolves to the step\'s body', () => {
    served = twoPeople()
    useViewStore.setState({ view: served })
    render(<TeamTab />)
    const rows = [...document.querySelectorAll<HTMLElement>('[data-testid^="team-step-"][data-testid$="-row"]')]
    expect(rows.length).toBeGreaterThan(1)
    for (const r of rows) {
      expect(['true', 'false'], r.getAttribute('data-testid')!).toContain(r.getAttribute('aria-expanded'))
      expect(document.getElementById(r.getAttribute('aria-controls')!), r.getAttribute('data-testid')!).not.toBeNull()
    }
    const later = screen.queryByTestId('team-steps-later')
    if (later !== null) {
      expect(['true', 'false']).toContain(later.getAttribute('aria-expanded'))
      const ids = later.getAttribute('aria-controls')!.split(' ')
      expect(ids.length).toBeGreaterThan(0)
      expect(ids.filter((id) => document.getElementById(id) === null)).toEqual([])
    }
  })
})
