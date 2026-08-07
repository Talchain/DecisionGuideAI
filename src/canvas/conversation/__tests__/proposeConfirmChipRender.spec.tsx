/**
 * ROADMAP 2.668 — the propose-confirm consent chip must REACH THE USER.
 *
 * ─── The corpus, and why it is the instrument that matters ─────────────────
 * `chipActionVocabulary.spec.ts` proves the render vocabulary AGREES with the
 * wire and the dispatcher. Agreement is not enough (trap 12d): a derived guard
 * is structurally blind to a vocabulary that is SHORT, and the whole 2.668
 * defect was a vocabulary that was short. Only a corpus written from what CEE
 * was MEASURED emitting can notice that — so this file is hand-written from
 * captured producer shapes, deliberately, and must stay that way.
 *
 * Capture provenance: CEE #839's full-route probe (recorded in ROADMAP 2.663,
 * 2026-08-07) on the #836 warrantless-mutation demotion path. CEE's step2 gate
 * judges the warrant absent, demotes the `add_constraint` op to an OFFER, and
 * emits it as a `suggested_actions` entry paired with a `pending_actions`
 * confirmation record. The 2026-08-06 live consent witness saw the other end of
 * the same turn — `{"event":"v5.turn_executor.mutation_warrant_absent",
 * "handler_id":"add_constraint","demotion":"offered"}` — and reported "Still NO
 * propose-confirm CHIP anywhere". The chip was on the wire the whole time.
 *
 * The fixture is not trusted on my say-so: every captured action is parsed
 * through the vendored `ActionSchema` before use, so a shape this suite renders
 * is provably a shape the contract admits (trap 16 — a fixture you wrote
 * yourself is not evidence about the wire; parsing it against the producer's
 * own schema is the closest a unit test gets).
 *
 * `pending_actions` is CEE-side state: it is absent from the 0.38.0
 * `OlumiResponseSchema` (which is `.strict()`) and has no UI consumer. It is
 * carried in the fixture as the record of the confirmation pair, not as
 * something the UI reads.
 *
 * ─── What is bound, and how ───────────────────────────────────────────────
 * Rendering is asserted through `ChatThread`, the surface the deployed flags
 * actually mount (trap 3b): staging serves `VITE_FEATURE_AI_PANEL_V2=true` and
 * the V5 orchestrator, and the 2026-08-06 witness saw this row live
 * ("Chat chips offered: [Run analysis] [Review model] …"). Asserting against
 * `SuggestedChips` in isolation would prove the component works while saying
 * nothing about whether the thread mounts it.
 *
 * Every assertion binds by IDENTITY — the proposal's own `prop_` id and its
 * verbatim label — never by a value predicate a sibling chip could satisfy
 * (trap 19). The unknown-action chip in the same render is the discriminating
 * half: it proves the row is filtering on the named action_type rather than
 * having simply been switched off.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { ActionSchema } from '@talchain/schemas/boundary'

import { ChatThread } from '../zones/ChatThread'
import { buildSuggestedActionChips } from '../../../v5/blocks/suggestedActionChips'
import { buildV5Payload, type BuildV5PayloadInput } from '../../../v5/buildPayload'
import { ACTION_TO_TURN_TYPE } from '../actionTurnTypes'
import { useCanvasStore } from '../../store'
import type { ConversationMessage } from '../types'

// ---------------------------------------------------------------------------
// Captured producer shapes (CEE #839 full-route probe, ROADMAP 2.663)
// ---------------------------------------------------------------------------

/** The #836 demotion: a graph mutation held back and offered for confirmation. */
const DEMOTION_PROPOSAL_ID = 'prop_9f2c41ab'
const DEMOTION_LABEL = 'Add this limit'
const DEMOTION_CONFIRM_UTTERANCE =
  'Yes, add the limit keeping Customer Churn Rate at or below 3%.'

const CAPTURED_DEMOTION_TURN = {
  suggested_actions: [
    {
      id: DEMOTION_PROPOSAL_ID,
      label: DEMOTION_LABEL,
      message: DEMOTION_CONFIRM_UTTERANCE,
      action_type: 'add_constraint',
    },
  ],
  // CEE-side confirmation record for the offered op. No UI consumer; recorded
  // here because it is what makes the suggested action a CONSENT affordance
  // rather than a suggestion.
  pending_actions: [{ kind: 'apply_proposed_change', chip_id: DEMOTION_PROPOSAL_ID }],
}

/**
 * The other two members of CEE's registered graph-mutation vocabulary. Same
 * demotion machinery, same darkness before this fix — `intentToActionType`
 * emits exactly these three, so a fix that lit only `add_constraint` would
 * leave two thirds of the channel dark.
 */
const CAPTURED_SIBLING_PROPOSALS = [
  {
    id: 'prop_setval_01',
    label: 'Set this value',
    message: 'Yes, set Customer Churn Rate to 0.03.',
    action_type: 'set_factor_value',
  },
  {
    id: 'prop_edge_01',
    label: 'Strengthen this link',
    message: 'Yes, strengthen the link from Premium Tier Launch to ARPU Uplift.',
    action_type: 'adjust_edge_strength',
  },
]

/**
 * An action_type outside the wire vocabulary. The allowlist exists partly to
 * stop these rendering as executable affordances (2.668 I-D) and that must
 * survive the switch to derivation.
 */
const UNKNOWN_ACTION = {
  id: 'prop_unknown_01',
  label: 'Do the unknown thing',
  message: 'Yes, do the unknown thing.',
  action_type: 'demolish_graph',
}

function isWireLegal(action: Record<string, unknown>): boolean {
  return ActionSchema.safeParse(action).success
}

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

vi.mock('../../../stores/uiStore', () => ({
  useUIStore: Object.assign((selector: (s: any) => any) => selector({}), {
    getState: () => ({ setActiveOutputTab: vi.fn() }),
    setState: vi.fn(),
  }),
}))

vi.mock('../../stores/guidanceStore', () => ({
  useGuidanceStore: Object.assign(
    (selector: (s: any) => any) => selector({ guidanceItems: [], _dispatchAction: vi.fn() }),
    {
      getState: () => ({ guidanceItems: [], _dispatchAction: vi.fn(), dismissItem: vi.fn() }),
    },
  ),
}))

let seq = 0
function assistantMessage(actionChips: ConversationMessage['actionChips']): ConversationMessage {
  seq += 1
  return {
    id: `msg-${seq}`,
    role: 'assistant',
    content: 'You did not ask me to edit the model, so I have not.',
    timestamp: new Date(),
    actionChips,
  }
}

function renderThread(
  actions: Array<Record<string, unknown>>,
  onChipClick = vi.fn().mockResolvedValue(undefined),
) {
  const chips = buildSuggestedActionChips([], actions as any)
  render(
    <ChatThread
      messages={[assistantMessage(chips)]}
      isThinking={false}
      longRunningHint={null}
      nodeCount={17}
      patchBlockStates={new Map()}
      patchRejections={new Map()}
      onChipClick={onChipClick}
      onPatchAccept={vi.fn()}
      onPatchDismiss={vi.fn()}
      onFeedback={vi.fn()}
      onRetry={vi.fn()}
    />,
  )
  return { chips, onChipClick }
}

beforeEach(() => {
  // Staging posture: the V5 orchestrator is the exclusive CEE path, which is
  // what switches the action_type filter on. With V5 off every chip passes
  // through unfiltered and this suite would prove nothing.
  vi.stubEnv('VITE_ENABLE_V5_ORCHESTRATOR', 'true')
  Element.prototype.scrollIntoView = vi.fn()
  useCanvasStore.setState({ ceeAnalysisReady: null as any })
})

afterEach(() => {
  vi.unstubAllEnvs()
  useCanvasStore.setState({ ceeAnalysisReady: null as any })
})

// ---------------------------------------------------------------------------
// Fixture preconditions — pinned in-test, so the discriminators cannot rot
// ---------------------------------------------------------------------------

describe('2.668 fixture preconditions', () => {
  it('every captured proposal is a wire-legal Action the contract admits', () => {
    // Without this, a typo in a fixture would produce a chip the producer could
    // never send, and the suite would be measuring a shape that does not exist.
    for (const action of [
      CAPTURED_DEMOTION_TURN.suggested_actions[0],
      ...CAPTURED_SIBLING_PROPOSALS,
    ]) {
      expect(isWireLegal(action), `${action.id} must parse as an Action`).toBe(true)
    }
  })

  it('the unknown-action fixture is genuinely unpublished — its discriminating power is pinned', () => {
    // The I-D tests below prove unknown actions drop. That proof is only worth
    // anything while this fixture is actually unknown: if `demolish_graph` were
    // ever added to the enum, those tests would keep passing while testing
    // nothing (trap 13b — a guard whose discrimination depends on a fixture
    // nothing pins). This is that pin.
    expect(isWireLegal(UNKNOWN_ACTION)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// I-A — the chip renders somewhere the user can click it
// ---------------------------------------------------------------------------

describe('2.668 I-A — a demoted proposal reaches the user as a clickable chip', () => {
  it('renders the captured #836 add_constraint demotion chip in the thread', () => {
    renderThread([CAPTURED_DEMOTION_TURN.suggested_actions[0]])

    const chip = screen.getByTestId(`suggested-chip-${DEMOTION_PROPOSAL_ID}`)
    expect(chip).toBeInTheDocument()
    expect(chip).toHaveTextContent(DEMOTION_LABEL)
    expect(chip.tagName).toBe('BUTTON')
    expect(chip).not.toBeDisabled()
  })

  it('renders it EXACTLY ONCE — SuggestedChips is the sole surface for actionChips', () => {
    // Pins the property that survived removing the dead `hideChips` chain: the
    // thread has one chip surface, so a re-introduced inline row would show up
    // here as a duplicate rather than silently doubling the consent affordance.
    renderThread([CAPTURED_DEMOTION_TURN.suggested_actions[0]])

    expect(screen.getAllByRole('button', { name: DEMOTION_LABEL })).toHaveLength(1)
  })

  it('mounts it through the response-chip-group the deployed thread renders', () => {
    // Binds to the MOUNT PATH, not just to the component: if ChatThread stops
    // grouping chips with the last assistant message, this fails loud rather
    // than passing because SuggestedChips still works in isolation.
    renderThread([CAPTURED_DEMOTION_TURN.suggested_actions[0]])

    const group = screen.getByTestId('response-chip-group')
    expect(group.contains(screen.getByTestId(`suggested-chip-${DEMOTION_PROPOSAL_ID}`))).toBe(true)
  })

  it('renders all three of the graph-mutation vocabulary, not just add_constraint', () => {
    renderThread([CAPTURED_DEMOTION_TURN.suggested_actions[0], ...CAPTURED_SIBLING_PROPOSALS])

    expect(screen.getByTestId(`suggested-chip-${DEMOTION_PROPOSAL_ID}`)).toBeInTheDocument()
    for (const sibling of CAPTURED_SIBLING_PROPOSALS) {
      expect(screen.getByTestId(`suggested-chip-${sibling.id}`)).toBeInTheDocument()
    }
  })
})

// ---------------------------------------------------------------------------
// I-D — unknown actions still drop (the discriminating pair)
// ---------------------------------------------------------------------------

describe('2.668 I-D — the safety property survives derivation', () => {
  it('drops an unknown action_type while the proposal in the SAME turn renders', () => {
    // The discriminating pair, in one render. The proposal rendering proves the
    // row is live; the unknown chip vanishing proves the filter is keyed on the
    // named action_type and not merely switched off. Either half alone shows
    // nothing.
    renderThread([CAPTURED_DEMOTION_TURN.suggested_actions[0], UNKNOWN_ACTION])

    expect(screen.getByTestId(`suggested-chip-${DEMOTION_PROPOSAL_ID}`)).toBeInTheDocument()
    expect(screen.queryByTestId(`suggested-chip-${UNKNOWN_ACTION.id}`)).toBeNull()
    expect(screen.queryByRole('button', { name: UNKNOWN_ACTION.label })).toBeNull()
  })

  it('drops an unknown action_type even when it is the only chip on the turn', () => {
    renderThread([UNKNOWN_ACTION])

    expect(screen.queryByTestId(`suggested-chip-${UNKNOWN_ACTION.id}`)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// I-C — the click drives the EXISTING confirm-resume path
// ---------------------------------------------------------------------------

describe('2.668 I-C — clicking the chip emits the confirm utterance', () => {
  it('hands the chip to onChipClick carrying the confirm message and the typed action', () => {
    const onChipClick = vi.fn().mockResolvedValue(undefined)
    renderThread([CAPTURED_DEMOTION_TURN.suggested_actions[0]], onChipClick)

    fireEvent.click(screen.getByTestId(`suggested-chip-${DEMOTION_PROPOSAL_ID}`))

    expect(onChipClick).toHaveBeenCalledTimes(1)
    const clicked = onChipClick.mock.calls[0][0]
    // Bound by identity: this is the PROPOSAL's chip, not some other chip that
    // happens to carry a message.
    expect(clicked.id).toBe(DEMOTION_PROPOSAL_ID)
    expect(clicked.message).toBe(DEMOTION_CONFIRM_UTTERANCE)
    expect(clicked.action_type).toBe('add_constraint')
  })

  it('dispatches through the existing deliberate turn mapping, not the default fallback', () => {
    // `dispatchAction` resolves the turn type from ACTION_TO_TURN_TYPE. A chip
    // whose action is absent from that map falls through to 'conversation' by
    // DEFAULT rather than by decision — the "promises action, delivers default
    // routing" case. This asserts the mapping is deliberate.
    expect(ACTION_TO_TURN_TYPE['add_constraint']).toBe('conversation')
    for (const sibling of CAPTURED_SIBLING_PROPOSALS) {
      expect(ACTION_TO_TURN_TYPE[sibling.action_type]).toBeDefined()
    }
  })

  it('keeps the typed action_type on the wire so CEE sees the confirm as warranted', () => {
    // The confirm-resume warrant (#839 F-B) is judged on the turn CEE receives.
    // If `sanitiseActionType` stripped `add_constraint`, CEE would see an
    // untyped chat turn and the chip would be a promise the transport broke.
    const input: BuildV5PayloadInput = {
      turnId: '00000000-0000-4000-8000-000000000001',
      scenarioId: '00000000-0000-4000-8000-000000000002',
      stage: 'analyse',
      turnClass: 'frame',
      mode: 'user',
      message: DEMOTION_CONFIRM_UTTERANCE,
      source: 'chip',
      chipMeta: { id: DEMOTION_PROPOSAL_ID, action_type: 'add_constraint' },
    }
    const build = buildV5Payload(input)
    if (!build.ok) throw new Error('payload build failed: ' + JSON.stringify(build))
    const payload = build.payload as { chip?: { action_type?: string } }
    expect(payload.chip?.action_type).toBe('add_constraint')
  })
})
