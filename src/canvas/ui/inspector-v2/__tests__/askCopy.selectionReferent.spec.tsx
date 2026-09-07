/**
 * ⭐ THE PRONOUN IS ONLY SAFE WHILE SOMETHING ON SCREEN NAMES THE ELEMENT.
 *
 * `ASK_TEMPLATES` de-labelled every ask ("How important is this to the
 * outcome?") on a three-leg argument, and the third leg was a claim about the
 * SCREEN: *"the composer's selection pill shows the user WHICH element is
 * attached"*. Measured at `7294c12d`, that leg is false in a reachable state:
 *
 *   · `SelectionPill` has exactly ONE product mount site — `OutputsDock.tsx`,
 *     inside `{aiPanelV2On && effectiveIsOpen ? … : null}`. A collapsed dock
 *     mounts no pill.
 *   · `revealOlumiSurface()` returns at its `if (focusFloating()) return true`
 *     branch when a floating/first-use composer is on screen, and DELIBERATELY
 *     does not claim the dock there — so the collapsed dock stays collapsed.
 *   · `requestAsk` reaches that state through `_prefillChat`, which
 *     `FloatingOlumiPanel`'s `ConversationPanel` registers, and the composer
 *     path DISCARDS `req.label` — so the drawer's "Ask about X" heading, the
 *     only other on-screen name, is never rendered either.
 *
 * The user then reads "How important is this to the outcome?" with no referent
 * anywhere on screen. That is the ambiguity the templates' own header names.
 *
 * These pins hold the two arms apart. They bind by ELEMENT IDENTITY, not by a
 * value predicate: the third case mounts a pill naming a DIFFERENT element and
 * still expects the name, so a gate that merely asked "is any pill mounted?"
 * fails here.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Mutable hook mocks the tests reconfigure — the convention `SelectionPill.spec.tsx`
// already uses. `importOriginal` is spread so an export added later is not
// silently absent (the mock-factory-replaces-the-module trap).
const selectionState: { value: { id: string; label: string; kind: 'node' | 'edge' } | null } = {
  value: null,
}
const carriageState: { value: { kind: string; selectedCount?: number; cap?: number } } = {
  value: { kind: 'none' },
}

vi.mock('../../../hooks/useSelectionContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../hooks/useSelectionContext')>()),
  useSelectionContext: () => selectionState.value,
  useSelectionCarriage: () => carriageState.value,
}))

vi.mock('../../../conversation/revealOlumi', () => ({
  revealOlumiSurface: vi.fn(),
}))

vi.mock('@xyflow/react', () => ({
  useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
}))

import { SelectionPill } from '../../../components/SelectionPill'
import { InspectorQuickActions } from '../shared/InspectorQuickActions'
import { useGuidanceStore } from '../../../stores/guidanceStore'

const ELEMENT_ID = 'f1'
const ELEMENT_LABEL = 'Marketing Budget'
/** The de-labelled copy under test, for `factor-controllable`. */
const PRONOUN_QUESTION = 'How important is this to the outcome?'

function quickActions() {
  return (
    <InspectorQuickActions
      elementId={ELEMENT_ID}
      elementLabel={ELEMENT_LABEL}
      panelType="factor-controllable"
    />
  )
}

let prefill: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  selectionState.value = null
  carriageState.value = { kind: 'none' }
  prefill = vi.fn()
  useGuidanceStore.setState({
    _prefillChat: prefill,
    _sendMessage: null,
    _sendChip: null,
    _scrollToPatch: null,
    _runAnalysis: null,
    _dispatchAction: null,
  } as never)
})

/** The single draft the ask landed in the composer. */
function draft(): string {
  expect(prefill).toHaveBeenCalledTimes(1)
  return String(prefill.mock.calls[0][0])
}

describe('ask copy · the pronoun follows the on-screen referent', () => {
  it('pill-less floating composer — the draft NAMES the element', () => {
    // No `SelectionPill` in the tree: the dock is collapsed and the floating
    // panel is hosting, which is exactly the state `revealOlumiSurface()`
    // leaves alone. The composer channel IS registered, so the ask lands here
    // and not in the drawer that would have shown "Ask about X".
    selectionState.value = { id: ELEMENT_ID, label: ELEMENT_LABEL, kind: 'node' }
    carriageState.value = { kind: 'carried' }
    render(quickActions())

    // The absence is real, not a blind query: the quick-action row IS present.
    expect(screen.queryByTestId('ai-panel-selection-pill')).toBeNull()
    expect(screen.getByTestId('inspector-quick-actions')).toBeTruthy()

    fireEvent.click(screen.getByTestId('inspector-quick-ask'))
    expect(draft()).toContain(ELEMENT_LABEL)
  })

  it('docked composer whose pill names THIS element — the draft drops the name', () => {
    selectionState.value = { id: ELEMENT_ID, label: ELEMENT_LABEL, kind: 'node' }
    carriageState.value = { kind: 'carried' }
    render(
      <>
        <SelectionPill />
        {quickActions()}
      </>,
    )

    // The referent really is on screen, from the real component.
    const pill = screen.getByTestId('ai-panel-selection-pill')
    expect(pill).toHaveTextContent(ELEMENT_LABEL)

    fireEvent.click(screen.getByTestId('inspector-quick-ask'))
    expect(draft()).toBe(PRONOUN_QUESTION)
    expect(draft()).not.toContain(ELEMENT_LABEL)
  })

  it('a pill naming a DIFFERENT element is not a referent for this one', () => {
    // Binds by identity. A gate reading "is a pill mounted?" passes the case
    // above and fails here.
    selectionState.value = { id: 'some-other-node', label: 'Headcount', kind: 'node' }
    carriageState.value = { kind: 'carried' }
    render(
      <>
        <SelectionPill />
        {quickActions()}
      </>,
    )

    expect(screen.getByTestId('ai-panel-selection-pill')).toHaveTextContent('Headcount')

    fireEvent.click(screen.getByTestId('inspector-quick-ask'))
    expect(draft()).toContain(ELEMENT_LABEL)
  })

  it('a WITHHELD selection names no element, so the draft carries the name', () => {
    // The pill mounts and speaks, but it renders the over-cap notice rather
    // than a name — "mounted" and "naming the element" are different claims.
    selectionState.value = null
    carriageState.value = { kind: 'withheld_over_cap', selectedCount: 21, cap: 20 }
    render(
      <>
        <SelectionPill />
        {quickActions()}
      </>,
    )

    const pill = screen.getByTestId('ai-panel-selection-pill')
    expect(pill).toBeTruthy()
    expect(pill).not.toHaveTextContent(ELEMENT_LABEL)

    fireEvent.click(screen.getByTestId('inspector-quick-ask'))
    expect(draft()).toContain(ELEMENT_LABEL)
  })
})
