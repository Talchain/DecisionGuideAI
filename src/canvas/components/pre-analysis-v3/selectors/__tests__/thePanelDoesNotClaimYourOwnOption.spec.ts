/**
 * THE PANEL MAY NOT BADGE A USER'S OWN OPTION AS OLUMI'S.
 *
 * ── THE DEFECT, AND WHY IT SURVIVED #1535 ──────────────────────────────────
 * `olumiAuthorshipClaim` was introduced as the ONE owner of the question "may
 * the product claim this element as its own?", and #1535 wired the canvas card
 * and the glance disclosure to it. `projectAuthoredEntities.attributionOfNode`
 * — the panel's Model section — was left asking `provenance === 'ai_inferred'`
 * on its own, so the SAME node that renders unmarked on the canvas card still
 * rendered an `[Olumi]` pill one surface away (`model/YourDecisionSection.tsx`
 * `EntityRow`). Two surfaces, one node, two answers: the exact three-way
 * disagreement the owner's header tabulates, with one row still open.
 *
 * ── THE INVARIANT IS WRITTEN AGAINST THE SPEC, NOT THE FAILURE MODE ────────
 * The claim asserted below is NOT "the panel calls `mayClaimOlumiAuthorship`"
 * — that is an implementation detail a refactor may legitimately change. The
 * claim is CEE's own rule: `ai_inferred` is the producer's CATCH-ALL and also
 * covers "the user stated it and the brief check came back unverified", so
 * `ai_inferred` BESIDE A RECORDED `source_quote` means nobody may be named. The
 * panel must be silent there, and must keep disclosing everywhere else.
 *
 * ── WHAT THE GATE MUST NOT COST (the control that matters most) ────────────
 * Suppression is the easy wrong fix. `projectAuthoredEntities`' own header
 * measured the value being protected: across 18 drafts on 7 frozen briefs, 12
 * contained at least one option the brief never mentions, and 15/15 of those
 * inventions carry `ai_inferred` with NO quote. Those are 10 syntheses, 3
 * status-quo baselines and 2 novel moves — real work, and marking it is what
 * keeps the user the author of the set. So every ambiguity case below is
 * twinned with an INVENTION case that must still be badged.
 *
 * ── EVERY ASSERTION BINDS BY NODE ID (CLAUDE.md trap 19) ───────────────────
 * The corpus deliberately holds several options whose attribution differs, and
 * every lookup goes through a `nodeId → attribution` map. A predicate like
 * `rows.find(r => r.attribution.kind === 'olumi')` would be satisfied by a
 * DIFFERENT option than the one under test, which is how an entire extractor
 * was once deleted under 23,832 green tests.
 */

import { describe, it, expect } from 'vitest'
import type { Node } from '@xyflow/react'
import { projectAuthoredEntities } from '../projectAuthoredEntities'
import { mayClaimOlumiAuthorship } from '../../../../domain/olumiAuthorshipClaim'
import { optionOriginFromNode } from '../../../../../components/results/analysisNew/optionOriginDisclosure'

/**
 * A store node as the panel actually receives it: `provenance` and any recorded
 * quote live on `data`, beside the label.
 */
function optionNode(id: string, label: string, data: Record<string, unknown>): Node {
  return {
    id,
    type: 'option',
    position: { x: 0, y: 0 },
    data: { kind: 'option', label, ...data },
  } as Node
}

/**
 * ⚠ THE CLASSES ARE NAMED, NOT NUMBERED, so a reader can see what each one is
 * a claim about. `quote_*` are the ambiguous class CEE produces by construction
 * (`draft/records/option-framing.ts` spreads a `stated` record and overwrites
 * the class to `ai_inferred`); `invented` is the class the disclosure exists
 * for; the rest are the user's own by every reading.
 */
const CORPUS: Node[] = [
  // ── THE AMBIGUOUS CLASS — the user's words, unverified. Say nothing. ──
  optionNode('o_quote_snake', 'Raise the price to £54', {
    provenance: 'ai_inferred',
    source_quote: 'I want to raise it to fifty four',
  }),
  optionNode('o_quote_camel', 'Hold the price and cut scope', {
    provenance: 'ai_inferred',
    sourceQuote: 'hold price, cut scope instead',
  }),
  // ⚠ FAIL-CLOSED ON AN UNREADABLE QUOTE. A degraded JSONB read can deliver a
  // non-string here. PRESENCE is the producer saying the node came off a
  // STATED record, so a "is it a non-empty string" test would fire the pill on
  // a node whose words are the user's. Declining costs only silence.
  optionNode('o_quote_unreadable', 'Bundle support into the licence', {
    provenance: 'ai_inferred',
    source_quote: 99,
  }),
  // ── THE INVENTION CLASS — Olumi's own. This MUST stay badged. ──
  optionNode('o_invented_hybrid', 'Raise the price and phase the increase', {
    provenance: 'ai_inferred',
  }),
  optionNode('o_invented_status_quo', 'Change nothing this quarter', {
    provenance: 'ai_inferred',
    source_quote: null,
  }),
  // ── THE USER'S OWN, BY EVERY READING. ──
  optionNode('o_from_brief', 'Move to annual billing', {
    provenance: 'from_brief',
    source_quote: 'we should move everyone to annual',
  }),
  optionNode('o_user_set', 'Hire a second seller', { provenance: 'user_set' }),
  optionNode('o_unstamped', 'Do a price test in one region', {}),
  // An unknown literal is a FINDING, not a patch site: the classifier returns
  // null and nobody is named.
  optionNode('o_unknown_literal', 'Split the tier in two', { provenance: 'something_new' }),
]

/** nodeId → attribution, so nothing is ever found by a value another row shares. */
function attributionsById(nodes: Node[]): Map<string, string> {
  const m = new Map<string, string>()
  for (const e of projectAuthoredEntities(nodes, 'option')) m.set(e.nodeId, e.attribution.kind)
  return m
}

const OLUMI_CLAIMED = ['o_invented_hybrid', 'o_invented_status_quo'] as const
const NOBODY_CLAIMED = [
  'o_quote_snake',
  'o_quote_camel',
  'o_quote_unreadable',
  'o_from_brief',
  'o_user_set',
  'o_unstamped',
  'o_unknown_literal',
] as const

describe('the panel is silent about authorship it is not entitled to claim', () => {
  it('CONTROL: the corpus reaches the projection intact, so an absence below is a verdict', () => {
    // Without this, a projection that dropped every option would satisfy every
    // "not olumi" assertion by rendering no rows at all — an absence claim with
    // no positive control is vacuous (CLAUDE.md trap 13).
    const byId = attributionsById(CORPUS)
    expect(byId.size, 'every option in the corpus is projected').toBe(CORPUS.length)
    expect(
      [...byId.values()].filter((k) => k === 'olumi').length,
      'the corpus contains real inventions, so the pill is reachable here',
    ).toBe(OLUMI_CLAIMED.length)
  })

  it.each(NOBODY_CLAIMED)(
    '%s: ai_inferred beside a recorded quote, or no ai stamp at all, renders no Olumi pill',
    (nodeId) => {
      const byId = attributionsById(CORPUS)
      expect(byId.get(nodeId), `${nodeId} must not be attributed to Olumi`).toBe('person')
    },
  )

  it.each(OLUMI_CLAIMED)(
    '%s: an invention with no recorded quote is STILL disclosed as Olumi’s',
    (nodeId) => {
      // The gate must suppress nothing true. A fix that silenced these would
      // trade a false claim for a lost disclosure — the opposite defect, and
      // the one the panel was built to close.
      const byId = attributionsById(CORPUS)
      expect(byId.get(nodeId), `${nodeId} is Olumi's own and must be marked`).toBe('olumi')
    },
  )

  it('the panel and the owner cannot disagree about any node in the corpus', () => {
    // ⚠ THIS PINS THE CONSOLIDATION, and it is deliberately NOT the only guard
    // here: an agreement check proves the two READ THE SAME RULE and can never
    // prove the rule is right (CLAUDE.md trap 12d). The hand-written corpus
    // above is what says the rule is right; this is what stops a copy drifting
    // back in.
    const byId = attributionsById(CORPUS)
    for (const node of CORPUS) {
      expect(
        byId.get(node.id) === 'olumi',
        `${node.id}: panel and olumiAuthorshipClaim must give one answer`,
      ).toBe(mayClaimOlumiAuthorship(node.data))
    }
  })

  it('the panel row and the glance disclosure agree about the same node', () => {
    // The defect this file closes was a DISAGREEMENT BETWEEN SURFACES, so the
    // invariant is stated between surfaces rather than inside one. These two
    // are the ends of the estate — a canvas selector and a results-panel
    // disclosure — reading one field about one node.
    for (const node of CORPUS) {
      const panelClaimsOlumi = attributionsById(CORPUS).get(node.id) === 'olumi'
      const glanceClaimsOlumi = optionOriginFromNode(node) !== null
      expect(
        panelClaimsOlumi,
        `${node.id}: the Model panel and the glance must not name different authors`,
      ).toBe(glanceClaimsOlumi)
    }
  })
})
