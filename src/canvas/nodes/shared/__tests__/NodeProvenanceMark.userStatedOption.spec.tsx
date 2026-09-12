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
