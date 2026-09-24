/**
 * ⛔⛔ UNRUN IN THIS SESSION — CI IS THE AUTHORITY.
 * The 18 Sep re-point below (`'node'` -> `'structural'`) and the set assertion
 * added with it were written under a hard no-execution constraint: no vitest,
 * no typecheck, no install was run against this tree. Nothing here has been
 * observed to pass OR to fail. Treat the "Staging Tests" run on this branch as
 * the only evidence about these assertions.
 */
/**
 * ⛔⛔ THE CANVAS MUST NOT CLAIM A USER'S OWN OPTION AS OLUMI'S.
 *
 * ── THE DEFECT, AND IT IS A TRUTHFULNESS DEFECT ──────────────────────────────
 * A user states an option in their brief. The option card's provenance mark
 * says **"Olumi suggested this"** about it — the product taking credit for the
 * user's own thinking, on the surface every user meets first, against the
 * programme's founding commitment that humans remain the authors. That is worse
 * than silence, not a lesser version of it.
 *
 * ── THE ANTECEDENT, DERIVED AT THE PRODUCER'S BYTES (CEE `2212ae05`) ─────────
 * Four hops, each read rather than inherited:
 *
 *  1. `cee/draft/records/option-framing.ts` — the branch's own guard requires
 *     `prov.provenance_class === 'stated'` AND a string `prov.source_quote`.
 *     It then builds `{ ...prov, provenance_class: 'ai_inferred', … }`. The
 *     spread RETAINS the quote, so every node on that path is `ai_inferred`
 *     beside the user's own words BY CONSTRUCTION.
 *  2. `cee/draft/records/projector.ts:250` declares the field that makes the
 *     gate safe: *"Present iff `stated`. The verbatim quote, canonicalised."*
 *     A genuine invention therefore never carries one.
 *  3. `cee/transforms/schema-v3.ts:1178-1190` stamps `ai_inferred` for anything
 *     not `stated`+`verified`, and — separately, `:1190` — lifts `source_quote`
 *     onto the WIRE node. Origin and quote are emitted together and are
 *     genuinely separable, which is the only reason a gate is possible.
 *  4. `canvas/utils/applyDraftResult.ts` `mapDraftNodeToCanvas` destructures
 *     neither field, so both ride `...rest` onto `node.data`. Pinned below,
 *     because if that ever stops being true this gate silently cannot fire.
 *
 * ── ⭐ THE GATE SUPPRESSES NOTHING TRUE, AND BOTH DIRECTIONS ARE ASSERTED ────
 * Census of every `*.json` in this repo: 293 option nodes, of which 145 are
 * `ai_inferred` with NO quote and 0 are `ai_inferred` WITH one. So on the whole
 * captured corpus the gate changes nothing, and the suite below proves it over
 * the real starter captures rather than asserting it. A fix that went silent on
 * Olumi's genuine inventions would destroy the disclosure the founder
 * specifically valued — it must RED here, and it does.
 *
 * ── ⚠ WHERE THE AMBIGUOUS FIXTURE COMES FROM, STATED PLAINLY ────────────────
 * The ambiguous class has ZERO witnesses in this repo's captures, so there is no
 * capture to point at. It is NOT hand-authored either: the spec takes the REAL
 * user-stated option out of a real capture and applies EXACTLY the rewrite
 * `option-framing.ts` performs on it. The words asserted below are the founder's
 * own, carried out of the capture file, never typed here.
 */
import { describe, it, expect } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { NodeProvenanceMark } from '../NodeProvenanceMark'
import { STRUCTURAL_PROVENANCE_LABEL } from '../../../domain/nodeProvenanceClaim'
import type { NodeProvenanceClaim } from '../../../domain/nodeProvenanceClaim'
import { mapDraftNodeToCanvas } from '../../../utils/applyDraftResult'
import poll from '../../../hydrate/__tests__/fixtures/pricing-provisional-poll.json'
import pricingStarter from '../../../starters/data/pricing-model.draft.json'
import buildVsBuyStarter from '../../../starters/data/build-vs-buy.draft.json'
import marketEntryStarter from '../../../starters/data/market-entry.draft.json'
import vendorStarter from '../../../starters/data/vendor-selection.draft.json'
import headcountStarter from '../../../starters/data/headcount-allocation.draft.json'

/** The sentence this spec exists to keep off a user's own option. */
const OLUMI_CLAIM = STRUCTURAL_PROVENANCE_LABEL.ai

type WireNode = { id: string; kind?: string; label: string; provenance?: string; source_quote?: string }

const optionsOf = (nodes: readonly WireNode[]) => nodes.filter((n) => n.kind === 'option')

/**
 * Binds a mark to WHICH QUESTION it answers, by `data-provenance-claim`, rather
 * than to its position — with two marks possible, position is not identity
 * (trap 19).
 *
 * ⛔ RE-POINTED 18 Sep 2026: the union was `'node' | 'value'`, matching a
 * spelling the card emitted and the domain type does not own
 * (`NodeProvenanceClaim = 'value' | 'structural' | 'none'`). Typed from the
 * DOMAIN so the two cannot re-split — see the sibling `whoseNumber` spec's
 * helper for the full account.
 */
const marksFor = (claim: Exclude<NodeProvenanceClaim, 'none'>) =>
  screen
    .queryAllByTestId('node-provenance-mark')
    .filter((el) => el.getAttribute('data-provenance-claim') === claim)

const pollOptions = optionsOf((poll as { graph: { nodes: WireNode[] } }).graph.nodes)

/**
 * The REAL user-stated option, lifted from the capture. Its `source_quote` is
 * the founder's own sentence and `provenance` is `from_brief` as captured.
 */
const realUserStatedOption = pollOptions.find((n) => n.provenance === 'from_brief')!

/** The REAL inventions from the same capture — `ai_inferred`, no quote. */
const realInventions = pollOptions.filter((n) => n.provenance === 'ai_inferred')

/**
 * ⚠ THE PRECONDITION, PINNED IN-TEST RATHER THAN ASSUMED (trap 13b).
 * A gate keyed on a field the ingestion strips is a gate that can never fire,
 * and it would look exactly like a passing test. These assert the fixture and
 * the ingestion really do put the discriminating data in front of the card.
 */
describe('the precondition this gate rests on', () => {
  it('the capture really does carry a user-stated option WITH its quote', () => {
    expect(realUserStatedOption).toBeDefined()
    expect(typeof realUserStatedOption.source_quote).toBe('string')
    expect(realUserStatedOption.source_quote!.length).toBeGreaterThan(0)
  })

  it('the capture really does carry Olumi inventions WITHOUT a quote', () => {
    expect(realInventions.length).toBeGreaterThan(0)
    for (const n of realInventions) expect(n.source_quote).toBeUndefined()
  })

  it('⛔ ingestion carries BOTH provenance and source_quote onto node.data', () => {
    // If this REDs, the gate below cannot fire on a real graph and the fix is dark.
    const ingested = mapDraftNodeToCanvas(realUserStatedOption)
    expect(ingested.data.provenance).toBe('from_brief')
    expect(ingested.data.source_quote).toBe(realUserStatedOption.source_quote)
  })
})

describe('⛔ a user-stated option is never claimed as Olumi\'s', () => {
  /**
   * CEE's `option-framing.ts` rewrite, reproduced on REAL captured data:
   * class becomes `ai_inferred`, the user's quote is retained by the spread.
   */
  const afterCeeRewrite = {
    ...realUserStatedOption,
    provenance: 'ai_inferred',
    label_authored: true,
  }

  it('says NOTHING about a node carrying ai_inferred beside the user\'s own words', () => {
    const { data } = mapDraftNodeToCanvas(afterCeeRewrite)
    render(<NodeProvenanceMark nodeType="option" data={data} />)
    expect(screen.queryByLabelText(OLUMI_CLAIM)).toBeNull()
    expect(screen.queryByTestId('node-provenance-mark')).toBeNull()
  })

  it('the words it must not claim are the user\'s own, carried from the capture', () => {
    // Binds the case to the user's sentence by IDENTITY, not by a predicate
    // another node could satisfy: this is the quote the card would be
    // overwriting with "Olumi suggested this".
    expect(afterCeeRewrite.source_quote).toBe(realUserStatedOption.source_quote)
    expect(afterCeeRewrite.source_quote).toContain('£49')
  })
})

describe('⚠ the gate stops at the STRUCTURAL claim, and that boundary is guarded', () => {
  /**
   * ⛔ THIS BLOCK EXISTS BECAUSE A MUTANT SURVIVED WITHOUT IT. Widening the gate
   * to `claim !== 'none'` — so it also silenced the VALUE claim — left the whole
   * suite green, which means the most reasoned part of the design was resting on
   * a comment. It is NOT an equivalent mutant: a user-stated factor that carries
   * a number and an unconfirmed brief binding arrives as `ai_inferred` + a quote
   * + a value, because `schema-v3.ts:1190` lifts `source_quote` for ANY typed
   * record, not only for options.
   *
   * The boundary is derived, not chosen: `source_quote` speaks to who authored
   * the ELEMENT, which is what the structural vocabulary claims. The value
   * vocabulary ("AI estimate") claims something about a NUMBER, and a quote
   * about the element is silent on that. Reading one field as though it answered
   * both questions is the conflation `nodeProvenanceClaim` exists to end.
   */
  const valuedFactorWithAmbiguousPair = {
    id: 'f1',
    kind: 'factor',
    label: 'Churn rate',
    provenance: 'ai_inferred',
    source_quote: 'churn is running around 4% a month',
    observed_state: { value: 0.04 },
  }

  /**
   * ⛔⛔ UPDATED 24 Sep 2026 (GAP-16, DESIGN-GAP-AUDIT-20260924.md row 16). This
   * used to assert the header rendered a value-claim mark ("not silence").
   * GAP-16 makes silence HERE the correct answer for any factor whose only
   * eligible claim is `'value'`: `FactorNode` carries that fact on its own
   * value line unconditionally (`valueSourceMark.tsx`), so the header no
   * longer duplicates it. What this test still must prove — untouched —
   * is that the card does NOT say "Olumi suggested this" about an element
   * whose authorship is ambiguous; a null header mark trivially satisfies
   * that, but it is asserted by identity rather than as a side effect of the
   * null check.
   */
  // ⛔ review 5822866079: `{ value: 0.04 }` has no source, so the value line reads
  // `unknown` and the header KEEPS its value mark (a number is never unmarked).
  it('a VALUED factor with an ambiguous pair: never the Olumi authorship claim; the value mark stays', () => {
    const { data } = mapDraftNodeToCanvas(valuedFactorWithAmbiguousPair)
    // Precondition pinned in-test: the pair really is present and the value
    // really did survive ingestion, so a pass here cannot be the fixture's doing.
    expect(data.provenance).toBe('ai_inferred')
    expect(data.source_quote).toBeDefined()
    expect(data.observedState).toEqual({ value: 0.04 })

    render(<NodeProvenanceMark nodeType="factor" data={data} />)
    expect(screen.queryByLabelText(OLUMI_CLAIM), 'the ambiguous element must never be claimed as Olumi\'s').toBeNull()
    const header = screen.queryByTestId('node-provenance-mark')
    expect(header, 'the value line cannot classify this source, so the header is the only mark with a kind').not.toBeNull()
    expect(header!.getAttribute('data-provenance-claim')).toBe('value')
  })

  /**
   * ⛔⛔⛔ THE TWIN THAT THE FIXTURE ABOVE CANNOT REACH — AND THE REGRESSION IT CAUGHT.
   *
   * `valuedFactorWithAmbiguousPair` carries NO `observed_state.source`, so
   * `classifyValueProvenance` returns `null`, the two-mark disagreement branch
   * is never entered, and the card falls to the single-mark path. Every
   * assertion above is therefore silent about what happens when a value source
   * IS present — the class the two-mark change (18 Sep) newly admits.
   *
   * ⛔ THE CORPUS SHARED THE CODE'S BLIND SPOT (CLAUDE.md trap 13d/22b). Adding
   * one field to the very same node makes the card render **"Olumi suggested
   * this"** over the user's own words — the exact sentence this whole spec file
   * exists to keep off a user's own node, re-opened by a change whose own tests
   * were all green.
   *
   * ⚠ WHY THE GATE MUST BE ASKED HERE AND NOT ONLY IN `nodeProvenanceClaim`.
   * That gate reads `if (claim === 'structural' && …)`, and its premise —
   * written down in its own docblock — is that *a valued factor never makes a
   * structural claim*. The disagreement branch breaks that premise: it makes a
   * STRUCTURAL claim on a node whose `claim` is `'value'`, so the gate is
   * bypassed by construction. The mark must ask the owning predicate itself.
   *
   * ⭐ THE VALUE MARK MUST SURVIVE. "From brief" is a true statement about the
   * NUMBER and the quote says nothing about it; silencing both would be the
   * over-suppression this file's last block exists to forbid.
   */
  const ambiguousPairWithABriefSourcedNumber = {
    ...valuedFactorWithAmbiguousPair,
    observed_state: { value: 0.04, source: 'brief_extraction' },
  }

  /**
   * ⛔⛔ UPDATED 24 Sep 2026 (GAP-16). The "true fact about the NUMBER" this
   * test protects used to be asserted as a HEADER mark (`marksFor('value')`).
   * GAP-16 moves that fact to the card's own value line unconditionally —
   * `factorValueSourceMark` never returns null for a stated value — so this
   * isolated `NodeProvenanceMark` render (which has no value line to show)
   * correctly shows NEITHER claim now. The two things this test exists to
   * protect — no Olumi-authorship claim, AND the number's provenance is not
   * silenced product-wide — are re-asserted below: the first directly, the
   * second by reference to `BaseNode.gap16NoDuplicateHeaderProvenance.spec.tsx`,
   * which renders the full `FactorNode` and proves the value line still
   * carries "From brief" for this exact shape.
   */
  it('⛔ a BRIEF-SOURCED number does not license claiming the ELEMENT as Olumi\'s', () => {
    const { data } = mapDraftNodeToCanvas(ambiguousPairWithABriefSourcedNumber)
    // Preconditions pinned in-test, so a pass cannot be the fixture failing to
    // reach the branch (trap 13b) — this is precisely how the twin above missed it.
    expect(data.provenance).toBe('ai_inferred')
    expect(data.source_quote).toBeDefined()
    expect((data.observedState as { source?: string }).source).toBe('brief_extraction')

    render(<NodeProvenanceMark nodeType="factor" data={data} />)

    // ⛔ The product must not take credit for the user's own thinking.
    expect(
      screen.queryByLabelText(OLUMI_CLAIM),
      'the card claimed the user\'s own element as Olumi\'s',
    ).toBeNull()
    expect(marksFor('structural'), 'an authorship mark rendered on an ambiguous node').toHaveLength(0)

    // ⭐ …and the header does not duplicate the number's provenance either —
    // GAP-16 moved that disclosure to the value line (proved elsewhere), so
    // this isolated render is silent on BOTH claims for this fixture.
    expect(marksFor('value'), 'the header must not carry a value-claim mark of its own').toHaveLength(0)
  })

  /**
   * ⛔ THE DISCRIMINATING TWIN. Identical node, quote REMOVED — a genuine Olumi
   * invention whose number came out of the brief. The structural mark must
   * render, so the fix above is proven to suppress the AMBIGUOUS case
   * specifically and not to have simply disabled the two-mark branch outright.
   *
   * ⛔⛔ UPDATED 24 Sep 2026 (GAP-16): "gets BOTH marks" is no longer true of
   * the HEADER — the value half is now suppressed everywhere (it duplicates
   * `FactorNode`'s own value-line mark), so this genuine invention gets its
   * ONE structural mark, same as the ambiguous twin above gets none. The
   * discrimination this test protects — genuine invention vs ambiguous pair —
   * still lives entirely in the structural claim.
   */
  it('⭐ the same node WITHOUT a quote is a real invention and gets its structural mark (value stays on the value line)', () => {
    const { source_quote: _dropped, ...genuineInvention } = ambiguousPairWithABriefSourcedNumber
    const { data } = mapDraftNodeToCanvas(genuineInvention)
    expect(data.source_quote).toBeUndefined()

    render(<NodeProvenanceMark nodeType="factor" data={data} />)
    expect(screen.queryByLabelText(OLUMI_CLAIM)).not.toBeNull()
    expect(marksFor('structural')).toHaveLength(1)
    expect(marksFor('value')).toHaveLength(0)
  })

  /**
   * ⛔⛔ THE THIRD STATE, AND THE REASON THE PREDICATE IS THE ONE IT IS.
   *
   * `olumiAuthorshipClaim` states outright that `olumiAuthorshipIsAmbiguous` and
   * `mayClaimOlumiAuthorship` are NOT negations: there are three states, and
   * BOTH are false for `from_brief`. A mark gated on `mayClaimOlumiAuthorship`
   * would therefore silence **"From your brief"** — a true disclosure the user
   * wants — while passing every other test in this file.
   *
   * ⭐ THAT DISTINCTION WAS A COMMENT UNTIL THIS TEST. A sentence in a docblock
   * asserting which of two same-shaped predicates is correct is exactly the
   * claim nobody re-checks (CLAUDE.md trap 13b/21), and swapping them is a
   * one-word edit. This is the case that REDs when someone makes it.
   */
  const briefAuthoredElementWithAnEditedNumber = {
    id: 'f2',
    kind: 'factor',
    label: 'Churn rate',
    provenance: 'from_brief',
    observed_state: { value: 0.04, source: 'user_override' },
  }

  /**
   * ⛔⛔ UPDATED 24 Sep 2026 (GAP-16): "keeps BOTH true facts" used to mean
   * both facts reach the HEADER. The value fact ("User edited") now lives
   * exclusively on `FactorNode`'s own value line — a duplicate of the header
   * copy this test used to assert — so the header keeps only the structural
   * disclosure this test was actually written to protect (see the docstring
   * above: `mayClaimOlumiAuthorship` is the wrong gate for it).
   */
  it('⭐ a brief-authored element with an edited number: the structural fact survives in the header', () => {
    const { data } = mapDraftNodeToCanvas(briefAuthoredElementWithAnEditedNumber)
    // Neither authorship predicate is true here — that is the whole point.
    expect(data.source_quote).toBeUndefined()
    expect(data.provenance).toBe('from_brief')

    render(<NodeProvenanceMark nodeType="factor" data={data} />)
    expect(
      marksFor('structural'),
      'the brief-authorship disclosure was silenced — mayClaimOlumiAuthorship is the WRONG gate here',
    ).toHaveLength(1)
    expect(marksFor('value'), 'the value fact is on the value line now, not duplicated in the header').toHaveLength(0)
  })

  it('the same factor WITHOUT a value falls to structural, and is then gated', () => {
    // The twin that proves the discriminator above is about the CLAIM, not the
    // kind: strip the number and the very same node goes silent.
    const { observed_state: _omitted, ...valueless } = valuedFactorWithAmbiguousPair
    const { data } = mapDraftNodeToCanvas(valueless)
    render(<NodeProvenanceMark nodeType="factor" data={data} />)
    expect(screen.queryByTestId('node-provenance-mark')).toBeNull()
  })
})

describe('⭐ and it still says so about Olumi\'s genuine inventions', () => {
  /**
   * ⛔ THE OVER-SUPPRESSION GUARD. A gate that simply went quiet on every
   * `ai_inferred` option would pass the block above and destroy the disclosure.
   * These are REAL captured inventions across five starter captures.
   */
  const allStarterNodes = [
    pricingStarter, buildVsBuyStarter, marketEntryStarter, vendorStarter, headcountStarter,
  ].flatMap((s) => (s as { nodes: WireNode[] }).nodes)

  const capturedInventions = [...optionsOf(allStarterNodes), ...realInventions]
    .filter((n) => n.provenance === 'ai_inferred' && n.source_quote === undefined)

  it('the corpus of real inventions is non-empty and sizeable', () => {
    // An empty corpus would make every assertion below vacuous (trap 13).
    expect(capturedInventions.length).toBeGreaterThanOrEqual(15)
  })

  it('every real invention still shows "Olumi suggested this"', () => {
    for (const node of capturedInventions) {
      cleanup()
      const { data } = mapDraftNodeToCanvas(node)
      render(<NodeProvenanceMark nodeType="option" data={data} />)
      expect(screen.queryByLabelText(OLUMI_CLAIM)).not.toBeNull()
    }
  })

  it('a user-stated option with its quote intact is still not badged as Olumi\'s', () => {
    const { data } = mapDraftNodeToCanvas(realUserStatedOption)
    render(<NodeProvenanceMark nodeType="option" data={data} />)
    expect(screen.queryByLabelText(OLUMI_CLAIM)).toBeNull()
  })
})
