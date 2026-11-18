/**
 * V12 v10 review item 9: the Team tab on a first arrival. A member core still holds (`gated`) reads the private-view box above the
 * "Team views" heading, with the scenario's own question text as its placeholder where the View carries it, and the reason its first
 * button waits folded into the button's title (no second line). Contrast rows: a member core does not hold has the box where it was
 * (below the heading); a View with no question keeps core's placeholder. Bound by test id and by the View's own words.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import golden from '../../olumiView/golden/european.view.json'
import type { View } from '../../olumiView/client'
import { useViewStore } from '../../olumiView/store'
import { setTeamFetch } from '../team/api'
import { resetDrafts } from '../team/drafts'
import { resetWrites } from '../team/writes'
import { TeamTab } from '../team/TeamTab'
import { resetTeamFlow } from '../team/flow'
import { useMe } from '../me'

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


let served2: View
beforeEach(() => {
  served2 = twoPeople({ shared: [] }, { gated: true })
  setTeamFetch((async () => new Response(JSON.stringify(served2), { status: 200 })) as unknown as typeof fetch)
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-0123456789ab', sid: SID, view: served2, status: 'ready', error: null, stale: false })
  useMe.setState({ me: { id: 'p_1', name: 'Ada' }, status: 'ready' })
})
afterEach(() => { cleanup(); resetTeamFlow(); setTeamFetch(null); resetDrafts(); resetWrites(); useMe.setState({ me: null, status: 'none' }) })

const before = (a: Element, b: Element) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
const setView = (v: View) => useViewStore.setState({ view: v })

describe('Team first arrival (v10 review item 9)', () => {
  // CHANGED BY DESIGN (overnight 18 Nov flow): the tab's heading is the header above every step; what v10 item 9 asked for (the box and its
  // first button in view on arrival) is now the open "Your view" step, with nothing but the header and one closed line above it.
  it('a held member arrives on the open "Your view" step: first arrival, then the box and its first button; one not held does not (contrast)', () => {
    render(<TeamTab />)
    const stepView = screen.getByTestId('team-step-view')
    expect(stepView.getAttribute('data-step-open')).toBe('')
    expect(stepView.contains(screen.getByTestId('team-view-text'))).toBe(true)
    expect(before(screen.getByTestId('first-arrival'), screen.getByTestId('team-view-text'))).toBe(true)
    expect(before(screen.getByTestId('team-view-text'), screen.getByTestId('team-view-give'))).toBe(true)
    // Only the invite step's one line stands between the header and this step.
    expect(screen.getByTestId('team-step-invite').hasAttribute('data-step-open')).toBe(false)
    cleanup()
    setView(twoPeople({ shared: [] }, { gated: false }))
    render(<TeamTab />)
    expect(screen.queryByTestId('first-arrival')).toBeNull()
    expect(screen.getByTestId('team-step-view').hasAttribute('data-step-open')).toBe(false)
  })

  it("the box's placeholder is the scenario's own question text from the View; a View without one keeps core's placeholder", () => {
    render(<TeamTab />)
    const q = base.model!.question.text
    expect(q).toBeTruthy()
    expect(screen.getByTestId('team-view-text').getAttribute('placeholder')).toBe(q)
    expect(screen.getByTestId('team-view-text').getAttribute('aria-label')).toBe('Your own view, private until revealed')
    cleanup()
    setView({ ...served2, model: null } as unknown as View)
    render(<TeamTab />)
    expect(screen.getByTestId('team-view-text').getAttribute('placeholder')).toBe('Your own view, private until revealed')
  })

  it('"Add my view" says why it waits in its own title, with no second line; typed words clear the title', () => {
    render(<TeamTab />)
    const give = screen.getByTestId('team-view-give') as HTMLButtonElement
    expect(give.disabled).toBe(true)
    expect(give.getAttribute('title')).toBe('Write your view first')
    expect(screen.queryByTestId('team-view-give-why')).toBeNull()
    fireEvent.change(screen.getByTestId('team-view-text'), { target: { value: 'Wait for the pilot.' } })
    expect(give.disabled).toBe(false)
    expect(give.getAttribute('title')).toBeNull()
  })
})
