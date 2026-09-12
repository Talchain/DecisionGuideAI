/**
 * ⭐⭐ THE DRAFT TURN'S OWN ATTESTATION, CARRIED TO THE REGISTER — ROADMAP 2.1379.
 *
 * ── THE DEFECT, DERIVED AT THE PINNED CONTRACT ─────────────────────────────
 * On a FIRST session the Reasoning tab's *"What you gave me, and what I did
 * with it"* shows the brief and then refuses three times over: *"I can't show
 * this yet for this decision…"*. The refusal is correct — `manifest === null`
 * means CEE told us nothing — but it is not the whole truth, because two
 * panels away the SAME TURN is already displaying *"Olumi left N things out of
 * this model"*.
 *
 * `not_modelled` is not in the contract at all. Measured in the version this
 * branch pins (`vendor/talchain-schemas-0.55.0.tgz`, read at the tarball and
 * not at `node_modules`): zero occurrences as a declared key, the only hits
 * being the enum member `target_not_modelled_as_threshold`. CONTRAST CONTROL in
 * the same sweep: `model_building_notices` → declared at
 * `boundary/olumi-response.js:245`. So the manifest reaches the store ONLY from
 * the scenario-graph cold read, which answers `absent` for a decision this
 * fresh. The UI cannot conjure one and must not try.
 *
 * What it CAN do is keep the attestation the draft turn already carried.
 *
 * ── WHY A SEPARATE WRITER, AND WHY IT IS FAIL-CLOSED ───────────────────────
 * `recordBriefForFreshDraft` answers *"what did the user write for this
 * decision?"*. This answers *"what did this draft turn attest it left out?"*.
 * Two questions under one name is this estate's signature defect (CLAUDE.md
 * trap 21), and folding them would mean the brief record's NEVER-DISPLACE rule
 * silently governed the notices too — so a re-draft after a cold read would
 * drop a fresh attestation on the floor.
 *
 * The write lands ONLY when this store is already describing that scenario.
 * Content this store cannot attribute to the decision on screen is content the
 * surface must never show, and the P0 recorded in the store's own header —
 * a PREVIOUS decision's brief rendered verbatim — is exactly what an
 * unattributed write reopens.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useContextIntegrityStore } from '../contextIntegrityStore'
import type { ModelBuildingNoticesView } from '../../conversation/modelBuildingNotices'

const SCENARIO_A = '11111111-1111-4111-8111-111111111111'
const SCENARIO_B = '22222222-2222-4222-8222-222222222222'

const NOTICES: ModelBuildingNoticesView = {
  totalCount: 12,
  rows: [
    {
      kind: 'detail_not_connected',
      count: 12,
      description: 'Details that nothing connected to your goal',
    },
  ],
}

/** A SECOND, DIFFERENT payload. A test that writes the same object twice cannot
 *  tell "preserved" from "rewritten" (trap 19). */
const OTHER_NOTICES: ModelBuildingNoticesView = {
  totalCount: 3,
  rows: [
    {
      kind: 'relationship_not_used',
      count: 3,
      description: "Connections Olumi proposed but couldn't place in the model",
    },
  ],
}

beforeEach(() => useContextIntegrityStore.getState().reset())
afterEach(() => useContextIntegrityStore.getState().reset())

describe('contextIntegrityStore carries the draft turn model-building notices', () => {
  /**
   * ⭐ RED-FIRST SIGNATURE 1 — at pristine `recordModelBuildingNotices` does not
   * exist, so this fails with `TypeError: ... is not a function`. There is no
   * softer signature available: the authority itself is what is missing.
   */
  it('records notices for the decision it is already describing', () => {
    const store = useContextIntegrityStore.getState()
    store.recordBriefForFreshDraft({ scenarioId: SCENARIO_A, briefText: 'Our runway is 8 months.' })

    expect(store.recordModelBuildingNotices({ scenarioId: SCENARIO_A, notices: NOTICES })).toBe(true)
    expect(useContextIntegrityStore.getState().modelBuildingNotices).toEqual(NOTICES)
  })

  /**
   * ⭐⭐ RED-FIRST SIGNATURE 2 — THE DISCRIMINATING HALF, and the one that keeps
   * the P0 shut. Signature 1 is satisfied by a writer that accepts anything;
   * this one fails unless the write is gated on the scenario the store is
   * describing. Same action, same payload, a DIFFERENT id.
   */
  it('refuses notices for a decision this store is not describing', () => {
    const store = useContextIntegrityStore.getState()
    store.recordBriefForFreshDraft({ scenarioId: SCENARIO_A, briefText: 'Our runway is 8 months.' })

    expect(store.recordModelBuildingNotices({ scenarioId: SCENARIO_B, notices: NOTICES })).toBe(
      false,
    )
    expect(useContextIntegrityStore.getState().modelBuildingNotices).toBeNull()
  })

  /** A store describing nothing yet can attribute nothing. Fail-closed. */
  it('refuses notices when nothing is recorded at all', () => {
    expect(
      useContextIntegrityStore.getState().recordModelBuildingNotices({
        scenarioId: SCENARIO_A,
        notices: NOTICES,
      }),
    ).toBe(false)
    expect(useContextIntegrityStore.getState().modelBuildingNotices).toBeNull()
  })

  /**
   * ⭐⭐ THE COLD READ DOES NOT UN-KNOW WHAT THE DRAFT TURN ATTESTED.
   * `setContextIntegrity` overwrites unconditionally and is reached on every
   * successful cold read, including ones whose manifest is not `derived`. If it
   * cleared the notices, this whole capability would blink out the moment the
   * scenario-graph read landed — which on a live session is seconds later.
   */
  it('keeps notices across a cold read for the SAME decision', () => {
    const store = useContextIntegrityStore.getState()
    store.recordBriefForFreshDraft({ scenarioId: SCENARIO_A, briefText: 'Our runway is 8 months.' })
    store.recordModelBuildingNotices({ scenarioId: SCENARIO_A, notices: NOTICES })

    useContextIntegrityStore.getState().setContextIntegrity({
      scenarioId: SCENARIO_A,
      briefText: 'Our runway is 8 months.',
      manifest: null,
    })

    expect(useContextIntegrityStore.getState().modelBuildingNotices).toEqual(NOTICES)
  })

  /**
   * ⭐⭐ AND THE OPPOSITE-DIRECTION TWIN (CLAUDE.md trap 22b — one predicate,
   * two harms, so both doors get watched). Preserving across a cold read is
   * only safe because a write for a DIFFERENT decision drops them. Without
   * this, decision A's omissions would sit under decision B's brief — the
   * store header's P0, wearing a new field.
   */
  it('drops notices when a cold read describes a DIFFERENT decision', () => {
    const store = useContextIntegrityStore.getState()
    store.recordBriefForFreshDraft({ scenarioId: SCENARIO_A, briefText: 'Our runway is 8 months.' })
    store.recordModelBuildingNotices({ scenarioId: SCENARIO_A, notices: NOTICES })

    useContextIntegrityStore.getState().setContextIntegrity({
      scenarioId: SCENARIO_B,
      briefText: 'Should we open in Berlin?',
      manifest: null,
    })

    expect(useContextIntegrityStore.getState().modelBuildingNotices).toBeNull()
  })

  /**
   * ⭐⭐ THE SAME PAIR AT THE OTHER WRITER — and it is a pair, not a repeat.
   * `setContextIntegrity` is not the only action that moves `scenarioId`;
   * `recordBriefForFreshDraft` reaches its `set` ONLY when the decision
   * differs, so every write it makes is a decision change. Watching one door
   * and leaving the one beside it open is trap 22b, and the harm here is the
   * store header's own P0 in a new field: decision A's omission counts standing
   * under decision B's brief, which the render gate cannot catch because after
   * this write the store genuinely IS describing B.
   */
  it('drops notices when a FRESH DRAFT describes a DIFFERENT decision', () => {
    const store = useContextIntegrityStore.getState()
    store.recordBriefForFreshDraft({ scenarioId: SCENARIO_A, briefText: 'Our runway is 8 months.' })
    store.recordModelBuildingNotices({ scenarioId: SCENARIO_A, notices: NOTICES })

    expect(
      useContextIntegrityStore
        .getState()
        .recordBriefForFreshDraft({ scenarioId: SCENARIO_B, briefText: 'Should we open in Berlin?' }),
    ).toBe(true)

    expect(useContextIntegrityStore.getState().modelBuildingNotices).toBeNull()
  })

  /**
   * ⭐⭐ AND ITS OPPOSITE-DIRECTION TWIN. Dropping on a different decision is
   * only safe because a refused record — the same decision, a later turn —
   * leaves the attestation standing. A clear written at this writer without
   * this half would take the capability down on the second turn of every
   * session, which is the mirror of the harm above and would look like a fix.
   */
  it('keeps notices when a fresh-draft record is REFUSED for the same decision', () => {
    const store = useContextIntegrityStore.getState()
    store.recordBriefForFreshDraft({ scenarioId: SCENARIO_A, briefText: 'Our runway is 8 months.' })
    store.recordModelBuildingNotices({ scenarioId: SCENARIO_A, notices: NOTICES })

    expect(
      useContextIntegrityStore
        .getState()
        .recordBriefForFreshDraft({ scenarioId: SCENARIO_A, briefText: 'Our runway is 8 months.' }),
    ).toBe(false)

    expect(useContextIntegrityStore.getState().modelBuildingNotices).toEqual(NOTICES)
  })

  /**
   * A LATER draft turn on the same decision replaces the attestation, rather
   * than being refused the way the BRIEF record is. The brief is the user's and
   * does not change; the notices describe THE MODEL CURRENTLY ON SCREEN, and a
   * re-draft builds a new one. Showing the previous draft's omissions beside
   * the current model is the mis-attribution the chat bubble avoids by riding
   * its own turn.
   */
  it('replaces the attestation on a later draft of the same decision', () => {
    const store = useContextIntegrityStore.getState()
    store.recordBriefForFreshDraft({ scenarioId: SCENARIO_A, briefText: 'Our runway is 8 months.' })
    store.recordModelBuildingNotices({ scenarioId: SCENARIO_A, notices: NOTICES })
    store.recordModelBuildingNotices({ scenarioId: SCENARIO_A, notices: OTHER_NOTICES })

    expect(useContextIntegrityStore.getState().modelBuildingNotices).toEqual(OTHER_NOTICES)
  })

  it('clears notices on reset', () => {
    const store = useContextIntegrityStore.getState()
    store.recordBriefForFreshDraft({ scenarioId: SCENARIO_A, briefText: 'Our runway is 8 months.' })
    store.recordModelBuildingNotices({ scenarioId: SCENARIO_A, notices: NOTICES })

    useContextIntegrityStore.getState().reset()

    expect(useContextIntegrityStore.getState().modelBuildingNotices).toBeNull()
  })
})
