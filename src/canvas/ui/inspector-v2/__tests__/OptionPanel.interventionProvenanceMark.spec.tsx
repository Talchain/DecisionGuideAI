/**
 * ⭐ AN INVENTED TARGET MUST NOT LOOK LIKE A NUMBER THE USER WROTE — **ON THE
 * INSPECTOR** (B1-b).
 *
 * ── WHY THIS FILE EXISTS WHEN #827 ALREADY CLOSED THIS ────────────────────
 * UI #827 closes the defect on the **Model tab**. An independent review of it
 * put the residual in one sentence:
 *
 *     "On the Model tab, yes. On the Inspector — the surface the defect was
 *      witnessed on — no."
 *
 * The Inspector is reached by DOUBLE-CLICKING A NODE ON THE CANVAS, arguably
 * before anyone opens the Model tab at all. Its live path is
 * `ReactFlowGraph.tsx:2334` → `InspectorModal` (`USE_INSPECTOR_V2 = true`,
 * hardcoded at `InspectorModal.tsx:16`) → the v2 branch at `:159` →
 * `InspectorRouter` (`NODE_PANELS.option`) → `OptionPanel`. And at
 * `OptionPanel.tsx:118` it read:
 *
 *     const { value, displayValue } = unwrapInterventionValue(rawValue)
 *
 * **`source` was dropped at the destructure.** #827 had already made
 * `unwrapInterventionValue` carry it; this surface simply did not take it, so
 * `InterventionRow` received no provenance and rendered the number bare — an
 * invented `0.45` and the user's own `0.9` in identical controls, no badge, no
 * tooltip, no unit on either. The only difference between them was the digits.
 *
 * ── ⚠⚠ WHY NOT `getExtractionLabel`, WHICH THIS SURFACE ALREADY OWNS ──────
 * DERIVED, not assumed, at `valueProvenance.ts` and `inspectorStrings.ts` on
 * this tip. `getExtractionLabel` classifies through `classifyValueProvenance` —
 * the **node** `observed_state.source` vocabulary. Two of the three intervention
 * literals are not members of it:
 *
 *   · `cee_hypothesis`  → unclassified → default arm → "Estimated by Olumi"
 *     (accidentally right, for the wrong reason)
 *   · `user_specified`  → unclassified → default arm → **"Estimated by Olumi"**
 *     — ⭐ THE MACHINE CLAIMING AUTHORSHIP OF A NUMBER THE USER TYPED. That is
 *     the exact inversion this lane is forbidden to ship, and reusing the
 *     surface's existing helper is how it would have arrived.
 *
 * The two vocabularies overlap on `brief_extraction` ONLY, which is what makes
 * the reuse look harmless and is why it is not (CLAUDE.md trap 21 — two
 * authorities answering different questions under one field name). T-VOCAB below
 * pins that inversion so nobody "simplifies" this back.
 *
 * ── HOW THIS FILE BINDS ──────────────────────────────────────────────────
 * · ⭐ MOUNTS `InspectorModal`, THE DEPLOYED PATH, never `OptionPanel` directly.
 *   #827's reviewer noted that its own spec renders its component directly and
 *   so does not pin its mount — a future default change could dark-ship the mark
 *   under a green suite (trap 3b). T-MOUNT asserts the chain itself.
 * · Every row is resolved BY `factorId` through `within(...)`. `0.45` is a value
 *   predicate a different intervention could satisfy, and reading a number off
 *   the whole pane is precisely how this estate shipped a spec that passed
 *   against a factor it was not written for (trap 19).
 * · Every "invented is marked" case has its OPPOSITE-DIRECTION TWIN: the
 *   user-stated row must NOT carry the invented mark, and the unstamped row must
 *   carry NOTHING AT ALL — not "Not set", which is a claim about the value, and
 *   the value is set (trap 22b).
 * · Expected user-facing strings are written LITERALLY here. The separate
 *   agreement guard (T-VOICE) compares the register against `getExtractionLabel`
 *   — a different module, driven by a different vocabulary — so it is a
 *   derivation, not a constant agreeing with itself, and it PINS ITS OWN
 *   PRECONDITION before comparing (trap 13b).
 *
 * ── WHY THE FIXTURES ARE THE WIRE'S, VERBATIM ────────────────────────────
 * Trap 22: a corpus from the author's head cannot see the class the author did
 * not imagine. The intervention objects are #827's, which are the deployed
 * draw's (UI `88cb7e37` · CEE `d1da670`, fresh guest, 2026-08-24) — including
 * the two a fixture written from the defect report would not have contained:
 * `raw_value: 0` invented targets, and an option whose OWN `provenance` is
 * `from_brief` while carrying an invented intervention.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { InspectorModal } from '../../../components/InspectorModal'
import { useCanvasStore } from '../../../store'
import {
  INSPECTOR_INTERVENTION_PROVENANCE_LABEL,
  InterventionRow,
} from '../shared/InterventionRow'
import { getExtractionLabel } from '../inspectorStrings'
import {
  INTERVENTION_PROVENANCE_SOURCES,
  classifyInterventionProvenance,
  classifyValueProvenance,
  type ValueProvenanceKind,
} from '../../../domain/valueProvenance'

// importOriginal-spread, NOT a hand-listed factory: `vi.mock` REPLACES the
// module, so a bare `{ useViewport }` factory silently removes every other
// @xyflow/react export the subtree imports (CLAUDE.md trap 12).
vi.mock('@xyflow/react', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
}))

// ── Identity anchors — the deployed v2 mount path ────────────────────────────
const NODE_INSPECTOR = 'div[role="dialog"][aria-label="Node inspector"]'
const INSPECTOR_SHELL = '[role="region"][aria-label="Inspector panel"]'

// ── The deployed draw's ids, verbatim from #827's fixtures ───────────────────
const OPTION_ID = '6f2c97b3'
const OPTION_LABEL = 'Phased migration'
/** `682a7e2d` — `provenance: 'from_brief'` AND carries an invented target. */
const OPTION_FROM_BRIEF_ID = '682a7e2d'
const OPTION_FROM_BRIEF_LABEL = 'Full switch'

const FACTOR_LICENSING = '440d2e30'
const FACTOR_LICENSING_LABEL = 'Annual licensing spend'
const FACTOR_MIGRATION = 'fd255d32'
const FACTOR_MIGRATION_LABEL = 'Migration and training cost'
const FACTOR_UNSTAMPED = 'aa11bb22'
const FACTOR_UNSTAMPED_LABEL = 'Support headcount'

// ── The wire's intervention objects, verbatim ────────────────────────────────

/** The invented 22,500 — exactly half the user's figure, no unit. */
const IV_INVENTED_22K5 = {
  value: 0.45,
  raw_value: 22500,
  source: 'cee_hypothesis',
  target_match: { node_id: FACTOR_LICENSING, match_type: 'exact_id', confidence: 'high' },
  value_confidence: 'low',
  reasoning: 'Model-chosen intervention level; this amount is not stated in the brief',
}

/** INVENTED, and `raw_value: 0` — half the invented targets on that draw are zero. */
const IV_INVENTED_ZERO = {
  value: 0,
  raw_value: 0,
  source: 'cee_hypothesis',
  target_match: { node_id: FACTOR_LICENSING, match_type: 'exact_id', confidence: 'high' },
  value_confidence: 'low',
  reasoning: 'Model-chosen intervention level; this amount is not stated in the brief',
}

/** The user's own £45,000, bound to `stated_items[3]`. */
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

/** The user's own £20,000. */
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

/** The human supplied this target directly. */
const IV_USER_SPECIFIED = {
  value: 0.75,
  raw_value: 37500,
  unit: '£',
  source: 'user_specified',
  target_match: { node_id: FACTOR_MIGRATION, match_type: 'exact_id', confidence: 'high' },
  value_confidence: 'high',
}

/**
 * A bare number. The Inspector's OWN intervention editor commits one of these
 * (`mutations.setIntervention(factorId, v)`), and nothing stamps it — so the
 * honest answer for this row is that the record does not say.
 */
const IV_UNSTAMPED = 0.6

// ── The exact sentences a user reads. Written literally, never imported. ─────
const MARK_AI = 'Estimated by Olumi'
const MARK_BRIEF = 'From your brief'
const MARK_EDITED = 'Set by you'

// ── Store harness ────────────────────────────────────────────────────────────

function factorNode(id: string, label: string, observed?: Record<string, unknown>) {
  return {
    id,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: {
      kind: 'factor',
      category: 'controllable',
      label,
      ...(observed === undefined ? {} : { observedState: observed }),
    },
  }
}

function optionNode(
  id: string,
  label: string,
  interventions: Record<string, unknown>,
  provenance = 'ai_inferred',
) {
  return {
    id,
    type: 'option',
    position: { x: 0, y: 0 },
    data: { kind: 'option', label, provenance, interventions },
  }
}

function seedStore(nodes: unknown[]) {
  useCanvasStore.setState({
    nodes: nodes as never[],
    edges: [],
    results: { status: 'idle' },
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: { x: 0, y: 0 } },
    goalThreshold: null,
    confirmedNodeIds: new Set(),
    _internal: {},
  } as never)
}

/** Mounts the DEPLOYED inspector chain and PROVES IT OPENED before returning. */
function openInspector(nodeId: string) {
  const utils = render(<InspectorModal nodeId={nodeId} edgeId={null} onClose={vi.fn()} />)

  const dialog = utils.container.querySelector(NODE_INSPECTOR)
  expect(dialog, 'PRECONDITION: the node inspector dialog must be mounted').not.toBeNull()
  expect(
    utils.container.querySelector(INSPECTOR_SHELL),
    'PRECONDITION: the InspectorShell must have rendered inside it',
  ).not.toBeNull()

  return { ...utils, dialog: dialog as HTMLElement }
}

/**
 * The one intervention row for `factorId` — bound by IDENTITY.
 *
 * ⚠ Never `getByText('0.45')`. A second intervention on the same option can
 * carry the same digits, and then the assertion is about whichever the query
 * reached first (trap 19).
 */
function row(dialog: HTMLElement, factorId: string): HTMLElement {
  return within(dialog).getByTestId(`inspector-intervention-${factorId}`)
}

/** The provenance mark inside that row, or null when the surface says nothing. */
function mark(dialog: HTMLElement, factorId: string): HTMLElement | null {
  return within(row(dialog, factorId)).queryByTestId(
    `inspector-intervention-${factorId}-provenance`,
  )
}

/** The complete visible text of one row — what a user actually reads. */
function rowText(dialog: HTMLElement, factorId: string): string {
  return row(dialog, factorId).textContent ?? ''
}

beforeEach(() => {
  vi.clearAllMocks()
  seedStore([])
})

// ─────────────────────────────────────────────────────────────────────────────

describe('B1-b — the Inspector says who chose each target', () => {
  // ── The mount path itself ──────────────────────────────────────────────────

  it('⭐⭐ T-MOUNT the DEPLOYED chain renders OptionPanel, and the mark is on it', () => {
    // Trap 3b: a spec that renders `OptionPanel` directly is green whatever the
    // router or the `USE_INSPECTOR_V2` default does. This one drives
    // `InspectorModal` — the component `ReactFlowGraph.tsx:2334` mounts — so a
    // flag flip, a router arm change, or a panel swap RED s here rather than
    // dark-shipping the mark under a green suite.
    seedStore([
      factorNode(FACTOR_LICENSING, FACTOR_LICENSING_LABEL),
      optionNode(OPTION_ID, OPTION_LABEL, { [FACTOR_LICENSING]: IV_INVENTED_22K5 }),
    ])
    const { dialog } = openInspector(OPTION_ID)

    // The panel that actually mounted is the OPTION panel, identified by its own
    // group heading, not by anything this test rendered.
    expect(
      within(dialog).getByText(OPTION_LABEL),
      'PRECONDITION: the OPTION inspector is what opened',
    ).toBeTruthy()
    expect(
      within(dialog).getByText('What this option changes'),
      "PRECONDITION: OptionPanel's own Input group must be on screen",
    ).toBeTruthy()

    expect(mark(dialog, FACTOR_LICENSING)?.textContent).toBe(MARK_AI)
  })

  // ── The defect, and both of its twins ─────────────────────────────────────

  it('⭐⭐ T1 an INVENTED target is marked as the model’s own estimate', () => {
    seedStore([
      factorNode(FACTOR_LICENSING, FACTOR_LICENSING_LABEL),
      optionNode(OPTION_ID, OPTION_LABEL, { [FACTOR_LICENSING]: IV_INVENTED_22K5 }),
    ])
    const { dialog } = openInspector(OPTION_ID)

    expect(mark(dialog, FACTOR_LICENSING)?.textContent).toBe(MARK_AI)
    // Mark by TEXT, not colour alone — the sentence is in the row's own text.
    expect(rowText(dialog, FACTOR_LICENSING)).toContain(MARK_AI)
  })

  it('⭐⭐ T2 TWIN — the user’s OWN stated figure is NOT marked as invented', () => {
    // The load-bearing half. Marking everything would satisfy T1 and reproduce
    // the defect in the opposite direction, which is the worse one: the product
    // disowning a number its user wrote.
    seedStore([
      factorNode(FACTOR_LICENSING, FACTOR_LICENSING_LABEL),
      optionNode(OPTION_ID, OPTION_LABEL, { [FACTOR_LICENSING]: IV_STATED_45K }),
    ])
    const { dialog } = openInspector(OPTION_ID)

    expect(mark(dialog, FACTOR_LICENSING)?.textContent).toBe(MARK_BRIEF)
    expect(rowText(dialog, FACTOR_LICENSING)).not.toContain(MARK_AI)
  })

  it('⭐⭐ T3 TWIN — an UNSTAMPED target renders NOTHING, not a fallback', () => {
    // Not "AI estimate". Not "From brief". And not "Not set" — that is a claim
    // about the VALUE, and the value is set. Unknown stays unknown.
    seedStore([
      factorNode(FACTOR_UNSTAMPED, FACTOR_UNSTAMPED_LABEL),
      optionNode(OPTION_ID, OPTION_LABEL, { [FACTOR_UNSTAMPED]: IV_UNSTAMPED }),
    ])
    const { dialog } = openInspector(OPTION_ID)

    // PRECONDITION: the row itself is on screen, so the absence below is about
    // the mark and not about an empty panel (trap 13 — an absence assertion
    // needs to prove it could have seen a presence).
    expect(within(row(dialog, FACTOR_UNSTAMPED)).getByText(FACTOR_UNSTAMPED_LABEL)).toBeTruthy()

    expect(mark(dialog, FACTOR_UNSTAMPED)).toBeNull()
    const text = rowText(dialog, FACTOR_UNSTAMPED)
    expect(text).not.toContain(MARK_AI)
    expect(text).not.toContain(MARK_BRIEF)
    expect(text).not.toContain(MARK_EDITED)
    expect(text).not.toContain('Not set')
  })

  it('⭐⭐ T4 the two are DISCRIMINATED SIDE BY SIDE on one option', () => {
    // The witnessed defect in one frame: an invented target and a user-stated
    // one, on the same option, in the same control. Each resolved by factorId.
    seedStore([
      factorNode(FACTOR_LICENSING, FACTOR_LICENSING_LABEL),
      factorNode(FACTOR_MIGRATION, FACTOR_MIGRATION_LABEL),
      factorNode(FACTOR_UNSTAMPED, FACTOR_UNSTAMPED_LABEL),
      optionNode(OPTION_ID, OPTION_LABEL, {
        [FACTOR_LICENSING]: IV_INVENTED_22K5,
        [FACTOR_MIGRATION]: IV_STATED_20K,
        [FACTOR_UNSTAMPED]: IV_UNSTAMPED,
      }),
    ])
    const { dialog } = openInspector(OPTION_ID)

    expect(mark(dialog, FACTOR_LICENSING)?.textContent).toBe(MARK_AI)
    expect(mark(dialog, FACTOR_MIGRATION)?.textContent).toBe(MARK_BRIEF)
    expect(mark(dialog, FACTOR_UNSTAMPED)).toBeNull()

    // …and no row borrows another row's answer.
    expect(rowText(dialog, FACTOR_MIGRATION)).not.toContain(MARK_AI)
    expect(rowText(dialog, FACTOR_LICENSING)).not.toContain(MARK_BRIEF)
  })

  it('⭐⭐ T5 a `raw_value: 0` invented target is marked too', () => {
    // Half the invented targets on the witnessed draw are ZERO. A guard keyed on
    // the value being truthy — or on "22,500 is missing" — sees nothing here.
    seedStore([
      factorNode(FACTOR_LICENSING, FACTOR_LICENSING_LABEL),
      optionNode(OPTION_ID, OPTION_LABEL, { [FACTOR_LICENSING]: IV_INVENTED_ZERO }),
    ])
    const { dialog } = openInspector(OPTION_ID)

    expect(mark(dialog, FACTOR_LICENSING)?.textContent).toBe(MARK_AI)
  })

  it('⭐⭐ T6 provenance is the INTERVENTION’s, never the OPTION’s', () => {
    // Option `682a7e2d` is `provenance: 'from_brief'` and carries an INVENTED
    // target beside a brief-extracted one. A disclosure sourced from the option
    // node is right on two of that draw's three options and wrong on this one —
    // a claim that passes on the wrong object (trap 19).
    seedStore([
      factorNode(FACTOR_LICENSING, FACTOR_LICENSING_LABEL),
      factorNode(FACTOR_MIGRATION, FACTOR_MIGRATION_LABEL),
      optionNode(
        OPTION_FROM_BRIEF_ID,
        OPTION_FROM_BRIEF_LABEL,
        { [FACTOR_LICENSING]: IV_INVENTED_ZERO, [FACTOR_MIGRATION]: IV_STATED_20K },
        'from_brief',
      ),
    ])
    const { dialog } = openInspector(OPTION_FROM_BRIEF_ID)

    expect(mark(dialog, FACTOR_LICENSING)?.textContent).toBe(MARK_AI)
    expect(mark(dialog, FACTOR_MIGRATION)?.textContent).toBe(MARK_BRIEF)
  })

  it('⭐⭐ T-VOCAB `user_specified` reads as the USER’s, and the surface’s own helper would have inverted it', () => {
    // ⭐ THE REASON THIS LANE DOES NOT REUSE `getExtractionLabel`, asserted
    // rather than argued. Both halves run: the inversion is REAL on this tip,
    // and the shipped mark does not commit it.
    expect(
      classifyValueProvenance('user_specified'),
      'PRECONDITION: `user_specified` is NOT a node observed_state.source literal',
    ).toBeNull()
    expect(
      getExtractionLabel('user_specified'),
      "the surface's node-vocabulary helper credits the machine for the user's own number",
    ).toBe(MARK_AI)

    seedStore([
      factorNode(FACTOR_MIGRATION, FACTOR_MIGRATION_LABEL),
      optionNode(OPTION_ID, OPTION_LABEL, { [FACTOR_MIGRATION]: IV_USER_SPECIFIED }),
    ])
    const { dialog } = openInspector(OPTION_ID)

    expect(mark(dialog, FACTOR_MIGRATION)?.textContent).toBe(MARK_EDITED)
    expect(rowText(dialog, FACTOR_MIGRATION)).not.toContain(MARK_AI)
  })

  it('⭐ T7 the mark survives a CEE-authored `display_value`, which hides the numeric control', () => {
    // `InterventionRow` swaps its whole numeric surface out when CEE supplies a
    // `display_value` (the F.6 passthrough). A mark hung off the numeric branch
    // would vanish on exactly the rows CEE has written prose for. Enumerating
    // EVERY path that reaches the marking is the review-doctrine rule.
    seedStore([
      factorNode(FACTOR_LICENSING, FACTOR_LICENSING_LABEL),
      optionNode(OPTION_ID, OPTION_LABEL, {
        [FACTOR_LICENSING]: { ...IV_INVENTED_22K5, display_value: 'halve licensing spend' },
      }),
    ])
    const { dialog } = openInspector(OPTION_ID)

    expect(
      within(row(dialog, FACTOR_LICENSING)).getByText('halve licensing spend'),
      'PRECONDITION: the display_value branch is the one that rendered',
    ).toBeTruthy()
    expect(mark(dialog, FACTOR_LICENSING)?.textContent).toBe(MARK_AI)
  })

  it('⭐ T8 SCOPING — a factor node with the same observedState source gets no intervention mark', () => {
    // Positive control on the negative: the mark is an OPTION-panel affordance
    // about interventions, not a general provenance badge that follows a
    // literal around the Inspector.
    seedStore([
      factorNode(FACTOR_LICENSING, FACTOR_LICENSING_LABEL, {
        value: 0.45,
        source: 'brief_extraction',
      }),
    ])
    const { dialog } = openInspector(FACTOR_LICENSING)

    expect(
      within(dialog).getByText(FACTOR_LICENSING_LABEL),
      'PRECONDITION: the factor inspector really did open',
    ).toBeTruthy()
    expect(
      within(dialog).queryByTestId(`inspector-intervention-${FACTOR_LICENSING}-provenance`),
    ).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('B1-b — the register is this surface’s existing voice, derived', () => {
  it('⭐⭐ T-VOICE every reachable arm equals what this surface already says', () => {
    // ⚠ NOT a constant agreeing with itself. `getExtractionLabel` lives in a
    // different module and is driven by the NODE vocabulary; this asserts the
    // intervention mark speaks the Inspector's existing words rather than
    // inventing a fourth register for the same concept (trap 12). Every pair
    // PINS ITS OWN PRECONDITION first, so an arm cannot pass by both sides
    // falling through to the same default (trap 13b).
    const pairs: ReadonlyArray<readonly [ValueProvenanceKind, string]> = [
      ['brief', 'brief_extraction'],
      ['ai', 'cee_inference'],
      ['edited', 'user_override'],
      ['confirmed', 'user_confirmed'],
      ['assumption', 'user_assumption'],
      ['panel', 'panel_elicited'],
    ]

    for (const [kind, nodeLiteral] of pairs) {
      expect(
        classifyValueProvenance(nodeLiteral)?.kind,
        `PRECONDITION: '${nodeLiteral}' must really classify to '${kind}', or the comparison below is two defaults agreeing`,
      ).toBe(kind)
      expect(
        INSPECTOR_INTERVENTION_PROVENANCE_LABEL[kind],
        `the intervention mark for '${kind}' must speak this surface's existing words`,
      ).toBe(getExtractionLabel(nodeLiteral))
    }

    // `human` has NO `observed_state.source` literal on this tip, so it cannot
    // be derived the same way. Stated rather than quietly skipped: it shares
    // `edited`'s copy, exactly as `inspectorStrings`' own register does.
    expect(
      INTERVENTION_PROVENANCE_SOURCES.every(s => classifyInterventionProvenance(s)?.kind !== 'human'),
      "PRECONDITION: no intervention literal reaches 'human' on this tip",
    ).toBe(true)
    expect(INSPECTOR_INTERVENTION_PROVENANCE_LABEL.human).toBe(
      INSPECTOR_INTERVENTION_PROVENANCE_LABEL.edited,
    )
  })

  it('⭐⭐ T-REACH the reachable kinds are exactly {brief, ai, edited}', () => {
    // A DERIVED guard, not a mirror: it reads the classifier's own literal list.
    // If a schemas minor adds an intervention source — or remaps one — this REDs
    // and somebody has to look at the copy, instead of a new kind arriving
    // silently on an arm nobody has read since it was typed.
    const reachable = new Set(
      INTERVENTION_PROVENANCE_SOURCES.map(s => classifyInterventionProvenance(s)?.kind),
    )
    expect([...reachable].sort()).toEqual(['ai', 'brief', 'edited'])

    // …and the contract's own three literals are all of them (trap 12d — where
    // you cannot derive, a hand-written corpus is what notices the list is
    // short; the enum is `cee-v3.ts:284`, quoted in `valueProvenance.ts`).
    expect([...INTERVENTION_PROVENANCE_SOURCES].sort()).toEqual([
      'brief_extraction',
      'cee_hypothesis',
      'user_specified',
    ])
  })

  it('⭐ T-NULL an unknown literal classifies to nothing and renders nothing', () => {
    expect(classifyInterventionProvenance('cee_repair')).toBeNull()
    expect(classifyInterventionProvenance('')).toBeNull()
    expect(classifyInterventionProvenance(undefined)).toBeNull()

    // …and the row proves the component honours that rather than guessing.
    // `InterventionRow` is rendered directly HERE, and only here, because this
    // is a claim about the COMPONENT's contract; the user-facing claims above
    // all go through the deployed mount.
    const { container } = render(
      <InterventionRow
        factorId={FACTOR_LICENSING}
        factorLabel={FACTOR_LICENSING_LABEL}
        currentValue={0.45}
        provenanceSource="cee_repair"
        onChange={vi.fn()}
      />,
    )
    expect(
      container.querySelector(`[data-testid="inspector-intervention-${FACTOR_LICENSING}"]`),
      'PRECONDITION: the row rendered',
    ).not.toBeNull()
    expect(
      container.querySelector(
        `[data-testid="inspector-intervention-${FACTOR_LICENSING}-provenance"]`,
      ),
    ).toBeNull()
    expect(container.textContent).not.toContain(MARK_AI)
    expect(container.textContent).not.toContain('cee_repair')
  })
})

// A cheap guard against the failure mode that makes every number above a lie:
// a spec that collected zero tests still exits 0 (CLAUDE.md standing brief).
describe('B1-b — instrument', () => {
  it('screen is real (the harness collected and ran)', () => {
    expect(typeof screen.queryByTestId).toBe('function')
  })
})
