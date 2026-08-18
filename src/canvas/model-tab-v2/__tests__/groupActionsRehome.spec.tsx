/**
 * THE REHOME'S COMPLETENESS PROOF — every send-to-AI capability of the v1 Model
 * tab, on the canonical outline (founder ruling, 18 Aug 2026: REHOME → DELETE).
 *
 * ## What this file is for
 *
 * The delete step removes eleven call sites across six components. It is
 * reviewable ONLY if every one of them has a named successor that carries the
 * SAME turn text. So the load-bearing test here is not "buttons render" — it is
 * the MANIFEST below, transcribed from the v1 sources at `9ff14c19`, asserted
 * for exact set equality in BOTH directions against the rehomed table.
 *
 * ⚠ EXACT EQUALITY BOTH WAYS IS DELIBERATE. A subset assertion would pass while
 * a capability was silently dropped; a superset assertion would pass while the
 * rehome invented a turn nobody asked for. Both are failures and both are
 * invisible to a "does it render" test.
 *
 * ⚠ THE MANIFEST IS A HAND-TRANSCRIBED RECORD OF THE v1 SOURCE, ON PURPOSE, and
 * this is the one place in this change where that is right rather than the trap.
 * Deriving it from `groupActions.ts` would make it a guard agreeing with itself
 * (platform trap 13b); deriving it from the v1 files would make the test pass
 * automatically the moment they are deleted, which is precisely the moment it
 * must still hold. It is pinned to the HISTORIC source (trap 14b) and its
 * provenance is the `rehomedFrom` field on every action.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ModelOutline } from '../ModelOutline'
import { ALL_GROUP_ACTIONS, GROUP_ACTIONS } from '../groupActions'
import { MODEL_GROUP_IDS, type ModelGroupId, type ModelRow } from '../types'

/**
 * Every message the v1 Model tab could send, transcribed from the source at
 * `9ff14c19`. Ten distinct turns across eleven call sites — "Explore other
 * strategies" occupied TWO mutually exclusive branches under ONE testid
 * (`OptionsSection.tsx:486` and `:508`), which is why a testid census could not
 * see the duplication and a message census can.
 *
 * `Map interventions` (`OptionsSection.tsx:472`) is deliberately ABSENT: it is an
 * adjudicated CUT (design §7.0 items 2 and 10), not a dropped capability.
 */
const V1_MESSAGES = [
  // GoalSection.tsx:243 — interpolates the goal label and displayed target.
  "Help me understand my goal 'Grow ARR' and whether the target of 45% is appropriate",
  // OptionsSection.tsx:486 and :508 — one action, two render sites.
  'I want to explore other strategies and options',
  // OptionsSection.tsx:521
  'Help me review my options and how they compare',
  // FactorsSection.tsx:737
  'I want to add a new factor to the model',
  // FactorsSection.tsx:745
  'Help me review the factors in my model and whether the values are reasonable',
  // RisksSection.tsx:100 — THE SEVENTH CAPABILITY the founder's six did not name.
  'I want to identify potential risks that could cause this decision to fail',
  // RisksSection.tsx:143
  'Help me understand the risks in my model and how to mitigate them',
  // RelationshipsSection.tsx:819
  "I'd like to add a causal relationship",
  // RelationshipsSection.tsx:827
  'Help me review the causal relationships and which ones need attention',
  // ModelHealthSection.tsx:328
  'Help me understand the reliability and limitations of my model',
] as const

/** The context the goal message interpolates, matching the manifest above. */
const CTX = { goalLabel: 'Grow ARR', goalTarget: '45%' }

function row(id: string, group: ModelGroupId, over: Partial<ModelRow> = {}): ModelRow {
  return {
    id,
    kind: 'factor',
    group,
    label: `Label ${id}`,
    primaryValue: '1',
    attention: [],
    editable: true,
    ...over,
  }
}

describe('rehome completeness — every v1 send-to-AI capability has a successor', () => {
  it('the rehomed messages are EXACTLY the v1 messages, both directions', () => {
    const rehomed = ALL_GROUP_ACTIONS.map(a => a.message(CTX)).sort()
    expect(rehomed).toEqual([...V1_MESSAGES].sort())
  })

  it('carries ten actions — one per distinct v1 turn, no more', () => {
    expect(ALL_GROUP_ACTIONS).toHaveLength(V1_MESSAGES.length)
  })

  it('THE SEVENTH CAPABILITY: a structural risk affordance exists, bound by id', () => {
    const addRisk = ALL_GROUP_ACTIONS.find(a => a.id === 'risks-add')
    expect(addRisk).toBeDefined()
    expect(addRisk!.intent).toBe('structural')
    expect(addRisk!.message(CTX)).toBe(
      'I want to identify potential risks that could cause this decision to fail',
    )
    expect(addRisk!.rehomedFrom).toContain('RisksSection.tsx:100')
  })

  it('every action names the v1 site it replaces — the delete step’s checklist', () => {
    for (const action of ALL_GROUP_ACTIONS) {
      expect(action.rehomedFrom, `${action.id} has no provenance`).toMatch(/\.tsx:\d+/)
    }
  })

  it('no two actions share an id — the "one testid, two sites" defect cannot recur', () => {
    const ids = ALL_GROUP_ACTIONS.map(a => a.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('the table is total over the seven groups', () => {
    expect(Object.keys(GROUP_ACTIONS).sort()).toEqual([...MODEL_GROUP_IDS].sort())
  })

  it('the four structural capabilities the founder named are structural, by id', () => {
    const structural = ALL_GROUP_ACTIONS.filter(a => a.intent === 'structural').map(a => a.id).sort()
    expect(structural).toEqual(['factors-add', 'options-explore', 'relationships-add', 'risks-add'])
  })
})

describe('the outline renders the rehomed affordances', () => {
  it('renders every action as a button, addressed by its own id', () => {
    render(
      <ModelOutline
        rows={[row('f1', 'factors')]}
        tier="plain"
        onGroupAction={vi.fn()}
        groupActionContext={CTX}
      />,
    )
    for (const action of ALL_GROUP_ACTIONS) {
      expect(
        screen.getByTestId(`model-action-v2-${action.id}`),
        `${action.id} is not on the outline`,
      ).toBeInTheDocument()
    }
  })

  it('clicking an action hands its EXACT message to the host', () => {
    const onGroupAction = vi.fn()
    render(
      <ModelOutline
        rows={[row('f1', 'factors')]}
        tier="plain"
        onGroupAction={onGroupAction}
        groupActionContext={CTX}
      />,
    )
    fireEvent.click(screen.getByTestId('model-action-v2-factors-add'))
    expect(onGroupAction).toHaveBeenCalledTimes(1)
    expect(onGroupAction.mock.calls[0][1]).toBe('I want to add a new factor to the model')
    expect(onGroupAction.mock.calls[0][0].id).toBe('factors-add')
  })

  it('the goal hand-off quotes the target THIS OUTLINE displays (P5)', () => {
    const onGroupAction = vi.fn()
    render(
      <ModelOutline
        rows={[row('g1', 'goal', { kind: 'goal', label: 'Grow ARR', primaryValue: '45%' })]}
        tier="plain"
        onGroupAction={onGroupAction}
        groupActionContext={{ goalLabel: 'Grow ARR', goalTarget: '45%' }}
      />,
    )
    fireEvent.click(screen.getByTestId('model-action-v2-goal-discuss'))
    expect(onGroupAction.mock.calls[0][1]).toBe(
      "Help me understand my goal 'Grow ARR' and whether the target of 45% is appropriate",
    )
  })

  it('"Add a factor" is reachable when the group is EMPTY — the v1 gap', () => {
    render(
      <ModelOutline rows={[]} tier="plain" onGroupAction={vi.fn()} groupActionContext={CTX} />,
    )
    expect(screen.getByTestId('model-action-v2-factors-add')).toBeInTheDocument()
    // Its v1 twin's mirror-image gap: the risk CTA existed ONLY when empty.
    expect(screen.getByTestId('model-action-v2-risks-add')).toBeInTheDocument()
  })

  it('"Identify potential risks" is reachable when risks ALREADY EXIST — v1 hid it', () => {
    render(
      <ModelOutline
        rows={[row('r1', 'outcomes-risks', { kind: 'risk' })]}
        tier="plain"
        onGroupAction={vi.fn()}
        groupActionContext={CTX}
      />,
    )
    expect(screen.getByTestId('model-action-v2-risks-add')).toBeInTheDocument()
  })

  it('P8: with no hand-off, NO affordance renders — never an inert button', () => {
    render(<ModelOutline rows={[row('f1', 'factors')]} tier="plain" groupActionContext={CTX} />)
    for (const action of ALL_GROUP_ACTIONS) {
      expect(screen.queryByTestId(`model-action-v2-${action.id}`)).toBeNull()
    }
    // Contrast control: the outline itself DID render, so the absence above is
    // about the affordances and not about a failed render (trap 13).
    expect(screen.getByTestId('model-outline-v2')).toBeInTheDocument()
    expect(screen.getByTestId('model-row-v2-f1')).toBeInTheDocument()
  })

  it('a group with no v1 equivalent offers nothing, and says so by rendering no container', () => {
    render(
      <ModelOutline rows={[]} tier="plain" onGroupAction={vi.fn()} groupActionContext={CTX} />,
    )
    expect(screen.queryByTestId('model-group-v2-assumptions-provenance-actions')).toBeNull()
    // Contrast control: a group that DOES have actions renders its container.
    expect(screen.getByTestId('model-group-v2-factors-actions')).toBeInTheDocument()
  })
})
