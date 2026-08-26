/**
 * The Inspector's read-only policy, pinned IN ITS ENFORCED FORM.
 *
 * ⭐ WHY THIS FILE EXISTS — the unenforced mirror is gone (26 Aug 2026).
 * `useInspectorMutations.ts` used to carry two authority manifests,
 * `NODE_SETTER_AUTHORITY` (21 keys) and `EDGE_SETTER_AUTHORITY` (5), every
 * value `'disabled'`. They were DELETED because they had **zero code
 * consumers**: every reference to either, outside their own definition and
 * `mutationAuthority.spec.ts`, was a COMMENT. Nothing branched on them, so
 * nothing could drift from them — and a table that cannot drift also cannot
 * enforce. Contrast control at the time of deletion: `useNodeMutations` /
 * `useEdgeMutations` were imported by 30+ files, so the sweep that returned
 * zero for the tables was demonstrably able to see consumers.
 *
 * The ACTUAL enforcement was, and remains, structural: `InspectorRouter` wraps
 * every panel — node and edge — in an unconditional
 * `<fieldset disabled data-authority="disabled">`, beneath a note carrying
 * `INSPECTOR_READ_ONLY_REASON`. That is strictly STRONGER than the manifests
 * were: a fieldset disables every descendant control, so a NEW setter added
 * tomorrow is inert without anyone remembering to classify it. The manifests
 * could only ever record a decision; the fieldset makes it.
 *
 * ⚠ WHAT THE PRE-EXISTING GUARD DID NOT COVER, and why deleting the tables
 * without this file would have left the fieldset UNEXPLAINED — an unexplained
 * enforcement being the next thing someone tidies away:
 *
 *   1. `InspectorRouter.spec.tsx` asserts the notice contains the SUBSTRING
 *      `'cannot yet be saved to the shared model'`. That is a hand-copied
 *      mirror of the copy: inline the constant as a literal, or reword the
 *      constant around that fragment, and it still passes. Here the expectation
 *      IS the imported constant, so the copy and its guard cannot diverge.
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
 * ── BINDING BY IDENTITY, AND THE DISCRIMINATING PAIR ────────────────────────
 * `InspectorRouter` has TWO independent boundary regions — the edge branch
 * (`InspectorRouter.tsx:221`) and the node branch (`:334`). Every assertion
 * below names WHICH region it is about and resolves it through that region's
 * own rendered panel, never through a bare
 * `document.querySelector('fieldset')` that either region could satisfy.
 * That is what makes the mutant pair discriminating: breaking ONE region must
 * RED only that region's cases and leave the other GREEN. A single biting
 * mutant would prove only sensitivity to *something*; the pair proves
 * sensitivity to the named region.
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
 * the DOM, not of a table: the assertions below hold no matter how many
 * setters exist, which is precisely why they cannot go stale the way a
 * hand-maintained key list did.
 *
 * ⚠⚠ AND THE INSTRUMENT TRAP THIS FILE HIT WHILE BEING WRITTEN, KEPT BECAUSE
 * THE NEXT PERSON WILL HIT IT TOO. The first version of these two cases
 * filtered on the RAW DOM PROPERTY `(el as HTMLInputElement).disabled`. It
 * FAILED, reporting two enabled `<input type="range">` inside a fieldset that
 * is unambiguously `disabled` — because **jsdom reflects the `disabled`
 * ATTRIBUTE and does not propagate a `<fieldset disabled>` to its
 * descendants' property.** In a real browser those inputs are inert; in jsdom
 * the property says otherwise.
 *
 * So the raw property is not an actionability check — it is a check on where
 * the attribute happens to be written. `expect(el).toBeDisabled()` IS
 * ancestor-aware (jest-dom walks up for a disabled fieldset), which is why the
 * per-region cases above passed while this block failed on the same DOM. The
 * helper below derives effective disabled-ness explicitly rather than trusting
 * either reflection, so the assertion means what it says.
 *
 * Had it been left as written, the "fix" would have looked like removing the
 * assertion or narrowing it past the sliders — weakening a guard to match a
 * broken probe.
 */
function isEffectivelyDisabled(el: HTMLElement): boolean {
  if ((el as HTMLInputElement).disabled) return true
  // Walk ancestors for a disabled <fieldset>, which natively disables every
  // descendant control (outside its first <legend>).
  let ancestor: HTMLElement | null = el.parentElement
  while (ancestor) {
    if (ancestor.tagName === 'FIELDSET' && ancestor.hasAttribute('disabled')) return true
    ancestor = ancestor.parentElement
  }
  return false
}

describe('Inspector read-only policy — no control escapes the boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cleanup()
  })

  it('leaves no effectively-enabled editing control anywhere in the node panel', () => {
    // ⚠ NOT the risk fixture used above. The risk panel renders only <button>
    // controls, so this completeness claim over input/select/textarea was
    // VACUOUS against it — caught by the precondition below, which is the
    // whole reason the precondition is written as an assertion rather than a
    // comment. A controllable factor renders a real number input, so the
    // claim has something to be true ABOUT.
    setStoreState(CONTROLLABLE_FACTOR_FIXTURE)
    render(<InspectorRouter nodeId="f1" edgeId={null} onClose={vi.fn()} />)

    const { fieldset } = readBoundary()
    const editing = Array.from(
      fieldset.querySelectorAll<HTMLElement>('input, select, textarea'),
    )
    // Precondition: a completeness claim over an empty set is vacuous.
    expect(editing.length).toBeGreaterThan(0)

    const escaped = editing.filter(el => !isEffectivelyDisabled(el))
    expect(escaped.map(el => el.getAttribute('aria-label') ?? el.tagName)).toEqual([])
  })

  it('leaves no effectively-enabled editing control anywhere in the edge panel', () => {
    setStoreState(EDGE_FIXTURE_NODES, EDGE_FIXTURE_EDGES)
    render(<InspectorRouter nodeId={null} edgeId="e1" onClose={vi.fn()} />)

    const { fieldset } = readBoundary()
    const editing = Array.from(
      fieldset.querySelectorAll<HTMLElement>('input, select, textarea'),
    )
    expect(editing.length).toBeGreaterThan(0)

    const escaped = editing.filter(el => !isEffectivelyDisabled(el))
    expect(escaped.map(el => el.getAttribute('aria-label') ?? el.tagName)).toEqual([])
  })

  it('POSITIVE CONTROL: the helper reports an ungoverned control as NOT disabled', () => {
    // Without this, `isEffectivelyDisabled` returning `true` unconditionally
    // would make both cases above pass while observing nothing (trap 13 — an
    // absence probe needs to be shown capable of detecting a presence).
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
