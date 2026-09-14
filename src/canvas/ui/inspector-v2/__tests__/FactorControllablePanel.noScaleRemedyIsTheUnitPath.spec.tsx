/**
 * ⭐ THE REMEDY THIS PANEL NAMES MUST BE ONE THE ASSISTANT CAN ACTUALLY PERFORM.
 *
 * ── THE DEFECT ────────────────────────────────────────────────────────────
 * The no-scale disclosure used to end "Ask Olumi to set the range it can move
 * between." A journey witness asked exactly that, twice, in natural language,
 * and the deployed assistant declined both times — "I can't currently store a
 * movable range like 0 to 100 on it." The user did precisely what the product
 * told them to do and was refused.
 *
 * It is not a model failing. No range editor is reachable anywhere in the
 * product: `model-tab-v2/contracts.ts` declares `proposePriorRange` with ZERO
 * implementations. The sibling surface for this same defect class
 * (`model-tab-v2/ModelRowView.tsx`'s `NO_RANGE_NOTICE`) had already reached
 * that conclusion and WITHHOLDS a remedy on exactly this ground — its own spec
 * bans the literals 'add a range' and 'set a range'. This panel was the
 * unsupported side of that disagreement.
 *
 * ── WHAT DOES WORK, DERIVED AT THE BYTES IN CEE (`staging` d9b06ea8) ───────
 * The analysis gate is `findScaleIncoherentBaselineFactorIds`
 * (`orchestrator-v5/tools/plot-intervention-scale.ts:813`). A value stated WITH
 * A PERCENT UNIT clears it:
 *   · the router is told to send `{ value, unit, cap? }` and is given the
 *     worked example "set churn to 5%" (`routing/tool-schema.ts:231-239`), so
 *     the phrasing is one the assistant already recognises;
 *   · `parseProposalValue` sets `inputHasUnit` (`set-factor-value.ts:199-215`);
 *   · `normaliseFactorValue`'s unit limb calls `unitPinnedScaleFrame`
 *     (`d1-shared/normalise-factor-value.ts:293-300`), which pins frame 100 for
 *     percent (`cee/draft/records/unit-scale-class.ts:363`), so "12%" is
 *     written `{raw_value: 12, value: 0.12}`;
 *   · the gate then exempts at `plot-intervention-scale.ts:839`
 *     (`baseline ∈ [0,1]`) and the run proceeds.
 * CEE pins that whole walk in
 * `handlers/__tests__/stated-unit-scale-survives-to-analysis.test.ts`.
 *
 * ⛔ AND WHY THE COPY MUST NOT GENERALISE TO "TELL OLUMI WHAT IT IS MEASURED
 * IN". `unitPinnedScaleFrame` pins percent and basis points AND NOTHING ELSE
 * (`unit-scale-class.ts:363-364`). A currency or a count classes `unknown`, is
 * written raw, and the gate still refuses — the same CEE spec pins that as its
 * opposite-direction twin. Worse, ANY unit makes `factorValueHasNoUsableScale`
 * return false, so a general instruction would make this disclosure VANISH
 * while the analysis went on refusing: a strictly worse dead end than the one
 * being fixed. CASE 3 below is the guard against that regression.
 *
 * ⚠ ASSERTIONS BIND BY IDENTITY. Every assertion reads the text of the element
 * carrying the exact test id `factor-value-no-scale`, never panel prose that
 * another message could satisfy (CLAUDE.md trap 19). The panel renders several
 * other "Ask Olumi to …" sentences; a substring assertion over the container
 * would pass on any of them.
 *
 * ⚠ THIS SPEC PINS COPY, AND SPELLS THE SENTENCE OUT RATHER THAN IMPORTING A
 * CONSTANT. Importing the component's own string would compare the component
 * against itself and pass on any wording, including the wording just removed
 * (the reasoning `ModelRowView.tsx:1309-1312` records for its own notice).
 *
 * ══ WHAT AN INDEPENDENT RE-REVIEW FOUND, AND WHY CASES 4 AND 5 EXIST ═══════
 *
 * ⛔ 1. THE BOUND. The first draft said "If it is a percentage, tell Olumi the
 * value with its unit", with no bound, and that turns a VISIBLE dead end into a
 * SILENT one for percentages above 100 or below 0 - the very harm this file's
 * own reasoning above rejects "tell Olumi what it is measured in" for. Derived
 * at the CEE `staging` bytes 7aa49ec8, independently of the first derivation:
 *   . `unitPinnedScaleFrame` pins frame 100 for percent ONLY while
 *     `magnitude <= 100`, and returns undefined for `magnitude < 0` and for
 *     `magnitude <= 1` (`cee/draft/records/unit-scale-class.ts:363`);
 *   . with no frame pinned the write falls back to RAW -
 *     `normalise-factor-value.ts:303` returns `{raw_value: x, value: x}`;
 *   . the stated unit is persisted REGARDLESS of whether a frame was pinned
 *     (`set-factor-value.ts:580-590`);
 *   . a recorded unit is NOT among the run gate's four exemptions, which are a
 *     cap, `baseline in [0,1]`, a recoverable pair frame, and user-authored
 *     self-framing interventions (`plot-intervention-scale.ts:836-882`).
 * So "set it to 150%" writes `{raw_value: 150, value: 150, unit: '%'}`: the
 * disclosure VANISHES (any unit, `factorValueEdit.ts:436`) and the analysis
 * STILL refuses with `baseline_scale_unresolved`.
 *
 * The working set is EXACTLY percent in [0, 100]: 0 and 0.5 clear the gate on
 * the `baseline in [0,1]` limb, and 1 to 100 clear it on the pinned frame. The
 * copy therefore names that set and no more, so the advice and the population
 * it works for are the same set. CASE 4 is the guard.
 *
 * ⛔ 2. NO EM DASH. `Brief3Panels.spec.tsx` ("Em-dash enforcement") forbids
 * U+2014 in rendered panel output, and `FactorExternalPanel.tsx:584` records
 * that the rule caught the first draft of a sibling sentence. It caught nothing
 * here: that suite keeps a HAND-LIST of three panels and this one is not on it
 * (CLAUDE.md trap 12, inside the guard written to enforce the rule). Widening
 * the hand-list is separate, measured work and is rowed, not folded into a copy
 * PR. CASE 5 pins this sentence locally in the meantime.
 *
 * ⚠ AND WHY CASE 5 READS THE MARKED ELEMENT, NOT THE CONTAINER. The panel's
 * shared chrome already renders one em dash that this PR does not own and must
 * not fix here (`useInspectorMutations.ts:259`, whose three siblings at :289,
 * :315 and :332 all use a full stop). A container-scoped assertion would go red
 * on THAT string, which would be a guard reporting someone else's defect as
 * this sentence's - and would have to be silenced rather than fixed. Binding by
 * test id keeps the guard about the string this change is responsible for.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { InspectorModal } from '../../../components/InspectorModal'
import { useCanvasStore } from '../../../store'

// importOriginal-spread, NOT a hand-listed factory: `vi.mock` REPLACES the
// module, so a bare factory silently removes every other @xyflow/react export
// the subtree imports (CLAUDE.md trap 12).
vi.mock('@xyflow/react', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
}))

const NODE_INSPECTOR = 'div[role="dialog"][aria-label="Node inspector"]'
const FACTOR_ID = 'fac_quality'
const MARKER = 'factor-value-no-scale'

/** The remedy that works, spelled out, INCLUDING the bound that makes it work. */
const UNIT_REMEDY = 'If it is a percentage between 0 and 100, tell Olumi the value with its unit'
/**
 * The unbounded construction, which prescribes a route into the silent dead
 * end for percentages above 100 and below 0. Must never return.
 */
const UNBOUNDED_REMEDY = 'If it is a percentage, tell Olumi'
/** House rule for rendered panel copy. */
const EM_DASH = '\u2014'
/** The remedy the deployed assistant declines. Must never return. */
const REFUSED_REMEDY = 'range it can move between'
/** The honest warning, which this change keeps. */
const WARNING = 'This value has no scale recorded'

function seedWith(observedState: Record<string, unknown>) {
  useCanvasStore.setState({
    nodes: [
      {
        id: FACTOR_ID,
        type: 'factor',
        position: { x: 0, y: 0 },
        data: {
          kind: 'factor',
          category: 'controllable',
          label: 'Pro Feature Release Quality',
          observedState,
        },
      },
    ] as never[],
    edges: [] as never[],
    results: { status: 'idle' },
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: { x: 0, y: 0 } },
    goalThreshold: null,
    confirmedNodeIds: new Set(),
    _internal: {},
  } as never)
}

function openFactor() {
  const utils = render(<InspectorModal nodeId={FACTOR_ID} edgeId={null} onClose={vi.fn()} />)
  // PRECONDITION — THE MOUNT PATH. Without the deployed chain mounted, every
  // assertion below is about a component the product does not render
  // (CLAUDE.md trap 3b).
  expect(
    utils.container.querySelector(NODE_INSPECTOR),
    'PRECONDITION: the node inspector dialog must be mounted',
  ).not.toBeNull()
  return utils
}

beforeEach(() => {
  vi.clearAllMocks()
  cleanup()
})

describe('the no-scale disclosure prescribes a remedy the assistant can perform', () => {
  it('CASE 1 — it names the stated-unit route, and no longer asks for a range', () => {
    // The shape measured on staging: no cap, no unit, value outside [0,1].
    seedWith({ value: 70, raw_value: 70, source: 'user' })
    openFactor()

    // IDENTITY BINDING: read the marked element, never the container.
    // `getByTestId` throws when absent, so a green result below cannot come
    // from an element that never rendered (trap 13b — the precondition is
    // pinned in-test rather than assumed).
    const disclosure = screen.getByTestId(MARKER)
    const text = disclosure.textContent ?? ''

    expect(text, 'the disclosure must render some text').not.toBe('')
    expect(
      text.includes(UNIT_REMEDY),
      `the disclosure must name the remedy that clears CEE's baseline gate. Got: ${text}`,
    ).toBe(true)
    expect(
      text.includes(REFUSED_REMEDY),
      `the disclosure must NOT ask for a range: the assistant declines it and \`proposePriorRange\` has zero implementations. Got: ${text}`,
    ).toBe(false)
  })

  it('CASE 2 — the honest warning survives: the remedy changed, the disclosure did not go quiet', () => {
    seedWith({ value: 70, raw_value: 70, source: 'user' })
    openFactor()

    const text = screen.getByTestId(MARKER).textContent ?? ''
    expect(
      text.includes(WARNING),
      `the value still has no scale and the panel must still say so. Got: ${text}`,
    ).toBe(true)
  })
})

describe('⛔ THE TWIN — the remedy tracks the SHAPE, so it cannot just be always-on', () => {
  it('CASE 3 — a factor that already records a unit gets no disclosure and no remedy', () => {
    // ⭐ THIS IS THE REGRESSION GUARD FOR THE OVER-BROAD COPY. Any unit makes
    // `factorValueHasNoUsableScale` false, so a "tell Olumi what it is measured
    // in" instruction would be satisfied here by a factor the CEE gate would
    // still refuse. Pinning the absence keeps the warning and the remedy
    // describing the same population.
    seedWith({ value: 40000, raw_value: 40000, unit: '£', source: 'user' })
    openFactor()
    expect(screen.queryByTestId(MARKER)).toBeNull()
  })
})

describe('⛔ THE BOUND — the advice and the population it works for are the same set', () => {
  it('CASE 4 — it names the range in which a stated percent actually clears the gate, never the unbounded form', () => {
    seedWith({ value: 70, raw_value: 70, source: 'user' })
    openFactor()

    // IDENTITY BINDING: the marked element, never container prose.
    const text = screen.getByTestId(MARKER).textContent ?? ''

    expect(
      text.includes(UNIT_REMEDY),
      `the remedy must name the bound: outside [0,100] a stated percent is written raw, the disclosure vanishes and the run still refuses. Got: ${text}`,
    ).toBe(true)
    expect(
      text.includes(UNBOUNDED_REMEDY),
      `the remedy must NOT prescribe stating a percentage without its bound - that is the silent dead end. Got: ${text}`,
    ).toBe(false)
  })
})

describe('house rule — no em dash in rendered panel copy', () => {
  it('CASE 5 — the disclosure renders no U+2014', () => {
    seedWith({ value: 70, raw_value: 70, source: 'user' })
    openFactor()

    const text = screen.getByTestId(MARKER).textContent ?? ''
    // Precondition pinned in-test: a guard over an empty string would pass
    // while rendering nothing at all (trap 13b).
    expect(text, 'the disclosure must render some text').not.toBe('')
    expect(
      text.includes(EM_DASH),
      `rendered em dash at ${text.indexOf(EM_DASH)}: ${text}`,
    ).toBe(false)
  })
})
