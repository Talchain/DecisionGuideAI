/**
 * The Inspector's read-only policy, pinned IN ITS ENFORCED FORM.
 *
 * ⭐ WHY THIS FILE EXISTS — the unenforced mirror is gone (26 Aug 2026).
 * `useInspectorMutations.ts` used to carry two authority manifests,
 * `NODE_SETTER_AUTHORITY` (21 keys) and `EDGE_SETTER_AUTHORITY` (5), every
 * value `'disabled'`. They were DELETED because they had **zero code
 * consumers**: every reference to either, outside their own definition and
 * `mutationAuthority.spec.ts`, was a comment or a documentation string, and
 * NONE WAS A CONSUMER. Nothing branched on them, so nothing could drift from
 * them — and a table that cannot drift also cannot enforce. Contrast control
 * at the time of deletion: `useNodeMutations` / `useEdgeMutations` were
 * imported by 30+ files, so the sweep that returned zero for the tables was
 * demonstrably able to see consumers.
 *
 * ⚠ "was a COMMENT" is what this said until 27 Aug 2026, and it was false:
 * `canvas/domain/analyticalNodeFields.ts:158` names the table in a RUNTIME
 * STRING LITERAL that ships to browsers. The narrow claim — zero code
 * CONSUMERS — is true and is the one the deletion rests on. See
 * `useInspectorMutations.ts` for the full correction.
 *
 * The ACTUAL enforcement was, and remains, structural: `InspectorRouter` wraps
 * every panel — node and edge — in an unconditional
 * `<fieldset disabled data-authority="disabled">`, beneath a note carrying
 * `INSPECTOR_READ_ONLY_REASON`. That is STRUCTURAL where the manifests were
 * clerical: a fieldset disables every descendant FORM CONTROL, so a NEW setter
 * added tomorrow is inert without anyone remembering to classify it — provided
 * it is a form control. The manifests could only ever record a decision; the
 * fieldset makes it.
 *
 * ⚠ THIS SAID "strictly STRONGER … every descendant control" UNTIL
 * 27 Aug 2026, AND EXECUTION REFUTED IT. `<fieldset disabled>` inerts
 * form-associated descendants only — not a `[role="button"]` div, not a
 * `[contenteditable]`, not an `a[href]`. The exact scope, the measured
 * counter-example, and the BOUND on it (**no write escapes**, and user
 * reachability was explicitly NOT claimed) are in `useInspectorMutations.ts`
 * and pinned below as `NOT_INERTED_BY_THE_FIELDSET_NODE`.
 *
 * ⚠ WHAT THE PRE-EXISTING GUARD DID NOT COVER, and why deleting the tables
 * without this file would have left the fieldset UNEXPLAINED — an unexplained
 * enforcement being the next thing someone tidies away:
 *
 *   1. `InspectorRouter.spec.tsx` asserts the notice contains the SUBSTRING
 *      `'cannot yet be saved to the shared model'` — a hand-copied mirror of
 *      the copy. Here the expectation IS the imported constant, so the copy
 *      and its guard cannot diverge by hand-copying.
 *
 *      ⚠ THAT IS NOT "STRONGER", AND THE FIRST VERSION OF THIS NOTE INVITED
 *      EXACTLY THAT READING (corrected 27 Aug 2026, measured). The two guards
 *      catch DIFFERENT things and NEITHER supersedes the other:
 *        · Gut the constant and exactly two guards RED, and BOTH are
 *          PRE-EXISTING — `InspectorRouter.spec.tsx:347` and
 *          `FactorExternalPanel.priorRangeHonesty.spec.tsx:705`. This file's
 *          17 stay GREEN. (Measured at this tip, applied-check 1, controls 0.)
 *        · Reword the constant to INVERT its meaning — "You may freely edit
 *          anything here" — and every one of the 68 cases across the six specs
 *          that reference the constant stays GREEN, this file's 17 included,
 *          because an equality-to-the-constant check moves WITH the constant.
 *      An identity check pins the WIRING; a substring check pins a fragment of
 *      the MEANING, and this file is the weaker of the two on meaning.
 *      **Keep both. Do not delete the substring guards on the strength of this
 *      file** — that is precisely the tidy-up this note exists to prevent.
 *   2. NOTHING asserted the ARIA BINDING. Delete `aria-describedby` from the
 *      fieldset and every pre-existing test stays green while the boundary
 *      stops being announced to a screen reader — the control is inert and the
 *      user is never told why. The binding is the half that makes the policy
 *      legible, so it is pinned here by IDENTITY: the fieldset's
 *      `aria-describedby` must resolve to the element that renders the reason.
 *   3. The old tests asserted the FIELDSET element `toBeDisabled()`. That is a
 *      property of the wrapper, not of anything a user can touch. A per-element
 *      check is not an actionability check (an ancestor `<fieldset disabled>`
 *      has defeated one before), so each case below finds a real focusable
 *      control INSIDE the boundary and asserts the DOM reports it disabled.
 *
 * ── WHAT MAKES THE MUTANT PAIR DISCRIMINATING ───────────────────────────────
 * `InspectorRouter` has TWO independent boundary regions — the edge branch
 * (`InspectorRouter.tsx:221`) and the node branch (`:334`). Breaking ONE must
 * RED only that region's cases and leave the other GREEN. A single biting
 * mutant proves only sensitivity to *something*; the pair proves sensitivity
 * to the named region, and the pair has been run.
 *
 * ⚠ BUT NOT BY THE MECHANISM THIS COMMENT ORIGINALLY CLAIMED (corrected
 * 27 Aug 2026). It said each assertion resolves its region "never through a
 * bare `document.querySelector('fieldset')` that either region could satisfy"
 * — and `readBoundary()` below is exactly a bare document-level query. The
 * discrimination is REAL, and it comes from the FIXTURE, not from the
 * selector: each `describe` seeds the store with only nodes or only an edge
 * and renders `InspectorRouter` with only `nodeId` or only `edgeId`, so
 * exactly one branch is ever mounted and the document holds exactly one
 * boundary. `readBoundary()` throws if there is none, which is what stops the
 * query being vacuous rather than any scoping in the selector.
 *
 * State the real mechanism, because it is what a future edit will get wrong:
 * the discrimination lives in the PER-`describe` FIXTURE and would be LOST by
 * a refactor that rendered both regions in one test. If you ever do that,
 * scope the queries to the rendered region instead of to `document`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

import { InspectorRouter } from '../InspectorRouter'
import { INSPECTOR_READ_ONLY_REASON } from '../useInspectorMutations'
import { useCanvasStore } from '../../../store'

vi.mock('@xyflow/react', () => ({
  useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
}))

function setStoreState(nodes: unknown[], edges: unknown[] = []) {
  useCanvasStore.setState({
    nodes: nodes as never[],
    edges: edges as never[],
    results: { status: 'idle' },
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    goalThreshold: null,
    confirmedNodeIds: new Set(),
    _internal: {},
  } as never)
}

const NODE_FIXTURE = [
  {
    id: 'r1',
    type: 'risk',
    data: { label: 'Operational risk', kind: 'risk', probability: 0.4, impact: 'medium' },
    position: { x: 0, y: 0 },
  },
]

/** A node kind whose panel renders a real editing INPUT (not only buttons). */
const CONTROLLABLE_FACTOR_FIXTURE = [
  {
    id: 'f1',
    type: 'factor',
    data: {
      label: 'Price',
      kind: 'factor',
      category: 'controllable',
      observedState: { raw_value: 49, value: 0.49, unit: '£' },
    },
    position: { x: 0, y: 0 },
  },
]

const EDGE_FIXTURE_NODES = [
  { id: 'f1', type: 'factor', data: { label: 'Marketing' }, position: { x: 0, y: 0 } },
  { id: 'g1', type: 'goal', data: { label: 'Revenue' }, position: { x: 0, y: 0 } },
]
const EDGE_FIXTURE_EDGES = [
  { id: 'e1', source: 'f1', target: 'g1', data: { weight: 0.5, direction: 'positive' } },
]

/**
 * Resolve the boundary and its explanation together.
 *
 * ⚠ PINS ITS OWN PRECONDITION. If the router rendered no boundary at all, a
 * test asserting "everything inside is disabled" would pass VACUOUSLY over an
 * empty set. So this throws unless the region exists AND contains at least one
 * focusable control — the thing the policy is actually about.
 */
function readBoundary() {
  const fieldset = document.querySelector<HTMLFieldSetElement>(
    'fieldset[data-authority="disabled"]',
  )
  if (!fieldset) throw new Error('PRECONDITION FAILED: no authority boundary rendered')

  const controls = Array.from(
    fieldset.querySelectorAll<HTMLElement>('input, select, textarea, button'),
  )
  return { fieldset, controls }
}

describe('Inspector read-only policy — enforced form, node region', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cleanup()
    setStoreState(NODE_FIXTURE)
  })

  it('renders the boundary around at least one real control (precondition, not a claim)', () => {
    render(<InspectorRouter nodeId="r1" edgeId={null} onClose={vi.fn()} />)
    const { controls } = readBoundary()
    // If this ever reads zero, every disabled-ness assertion below is vacuous.
    expect(controls.length).toBeGreaterThan(0)
  })

  it('explains the boundary with INSPECTOR_READ_ONLY_REASON — the constant, not a copy', () => {
    render(<InspectorRouter nodeId="r1" edgeId={null} onClose={vi.fn()} />)
    expect(screen.getByTestId('inspector-authority-notice')).toHaveTextContent(
      INSPECTOR_READ_ONLY_REASON,
    )
  })

  it('BINDS the boundary to that explanation via aria-describedby, by identity', () => {
    render(<InspectorRouter nodeId="r1" edgeId={null} onClose={vi.fn()} />)
    const { fieldset } = readBoundary()
    const describedBy = fieldset.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()

    // Resolve the id to the element it names, and require THAT element to be
    // the one carrying the reason. An `aria-describedby` pointing at nothing,
    // or at some other node, is a boundary the user is never told about.
    const explanation = document.getElementById(describedBy as string)
    expect(explanation).not.toBeNull()
    expect(explanation).toHaveTextContent(INSPECTOR_READ_ONLY_REASON)
    expect(explanation).toBe(screen.getByTestId('inspector-authority-notice'))
  })

  it('makes every control inside the boundary genuinely inert', () => {
    render(<InspectorRouter nodeId="r1" edgeId={null} onClose={vi.fn()} />)
    const { controls } = readBoundary()
    for (const control of controls) {
      expect(control).toBeDisabled()
    }
  })

  it('POSITIVE CONTROL: the close affordance sits OUTSIDE the boundary and stays usable', () => {
    render(<InspectorRouter nodeId="r1" edgeId={null} onClose={vi.fn()} />)
    const { fieldset } = readBoundary()
    const close = screen.getByRole('button', { name: /close/i })
    // Proves the boundary is scoped, not a blanket "everything is disabled"
    // reading that would pass even if the panel rendered nothing at all.
    expect(fieldset.contains(close)).toBe(false)
    expect(close).toBeEnabled()
  })
})

describe('Inspector read-only policy — enforced form, edge region', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cleanup()
    setStoreState(EDGE_FIXTURE_NODES, EDGE_FIXTURE_EDGES)
  })

  it('renders the boundary around at least one real control (precondition, not a claim)', () => {
    render(<InspectorRouter nodeId={null} edgeId="e1" onClose={vi.fn()} />)
    const { controls } = readBoundary()
    expect(controls.length).toBeGreaterThan(0)
  })

  it('explains the boundary with INSPECTOR_READ_ONLY_REASON — the constant, not a copy', () => {
    render(<InspectorRouter nodeId={null} edgeId="e1" onClose={vi.fn()} />)
    expect(screen.getByTestId('inspector-authority-notice')).toHaveTextContent(
      INSPECTOR_READ_ONLY_REASON,
    )
  })

  it('BINDS the boundary to that explanation via aria-describedby, by identity', () => {
    render(<InspectorRouter nodeId={null} edgeId="e1" onClose={vi.fn()} />)
    const { fieldset } = readBoundary()
    const describedBy = fieldset.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()

    const explanation = document.getElementById(describedBy as string)
    expect(explanation).not.toBeNull()
    expect(explanation).toHaveTextContent(INSPECTOR_READ_ONLY_REASON)
    expect(explanation).toBe(screen.getByTestId('inspector-authority-notice'))
  })

  it('makes every control inside the boundary genuinely inert', () => {
    render(<InspectorRouter nodeId={null} edgeId="e1" onClose={vi.fn()} />)
    const { controls } = readBoundary()
    for (const control of controls) {
      expect(control).toBeDisabled()
    }
  })
})

/**
 * ⭐ THE REPLACEMENT FOR THE DELETED COMPLETENESS GUARD.
 *
 * `mutationAuthority.spec.ts` used to assert that every key of
 * `NODE_SETTER_FIELDS` / `EDGE_SETTER_FIELDS` appeared in the corresponding
 * manifest — a completeness check over the PROSE. What actually matters is
 * that no Inspector control escapes the boundary, and that is a property of
 * the DOM, not of a table.
 *
 * ⚠⚠ AND THE FIRST VERSION OF THIS BLOCK COULD NOT OBSERVE THAT PROPERTY AT
 * ALL. Corrected 27 Aug 2026 after an independent review MEASURED it, and the
 * measurement is kept here because it is the whole reason the shape below is
 * what it is:
 *
 *   Mutant M5 added an enabled `<input aria-label="ESCAPED_EDITOR" />` to the
 *   `InspectorShell` HEADER — inside the Inspector, OUTSIDE the fieldset.
 *   Applied-check scoped to `src/`: exactly 1 file, 1 insertion.
 *   The suite stayed **12/12 GREEN**.
 *
 * The mechanism: both cases built their candidate set from
 * `fieldset.querySelectorAll(...)`, so every member had the disabled fieldset
 * as an ancestor and `isEffectivelyDisabled` was true BY CONSTRUCTION.
 * `escaped` could only be non-empty if the fieldset itself lost `disabled` —
 * which the sibling case "makes every control inside the boundary genuinely
 * inert" already measures. It was a DUPLICATE of its sibling wearing the name
 * of the guard it replaced. **A guard that cannot fail in the way its name
 * claims is worse than no guard, because it retires the question.**
 *
 * ── WHAT THE CASES BELOW ACTUALLY ASSERT ────────────────────────────────────
 * The escape question is a claim about the WHOLE Inspector, so it is asked of
 * the whole rendered region and not of the boundary's own subtree:
 *
 *   escaped = (every control in the Inspector region)
 *           − (everything inside the boundary)
 *           − (the deliberately-outside set, pinned by identity below)
 *
 * and `escaped` must be empty. That REDs on M5, and on the realistic version
 * of M5: `InspectorRouter` passes no `onLabelChange`, so `EditableLabel`
 * renders a bare `<span>` (`EditableLabel.tsx:124-130`). Wire that prop and a
 * `<button data-testid="inspector-rename-trigger">` appears in the header,
 * outside the fieldset, opening an `<input>` that writes the label — i.e.
 * `setLabel`, which was a key of the deleted `NODE_SETTER_AUTHORITY`. That is
 * the escape class the manifest was nominally about, and this is the guard
 * that would catch it.
 *
 * The selector is widened past form controls on purpose — `[role="button"]`,
 * `[contenteditable]` and `a[href]` are how a write surface arrives WITHOUT
 * being a form control, and the section below records why that distinction is
 * load-bearing here.
 */

/** The Inspector's outermost rendered element — `InspectorShell.tsx:88-94`. */
const INSPECTOR_REGION = '[role="region"][aria-label="Inspector panel"]'

/**
 * Anything a user can press, type into, or follow. Deliberately wider than
 * `input, select, textarea` — see `NOT_INERTED_BY_THE_FIELDSET` below.
 */
const EDITING_SELECTOR =
  'input, select, textarea, button, [role="button"], [contenteditable], a[href]'

/** The four element types `<fieldset disabled>` actually inerts, per the HTML spec. */
const NATIVELY_DISABLEABLE = 'button, input, select, textarea'

/**
 * Chrome that sits OUTSIDE the boundary ON PURPOSE. None of these writes the
 * model: they navigate, dismiss, or toggle presentation.
 *
 * ⚠ A SUBTRACTION LIST IS A HAND-MAINTAINED MIRROR (trap 12), so it is fenced
 * two ways: every entry MUST match at least one element (a renamed or removed
 * affordance REDs here instead of silently widening the guard), and every
 * match MUST resolve outside the boundary (so an allowlisted identity cannot
 * be reused INSIDE the fieldset to launder a control past the escape check).
 * Identity only — a value predicate another element could satisfy is trap 19.
 */
const DELIBERATELY_OUTSIDE: ReadonlyArray<{ selector: string; why: string; onlyOn?: 'node' }> = [
  { selector: '[data-testid="inspector-back-to-results"]', why: 'navigation' },
  { selector: '[aria-label="Show technical detail"]', why: 'presentation toggle' },
  { selector: '[aria-label="Close inspector"]', why: 'dismissal' },
  { selector: '[data-testid="inspector-quick-analysis"]', why: 'navigation' },
  /**
   * ⭐⭐ THE ONE WRITE DELIBERATELY OUTSIDE THE BOUNDARY (31 Aug 2026).
   *
   * Every other entry above is navigation, presentation or dismissal — none of
   * them writes. This one does: it renames the element, through the sanctioned
   * `setLabel`.
   *
   * IT BELONGS OUTSIDE BECAUSE THE BOUNDARY'S CLAIM IS ABOUT SAVEABILITY, NOT
   * ABOUT EDITING. The fieldset exists because those controls "cannot yet be
   * saved to the shared model". A rename CAN: `setLabel` writes `data.label`
   * through the manifest-guarded setter, it is persisted hash-by-default, and
   * CEE reads durable label changes (its #1237). Keeping it inside the fieldset
   * would have suppressed a write the product can honour — the same
   * over-suppression the `mutationAuthority.ts` header records a withdrawn
   * proposal for.
   *
   * ⚠ THE NOTICE WAS NARROWED IN THE SAME CHANGE. It said "This inspector is
   * read-only", which became false the moment the title could be edited. It now
   * says the name is editable and the settings below are not. A boundary and
   * the sentence describing it must not disagree.
   *
   * ⚠ THIS ENTRY MUST NOT GROW. It is the exception, not a precedent: a second
   * write out here means the boundary has stopped being the answer to "may this
   * present itself as a saved edit?" and has started being a suggestion.
   */
  {
    selector: '[data-testid="inspector-rename-trigger"]',
    why: 'rename — a write, and a SAVEABLE one',
    // NODE PANELS ONLY, and scoped rather than made optional so the
    // fail-loud check still applies on the panel where it must appear. An
    // edge's inspector title is DERIVED ("Source → Target"), not a stored
    // field, so there is nothing there to rename and `onLabelChange` is
    // deliberately not passed on that branch.
    onlyOn: 'node',
  },
]

function describeControl(el: Element): string {
  const id =
    el.getAttribute('data-testid') ??
    el.getAttribute('aria-label') ??
    (el.textContent ?? '').trim().slice(0, 40)
  return `<${el.tagName.toLowerCase()}> ${id}`
}

/**
 * Every control in the Inspector that is neither inside the boundary nor
 * deliberately outside it. Non-empty means a write surface has escaped.
 */
function escapedControls(panel: 'node' | 'edge' = 'node'): string[] {
  const region = document.querySelector<HTMLElement>(INSPECTOR_REGION)
  if (!region) throw new Error('PRECONDITION FAILED: no Inspector region rendered')
  const fieldset = document.querySelector<HTMLElement>('fieldset[data-authority="disabled"]')
  if (!fieldset) throw new Error('PRECONDITION FAILED: no authority boundary rendered')

  const allowed = new Set<Element>()
  for (const { selector, onlyOn } of DELIBERATELY_OUTSIDE) {
    if (onlyOn && onlyOn !== panel) continue
    const matches = Array.from(region.querySelectorAll(selector))
    // Fails loud rather than quietly excusing one control fewer.
    expect(matches.length, `deliberately-outside entry matched nothing: ${selector}`)
      .toBeGreaterThan(0)
    for (const match of matches) {
      expect(
        fieldset.contains(match),
        `deliberately-outside entry resolved INSIDE the boundary: ${selector}`,
      ).toBe(false)
      allowed.add(match)
    }
  }

  return Array.from(region.querySelectorAll<HTMLElement>(EDITING_SELECTOR))
    .filter(el => !fieldset.contains(el) && !allowed.has(el))
    .map(describeControl)
}

function isEffectivelyDisabled(el: HTMLElement): boolean {
  if ((el as HTMLInputElement).disabled) return true
  // Walk ancestors for a disabled <fieldset>, which natively disables every
  // descendant FORM CONTROL (outside its first <legend>).
  //
  // ⚠ THE INSTRUMENT TRAP THIS FILE HIT WHILE BEING WRITTEN, kept because the
  // next person will hit it too. The first version filtered on the RAW DOM
  // PROPERTY `(el as HTMLInputElement).disabled` alone. It FAILED, reporting
  // two enabled `<input type="range">` inside a fieldset that is unambiguously
  // `disabled` — because jsdom reflects the `disabled` ATTRIBUTE and does not
  // propagate a `<fieldset disabled>` to its descendants' property. In a real
  // browser those inputs are inert; in jsdom the property says otherwise. So
  // the raw property is not an actionability check, it is a check on where the
  // attribute happens to be written. Had it been left as written, the "fix"
  // would have looked like removing the assertion or narrowing it past the
  // sliders — weakening a guard to match a broken probe.
  //
  // ⚠ AND THE LIMIT OF THIS HELPER, WHICH IS A FACT ABOUT THE PLATFORM AND NOT
  // A BUG IN THE HELPER: it is only sound for `NATIVELY_DISABLEABLE` elements.
  // Callers must not hand it a `[role="button"]` div — see the pinned set
  // below, which is where that case is recorded instead.
  let ancestor: HTMLElement | null = el.parentElement
  while (ancestor) {
    if (ancestor.tagName === 'FIELDSET' && ancestor.hasAttribute('disabled')) return true
    ancestor = ancestor.parentElement
  }
  return false
}

/** Controls inside the boundary that `<fieldset disabled>` does NOT inert. */
function notInertedInsideBoundary(): string[] {
  const fieldset = document.querySelector<HTMLElement>('fieldset[data-authority="disabled"]')
  if (!fieldset) throw new Error('PRECONDITION FAILED: no authority boundary rendered')
  return Array.from(fieldset.querySelectorAll<HTMLElement>(EDITING_SELECTOR))
    .filter(el => !el.matches(NATIVELY_DISABLEABLE))
    .map(describeControl)
}

describe('Inspector read-only policy — no control escapes the boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cleanup()
  })

  it('leaves no editing control outside the boundary in the node panel', () => {
    // ⚠ NOT the risk fixture used above. A controllable factor renders a real
    // number input inside the boundary, so the boundary has something to be
    // true ABOUT rather than only buttons.
    setStoreState(CONTROLLABLE_FACTOR_FIXTURE)
    render(<InspectorRouter nodeId="f1" edgeId={null} onClose={vi.fn()} />)
    expect(escapedControls()).toEqual([])
  })

  it('leaves no editing control outside the boundary in the edge panel', () => {
    setStoreState(EDGE_FIXTURE_NODES, EDGE_FIXTURE_EDGES)
    render(<InspectorRouter nodeId={null} edgeId="e1" onClose={vi.fn()} />)
    expect(escapedControls('edge')).toEqual([])
  })

  it('leaves no effectively-enabled FORM CONTROL inside the node boundary', () => {
    setStoreState(CONTROLLABLE_FACTOR_FIXTURE)
    render(<InspectorRouter nodeId="f1" edgeId={null} onClose={vi.fn()} />)
    const { fieldset } = readBoundary()
    const formControls = Array.from(
      fieldset.querySelectorAll<HTMLElement>(NATIVELY_DISABLEABLE),
    )
    // Precondition: a completeness claim over an empty set is vacuous.
    expect(formControls.length).toBeGreaterThan(0)
    expect(formControls.filter(el => !isEffectivelyDisabled(el)).map(describeControl)).toEqual([])
  })

  it('leaves no effectively-enabled FORM CONTROL inside the edge boundary', () => {
    setStoreState(EDGE_FIXTURE_NODES, EDGE_FIXTURE_EDGES)
    render(<InspectorRouter nodeId={null} edgeId="e1" onClose={vi.fn()} />)
    const { fieldset } = readBoundary()
    const formControls = Array.from(
      fieldset.querySelectorAll<HTMLElement>(NATIVELY_DISABLEABLE),
    )
    expect(formControls.length).toBeGreaterThan(0)
    expect(formControls.filter(el => !isEffectivelyDisabled(el)).map(describeControl)).toEqual([])
  })

  /**
   * ⭐ THE KNOWN SCOPE LIMIT OF `<fieldset disabled>`, PINNED SO THE SUITE CAN
   * SEE IT RATHER THAN ONLY THIS COMMENT.
   *
   * A fieldset inerts FORM CONTROLS. It does not inert a `[role="button"]`
   * div, a `[contenteditable]`, or an `a[href]`. An independent review
   * measured one such div inside this boundary — `EmptyDescriptionPrompt`,
   * `tabindex=0` — taking focus, firing its handler and opening an editor,
   * while the two real `<button>`s beside it were disabled in the same run.
   *
   * ⚠ THE BOUND ON THAT FINDING, CARRIED EXACTLY AND NOT UPGRADED: **NO WRITE
   * ESCAPES.** The `<textarea>` that opens is itself inside the fieldset and
   * natively disabled. The review explicitly DECLINED to claim user
   * reachability, because the store write it exercised came from a synthetic
   * `fireEvent.change` that bypasses the browser's own gating. So this is a
   * recorded scope limit of the MECHANISM, not a known user-facing defect —
   * do not cite it as one, and do not widen it without measuring it yourself.
   *
   * The set is pinned EXACTLY, so it REDs if it GROWS (a new non-form control
   * appears inside the boundary and needs adjudicating) or SHRINKS (someone
   * made one inert, and this note plus the sentence in
   * `useInspectorMutations.ts` should be updated to say so). A gap recorded in
   * the suite is honest; a gap visible only to a comment is how it gets lost.
   */
  const NOT_INERTED_BY_THE_FIELDSET_NODE = [
    '<div> What is this factor and why does it matter?',
  ]

  it('pins EXACTLY which controls the fieldset does not inert (node panel)', () => {
    setStoreState(CONTROLLABLE_FACTOR_FIXTURE)
    render(<InspectorRouter nodeId="f1" edgeId={null} onClose={vi.fn()} />)
    expect(notInertedInsideBoundary()).toEqual(NOT_INERTED_BY_THE_FIELDSET_NODE)
  })

  it('pins EXACTLY which controls the fieldset does not inert (edge panel)', () => {
    setStoreState(EDGE_FIXTURE_NODES, EDGE_FIXTURE_EDGES)
    render(<InspectorRouter nodeId={null} edgeId="e1" onClose={vi.fn()} />)
    expect(notInertedInsideBoundary()).toEqual([])
  })

  it('POSITIVE CONTROL: the escape check can SEE an escape', () => {
    // Without this, `escapedControls()` returning `[]` unconditionally would
    // make both escape cases pass while observing nothing (trap 13 — an
    // absence probe must be shown capable of detecting a presence). This is
    // the M5 shape, injected directly: an enabled control inside the Inspector
    // region and outside the boundary.
    setStoreState(CONTROLLABLE_FACTOR_FIXTURE)
    render(<InspectorRouter nodeId="f1" edgeId={null} onClose={vi.fn()} />)
    expect(escapedControls()).toEqual([])

    const region = document.querySelector<HTMLElement>(INSPECTOR_REGION)!
    const escapee = document.createElement('input')
    escapee.setAttribute('aria-label', 'ESCAPED_EDITOR')
    region.appendChild(escapee)
    expect(escapedControls()).toEqual(['<input> ESCAPED_EDITOR'])

    escapee.remove()
    expect(escapedControls()).toEqual([])
  })

  it('POSITIVE CONTROL: the helper reports an ungoverned control as NOT disabled', () => {
    const loose = document.createElement('input')
    document.body.appendChild(loose)
    expect(isEffectivelyDisabled(loose)).toBe(false)

    const guarded = document.createElement('fieldset')
    guarded.setAttribute('disabled', '')
    const inner = document.createElement('input')
    guarded.appendChild(inner)
    document.body.appendChild(guarded)
    expect(isEffectivelyDisabled(inner)).toBe(true)

    loose.remove()
    guarded.remove()
  })
})
