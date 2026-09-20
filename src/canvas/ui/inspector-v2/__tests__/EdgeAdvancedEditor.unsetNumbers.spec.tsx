/**
 * EdgeAdvancedEditor — the three numbers under "model detail" must not be
 * fabricated, and TABBING THROUGH ONE MUST NOT STAMP IT AS A HUMAN CLAIM.
 *
 * ⛔⛔ THESE TESTS HAVE NEVER BEEN RUN. The lane that wrote them was under a
 * hard no-execution constraint: no install, no vitest, no tsc, nothing driven.
 * CI is the authority for every assertion below. Read a green run here as the
 * first evidence about this file, not as confirmation of something the author
 * already saw.
 *
 * ── THE DEFECT
 * `EdgeAdvancedEditor` read three edge fields RAW, on the one surface a person
 * opens BECAUSE they want the numbers:
 *
 *   :44  `beliefExists ?? EDGE_CONSTRAINTS.beliefExists.default` → **0.7**
 *        under "Existence probability", beside a formal definition.
 *   :43  `strengthStd ?? 0.15`  → **0.15** under "Epistemic uncertainty (σ)".
 *   :40  `weight ?? 0.5`        → signed and printed as β.
 *
 * ── WHY THIS IS WORSE THAN THE `EdgePanel` INSTANCE THIS BRANCH ALREADY FIXED
 *
 * 1. THE SAME OPEN PANEL CONTRADICTS ITSELF. `EdgePanel.tsx:922` prints the
 *    same edge's existence as "Not set yet"; two clicks later, under a heading
 *    called "model detail", the same edge read 0.7. A reader reconciling those
 *    concludes the "Not set yet" was the display being coy.
 *
 * 2. IT IS NOT THE NUMBER THE ANALYSIS USES EITHER. `adapters/plot/v2/adapter
 *    .ts:1263` OMITS `exists_probability` when it is unset, its own log string
 *    reading "omitted (PLoT defaults to 0.8)". So the figure shown was neither
 *    what the model held nor what the run used.
 *
 * 3. ⭐ IT LAUNDERED A CONSTANT INTO A USER CLAIM. The fields are EDITABLE and
 *    `AdvancedField` commits ON BLUR. A person who clicked in, saw 0.7 and
 *    tabbed out UNCHANGED committed `setExistsProbability(0.7)`, which stamps
 *    `beliefExistsSource: 'user'` — after which every correctly-gated sibling
 *    surface faithfully displays it as "70%". The gates elsewhere on this
 *    branch make that worse, not better: they are what lends the laundered
 *    number its authority. The fourth block below is the test for that path,
 *    and it is the load-bearing one.
 *
 * ── CLAIM TYPE, STATED SO NOTHING HERE IS READ AS MORE THAN IT IS
 * Every assertion is a RENDERED-VALUE or STORE-STATE claim in jsdom. jsdom
 * cannot prove visibility or layout (platform trap 3) and nothing here claims
 * either. This spec renders `EdgeAdvancedEditor` DIRECTLY, so it does NOT
 * exercise `TechnicalDisclosure` or any fieldset above it — it is evidence
 * about the COMPONENT. (Derived at this tip and stated in the component's own
 * header: `InspectorRouter`'s blanket `<fieldset disabled>` on the EDGE branch
 * is GONE — `InspectorRouter.tsx:299-313` — and both mounts sit outside
 * `EdgePanel`'s own fieldsets, so the laundering path is reachable behind
 * `techMode`. That reachability claim is DERIVED BY READING, not driven, and
 * this spec does not pin it.)
 *
 * ── WHY THE EDIT PATH IS PINNED TOO
 * A fix that made the fields inert, or that refused every entry, would pass a
 * "no fabricated number" test and ship a worse product. The DISCRIMINATING
 * blocks — a stamped edge still prints its numbers, and a typed number still
 * commits AND stamps — are what stop that.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EdgeAdvancedEditor } from '../editors/EdgeAdvancedEditor'
import { useCanvasStore } from '../../../store'
import { USER_EDGE_DEFAULTS, EDGE_CONSTRAINTS } from '../../../domain/edges'
import { METRIC_UNSET } from '../../../nodes/shared/metricVocabulary'
import { NUMERIC_FIELD_REFUSAL } from '../shared/numericFieldAdmission'

const NODES = [
  { id: 'fac1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Marketing budget' } },
  { id: 'out1', type: 'outcome', position: { x: 100, y: 0 }, data: { label: 'Revenue' } },
]

/** The three fields under test, bound by their VISIBLE LABEL — i.e. by
 *  identity, never by a value predicate another field could satisfy
 *  (CLAUDE.md trap 19). `AdvancedField` associates a real `<label htmlFor>`,
 *  so `getByLabelText` asks the accessibility tree the same question a screen
 *  reader does. */
const BETA = 'Effect coefficient (β)'
const SIGMA = 'Epistemic uncertainty (σ)'
const EXISTENCE = 'Existence probability'

const field = (label: string): HTMLInputElement =>
  screen.getByLabelText(label) as HTMLInputElement

function seedNodes() {
  useCanvasStore.setState({
    ...useCanvasStore.getState(),
    nodes: NODES,
    edges: [],
    results: { status: 'none', report: null },
  } as never)
}

function seedEdge(data: Record<string, unknown>) {
  seedNodes()
  useCanvasStore.setState({
    ...useCanvasStore.getState(),
    edges: [{ id: 'e1', source: 'fac1', target: 'out1', type: 'styled', data }],
  } as never)
}

/** Build the edge the way the PRODUCT does — no hand-authored `data`. Same
 *  helper as `EdgePanel.unsetNumber.spec.tsx`, for the same reason: a fixture
 *  invented to make a gate fire is not evidence about a state a user reaches. */
function drawEdgeThroughProduct() {
  seedNodes()
  const result = useCanvasStore
    .getState()
    .addEdge({ source: 'fac1', target: 'out1', data: { ...USER_EDGE_DEFAULTS } } as never)
  expect((result as { created: boolean }).created).toBe(true)
  const drawn = useCanvasStore.getState().edges
  expect(drawn).toHaveLength(1)
  useCanvasStore.setState({
    ...useCanvasStore.getState(),
    edges: [{ ...drawn[0], id: 'e1' }],
  } as never)
  return drawn[0]
}

const edgeData = (): Record<string, unknown> =>
  (useCanvasStore.getState().edges.find(e => e.id === 'e1')?.data ?? {}) as Record<string, unknown>

/**
 * ⚠ `onSendSettled` IS REQUIRED, and it arrived on `staging` while this branch
 * was open (the send-settlement channel). This spec is about the three numbers'
 * PROVENANCE GATING, which no settlement can reach — so the callback is a
 * deliberate no-op here rather than a spy: asserting on it would bind this file
 * to a question it was not written to ask.
 */
const renderEditor = () =>
  render(
    <EdgeAdvancedEditor edgeId="e1" linkKind="causal" onSendSettled={() => {}} />,
  )

beforeEach(() => {
  useCanvasStore.setState(useCanvasStore.getState(), true)
  vi.restoreAllMocks()
})

describe('EdgeAdvancedEditor — the three numbers are provenance-gated', () => {
  it('PREMISE CONTROL: the fabricated constants are still what this file would have printed', () => {
    // If these move, the numbers named in this spec's header stop being the
    // ones the defect produced — and the spec's story, not just its numbers,
    // needs re-deriving. Pinned so that shows up as a RED here rather than as a
    // quietly wrong comment.
    expect(EDGE_CONSTRAINTS.beliefExists.default).toBe(0.7)
    expect(USER_EDGE_DEFAULTS.beliefExists).toBe(0.8)
    expect(USER_EDGE_DEFAULTS.strengthStd).toBe(0.15)
    expect(USER_EDGE_DEFAULTS.weight).toBe(0.3)
  })

  it('REACHABILITY CONTROL: an edge drawn through the product carries all three numbers and NO source', () => {
    const drawn = drawEdgeThroughProduct()
    const data = drawn.data as Record<string, unknown>
    expect(typeof data.weight).toBe('number')
    expect(typeof data.strengthStd).toBe('number')
    expect(typeof data.beliefExists).toBe('number')
    expect(data.weightSource).toBeUndefined()
    expect(data.strengthStdSource).toBeUndefined()
    expect(data.beliefExistsSource).toBeUndefined()
  })

  describe('an edge nobody has characterised', () => {
    it.each([[BETA], [SIGMA], [EXISTENCE]])('%s renders EMPTY, not a fabricated number', label => {
      drawEdgeThroughProduct()
      renderEditor()
      expect(field(label).value).toBe('')
    })

    it.each([[BETA], [SIGMA], [EXISTENCE]])('%s says so, in the vocabulary the rest of the edge uses', label => {
      drawEdgeThroughProduct()
      renderEditor()
      // Derived from `METRIC_UNSET`, never re-typed: one state must not acquire
      // a second name on the one screen that already says "Not set yet" twice.
      expect(field(label).placeholder).toBe(METRIC_UNSET.standalone)
    })

    it('the unset state is ANNOUNCED, not only drawn', () => {
      drawEdgeThroughProduct()
      renderEditor()
      // A placeholder alone leaves a screen-reader user with a silent empty box
      // and no way to tell "nobody has said" from "the panel is broken".
      for (const label of [BETA, SIGMA, EXISTENCE]) {
        const describedBy = field(label).getAttribute('aria-describedby')
        expect(describedBy).toBeTruthy()
        const message = document.getElementById(describedBy as string)
        expect(message?.textContent ?? '').toContain(METRIC_UNSET.standalone)
      }
    })

    it('an edge with NO data at all is unset too — the `?? 0.7 / 0.5 / 0.15` path', () => {
      // The drawn-edge case exercises the USER_EDGE_DEFAULTS fabrications; this
      // one exercises the ABSENT-field fallbacks, which are different numbers.
      seedEdge({})
      renderEditor()
      expect(field(BETA).value).toBe('')
      expect(field(SIGMA).value).toBe('')
      expect(field(EXISTENCE).value).toBe('')
    })
  })

  /**
   * ⭐⭐ THE LAUNDERING PATH — the sharpest part of the finding.
   *
   * `AdvancedField` commits on BLUR, so the harm needs no typing and no intent:
   * focus and leave. Before the fix this wrote the UI constant into the store
   * WITH a `'user'` stamp. Each assertion below names the stamp key, because
   * "the value did not change" is the weaker claim — a stamp on an unchanged
   * value is still a fabricated provenance.
   */
  describe('tabbing through an unset field stamps NOTHING', () => {
    it.each([
      [EXISTENCE, 'beliefExistsSource'],
      [SIGMA, 'strengthStdSource'],
      [BETA, 'weightSource'],
    ])('focus + blur on %s does not stamp %s', (label, stampKey) => {
      drawEdgeThroughProduct()
      const before = { ...edgeData() }
      renderEditor()
      const input = field(label)
      fireEvent.focus(input)
      fireEvent.blur(input)
      const after = edgeData()
      expect(after[stampKey]).toBeUndefined()
      expect(after.weight).toBe(before.weight)
      expect(after.strengthStd).toBe(before.strengthStd)
      expect(after.beliefExists).toBe(before.beliefExists)
    })

    it('β does not stamp a DIRECTION either', () => {
      // `setStrength` writes `direction` AND `directionSource` alongside the
      // weight, so a blur-commit on β laundered two claims, not one.
      drawEdgeThroughProduct()
      renderEditor()
      fireEvent.focus(field(BETA))
      fireEvent.blur(field(BETA))
      expect(edgeData().directionSource).toBeUndefined()
    })

    it('and it does not ACCUSE the reader of a typo', () => {
      // The other half of the fix, in `AdvancedField`: an empty numeric entry
      // is "no entry", not "a bad entry". Without this the fix for a fabricated
      // number would have shipped a false refusal in its place.
      drawEdgeThroughProduct()
      renderEditor()
      fireEvent.focus(field(EXISTENCE))
      fireEvent.blur(field(EXISTENCE))
      expect(screen.queryByText(NUMERIC_FIELD_REFUSAL.NOT_FINITE)).toBeNull()
    })
  })

  /**
   * ⭐ THE DISCRIMINATING HALF. Without these, "render nothing, ever" and
   * "refuse every entry" both pass the blocks above — and either would be a
   * worse product than the defect.
   */
  describe('DISCRIMINATING PAIR — a stated value is still shown, and still editable', () => {
    it('a user-STATED edge prints all three numbers', () => {
      seedEdge({
        weight: 0.42,
        weightSource: 'user',
        direction: 'positive',
        strengthStd: 0.08,
        strengthStdSource: 'user',
        beliefExists: 0.82,
        beliefExistsSource: 'user',
      })
      renderEditor()
      expect(field(BETA).value).toBe('0.42')
      expect(field(SIGMA).value).toBe('0.08')
      expect(field(EXISTENCE).value).toBe('0.82')
    })

    it('a NEGATIVE direction still signs β, exactly as before the gate', () => {
      seedEdge({ weight: 0.42, weightSource: 'user', direction: 'negative' })
      renderEditor()
      expect(field(BETA).value).toBe('-0.42')
    })

    it('a pre-marker CEE edge still prints its existence — back-compat, not a regression', () => {
      seedEdge({ beliefExists: 0.9, exists_probability: 0.9 })
      renderEditor()
      expect(field(EXISTENCE).value).toBe('0.9')
    })

    it('typing a number into an UNSET field still commits it, and stamps it', () => {
      // The empty-blur guard must refuse only the EMPTY entry. If it swallowed
      // real entries too, the field would be silently dead and every block
      // above would still be green.
      drawEdgeThroughProduct()
      renderEditor()
      const input = field(EXISTENCE)
      fireEvent.change(input, { target: { value: '0.55' } })
      fireEvent.blur(input)
      const after = edgeData()
      expect(after.beliefExists).toBe(0.55)
      expect(after.beliefExistsSource).toBe('user')
    })

    it('a stated value that is CLEARED is not committed as anything', () => {
      // Clearing is an entry the person made and then withdrew. It must not
      // commit, and it must not accuse.
      seedEdge({ beliefExists: 0.82, beliefExistsSource: 'user' })
      renderEditor()
      const input = field(EXISTENCE)
      fireEvent.change(input, { target: { value: '' } })
      fireEvent.blur(input)
      expect(edgeData().beliefExists).toBe(0.82)
      expect(screen.queryByText(NUMERIC_FIELD_REFUSAL.NOT_FINITE)).toBeNull()
    })
  })
})
