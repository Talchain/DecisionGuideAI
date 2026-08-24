/**
 * ⭐ AN INVENTED TARGET MUST NOT LOOK LIKE A NUMBER THE USER WROTE (B1-a).
 *
 * ## The defect this file pins, witnessed on the deployed build
 *
 * UI `88cb7e37` · CEE `d1da670`, fresh guest, 2026-08-24. On ONE draw, on ONE
 * factor, the product produced the discriminating pair:
 *
 *   · `cee_hypothesis`   raw 22,500, no unit, `value_confidence: low`,
 *     CEE's own reasoning "this amount is not stated in the brief" → 0.45
 *   · `brief_extraction` raw 45,000, unit `£`, `value_confidence: high`,
 *     reasoning naming `stated_items[3]` verbatim → 0.9
 *
 * Both rendered in the same control, same typography, no unit on either, no
 * badge, icon, colour or tooltip on either. **The only difference between a
 * number Olumi invented and one the user wrote was the digits.**
 *
 * The data was never the problem — every field above is correct on the wire.
 * `unwrapInterventionValue` returned `{value, displayValue}` and threw `source`
 * away at the ONE point every render surface reads an intervention through, so
 * nothing downstream still had the fact to show.
 *
 * ## Why the fixtures are the wire's, verbatim
 *
 * Trap 22: a corpus drawn from the author's head cannot see the class the author
 * did not imagine. Every intervention object below is copied byte-for-byte from
 * `drawA-11-autosave-raw.json` — the canonical client-side model captured from
 * the deployed build — including the two that a fixture written from the defect
 * report would NOT have contained:
 *
 *   1. `raw_value: 0` invented targets. Half the invented interventions on that
 *      draw are ZERO. A guard keyed on "22,500 is missing" sees nothing here.
 *   2. `682a7e2d` — an option whose own `provenance` is `from_brief` and which
 *      nevertheless carries an INVENTED intervention. **Option-level provenance
 *      does not predict intervention-level provenance**, so a disclosure bound
 *      to the option node would be wrong on this row and right on the other two
 *      — the shape of test that passes on the wrong object (trap 19).
 *
 * ## Binding
 *
 * Every value assertion resolves its row BY `factorId` through `within(...)`,
 * never by the digits. `0.45` is a value predicate a different intervention
 * could satisfy, and reading it off the whole pane is precisely how this estate
 * shipped a spec that passed against a factor it was not written for.
 *
 * Every "invented is marked" case has its OPPOSITE-DIRECTION TWIN asserting the
 * user-stated row is NOT marked as invented (trap 22b). The inversion is the
 * live defect on the deployed build — the twin is the load-bearing half.
 */

import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import type { Node } from '@xyflow/react'
import { ModelDetailRegion } from '../ModelDetailRegion'
import { toRowDetail, type ModelProjectionInput } from '../adapters'
import type { ModelRow } from '../types'
import { unwrapInterventionValue } from '../../utils/labelUtils'
import {
  INTERVENTION_PROVENANCE_SOURCES,
  classifyInterventionProvenance,
  classifyValueProvenance,
} from '../../domain/valueProvenance'

// ── The deployed draw, verbatim ──────────────────────────────────────────────

const FACTOR_LICENSING = '440d2e30'
const FACTOR_MIGRATION = 'fd255d32'
const OPTION_PHASED = '6f2c97b3' // option provenance: ai_inferred
const OPTION_STAYING = 'f259d659' // option provenance: from_brief
const OPTION_FULL = '682a7e2d' // option provenance: from_brief — AND carries an invented target

/** `f259d659[440d2e30]` — the user's own £45,000, bound to `stated_items[3]`. */
const IV_STATED_45K = {
  value: 0.9,
  raw_value: 45000,
  unit: '£',
  source: 'brief_extraction',
  target_match: { node_id: FACTOR_LICENSING, match_type: 'exact_id', confidence: 'high' },
  value_confidence: 'high',
  reasoning:
    'Direct causal value bound by edge 3d61e986 to stated_items[3]: our annual Salesforce licensing is £45,000',
}

/** `6f2c97b3[440d2e30]` — the invented 22,500, exactly half the user's figure. */
const IV_INVENTED_22K5 = {
  value: 0.45,
  raw_value: 22500,
  source: 'cee_hypothesis',
  target_match: { node_id: FACTOR_LICENSING, match_type: 'exact_id', confidence: 'high' },
  value_confidence: 'low',
  reasoning: 'Model-chosen intervention level; this amount is not stated in the brief',
}

/** `682a7e2d[440d2e30]` — INVENTED, and sitting on a `from_brief` option. */
const IV_INVENTED_ZERO = {
  value: 0,
  raw_value: 0,
  source: 'cee_hypothesis',
  target_match: { node_id: FACTOR_LICENSING, match_type: 'exact_id', confidence: 'high' },
  value_confidence: 'low',
  reasoning: 'Model-chosen intervention level; this amount is not stated in the brief',
}

/** `682a7e2d[fd255d32]` — the user's own £20,000. */
const IV_STATED_20K = {
  value: 0.4,
  raw_value: 20000,
  unit: '£',
  source: 'brief_extraction',
  target_match: { node_id: FACTOR_MIGRATION, match_type: 'exact_id', confidence: 'high' },
  value_confidence: 'high',
  reasoning:
    'Direct causal value bound by edge 36e4730e to stated_items[2]: A full switch costs £20,000 in migration and training',
}

/**
 * A bare number. The Model tab's own intervention editor commits one of these,
 * and CEE stamps nothing on it — so the honest answer for this row is that the
 * record does not say, and the surface must say nothing rather than guess.
 */
const IV_UNSTAMPED = 0.6

function factorNode(id: string, label: string): Node {
  return {
    id,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: { label, type: 'factor', observedState: { value: 0.9, raw_value: 45000, source: 'cee_inference' } },
  } as unknown as Node
}

/**
 * ⚠ `provenance` IS ON THE FIXTURE AND IT IS LOAD-BEARING, NOT DECORATION.
 *
 * The option node carries its OWN `provenance` on the wire, and a plausible
 * wrong implementation reads the mark off it. Omitting it from the fixture
 * would make that implementation render NOTHING — so the suite would red for
 * the wrong reason and would go green again the moment someone "fixed" the
 * mapping. With it present, the wrong implementation renders CONFIDENTLY and
 * is right on two of the three options, and only the discriminating case can
 * tell the two apart. A fixture that cannot express the wrong answer cannot
 * refute it (trap 19).
 */
function optionNode(
  id: string,
  label: string,
  interventions: Record<string, unknown>,
  provenance?: string,
): Node {
  return {
    id,
    type: 'option',
    position: { x: 0, y: 0 },
    data: { label, type: 'option', interventions, ...(provenance ? { provenance } : {}) },
  } as unknown as Node
}

function projection(): ModelProjectionInput {
  return {
    nodes: [
      factorNode(FACTOR_LICENSING, 'Annual CRM Licensing Cost'),
      factorNode(FACTOR_MIGRATION, 'Migration and Training Cost'),
      optionNode(
        OPTION_PHASED,
        'Phased HubSpot Migration (pilot team first)',
        { [FACTOR_LICENSING]: IV_INVENTED_22K5 },
        'ai_inferred',
      ),
      optionNode(
        OPTION_STAYING,
        'Staying on Salesforce',
        { [FACTOR_LICENSING]: IV_STATED_45K },
        'from_brief',
      ),
      // ⭐ THE DISCRIMINATING OPTION: `from_brief` at the option level, and an
      // INVENTED target inside it. An implementation reading the option node is
      // right on the two above and wrong here.
      optionNode(
        OPTION_FULL,
        'move our whole sales team off Salesforce onto HubSpot this year',
        { [FACTOR_LICENSING]: IV_INVENTED_ZERO, [FACTOR_MIGRATION]: IV_STATED_20K },
        'from_brief',
      ),
    ],
    edges: [],
    goalThreshold: null,
  }
}

function optionRow(id: string, label: string): ModelRow {
  return { id, kind: 'option', group: 'options', label, primaryValue: '1 change', attention: [], editable: true }
}

/** The pill's own copy, keyed off the ONE classifier — never re-spelled here. */
const AI_LABEL = 'AI estimate'
const BRIEF_LABEL = 'From brief'
const ABSENT_LABEL = 'Not set'

function provenanceOf(factorId: string): HTMLElement | null {
  return screen.queryByTestId(`model-detail-v2-intervention-${factorId}-provenance`)
}

// ── 1. The drop point ────────────────────────────────────────────────────────

describe('⭐ unwrapInterventionValue carries the producer’s own source stamp', () => {
  it('keeps `cee_hypothesis` on the invented target', () => {
    expect(unwrapInterventionValue(IV_INVENTED_22K5).source).toBe('cee_hypothesis')
  })

  it('TWIN: keeps `brief_extraction` on the user-stated target', () => {
    expect(unwrapInterventionValue(IV_STATED_45K).source).toBe('brief_extraction')
  })

  it('carries the stamp on a ZERO invented target — the value is not the signal', () => {
    // Half the invented interventions on the witnessed draw are `raw_value: 0`.
    // A carrier keyed on truthiness of the value drops every one of them.
    expect(unwrapInterventionValue(IV_INVENTED_ZERO).source).toBe('cee_hypothesis')
    expect(unwrapInterventionValue(IV_INVENTED_ZERO).value).toBe(0)
  })

  it('reports UNKNOWN as null — never a guessed stamp in either direction', () => {
    expect(unwrapInterventionValue(IV_UNSTAMPED).source).toBeNull()
    expect(unwrapInterventionValue({ value: 0.5 }).source).toBeNull()
    expect(unwrapInterventionValue({ value: 0.5, source: '   ' }).source).toBeNull()
    expect(unwrapInterventionValue({ value: 0.5, source: 42 }).source).toBeNull()
    expect(unwrapInterventionValue(undefined).source).toBeNull()
  })

  it('does not disturb the numeric or display halves it already answered', () => {
    // CONTRAST CONTROL: the additive field must not move the two answers every
    // caller in the tree already depends on.
    expect(unwrapInterventionValue(IV_INVENTED_22K5).value).toBe(0.45)
    expect(unwrapInterventionValue(IV_STATED_45K).value).toBe(0.9)
    expect(unwrapInterventionValue({ value: 0.3, display_value: '  High  ' }).displayValue).toBe('High')
  })
})

// ── 2. The classifier — ONE authority, extended, not duplicated ──────────────

describe('⭐ cee_hypothesis is classified by the ratified authority', () => {
  it('classifies `cee_hypothesis` as the model’s own estimate', () => {
    expect(classifyInterventionProvenance('cee_hypothesis')).toEqual({ kind: 'ai', userOwned: false })
  })

  it('TWIN: `brief_extraction` still classifies to the user’s brief, not to AI', () => {
    expect(classifyInterventionProvenance('brief_extraction')).toEqual({
      kind: 'brief',
      userOwned: false,
    })
  })

  it('classifies `user_specified` as the human’s own, and USER-OWNED', () => {
    expect(classifyInterventionProvenance('user_specified')).toEqual({
      kind: 'edited',
      userOwned: true,
    })
  })

  it('CONTRAST CONTROL: an unknown literal is still refused, not guessed', () => {
    // Without this the three above are satisfiable by a classifier that returns
    // a class for everything — which is the failure mode the module was
    // written to end ("Estimated by Olumi" over a confirmed value).
    expect(classifyInterventionProvenance('cee_hypothesis_v2')).toBeNull()
    expect(classifyInterventionProvenance(undefined)).toBeNull()
  })

  /**
   * ⭐⭐ THE HAND-WRITTEN CORPUS, because no derivation is available here.
   *
   * The vendored contract does not export the intervention literals — it says
   * so itself: *"This package does not carry InterventionV3, so it does not
   * carry that contract's screen either."* So the completeness check that
   * `SOURCE_CLASSES` gets against `OBSERVED_STATE_SOURCE_LITERALS` cannot exist
   * for this map, and a corpus pinned to the contract's own QUOTED enum is what
   * notices the list going short (trap 12d).
   */
  it('⭐ CORPUS: classifies exactly the three literals the contract declares', () => {
    // Quoted verbatim from the vendored 0.48.0 package,
    // `dist/orchestrator/edit-tool-ops.js:235`, citing `cee-v3.ts:284`:
    //   "an enum of `brief_extraction | cee_hypothesis | user_specified`"
    // Asserted as a SET EQUALITY so this REDs if the map GROWS as well as if it
    // shrinks — a corpus that only checks membership cannot see an invention.
    expect([...INTERVENTION_PROVENANCE_SOURCES].sort()).toEqual([
      'brief_extraction',
      'cee_hypothesis',
      'user_specified',
    ])
  })
})

/**
 * ⭐⭐ THE TWO `source` FIELDS ARE DIFFERENT QUESTIONS WEARING ONE NAME.
 *
 * `observed_state.source` asks WHO PUT THIS VALUE HERE. `interventions[f].source`
 * asks HOW THIS TARGET WAS DETERMINED. The vendored contract states the
 * distinction outright and CEE exempts the interventions subtree from its
 * observed-state screen because of it.
 *
 * They OVERLAP on `brief_extraction` and are otherwise disjoint — which is what
 * makes merging them look harmless. This lane tried the merge first: adding
 * `cee_hypothesis` to `SOURCE_CLASSES` typechecks, renders the right words, and
 * REDs `sourceClassesCompleteness` — the one guard that can see contract drift.
 * These cases pin the separation so a future tidy-up cannot quietly re-merge it.
 */
describe('⭐⭐ the two source vocabularies stay apart', () => {
  it('the node classifier REFUSES an intervention-only literal', () => {
    expect(classifyValueProvenance('cee_hypothesis')).toBeNull()
    expect(classifyValueProvenance('user_specified')).toBeNull()
  })

  it('the intervention classifier REFUSES a node-only literal', () => {
    expect(classifyInterventionProvenance('cee_inference')).toBeNull()
    expect(classifyInterventionProvenance('user_confirmed')).toBeNull()
    expect(classifyInterventionProvenance('panel_elicited')).toBeNull()
  })

  it('CONTRAST CONTROL: they agree on the ONE literal both vocabularies declare', () => {
    // Without this the two refusals above are satisfiable by two classifiers
    // that refuse everything — an absence probe with no proof it sees a
    // presence (trap 13).
    expect(classifyValueProvenance('brief_extraction')?.kind).toBe('brief')
    expect(classifyInterventionProvenance('brief_extraction')?.kind).toBe('brief')
  })
})

// ── 3. The projection ────────────────────────────────────────────────────────

describe('⭐ the option projection carries each intervention’s OWN provenance', () => {
  it('stamps the invented target `cee_hypothesis`, bound by factor id', () => {
    const detail = toRowDetail(projection(), OPTION_PHASED)
    const iv = detail?.interventions.find(i => i.factorId === FACTOR_LICENSING)
    expect(iv?.provenanceSource).toBe('cee_hypothesis')
  })

  it('TWIN: stamps the user-stated target `brief_extraction`, bound by factor id', () => {
    const detail = toRowDetail(projection(), OPTION_STAYING)
    const iv = detail?.interventions.find(i => i.factorId === FACTOR_LICENSING)
    expect(iv?.provenanceSource).toBe('brief_extraction')
  })

  it('⭐ reads the INTERVENTION, never the option — one option carries both', () => {
    // `682a7e2d`'s own provenance is `from_brief`, and it carries an invented
    // target anyway. A disclosure bound to the option node reads "from brief"
    // for both rows here and is right twice on the other two options — the
    // exact shape of a guard that passes on the wrong object.
    const detail = toRowDetail(projection(), OPTION_FULL)
    const invented = detail?.interventions.find(i => i.factorId === FACTOR_LICENSING)
    const stated = detail?.interventions.find(i => i.factorId === FACTOR_MIGRATION)
    expect(invented?.provenanceSource).toBe('cee_hypothesis')
    expect(stated?.provenanceSource).toBe('brief_extraction')
  })

  it('leaves an unstamped target UNSTAMPED', () => {
    const input = projection()
    const nodes = input.nodes.map(n =>
      n.id === OPTION_PHASED
        ? optionNode(
            OPTION_PHASED,
            'Phased HubSpot Migration (pilot team first)',
            { [FACTOR_LICENSING]: IV_UNSTAMPED },
            'ai_inferred',
          )
        : n,
    )
    const detail = toRowDetail({ ...input, nodes }, OPTION_PHASED)
    const iv = detail?.interventions.find(i => i.factorId === FACTOR_LICENSING)
    // CONTRAST CONTROL in the same assertion: the row still projects, with its
    // value — so the absence below is a missing STAMP, not a missing row.
    expect(iv).toBeDefined()
    expect(iv?.numericValue).toBe(0.6)
    expect(iv?.provenanceSource).toBeUndefined()
  })
})

// ── 4. The surface — what the user actually reads ────────────────────────────

describe('⭐ the detail region marks an invented target where the number is read', () => {
  it('shows "AI estimate" on the invented row', () => {
    const detail = toRowDetail(projection(), OPTION_PHASED)!
    render(
      <ModelDetailRegion
        row={optionRow(OPTION_PHASED, 'Phased HubSpot Migration (pilot team first)')}
        detail={detail}
        tier="plain"
      />,
    )
    expect(within(provenanceOf(FACTOR_LICENSING)!).getByText(AI_LABEL)).toBeInTheDocument()
  })

  it('⭐ TWIN: the user-stated row says "From brief" and is NOT marked as invented', () => {
    // The load-bearing half. On the deployed build the product does the exact
    // inverse elsewhere — it labels the user's own £45,000 "AI estimate" and
    // tells them to check it first. Marking invention without this twin would
    // leave that failure mode wide open on this surface too.
    const detail = toRowDetail(projection(), OPTION_STAYING)!
    render(
      <ModelDetailRegion
        row={optionRow(OPTION_STAYING, 'Staying on Salesforce')}
        detail={detail}
        tier="plain"
      />,
    )
    const cell = provenanceOf(FACTOR_LICENSING)!
    expect(within(cell).getByText(BRIEF_LABEL)).toBeInTheDocument()
    expect(within(cell).queryByText(AI_LABEL)).toBeNull()
  })

  it('⭐ marks BOTH rows correctly on the same pane, each by its own stamp', () => {
    // The discriminating case, rendered: one option, two rows, opposite marks.
    // A surface reading the option node would render the same word twice.
    const detail = toRowDetail(projection(), OPTION_FULL)!
    render(
      <ModelDetailRegion
        row={optionRow(OPTION_FULL, 'move our whole sales team off Salesforce onto HubSpot this year')}
        detail={detail}
        tier="plain"
      />,
    )
    expect(within(provenanceOf(FACTOR_LICENSING)!).getByText(AI_LABEL)).toBeInTheDocument()
    expect(within(provenanceOf(FACTOR_MIGRATION)!).getByText(BRIEF_LABEL)).toBeInTheDocument()
    expect(within(provenanceOf(FACTOR_LICENSING)!).queryByText(BRIEF_LABEL)).toBeNull()
    expect(within(provenanceOf(FACTOR_MIGRATION)!).queryByText(AI_LABEL)).toBeNull()
  })

  it('marks the ZERO invented target too — the mark tracks the stamp, not the digits', () => {
    const detail = toRowDetail(projection(), OPTION_FULL)!
    render(
      <ModelDetailRegion
        row={optionRow(OPTION_FULL, 'full switch')}
        detail={detail}
        tier="plain"
      />,
    )
    // CONTRAST CONTROL: the value itself renders, and it is the falsy one.
    expect(
      screen.getByTestId(`model-detail-v2-intervention-${FACTOR_LICENSING}-value`),
    ).toHaveTextContent('0')
    expect(within(provenanceOf(FACTOR_LICENSING)!).getByText(AI_LABEL)).toBeInTheDocument()
  })

  it('⭐ says NOTHING for an unstamped target — unknown stays unknown', () => {
    const input = projection()
    const nodes = input.nodes.map(n =>
      n.id === OPTION_PHASED
        ? optionNode(OPTION_PHASED, 'Phased', { [FACTOR_LICENSING]: IV_UNSTAMPED }, 'ai_inferred')
        : n,
    )
    const detail = toRowDetail({ ...input, nodes }, OPTION_PHASED)!
    render(<ModelDetailRegion row={optionRow(OPTION_PHASED, 'Phased')} detail={detail} tier="plain" />)
    // Neither claim, and not the pill's "Not set" fallback either: "Not set"
    // is a statement about the VALUE, and the value is set — it is the
    // provenance that is unrecorded. Asserting it in all three directions is
    // what stops "no source" quietly becoming "AI estimate" or "From brief".
    const row = screen.getByTestId(`model-detail-v2-intervention-${FACTOR_LICENSING}`)
    expect(within(row).queryByText(AI_LABEL)).toBeNull()
    expect(within(row).queryByText(BRIEF_LABEL)).toBeNull()
    expect(within(row).queryByText(ABSENT_LABEL)).toBeNull()
    // CONTRAST CONTROL: the row is there and shows its value, so the three
    // absences above are not the absence of the whole row (trap 13).
    expect(
      screen.getByTestId(`model-detail-v2-intervention-${FACTOR_LICENSING}-value`),
    ).toHaveTextContent('0.6')
  })

  it('the mark is TEXT, not colour alone', () => {
    const detail = toRowDetail(projection(), OPTION_PHASED)!
    render(<ModelDetailRegion row={optionRow(OPTION_PHASED, 'Phased')} detail={detail} tier="plain" />)
    // A border-colour-only distinction is invisible to a monochrome reader and
    // to anyone who cannot compare two rows side by side.
    expect(provenanceOf(FACTOR_LICENSING)!.textContent?.trim()).toBe(AI_LABEL)
  })

  it('the mark is visible in PLAIN — it is not an Advanced parameter', () => {
    // Trap 3b at tier grain: a disclosure that only exists behind the Advanced
    // toggle is a disclosure most users never load.
    const detail = toRowDetail(projection(), OPTION_PHASED)!
    const { rerender } = render(
      <ModelDetailRegion row={optionRow(OPTION_PHASED, 'Phased')} detail={detail} tier="plain" />,
    )
    expect(provenanceOf(FACTOR_LICENSING)).not.toBeNull()
    rerender(<ModelDetailRegion row={optionRow(OPTION_PHASED, 'Phased')} detail={detail} tier="advanced" />)
    expect(provenanceOf(FACTOR_LICENSING)).not.toBeNull()
  })
})

// ── 5. "Where it came from" stops promising an answer it does not have ───────

describe('an empty "Where it came from" is an absence, and renders as one', () => {
  it('does not render the heading when there is nothing under it', () => {
    // The witnessed defect: on an option the heading rendered with NOTHING
    // beneath it — a section announcing that provenance was looked for and
    // none exists, on the exact element whose provenance is the finding.
    const detail = toRowDetail(projection(), OPTION_PHASED)!
    expect(detail.basis).toBeNull()
    expect(detail.adjustments).toHaveLength(0)
    render(<ModelDetailRegion row={optionRow(OPTION_PHASED, 'Phased')} detail={detail} tier="plain" />)
    expect(screen.queryByTestId('model-detail-v2-provenance')).toBeNull()
    expect(screen.queryByText('Where it came from')).toBeNull()
  })

  it('POSITIVE CONTROL: it still renders when it HAS something to say', () => {
    const detail = toRowDetail(projection(), OPTION_PHASED)!
    render(
      <ModelDetailRegion
        row={{ ...optionRow(OPTION_PHASED, 'Phased'), provenanceSource: 'brief_extraction' }}
        detail={detail}
        tier="plain"
      />,
    )
    expect(screen.getByTestId('model-detail-v2-provenance')).toBeInTheDocument()
    expect(screen.getByText('Where it came from')).toBeInTheDocument()
  })
})
