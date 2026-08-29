/**
 * COLLAB — the disagreement surface, and the evidence request shape.
 *
 * ── WHAT THESE TESTS ARE ACTUALLY FOR ─────────────────────────────────────
 * Two failure modes, neither of which a type would catch:
 *
 * 1. THE UI COMPOSES ITS OWN REASONING COPY. `headline` and `question` are
 *    pinned in CEE by a suite that proves they never average, rank or name a
 *    winner. A component that rewrote or "improved" them locally would sit
 *    outside that guarantee silently. The tests below assert the rendered text
 *    IS the served string, by identity.
 * 2. A DANGEROUS URL IS RENDERED AS A LINK. CEE validates the scheme, but this
 *    is a stored-XSS path on a bearer-token surface across two services with two
 *    deploy cadences, so the client gate is independently load-bearing.
 */

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi, afterEach } from 'vitest'

import { DisagreementBody, safeHref } from '../DisagreementBody'
import { attachEvidence } from '../collabService'
import type { DisagreementTarget, DisagreementView } from '../collabService'

vi.mock('../participantToken', () => ({
  getParticipantToken: () => 'ptoken-for-tests',
}))

const GRACE_ID = '55555555-5555-4555-8555-555555555555'
const ADA_ID = '66666666-6666-4666-8666-666666666666'
const TARGET_ID = 'fac_churn_risk'

function target(overrides: Partial<DisagreementTarget> = {}): DisagreementTarget {
  return {
    target: { kind: 'factor', id: TARGET_ID },
    label: 'Churn risk after a price rise',
    model_value_at_version: 0.5,
    shape: 'split',
    answering_participants: 2,
    distinct_values: 2,
    spread: { low: 0.2, high: 0.85, width: 0.65 },
    positions: [
      {
        participant_id: GRACE_ID,
        display_label: 'Grace',
        value: 0.85,
        stated_basis: 'we lost 8% last time',
        confidence: null,
        kind: 'belief_submitted',
        pole: 'high',
      },
      {
        participant_id: ADA_ID,
        display_label: 'Ada',
        value: 0.2,
        stated_basis: null,
        confidence: null,
        kind: 'belief_submitted',
        pole: 'low',
      },
    ],
    positions_with_stated_basis: 1,
    evidence: [
      {
        event_id: 'evt-1',
        authored_by: ADA_ID,
        author_label: 'Ada',
        stance: 'challenges',
        stance_phrase: 'challenges',
        kind: 'link',
        body: 'Renewal data for the last three rises.',
        url: 'https://example.com/renewals',
        about_participant_id: GRACE_ID,
        about_label: 'Grace',
        created_at: '2026-08-14T11:00:00.000Z',
      },
    ],
    headline: 'SERVED-HEADLINE-SENTINEL',
    question: 'SERVED-QUESTION-SENTINEL',
    ...overrides,
  }
}

const view = (
  t: DisagreementTarget = target(),
  overrides: Partial<DisagreementView> = {},
): DisagreementView => ({
  round_id: 'round-1',
  graph_version_ref: 'mv-1',
  standing_note: 'SERVED-STANDING-NOTE-SENTINEL',
  per_target: [t],
  ...overrides,
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('the standing sentence is served, never composed here', () => {
  it('renders the served standing note verbatim', () => {
    render(<DisagreementBody view={view()} />)
    expect(screen.getByTestId('disagreement-standing-note')).toHaveTextContent(
      'SERVED-STANDING-NOTE-SENTINEL',
    )
  })

  /**
   * ⭐ THE DISCRIMINATING HALF, and the one that matters. This component used
   * to hand-write this sentence, so "renders something" is exactly the assertion
   * that would have passed on the defect. Absent must mean ABSENT: a local
   * fallback would silently reinstate the second authority the served field was
   * introduced to remove, and every other test here would still pass.
   */
  it('renders NO standing sentence at all when the server sent none', () => {
    render(<DisagreementBody view={view(target(), { standing_note: null })} />)
    expect(screen.queryByTestId('disagreement-standing-note')).toBeNull()
    // Bound to the retired wording specifically: if anyone re-introduces the
    // old local copy as a fallback, this is what catches it.
    expect(screen.queryByText(/are not combined into a single number/i)).toBeNull()
  })
})

describe('the reasoning copy is rendered, never composed', () => {
  it('renders the served headline verbatim', () => {
    render(<DisagreementBody view={view()} />)
    // ⭐ SENTINEL STRINGS. A component that generated its own sentence would
    // still render something plausible and would fail here — which is the whole
    // point. Asserting "some text is present" would pass on locally-authored
    // copy and prove nothing.
    expect(screen.getByTestId(`disagreement-headline-${TARGET_ID}`)).toHaveTextContent(
      'SERVED-HEADLINE-SENTINEL',
    )
  })

  it('renders the served question verbatim', () => {
    render(<DisagreementBody view={view()} />)
    expect(screen.getByTestId(`disagreement-question-${TARGET_ID}`)).toHaveTextContent(
      'SERVED-QUESTION-SENTINEL',
    )
  })

  it('renders NO question block when the server sent none', () => {
    // The discriminating twin. Absence must be absence — a component that
    // substituted a filler question when the server declined to ask one would
    // pass the test above and fail this.
    render(<DisagreementBody view={view(target({ question: null }))} />)
    expect(screen.queryByTestId(`disagreement-question-${TARGET_ID}`)).toBeNull()
  })
})

describe('positions', () => {
  it('shows each person’s stated basis in their own words', () => {
    render(<DisagreementBody view={view()} />)
    expect(screen.getByTestId(`disagreement-basis-${GRACE_ID}`)).toHaveTextContent(
      'we lost 8% last time',
    )
  })

  it('calls out a position with no stated basis rather than hiding it', () => {
    render(<DisagreementBody view={view()} />)
    // Ada gave a number and no reason. The un-interrogable position is exactly
    // the one this surface must not let pass unremarked.
    expect(screen.getByTestId(`disagreement-no-basis-${ADA_ID}`)).toBeInTheDocument()
    expect(screen.queryByTestId(`disagreement-basis-${ADA_ID}`)).toBeNull()
  })

  it('marks poles from the SERVED value, per participant', () => {
    render(<DisagreementBody view={view()} />)
    expect(screen.getByTestId(`disagreement-position-${GRACE_ID}`)).toHaveAttribute(
      'data-pole',
      'high',
    )
    expect(screen.getByTestId(`disagreement-position-${ADA_ID}`)).toHaveAttribute(
      'data-pole',
      'low',
    )
  })

  it('renders the range as two endpoints, never as one number', () => {
    render(<DisagreementBody view={view()} />)
    const spread = screen.getByTestId(`disagreement-spread-${TARGET_ID}`)
    // Written as percentages since `formatPanelValue` landed — the PROPERTY
    // pinned here is unchanged (both endpoints named, never one number
    // standing in for them), only the numeral spelling is.
    expect(spread).toHaveTextContent('20%')
    expect(spread).toHaveTextContent('85%')
    // ⚠ 0.525 is the midpoint of this fixture. Its appearance anywhere would
    // mean the surface had invented a number nobody in the room said. Asserted
    // in BOTH spellings, because the display rule now has two and a midpoint
    // smuggled in as "52.5%" would otherwise pass.
    expect(document.body.textContent).not.toContain('0.525')
    expect(document.body.textContent).not.toContain('52.5%')
  })

  it('never renders aggregate language', () => {
    render(<DisagreementBody view={view()} />)
    const text = (document.body.textContent ?? '').toLowerCase()
    for (const banned of ['average', 'median', 'consensus', 'recommended', 'winner', 'midpoint']) {
      expect(text).not.toContain(banned)
    }
  })
})

describe('evidence', () => {
  it('attributes evidence to the server-resolved author and names whose view it is about', () => {
    render(<DisagreementBody view={view()} />)
    const card = screen.getByTestId('disagreement-evidence-evt-1')
    expect(card).toHaveTextContent('Ada')
    expect(card).toHaveTextContent('challenges')
    expect(card).toHaveTextContent('Grace')
    expect(card).toHaveAttribute('data-stance', 'challenges')
  })

  it('renders the author’s words verbatim', () => {
    render(<DisagreementBody view={view()} />)
    expect(screen.getByTestId('disagreement-evidence-body-evt-1')).toHaveTextContent(
      'Renewal data for the last three rises.',
    )
  })

  it('renders an https link with noopener noreferrer', () => {
    render(<DisagreementBody view={view()} />)
    const link = screen.getByTestId('disagreement-evidence-link-evt-1')
    expect(link).toHaveAttribute('href', 'https://example.com/renewals')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })
})

describe('safeHref — the client half of the stored-XSS gate', () => {
  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    'not a url at all',
  ])('refuses %s', (url) => {
    expect(safeHref(url)).toBeNull()
  })

  it.each([
    ['https://example.com/a', 'https://example.com/a'],
    ['http://example.com/b', 'http://example.com/b'],
  ])('accepts %s', (url, expected) => {
    // The contrast control: proves the refusals above are about the SCHEME and
    // not a function that returns null for everything.
    expect(safeHref(url)).toBe(expected)
  })

  it('does not render a dangerous URL as a link, and says so', () => {
    const t = target()
    const withBadUrl = target({
      evidence: [{ ...t.evidence[0], url: 'javascript:alert(1)' }],
    })
    render(<DisagreementBody view={view(withBadUrl)} />)
    expect(screen.queryByTestId('disagreement-evidence-link-evt-1')).toBeNull()
    // The BODY still renders — the evidence is not lost, only its link. And the
    // drop is disclosed rather than silent.
    expect(screen.getByTestId('disagreement-evidence-body-evt-1')).toHaveTextContent(
      'Renewal data',
    )
    expect(screen.getByTestId('disagreement-evidence-evt-1')).toHaveTextContent(
      'cannot be opened safely',
    )
    expect(document.body.innerHTML).not.toContain('javascript:')
  })
})

describe('attachEvidence request shape', () => {
  async function capture(): Promise<{ url: string; body: Record<string, unknown> }> {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ authored_by: GRACE_ID, event_id: 'e1' }), { status: 201 }),
      )
    await attachEvidence('round-1', {
      targetId: TARGET_ID,
      targetKind: 'factor',
      kind: 'link',
      body: 'Renewal data for the last three rises.',
      url: 'https://example.com/renewals',
      stance: 'challenges',
      aboutParticipantId: GRACE_ID,
    })
    const call = spy.mock.calls[0]
    return {
      url: String(call[0]),
      body: JSON.parse(String((call[1] as RequestInit).body)) as Record<string, unknown>,
    }
  }

  it('posts to the shared events endpoint, not a second one', async () => {
    const { url } = await capture()
    expect(url).toBe('/bff/collab/packet/round-1/events')
  })

  it('carries NO provenance claim of any kind', async () => {
    // ⭐ INV-F FROM THE CLIENT SIDE. The server REFUSES a smuggled
    // `authored_by`/`provenance` rather than ignoring it, so a client that sent
    // one would break every attach — but the reason to assert it here is that a
    // well-meaning "include the author so the optimistic render is right" change
    // looks entirely reasonable in review.
    const { body } = await capture()
    const evidence = body.evidence as Record<string, unknown>
    expect(Object.keys(body).sort()).toEqual(['belief', 'evidence', 'kind', 'target'])
    expect(Object.keys(evidence).sort()).toEqual([
      'about_participant_id',
      'body',
      'kind',
      'stance',
      'url',
    ])
    expect(evidence).not.toHaveProperty('authored_by')
    expect(body).not.toHaveProperty('provenance')
  })

  it('sends the words verbatim and carries no belief', async () => {
    const { body } = await capture()
    expect(body.belief).toBeNull()
    expect((body.evidence as Record<string, unknown>).body).toBe(
      'Renewal data for the last three rises.',
    )
  })

  it('sends the participant token as a header, never in the URL', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({}), { status: 201 }))
    await attachEvidence('round-1', {
      targetId: TARGET_ID,
      targetKind: 'factor',
      kind: 'note',
      body: 'x',
      url: null,
      stance: 'supports',
      aboutParticipantId: null,
    })
    const [url, init] = spy.mock.calls[0]
    expect(String(url)).not.toContain('ptoken-for-tests')
    const headers = (init as RequestInit).headers as Record<string, string>
    expect(headers['x-collab-participant-token']).toBe('ptoken-for-tests')
  })
})
