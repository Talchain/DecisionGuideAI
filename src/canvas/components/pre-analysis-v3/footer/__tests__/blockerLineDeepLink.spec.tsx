/**
 * EVERY BLOCKER LINE TAKES THE USER TO THE THING IT IS ABOUT — OR SAYS NOTHING.
 *
 * ── THE REGRESSION THIS CLOSES ─────────────────────────────────────────────
 * The retired `pre-analysis/BlockersSection` deep-linked every blocker
 * (`onFocusNode(id)`, `aria-label="Open … in inspector"`,
 * `data-testid="blocker-option-link-<id>"`). The v3 footer replaced it with
 * inert `<li>` strings, so a tester reading *"Choose the missing effect value
 * for X on Y."* five times over then hunted each pair on the canvas by hand.
 * That hunting is the friction, not the sentences.
 *
 * ── THE TWO OPPOSITE HARMS, AND THE TWIN FOR EACH ──────────────────────────
 * A missing link costs the user a hunt. A link that goes NOWHERE is worse: it
 * advertises an action that terminates in refusal, which is the defect class
 * this product exists to delete. They cannot share one window, so:
 *   · every "a link must appear" case has a "and this one must stay plain text"
 *     twin, on the SAME component with the SAME shape of input;
 *   · the resolution is asserted against the LIVE graph, not against the
 *     producer's id — those are two id spaces.
 *
 * ⚠ NOTHING HERE ASSERTS AN ORDER. The lines render in the order given.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Node } from '@xyflow/react'
import { BlockerLine, resolveBlockerTarget } from '../BlockerLine'
import { useCanvasStore } from '../../../../store'
import { registerFocusHelpers } from '../../../../utils/focusHelpers'

const KEEP_SENTENCE =
  'Choose the missing effect value for "keep what we have" on "Current CRM Capability Gap".'

/** A canvas as the user has it: two option nodes, real ids, real labels. */
const NODES = [
  { id: 'opt_keep', position: { x: 0, y: 0 }, data: { label: 'keep what we have' } },
  { id: 'opt_migrate', position: { x: 0, y: 0 }, data: { label: 'migrate to Salesforce instead' } },
] as unknown as Node[]

let focused: string[] = []
let unregister: (() => void) | null = null

beforeEach(() => {
  focused = []
  unregister = registerFocusHelpers(
    (id) => focused.push(id),
    () => {},
  )
  useCanvasStore.setState({ nodes: NODES } as never)
})

afterEach(() => {
  unregister?.()
  unregister = null
})

describe('BlockerLine — the deep-link is offered only where it resolves', () => {
  it('PRECONDITION: the canvas really holds the node the fixtures name', () => {
    // Without this the "renders plain text" cases below could pass because the
    // store was empty, not because the resolver refused — a guard agreeing with
    // itself.
    expect(useCanvasStore.getState().nodes.map((n) => n.id)).toContain('opt_keep')
  })

  it('a blocker scoped to a node ON THE CANVAS renders as a control', () => {
    render(<BlockerLine item={{ text: KEEP_SENTENCE, scope: { id: 'opt_keep' } }} />)
    // Bound by IDENTITY: the testid names the node this line is about, so a
    // link pointing at a DIFFERENT node fails rather than passing on a count.
    expect(screen.getByTestId('blocker-option-link-opt_keep')).toHaveTextContent(KEEP_SENTENCE)
  })

  it('activating it focuses THAT node — the act the affordance promises', async () => {
    render(<BlockerLine item={{ text: KEEP_SENTENCE, scope: { id: 'opt_keep' } }} />)
    await userEvent.click(screen.getByTestId('blocker-option-link-opt_keep'))
    expect(focused).toEqual(['opt_keep'])
  })

  it('it names its destination to a screen reader', () => {
    render(<BlockerLine item={{ text: KEEP_SENTENCE, scope: { id: 'opt_keep' } }} />)
    expect(screen.getByTestId('blocker-option-link-opt_keep')).toHaveAttribute(
      'aria-label',
      `Open "${KEEP_SENTENCE}" in the inspector`,
    )
  })

  it('TWIN: a blocker whose node is NOT on the canvas renders PLAIN TEXT, never a dead control', () => {
    render(<BlockerLine item={{ text: KEEP_SENTENCE, scope: { id: 'opt_vanished' } }} />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText(KEEP_SENTENCE)).toBeInTheDocument()
  })

  it('TWIN: a blocker with NO scope at all renders plain text', () => {
    // The validation-error case: `graphHealth.issues` carries no node id.
    render(<BlockerLine item={{ text: 'Connection from "Speed" to "Revenue" has no effect direction' }} />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('resolves by LABEL when the producer id is not a canvas id', () => {
    render(
      <BlockerLine
        item={{ text: KEEP_SENTENCE, scope: { id: 'cee_internal_42', label: 'keep what we have' } }}
      />,
    )
    expect(screen.getByTestId('blocker-option-link-opt_keep')).toBeInTheDocument()
  })

  it('TWIN: a FUZZY label match is NOT good enough to navigate on', () => {
    // `findNodeMatches` also returns `contains` matches. A guess that takes the
    // user to the wrong node looks exactly as authoritative as a correct link,
    // so only an EXACT match earns a control.
    expect(
      resolveBlockerTarget({ text: KEEP_SENTENCE, scope: { label: 'keep' } }, NODES),
    ).toBeNull()
  })

  it('THE FOCUS TARGET IS THE MATCHED NODE ID, never the producer’s raw id', () => {
    expect(
      resolveBlockerTarget(
        { text: KEEP_SENTENCE, scope: { id: 'cee_internal_42', label: 'keep what we have' } },
        NODES,
      ),
    ).toBe('opt_keep')
  })
})
