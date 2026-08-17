/**
 * COLLAB — THE CITATION READBACK. Does the evidence the owner cited reach a
 * surface a user looks at.
 *
 * ── THE DEFECT ────────────────────────────────────────────────────────────
 * From 0.41.0 CEE stamps `observed_state.elicited_from.evidence_event_id` when
 * the owner applies a panellist's value while citing a colleague's note
 * (`factor-value-edit.ts:362-384`), and the contract carries it — `.strict()`
 * with `evidence_event_id: z.ZodOptional<z.ZodString>` on the graph's
 * `elicited_from`. The write path is wire-witnessed.
 *
 * It reached no user, because `readElicitedFrom` returned a type with no such
 * member and EVERY mounted attribution surface goes through that one function.
 * The product recorded why a value was adopted and showed nobody.
 *
 * ── THE LOAD-BEARING BLOCKS ARE THE THIRD AND FOURTH, NOT THE HAPPY PATH ──
 * Block 3 is the one that must never regress: a manual edit, or an apply with no
 * citation, MUST NOT produce a citation line. Provenance that can be fabricated
 * by the client is worse than provenance that is missing, and the mutant kit
 * below includes a mutation that stamps a citation on an uncited value — it must
 * go RED.
 *
 * Block 4 pins the copy. A 15 Aug review found this feature's own sentence
 * asserting a causality the server never verified: CEE checks that the evidence
 * exists, belongs to the round and names the factor, and reads neither `stance`
 * nor `about_participant_id`. So the surface may report the ACT of attaching and
 * must never report a CONSEQUENCE. The assertion is over the rendered text, not
 * over a constant, so a future rewording is caught wherever it is written.
 *
 * ── ASSERTIONS BIND BY IDENTITY ───────────────────────────────────────────
 * The fixture holds THREE evidence rows across TWO targets, with distinct
 * bodies, distinct authors and distinct stances, so no assertion can pass on the
 * wrong row (trap 19). The cited row is deliberately on a DIFFERENT target from
 * the factor under the cursor, and is authored by a DIFFERENT person from the
 * applied value — both are real product paths and both would be hidden by a
 * narrower lookup.
 */

import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CITED_EVIDENCE_TESTID, CitedEvidenceNote } from '../CitedEvidenceNote'
import { readCitation, resolveCitedEvidence } from '../citedEvidence'
import { readElicitedFrom } from '../participantNames'
import type { DisagreementView } from '../collabService'

/* ── fixtures ─────────────────────────────────────────────────────────────── */

const ROUND_ID = '33333333-3333-4333-8333-333333333333'
/** Grace's value is the one applied. */
const GRACE_ID = '55555555-5555-4555-8555-555555555555'

/** The CITED row — Ada's challenge, on the NEIGHBOURING target. */
const ADA_EVIDENCE_ID = '88888888-8888-4888-8888-888888888888'
const ADA_BODY = 'Q3 cohort held at 12% after the last rise, so 0.85 looks high'
const ADA_LABEL = 'Ada'
const ADA_STANCE_PHRASE = 'challenging this'

/** A decoy on the SAME target as the cursor. Never cited. */
const DECOY_EVIDENCE_ID = '99999999-9999-4999-8999-999999999999'
const DECOY_BODY = 'Pricing deck slide 14 supports a steep response'
const DECOY_LABEL = 'Ruth'

/** A second decoy, same author as the cited row, different id. */
const SECOND_DECOY_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const SECOND_DECOY_BODY = 'Renewal desk thinks churn is already priced in'

const CURSOR_TARGET_ID = 'fac_churn_risk'
const NEIGHBOUR_TARGET_ID = 'fac_lead_time'

function evidenceRow(o: {
  event_id: string
  author_label: string
  body: string
  stance_phrase?: string
  kind?: 'note' | 'link'
  url?: string | null
}) {
  return {
    event_id: o.event_id,
    authored_by: 'server-stamped-id',
    author_label: o.author_label,
    stance: 'challenges' as const,
    stance_phrase: o.stance_phrase ?? ADA_STANCE_PHRASE,
    kind: o.kind ?? ('note' as const),
    body: o.body,
    url: o.url ?? null,
    about_participant_id: null,
    about_label: null,
    created_at: '2026-08-14T11:00:00.000Z',
  }
}

function disagreementView(overrides: Partial<DisagreementView> = {}): DisagreementView {
  return {
    round_id: ROUND_ID,
    graph_version_ref: 'mv-1',
    standing_note: null,
    per_target: [
      {
        target: { kind: 'factor', id: CURSOR_TARGET_ID },
        label: 'Churn risk after a price rise',
        model_value_at_version: 0.5,
        shape: 'split',
        answering_participants: 2,
        distinct_values: 2,
        spread: { low: 0.2, high: 0.85, width: 0.65 },
        positions: [],
        positions_with_stated_basis: 2,
        // The decoys live HERE, on the target under the cursor.
        evidence: [
          evidenceRow({ event_id: DECOY_EVIDENCE_ID, author_label: DECOY_LABEL, body: DECOY_BODY }),
          evidenceRow({
            event_id: SECOND_DECOY_ID,
            author_label: ADA_LABEL,
            body: SECOND_DECOY_BODY,
          }),
        ],
        headline: 'Two people differ on this.',
        question: 'What would settle it?',
      },
      {
        target: { kind: 'factor', id: NEIGHBOUR_TARGET_ID },
        label: 'Supplier lead time in weeks',
        model_value_at_version: 3,
        shape: 'aligned',
        answering_participants: 2,
        distinct_values: 1,
        spread: null,
        positions: [],
        positions_with_stated_basis: 1,
        // The CITED row lives on the NEIGHBOUR, which is legitimate: CEE's
        // verifier requires only that the evidence belong to the same ROUND.
        evidence: [
          evidenceRow({ event_id: ADA_EVIDENCE_ID, author_label: ADA_LABEL, body: ADA_BODY }),
        ],
        headline: 'They agree on this.',
        question: null,
      },
    ],
    ...overrides,
  }
}

/** A cited apply: Grace's value, citing Ada's evidence. */
const citedElicitedFrom = {
  round_id: ROUND_ID,
  participant_id: GRACE_ID,
  evidence_event_id: ADA_EVIDENCE_ID,
}

/** An uncited apply. The key is ABSENT, which is how CEE writes it. */
const uncitedElicitedFrom = { round_id: ROUND_ID, participant_id: GRACE_ID }

/* ══════════════════════════════════════════════════════════════════════════ */

describe('the reader gate carries the citation without costing the attribution', () => {
  it('readElicitedFrom carries evidence_event_id when the wire has one', () => {
    const ref = readElicitedFrom(citedElicitedFrom)
    expect(ref).not.toBeNull()
    expect(ref?.evidence_event_id).toBe(ADA_EVIDENCE_ID)
    // The attribution members are untouched.
    expect(ref?.round_id).toBe(ROUND_ID)
    expect(ref?.participant_id).toBe(GRACE_ID)
  })

  it('OMITS the key — not undefined — on an uncited apply, matching the write path', () => {
    const ref = readElicitedFrom(uncitedElicitedFrom)
    expect(ref).not.toBeNull()
    // `'x' in obj` is the presence test `panelApplyHandoff.ts` and
    // `buildPayload.ts` already use. A key set to `undefined` would pass a
    // `=== undefined` check and fail this one.
    expect('evidence_event_id' in (ref as object)).toBe(false)
  })

  it('⭐ a MALFORMED citation costs the citation and NEVER the attribution', () => {
    // The inverse of this is the defect that matters: returning null for the
    // whole reference would take a NAME off the screen because a THIRD field was
    // junk, and the contract's absence semantics say attribution is intact.
    for (const junk of ['', '   ', 42, null, {}, []]) {
      const ref = readElicitedFrom({ ...uncitedElicitedFrom, evidence_event_id: junk })
      expect(ref, `junk=${JSON.stringify(junk)}`).not.toBeNull()
      expect(ref?.participant_id).toBe(GRACE_ID)
      expect(ref?.evidence_event_id).toBeUndefined()
    }
  })

  it('readCitation answers null when there is no citation, and the ref when there is', () => {
    expect(readCitation(uncitedElicitedFrom)).toBeNull()
    expect(readCitation(citedElicitedFrom)).toEqual({
      round_id: ROUND_ID,
      evidence_event_id: ADA_EVIDENCE_ID,
    })
  })
})

describe('resolution binds to the cited row by id, across every target', () => {
  it('⭐ resolves a row on a DIFFERENT target from the cursor, by id', () => {
    const res = resolveCitedEvidence(citedElicitedFrom, disagreementView())
    expect(res.state).toBe('cited')
    if (res.state !== 'cited') return
    // Bound by id. The decoys on the cursor's own target must not win.
    expect(res.evidence.body).toBe(ADA_BODY)
    expect(res.evidence.body).not.toBe(DECOY_BODY)
    expect(res.evidence.body).not.toBe(SECOND_DECOY_BODY)
  })

  it('⭐ names the EVIDENCE author, who is not the applied value\'s author', () => {
    const res = resolveCitedEvidence(citedElicitedFrom, disagreementView())
    if (res.state !== 'cited') throw new Error('fixture: expected cited')
    // The asymmetry IS the feature: Grace's number, Ada's challenge. Collapsing
    // them, or asserting they must match, destroys the case this exists for.
    expect(res.evidence.author_label).toBe(ADA_LABEL)
    expect(res.evidence.author_label).not.toBe(DECOY_LABEL)
  })

  it('renders CEE\'s stance phrase, not a locally composed one', () => {
    const res = resolveCitedEvidence(citedElicitedFrom, disagreementView())
    if (res.state !== 'cited') throw new Error('fixture: expected cited')
    expect(res.evidence.stance_phrase).toBe(ADA_STANCE_PHRASE)
  })

  it('distinguishes all four unresolved reasons', () => {
    // no_citation — the ordinary case for almost every factor.
    expect(resolveCitedEvidence(uncitedElicitedFrom, disagreementView())).toEqual({
      state: 'unresolved',
      reason: 'no_citation',
    })
    // view_unavailable — transient. `undefined` (never asked) and `null`
    // (asked, failed) are both this, and neither is "nothing was cited".
    expect(resolveCitedEvidence(citedElicitedFrom, undefined)).toEqual({
      state: 'unresolved',
      reason: 'view_unavailable',
    })
    expect(resolveCitedEvidence(citedElicitedFrom, null)).toEqual({
      state: 'unresolved',
      reason: 'view_unavailable',
    })
    // evidence_not_found — the view loaded and holds no such row.
    expect(
      resolveCitedEvidence(
        { ...citedElicitedFrom, evidence_event_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
        disagreementView(),
      ),
    ).toEqual({ state: 'unresolved', reason: 'evidence_not_found' })
    // body_unusable — a row exists and has nothing to show.
    const blankBody = disagreementView()
    blankBody.per_target[1].evidence[0].body = '   '
    expect(resolveCitedEvidence(citedElicitedFrom, blankBody)).toEqual({
      state: 'unresolved',
      reason: 'body_unusable',
    })
  })

  it('⭐ refuses to substitute for an absent author label or stance phrase', () => {
    // Both are CEE's, and a UI default for either is a second authority: an
    // unattributed quotation, or a stance this bundle invented.
    const noLabel = disagreementView()
    noLabel.per_target[1].evidence[0].author_label = ''
    expect(resolveCitedEvidence(citedElicitedFrom, noLabel)).toEqual({
      state: 'unresolved',
      reason: 'body_unusable',
    })

    const noStance = disagreementView()
    noStance.per_target[1].evidence[0].stance_phrase = '  '
    expect(resolveCitedEvidence(citedElicitedFrom, noStance)).toEqual({
      state: 'unresolved',
      reason: 'body_unusable',
    })
  })

  it('carries no identifier into the resolved result', () => {
    const res = resolveCitedEvidence(citedElicitedFrom, disagreementView())
    const serialised = JSON.stringify(res)
    // A uuid in a sentence position reads to the user as content. Same
    // invariant `participantNames.ts` holds for names, asserted the same way.
    for (const id of [ADA_EVIDENCE_ID, GRACE_ID, ROUND_ID, 'server-stamped-id']) {
      expect(serialised).not.toContain(id)
    }
    // Positive control: the assertion above is over a string that DOES contain
    // the body, so it is proven capable of finding something (trap 13).
    expect(serialised).toContain(ADA_BODY)
  })
})

describe('⭐ PROVENANCE IS NEVER FABRICATED: no citation, no line', () => {
  it('renders NOTHING for every unresolved reason', () => {
    for (const reason of [
      'no_citation',
      'view_unavailable',
      'evidence_not_found',
      'body_unusable',
    ] as const) {
      const { container, unmount } = render(
        <CitedEvidenceNote resolution={{ state: 'unresolved', reason }} />,
      )
      expect(container.innerHTML, `reason=${reason}`).toBe('')
      expect(screen.queryByTestId(CITED_EVIDENCE_TESTID)).toBeNull()
      unmount()
    }
  })

  it('an uncited apply resolves to no_citation against a view FULL of evidence', () => {
    // The strongest form: the round has three evidence rows and this value cites
    // none of them. A resolver that fell back to "any evidence on this round"
    // would render somebody else's note as this value's citation.
    const res = resolveCitedEvidence(uncitedElicitedFrom, disagreementView())
    expect(res).toEqual({ state: 'unresolved', reason: 'no_citation' })
    const { container } = render(<CitedEvidenceNote resolution={res} />)
    expect(container.innerHTML).toBe('')
  })

  it('a manual retype — no elicited_from at all — resolves to no_citation', () => {
    // CEE-1: a manual edit writes `source: 'user_override'` and no
    // `elicited_from`. Nothing here may invent one.
    for (const manual of [undefined, null, {}, { source: 'user_override' }]) {
      expect(resolveCitedEvidence(manual, disagreementView())).toEqual({
        state: 'unresolved',
        reason: 'no_citation',
      })
    }
  })
})

describe('⭐ THE COPY REPORTS AN ACT, NEVER A CONSEQUENCE', () => {
  it('renders the author, the stance and the words', () => {
    const res = resolveCitedEvidence(citedElicitedFrom, disagreementView())
    render(<CitedEvidenceNote resolution={res} />)

    const node = screen.getByTestId(CITED_EVIDENCE_TESTID)
    expect(node.textContent).toContain(ADA_LABEL)
    expect(node.textContent).toContain(ADA_STANCE_PHRASE)
    expect(node.textContent).toContain(ADA_BODY)
  })

  it('asserts NO causal link between the citation and the applied value', () => {
    const res = resolveCitedEvidence(citedElicitedFrom, disagreementView())
    render(<CitedEvidenceNote resolution={res} />)
    const text = screen.getByTestId(CITED_EVIDENCE_TESTID).textContent?.toLowerCase() ?? ''

    /**
     * The banned register. CEE verified existence, round and factor — never
     * that the citation motivated the change. The exact sentence a 15 Aug
     * review caught is the first entry.
     */
    for (const banned of [
      'as the reason',
      'the reason for',
      'because',
      'which is why',
      'justifies',
      'justified',
      'supports this value',
      'confirms',
      'verified by',
      'proves',
      // and the endorsement register `inspectorStrings.ts` already bans
      'was correct',
      'is correct',
      'was right',
      'agreed',
      'consensus',
      'resolved',
      'winner',
      'recommended',
    ]) {
      expect(text, `banned phrase present: ${banned}`).not.toContain(banned)
    }
  })

  it('renders a link row\'s url as a real link, and omits it when absent', () => {
    const withUrl = disagreementView()
    withUrl.per_target[1].evidence[0].kind = 'link'
    withUrl.per_target[1].evidence[0].url = 'https://example.test/cohort-report'
    const cited = resolveCitedEvidence(citedElicitedFrom, withUrl)
    const { unmount } = render(<CitedEvidenceNote resolution={cited} />)
    const anchor = screen.getByRole('link', { name: 'https://example.test/cohort-report' })
    expect(anchor.getAttribute('href')).toBe('https://example.test/cohort-report')
    expect(anchor.getAttribute('rel')).toContain('noopener')
    unmount()

    render(<CitedEvidenceNote resolution={resolveCitedEvidence(citedElicitedFrom, disagreementView())} />)
    expect(screen.queryByRole('link')).toBeNull()
  })
})

describe('the cache asks the network only when a citation exists', () => {
  beforeEach(() => {
    vi.resetModules()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('⭐ an UNCITED value triggers no disagreement request at all', async () => {
    const fetchSpy = vi.fn()
    vi.doMock('../collabService', async () => ({
      ...(await vi.importActual<typeof import('../collabService')>('../collabService')),
      fetchOwnerDisagreement: fetchSpy,
    }))
    vi.doMock('../ownerAccessToken', () => ({
      requireOwnerAccessToken: async () => 'owner-token',
    }))

    const { ensureDisagreement, __resetCitedEvidenceCacheForTests } = await import(
      '../citedEvidenceCache'
    )
    __resetCitedEvidenceCacheForTests()

    // `useCitedEvidence` derives its round id from `readCitation`, which is null
    // for an uncited value — so the empty round id must short-circuit.
    await ensureDisagreement('')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('dedups concurrent requests for one round to a single fetch', async () => {
    const fetchSpy = vi.fn(async () => disagreementView())
    vi.doMock('../collabService', async () => ({
      ...(await vi.importActual<typeof import('../collabService')>('../collabService')),
      fetchOwnerDisagreement: fetchSpy,
    }))
    vi.doMock('../ownerAccessToken', () => ({
      requireOwnerAccessToken: async () => 'owner-token',
    }))

    const { ensureDisagreement, __resetCitedEvidenceCacheForTests } = await import(
      '../citedEvidenceCache'
    )
    __resetCitedEvidenceCacheForTests()

    await Promise.all([
      ensureDisagreement(ROUND_ID),
      ensureDisagreement(ROUND_ID),
      ensureDisagreement(ROUND_ID),
    ])
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
  })

  it('caches a FAILURE as null rather than retrying on every render', async () => {
    const fetchSpy = vi.fn(async () => {
      throw new Error('signed out')
    })
    vi.doMock('../collabService', async () => ({
      ...(await vi.importActual<typeof import('../collabService')>('../collabService')),
      fetchOwnerDisagreement: fetchSpy,
    }))
    vi.doMock('../ownerAccessToken', () => ({
      requireOwnerAccessToken: async () => 'owner-token',
    }))

    const { ensureDisagreement, peekDisagreement, __resetCitedEvidenceCacheForTests } =
      await import('../citedEvidenceCache')
    __resetCitedEvidenceCacheForTests()

    expect(await ensureDisagreement(ROUND_ID)).toBeNull()
    expect(await ensureDisagreement(ROUND_ID)).toBeNull()
    // One attempt, and the cached null is a FACT the surface can read
    // synchronously — distinct from `undefined`, which means never asked.
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(peekDisagreement(ROUND_ID)).toBeNull()
    expect(peekDisagreement('some-other-round')).toBeUndefined()
  })
})
