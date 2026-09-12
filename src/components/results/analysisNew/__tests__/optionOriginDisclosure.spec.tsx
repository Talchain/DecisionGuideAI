/**
 * ⭐⭐ WHEN THE WINNER IS OLUMI'S IDEA, THE PANEL SAYS SO — WHERE IT NAMES IT.
 *
 * The founder wrote "Should we increase the Pro plan price from £49 to £59?".
 * The product invented "Raise Price to £54 (Soft Increase)" and announced it as
 * the answer at 73% with nothing saying the option was ours.
 *
 * ⛔ THE DISCRIMINATION THESE ARMS EXIST TO PROVE, because presence alone would
 * pass on a sentence that always fires:
 *   · it binds to the LEADER BY ID, not to "some invented node in the graph";
 *   · it stays silent on the USER'S OWN option;
 *   · it stays silent on the AMBIGUOUS `ai_inferred`-with-a-quote case, which is
 *     a fabrication in the opposite direction and the worse of the two;
 *   · it never appears where no leader is named;
 *   · and the leader is STILL NAMED — this is disclosure, never exclusion.
 */

import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { AtAGlance } from '../sections/AtAGlance'
import {
  OPTION_ORIGIN_COPY,
  buildNodeOriginMap,
  optionOriginFromNode,
} from '../optionOriginDisclosure'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import { decisionWithLeaderWithheld, genuineDecision } from './analysisNewFixtures'

afterEach(() => cleanup())

/** The leading option in `genuineDecision()`. Bound BY ID, never by label. */
const LEADER_ID = 'opt_b'
/** The other option in the same fixture — the identity contrast. */
const OTHER_ID = 'opt_a'

const SENTENCE = OPTION_ORIGIN_COPY.ai_suggested

const node = (id: string, provenance: string, extra: Record<string, unknown> = {}) => ({
  id,
  data: { type: 'option', label: id, provenance, ...extra },
})

const glanceOf = (data: ResultsSectionDataReturn, nodes: ReadonlyArray<unknown>) =>
  buildAnalysisNewViewModel({
    data,
    recommendations: [],
    isPreRun: false,
    isRunning: false,
    isStale: false,
    nodeOrigins: buildNodeOriginMap(nodes),
  }).atAGlance

const renderGlance = (data: ResultsSectionDataReturn, nodes: ReadonlyArray<unknown>) =>
  render(
    <AtAGlance
      isRunning={false}
      reanalyseBlocked={false}
      reanalyseBlockedReason={null}
      glance={glanceOf(data, nodes)}
    />,
  )

// ── the predicate, at the node ──────────────────────────────────────────────

describe('optionOriginFromNode — CEE’s predicate, inherited not re-decided', () => {
  it('ai_inferred with NO recorded quote is Olumi’s', () => {
    expect(optionOriginFromNode(node(LEADER_ID, 'ai_inferred'))).toBe('ai_suggested')
  })

  /**
   * ⛔ THE AMBIGUITY GATE. `ai_inferred` is CEE's CATCH-ALL: it covers both "the
   * model invented this" AND "the user stated it but the brief check came back
   * unverified". Announcing the second as ours is a fabrication against the
   * user's own words, so we decline.
   */
  it('ai_inferred BESIDE a recorded quote declines — neither ours nor theirs is safe', () => {
    expect(
      optionOriginFromNode(node(LEADER_ID, 'ai_inferred', { source_quote: 'raise it to 59' })),
    ).toBeNull()
  })

  /**
   * ⚠ KEYED ON RECORDED, NOT ON READABLE. CEE found this by driving a malformed
   * value one seam past its guard: a degraded JSONB read yields `source_quote:
   * 99`, which fails a string test, so a "non-empty string" gate does NOT fire
   * and the user is told their own words were ours. Presence alone must close it.
   */
  it('an UNREADABLE recorded quote still declines (fail-closed)', () => {
    expect(optionOriginFromNode(node(LEADER_ID, 'ai_inferred', { source_quote: 99 }))).toBeNull()
  })

  it.each([['from_brief'], ['user_set']])('%s is the user’s — silent', (p) => {
    expect(optionOriginFromNode(node(LEADER_ID, p))).toBeNull()
  })

  it('an absent, unknown or object-shaped provenance is silent, never a guess', () => {
    expect(optionOriginFromNode({ id: LEADER_ID, data: { type: 'option' } })).toBeNull()
    expect(optionOriginFromNode(node(LEADER_ID, 'something_new'))).toBeNull()
    expect(optionOriginFromNode({ id: LEADER_ID, data: { provenance: { source: 'x' } } })).toBeNull()
  })

  it('reads the top-level wire shape as well as node.data', () => {
    expect(optionOriginFromNode({ id: LEADER_ID, provenance: 'ai_inferred' })).toBe('ai_suggested')
  })
})

// ── the surface ─────────────────────────────────────────────────────────────

describe('At a glance — the disclosure lands where the leader is named', () => {
  it('names Olumi’s own option AS the answer AND says it was ours', () => {
    renderGlance(genuineDecision(), [node(LEADER_ID, 'ai_inferred')])

    // ⭐ DISCLOSURE, NOT EXCLUSION — the leader is still the answer on screen.
    expect(screen.getByTestId('analysis-new-glance-headline')).toHaveTextContent('Raise price')
    expect(screen.getByTestId('analysis-new-glance-option-origin')).toHaveTextContent(SENTENCE)
  })

  /**
   * ⭐⭐ THE IDENTITY BINDING, AND IT IS THE ARM THAT MATTERS (CLAUDE.md trap 19).
   * The graph HOLDS an Olumi-invented option — but it is not the leader. A
   * disclosure bound to "does this run contain an invented option" passes the
   * arm above and fails here; only one bound to the leader's own id survives both.
   */
  it('is SILENT when the invented option is not the one winning', () => {
    renderGlance(genuineDecision(), [
      node(LEADER_ID, 'from_brief'),
      node(OTHER_ID, 'ai_inferred'),
    ])

    expect(screen.getByTestId('analysis-new-glance-headline')).toHaveTextContent('Raise price')
    expect(screen.queryByTestId('analysis-new-glance-option-origin')).toBeNull()
  })

  it('is SILENT when the leading option came from the user’s own brief', () => {
    renderGlance(genuineDecision(), [node(LEADER_ID, 'from_brief')])
    expect(screen.queryByTestId('analysis-new-glance-option-origin')).toBeNull()
  })

  it('is SILENT on the ambiguous case, on the surface as well as at the node', () => {
    renderGlance(genuineDecision(), [
      node(LEADER_ID, 'ai_inferred', { source_quote: 'raise it to 59' }),
    ])
    expect(screen.queryByTestId('analysis-new-glance-option-origin')).toBeNull()
  })

  /**
   * ⛔ THE GATE IS NOT TOUCHED, AND THIS PINS THE DIRECTION. A run the model
   * refused to let name a leader must gain no new sentence: a disclosure about
   * "the leading option" where none is named would author the designation the
   * gate just withheld.
   */
  it('never appears where the entitlement withheld the leader', () => {
    const withheld = decisionWithLeaderWithheld()
    renderGlance(withheld, [node(LEADER_ID, 'ai_inferred'), node('opt_x', 'ai_inferred')])

    expect(glanceOf(withheld, [node(LEADER_ID, 'ai_inferred')]).headline,
      'precondition: this fixture must withhold, or the arm tests nothing').toBeNull()
    expect(screen.queryByTestId('analysis-new-glance-option-origin')).toBeNull()
  })

  /**
   * ⚠ THE PRECONDITION, PINNED IN-TEST. Without node origins the surface is
   * exactly what it was — so the arms above measure the disclosure, not some
   * unrelated difference between fixtures.
   */
  it('with no graph nodes at all the panel is unchanged', () => {
    renderGlance(genuineDecision(), [])
    expect(screen.getByTestId('analysis-new-glance-headline')).toHaveTextContent('Raise price')
    expect(screen.queryByTestId('analysis-new-glance-option-origin')).toBeNull()
  })
})
