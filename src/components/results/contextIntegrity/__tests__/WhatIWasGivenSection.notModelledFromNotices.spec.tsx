/**
 * ⭐⭐ ONE SCREEN, TWO ANSWERS TO ONE QUESTION — ROADMAP 2.1379.
 *
 * ── THE DEFECT, MEASURED ON A FRESH GUEST JOURNEY (deployed `ce4769a1`) ─────
 * The Reasoning tab's register refuses: *"I can't show this yet for this
 * decision, so please don't read the absence as everything having made it in."*
 * Two panels above it, the same turn's bubble reads *"Olumi left N things out
 * of this model"*, with a breakdown. The refusal is not false — `manifest ===
 * null` really does mean CEE told this store nothing — but it is not the whole
 * truth, and on the one surface whose entire job is telling the user what
 * reached the model, an avoidable "I know nothing" beside a live count is the
 * confident-wrongness inversion: needless silence read as ignorance.
 *
 * ── ⛔ THE REFUSAL IS CORRECT AND STAYS ────────────────────────────────────
 * `WhatIWasGivenSection`'s header rules that `manifest === null` must refuse
 * EXPLICITLY — *"never an empty list, and never silence"* — because both read
 * as "everything made it in". Nothing here deletes the refusal or lets it fall
 * silent. It is RE-SCOPED: it names the thing that genuinely cannot be shown
 * (which of the user's figures reached the model) and points at the thing that
 * can. Pinned in both directions below, so a later seat cannot quietly drop
 * either arm.
 *
 * ── ⛔ WHY ONLY SOME KINDS REACH THIS PANE ─────────────────────────────────
 * The pane is called "Not modelled yet". `KIND_OUTCOME` already rules which
 * kinds every producer reason leaves OFF the graph: `detail_not_connected` and
 * `relationship_not_used`, and nothing else. The other four are in the model,
 * handled differently, or mixed. Listing a `present_changed` kind under "Not
 * modelled yet" would be the exact over-claim that authority exists to prevent,
 * and it would contradict the bubble two panels up on the same payload. That
 * rule is IMPORTED, never re-spelled — a second copy is trap 12.
 *
 * ── ⛔ AND WHY NO ROW NAMES AN ITEM, OR CARRIES AN ACT ─────────────────────
 * `details_redacted` is a literal `true`: the producer sends aggregate counts
 * per kind and NOTHING else. There is no literal, no char offset and no node
 * id, so `composeNotModelledQuestion` has nothing to compose and a "Where does
 * this fit?" button here would be a control that cannot do anything. This
 * panel's standing rule is that we never render one. The inertness is pinned.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

const conversation = { sendSystemEvent: () => Promise.resolve(undefined) }
vi.mock('../../../../canvas/conversation/ConversationContext', () => ({
  useOptionalConversationContext: () => conversation,
  useConversationContext: () => conversation,
  ConversationProvider: ({ children }: { children: unknown }) => children,
}))
vi.mock('../../../../canvas/ToastContext', () => ({
  useShowToastSafe: () => vi.fn(),
  ToastProvider: ({ children }: { children: unknown }) => children,
}))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusByTarget: vi.fn(),
  focusExistingTarget: vi.fn(),
  focusModelTarget: vi.fn(() => true),
}))

import { ModelBuildingNoticeKindSchema } from '@talchain/schemas/boundary'

import { WhatIWasGivenSection } from '../WhatIWasGivenSection'
import { useCanvasStore } from '@/canvas/store'
import { useContextIntegrityStore } from '@/canvas/stores/contextIntegrityStore'
import {
  modelBuildingNoticeAttribution,
  modelBuildingNoticeOutcome,
  toModelBuildingNoticesView,
} from '@/canvas/conversation/modelBuildingNotices'
import { NOT_MODELLED_NOTICES_COPY, notModelledNoticeRows } from '../notModelledNotices'

const LIVE_SCENARIO_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_SCENARIO_ID = '22222222-2222-4222-8222-222222222222'
const BRIEF = 'We have 8 months of runway and our NRR is 112%. Should we raise now?'
/** A SECOND decision's brief. A test that reuses one brief cannot tell which
 *  decision is on screen (trap 19). */
const BRIEF_B = 'Should we open a Berlin office next year?'

const LIST_TID = 'what-i-was-given-notyet-notices'
const ROW_TID = `${LIST_TID}-row`

/**
 * ⚠ ONE PAYLOAD CARRYING BOTH SIDES OF THE RULE, ON PURPOSE.
 * `detail_not_connected` is `absent` and must render; `alternative_consolidated`
 * is `present_changed` and must not. A fixture carrying only the first cannot
 * tell a pane that applies `KIND_OUTCOME` from one that renders whatever it is
 * handed (CLAUDE.md trap 19), and the pair is the discriminating half of this
 * suite.
 *
 * Parsed through the published schema rather than hand-built, so the two
 * cross-field rules (unique kinds, `total_count` equals the row sum) are
 * enforced on this fixture exactly as they are on the wire.
 */
const MIXED_NOTICES = toModelBuildingNoticesView({
  total_count: 15,
  groups: [
    { kind: 'detail_not_connected', count: 12 },
    { kind: 'alternative_consolidated', count: 3 },
  ],
  details_redacted: true,
})

/** A payload with NOTHING this pane may honestly show. Its own contrast. */
const NO_ABSENT_NOTICES = toModelBuildingNoticesView({
  total_count: 3,
  groups: [{ kind: 'alternative_consolidated', count: 3 }],
  details_redacted: true,
})

beforeEach(() => {
  useContextIntegrityStore.getState().reset()
  useCanvasStore.setState({ currentScenarioId: LIVE_SCENARIO_ID, nodes: [] } as never)
  // The FRESH-DRAFT path exactly: the brief the user typed, and `manifest:
  // null`, because the cold read answers `absent` for a decision this new.
  useContextIntegrityStore
    .getState()
    .recordBriefForFreshDraft({ scenarioId: LIVE_SCENARIO_ID, briefText: BRIEF })
})

afterEach(() => {
  useContextIntegrityStore.getState().reset()
  useCanvasStore.setState({ currentScenarioId: null, nodes: [] } as never)
  cleanup()
})

/**
 * Seed through the REAL WRITER, never `setState`. A render test that injects
 * the field directly passes on a build where nothing ever writes it — the
 * built-but-not-plugged-in defect this estate has shipped 42 times.
 */
const recordNotices = (
  notices: ReturnType<typeof toModelBuildingNoticesView>,
  scenarioId: string = LIVE_SCENARIO_ID,
) => useContextIntegrityStore.getState().recordModelBuildingNotices({ scenarioId, notices })

const open = () => {
  render(<WhatIWasGivenSection />)
  fireEvent.click(screen.getByTestId('what-i-was-given-toggle'))
}

/** Find a row BY ITS PRODUCER KIND, never by position or by text (trap 19). */
const rowFor = (kind: string): HTMLElement | undefined =>
  screen.queryAllByTestId(ROW_TID).find((el) => el.getAttribute('data-notice-kind') === kind)

describe('"Not modelled yet" answers from the draft turn when the manifest cannot', () => {
  /**
   * ⭐ RED-FIRST SIGNATURE 1 — at pristine `recordModelBuildingNotices` does not
   * exist on the store, so this fails with
   * `TypeError: ...recordModelBuildingNotices is not a function`. Once the
   * writer lands it fails on `expect(rowFor(...)).toBeInTheDocument()`, because
   * no renderer reads it.
   */
  it('renders the kinds that are genuinely not in the model, with their counts', () => {
    recordNotices(MIXED_NOTICES)
    open()

    const row = rowFor('detail_not_connected')
    expect(row).toBeInTheDocument()
    expect(row?.textContent).toBe('Details that nothing connected to your goal (12)')
  })

  /**
   * ⭐⭐ RED-FIRST SIGNATURE 2 — THE DISCRIMINATING TWIN. Signature 1 is
   * satisfied by a pane that renders every row it is handed. This one fails
   * unless `KIND_OUTCOME` is actually consulted. Same payload, same list, the
   * opposite expectation.
   */
  it('never lists a kind the producer leaves IN the model under "Not modelled yet"', () => {
    recordNotices(MIXED_NOTICES)
    open()

    expect(rowFor('detail_not_connected')).toBeInTheDocument()
    expect(rowFor('alternative_consolidated')).toBeUndefined()
  })

  /**
   * ⭐⭐ RED-FIRST SIGNATURE 3 — THE REFUSAL IS KEPT, AND RE-SCOPED. Asserted as
   * a WHOLE-STRING EQUALITY and by test id, not as a negative: a `not.toMatch`
   * passes on an emptied element, which is how an arm gets deleted under a green
   * suite (the audit recorded in `modelBuildingNotices.ts`).
   */
  it('keeps an explicit refusal, re-scoped to what genuinely cannot be shown', () => {
    recordNotices(MIXED_NOTICES)
    open()

    const refusal = screen.getByTestId('what-i-was-given-unknown')
    expect(refusal.textContent).toBe(NOT_MODELLED_NOTICES_COPY.unknownWithNotices)
    // The clause the header calls load-bearing survives the re-scoping.
    expect(refusal.textContent).toContain('everything having made it in')
  })

  /**
   * ⭐⭐ THE OPPOSITE-DIRECTION TWIN (trap 22b). With nothing to show, the
   * ORIGINAL refusal must render unchanged and no list may appear — otherwise
   * the re-scoped sentence would point at an empty space, and the panel would
   * have traded one false impression for another.
   */
  it('falls back to the unqualified refusal when no notices were attested', () => {
    open()

    expect(screen.getByTestId('what-i-was-given-unknown').textContent).toBe(
      NOT_MODELLED_NOTICES_COPY.unknown,
    )
    expect(screen.queryByTestId(LIST_TID)).not.toBeInTheDocument()
  })

  /**
   * ⭐⭐ AND THE SHARPER TWIN: notices WERE attested, but not one of their kinds
   * belongs under this heading. The pane must behave exactly as if none arrived.
   * A pane keyed on "did a payload arrive?" rather than "is there an honest row?"
   * passes the test above and fails this one.
   */
  it('falls back to the unqualified refusal when no attested kind is absent from the model', () => {
    recordNotices(NO_ABSENT_NOTICES)
    open()

    expect(screen.getByTestId('what-i-was-given-unknown').textContent).toBe(
      NOT_MODELLED_NOTICES_COPY.unknown,
    )
    expect(screen.queryByTestId(LIST_TID)).not.toBeInTheDocument()
  })

  /**
   * The heading and its lead. The lead is asserted whole because it is the one
   * sentence carrying the invitation, and an emptied one would leave a bare
   * list of category labels under a heading.
   */
  it('renders the pane under its own heading, with an invitation rather than a verdict', () => {
    recordNotices(MIXED_NOTICES)
    open()

    expect(screen.getByRole('heading', { name: 'Not modelled yet' })).toBeInTheDocument()
    expect(screen.getByTestId(`${LIST_TID}-lead`).textContent).toBe(
      NOT_MODELLED_NOTICES_COPY.noticesLead,
    )
  })

  /**
   * ⛔ INERT, AND IT MUST STAY INERT. `details_redacted: true` means there is no
   * item to name and nothing for `composeNotModelledQuestion` to compose, so an
   * act here would be a button that cannot do anything — the defect
   * `COPY.addAction`'s 15 refused arms were measured to avoid.
   */
  it('offers no act on a row whose item the producer redacted', () => {
    recordNotices(MIXED_NOTICES)
    render(<WhatIWasGivenSection onSendMessage={vi.fn()} />)
    fireEvent.click(screen.getByTestId('what-i-was-given-toggle'))

    const list = screen.getByTestId(LIST_TID)
    expect(list.querySelectorAll('button')).toHaveLength(0)
  })

  /**
   * ⛔ THE IDENTITY GATE DOES NOT WEAKEN. This surface once rendered A PREVIOUS
   * DECISION'S BRIEF verbatim. A new field carrying a new decision's omissions
   * is a new way to reopen that, so it is gated at the point of RENDER by the
   * same positive match, and refused at the point of WRITE as well.
   */
  it('never shows one decision’s omissions under another decision', () => {
    expect(recordNotices(MIXED_NOTICES, OTHER_SCENARIO_ID)).toBe(false)
    open()

    expect(screen.queryByTestId(LIST_TID)).not.toBeInTheDocument()
  })

  /**
   * ⭐⭐ THE OTHER DOOR, AND THE ONE THE IDENTITY GATE CANNOT WATCH — the twin
   * of the cold-read case pinned in `contextIntegrityStore.modelBuildingNotices
   * .spec.ts` ("drops notices when a cold read describes a DIFFERENT
   * decision"), reproduced HERE AT THE RENDER because the harm is a sentence on
   * screen, not a store field.
   *
   * ⚠ THE GATE PASSES IN THIS STATE, CORRECTLY. Two writers move `scenarioId`,
   * and the gate only asks whether the store's id equals the live one — which,
   * after a fresh draft for decision B, it DOES. The store genuinely says it is
   * describing B; what it is holding underneath is A's attestation. So the
   * whole section renders, the brief on screen is B's, and A's counts sit under
   * it with the re-scoped refusal's *"What I can show is below"* pointing at
   * them. That is a false statement about the decision on screen, on the one
   * surface whose entire job is saying what reached the model — this store's
   * own P0 (a PREVIOUS decision's brief, rendered verbatim) wearing a new
   * field, and milder only in degree.
   *
   * ⚠ REACHABLE WITH NO PAGE RELOAD. Nothing in product code clears this store;
   * `resetCanvas` sets `currentScenarioId: null` and the next draft turn mints
   * a fresh id in-session (`useConversation.ts:4021`), setting it on the canvas
   * store BEFORE `scenarioIdAtDispatch` is captured. `model_building_notices`
   * is `.optional()` and the record sits behind `if (draftNotices)`, so a
   * second decision whose draft carries no attestation overwrites nothing.
   */
  it('never shows a previous decision’s omissions once a fresh draft moves the register on', () => {
    // Decision A: its brief is recorded by `beforeEach`; its draft attested 12.
    // ⚠ ANCHOR — the seed must have LANDED, or the absence below is vacuous.
    expect(recordNotices(MIXED_NOTICES)).toBe(true)

    // ── Decision B, through the REAL writers, in the real order ──
    useCanvasStore.setState({ currentScenarioId: OTHER_SCENARIO_ID } as never)
    expect(
      useContextIntegrityStore
        .getState()
        .recordBriefForFreshDraft({ scenarioId: OTHER_SCENARIO_ID, briefText: BRIEF_B }),
    ).toBe(true)

    open()

    // ⚠ POSITIVE CONTROL (trap 13): the section IS on screen and IS describing
    // B. Without this the absences below would pass on a render of nothing.
    expect(screen.getByTestId('what-i-was-given-brief').textContent).toBe(BRIEF_B)

    expect(rowFor('detail_not_connected')).toBeUndefined()
    expect(screen.queryByTestId(LIST_TID)).not.toBeInTheDocument()
    // And the refusal is the unqualified one: there is nothing below to point at.
    expect(screen.getByTestId('what-i-was-given-unknown').textContent).toBe(
      NOT_MODELLED_NOTICES_COPY.unknown,
    )
  })

  /**
   * ⭐⭐ AND THE OPPOSITE-DIRECTION TWIN (trap 22b — one predicate, two harms,
   * so both doors get watched at BOTH writers). Dropping on a different
   * decision is only safe if the SAME decision keeps what its draft attested. A
   * later turn on the same decision re-offers the brief, the record is refused
   * as already standing, and the attestation must survive that refusal — a
   * clear written without this half would blink the capability out on the
   * second turn of every session.
   */
  it('keeps the attestation when a later turn re-records the SAME decision’s brief', () => {
    expect(recordNotices(MIXED_NOTICES)).toBe(true)

    expect(
      useContextIntegrityStore
        .getState()
        .recordBriefForFreshDraft({ scenarioId: LIVE_SCENARIO_ID, briefText: BRIEF }),
    ).toBe(false)

    open()

    expect(screen.getByTestId('what-i-was-given-brief').textContent).toBe(BRIEF)
    const row = rowFor('detail_not_connected')
    expect(row).toBeInTheDocument()
    expect(row?.textContent).toBe('Details that nothing connected to your goal (12)')
  })

  /** And the whole section stays gated when the canvas moves to another decision. */
  it('renders nothing at all once the canvas is on a different decision', () => {
    recordNotices(MIXED_NOTICES)
    useCanvasStore.setState({ currentScenarioId: OTHER_SCENARIO_ID } as never)
    render(<WhatIWasGivenSection />)

    expect(screen.queryByTestId('what-i-was-given-section')).not.toBeInTheDocument()
  })
})

/**
 * ⭐⭐ ATTRIBUTION IS EARNED, AND THIS IS THE TRIPWIRE THAT KEEPS IT EARNED.
 *
 * #1524 established that the wire carries NO per-item provenance, so copy may
 * not call these losses the user's or Olumi's except where a kind is
 * unanimously one thing. `KIND_ATTRIBUTION` is that ruling and it is REUSED
 * here, never re-derived — a second rule is trap 12, and on this particular
 * question a second rule is how "Details YOU MENTIONED" shipped.
 *
 * The existing manifest-fed lead says *"These are in your brief"*. That claim is
 * `user_stated`, and it is FALSE of everything this pane can show: both absent
 * kinds are `olumi_authored` or `mixed`. So the notices lead claims neither
 * side, and this test is derived over the WHOLE enum so that a seventh kind, or
 * a change of outcome on an existing one, turns RED here rather than silently
 * licensing a possession claim the wire cannot support.
 */
describe('the notices lead claims no attribution the wire cannot support', () => {
  const ABSENT_KINDS = ModelBuildingNoticeKindSchema.options.filter(
    (kind) => modelBuildingNoticeOutcome(kind) === 'absent',
  )

  /**
   * ⚠ A POSITIVE CONTROL FIRST (trap 13). An invariant over an EMPTY set passes
   * by testing nothing, and `ABSENT_KINDS` is derived — so its size is asserted
   * before anything is concluded from it.
   */
  it('has absent kinds to reason about at all', () => {
    expect(ABSENT_KINDS).toEqual(['detail_not_connected', 'relationship_not_used'])
  })

  it('finds no absent kind that is unanimously the user’s', () => {
    for (const kind of ABSENT_KINDS) {
      expect(modelBuildingNoticeAttribution(kind)).not.toBe('user_stated')
    }
  })

  /**
   * ⚠ CONTRAST CONTROL, IN THE SAME RUN. An attribution probe that answered
   * "never `user_stated`" for every kind would pass the test above while
   * discriminating nothing (trap 13e). One kind IS unanimously the user's, and
   * it is deliberately not in the absent bucket.
   */
  it('still recognises the kind that IS unanimously the user’s', () => {
    expect(modelBuildingNoticeAttribution('target_not_modelled_as_threshold')).toBe('user_stated')
  })

  /** So the lead may make no possession claim, in either person. */
  it('makes no possession claim in the lead sentence', () => {
    expect(NOT_MODELLED_NOTICES_COPY.noticesLead).not.toMatch(/\byour\b|\byou\b/i)
    expect(NOT_MODELLED_NOTICES_COPY.noticesLead).not.toMatch(/brief/i)
  })

  /**
   * ⚠ AND THE POSITIVE CONTROL FOR THAT NEGATIVE: the MANIFEST-fed lead, which
   * legitimately does make the claim, must still trip the same matchers. Two
   * negatives with no positive beside them pass on an empty string.
   */
  it('is a real discrimination, not a matcher that never fires', () => {
    expect(NOT_MODELLED_NOTICES_COPY.manifestLead).toMatch(/\byour\b/i)
    expect(NOT_MODELLED_NOTICES_COPY.manifestLead).toMatch(/brief/i)
  })

  /**
   * British English, and the estate's standing ban on em dashes in product
   * strings. Asserted over every string this module ships, so a new one cannot
   * arrive unchecked.
   */
  it('ships no em dash in any product string', () => {
    for (const [key, value] of Object.entries(NOT_MODELLED_NOTICES_COPY)) {
      expect(`${key}: ${value}`).not.toContain('—')
    }
  })

  /** "Not modelled yet" is an invitation. Nothing says dropped, lost or discarded. */
  it('never names the omission as a loss', () => {
    for (const value of Object.values(NOT_MODELLED_NOTICES_COPY)) {
      expect(value).not.toMatch(/\bdropp?ed\b|\blost\b|\bdiscarded\b/i)
    }
  })

  /**
   * ⭐⭐ `undefined` IS REACHABLE, AND THE FIRST VERSION OF THIS FUNCTION CRASHED
   * ON IT — caught by a sibling suite, not by this one, which is the finding.
   *
   * The guard was written `view === null`, against the state the STORE declares.
   * But a `vi.mock` factory REPLACES the module, so any spec mocking
   * `contextIntegrityStore` with a hand-listed object returns `undefined` for a
   * field added later (CLAUDE.md trap 12, in its original form) — and
   * `givenSectionGrammarIsOptIn.spec.tsx` does exactly that. `view.rows` then
   * threw and took the WHOLE SECTION down: five tests about container geometry
   * REDing on a null-guard two panes away.
   *
   * That is trap 13d exactly — an invariant written against the failure mode in
   * hand (`null`) rather than against the domain the runtime actually admits.
   * The guard is now truthiness, and the signature says so. An absent view
   * yields an empty pane and the unqualified refusal, which is the honest
   * reading of "we were told nothing" in either spelling.
   */
  it('treats an ABSENT view as no rows, in either spelling, and never throws', () => {
    expect(notModelledNoticeRows(null)).toEqual([])
    expect(notModelledNoticeRows(undefined)).toEqual([])
  })

  /**
   * ⚠ THE POSITIVE CONTROL FOR THAT NEGATIVE (trap 13). A function that
   * returned `[]` unconditionally would pass the test above perfectly.
   */
  it('still returns rows for a view that has them', () => {
    expect(notModelledNoticeRows(MIXED_NOTICES).map((r) => r.kind)).toEqual([
      'detail_not_connected',
    ])
  })
})
