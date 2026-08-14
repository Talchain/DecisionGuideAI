/**
 * GroundedFocusNotice — THE HONESTY PAIR, and the mount path that carries it.
 *
 * The load-bearing acceptance condition of hop 4b's UI half is not that a
 * grounded node lights up. It is that the two "nothing lit up" states stay
 * APART:
 *
 *   · `not_in_model`    — the graph WAS read and does not contain what the user
 *                         pointed at. Marking nothing is honest, and the notice
 *                         stays silent.
 *   · `could_not_check` — the graph could NOT be read. Rendering that as an
 *                         empty canvas tells the user their node is gone on the
 *                         strength of a lookup that never happened, which
 *                         reintroduces at the pixel layer exactly the
 *                         conflation CEE's hop 3 and hop 4 were built to keep
 *                         apart.
 *
 * With node marks alone the two are indistinguishable — both mark nothing —
 * so the discrimination has to live in a surface, and this is that surface.
 *
 * ⚠ SCOPE (trap 3): jsdom proves the element is IN THE DOM. It cannot prove it
 * is visible, laid out, or legible. Those are browser claims and are made in a
 * browser, not here.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { GroundedFocusNotice } from '../GroundedFocusNotice'
import { useCanvasStore } from '../../store'

const NOTICE = 'grounded-focus-could-not-check'

/** Drive the REAL store action rather than writing the slice directly, so the
 *  spec exercises the production path into this component. */
function ground(unresolved: 'none' | 'not_in_model' | 'could_not_check', ids: string[] = []) {
  useCanvasStore.getState().setGroundedFocus({ nodeIds: ids, unresolved })
}

beforeEach(() => {
  useCanvasStore.setState({
    highlightedNodes: new Set<string>(),
    groundedFocus: { nodeIds: new Set<string>(), unresolved: null },
  })
})

describe('GroundedFocusNotice — the two empty states are not the same state', () => {
  it('SPEAKS when the model could not be read, saying EXACTLY this and nothing more', () => {
    ground('could_not_check')
    render(<GroundedFocusNotice />)

    const notice = screen.getByTestId(NOTICE)
    expect(notice).toBeInTheDocument()

    // ⭐ EXACT TEXT, NOT A PHRASE PREDICATE — and the difference is a real
    // defect this assertion used to have. It was a positive phrase match
    // (`/couldn.t read your model/i`) plus a hand-written list of forbidden
    // words (`/not found|doesn.t exist|no longer/i`). An adversarial probe
    // defeated it in one line: rewriting the copy to
    //
    //   "I couldn't read your model to check what you selected — that element
    //    has been removed from your model"
    //
    // satisfied the positive phrase, dodged all three forbidden words, and
    // stayed GREEN — while asserting the EXACT false claim this component
    // exists to prevent. A forbidden-word list is a hand-maintained mirror
    // (trap 12) and the space of ways to say "your node is gone" is unbounded,
    // so no list can cover it.
    //
    // Binding the whole sentence inverts the problem: the honest copy is
    // enumerable and short, every other sentence in the language fails, and a
    // deliberate copy change must come here and be read.
    expect(notice.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'I couldn’t read your model to check what you selected, so I can’t show it on the canvas.',
    )
  })

  it('makes no claim about the element in either direction', () => {
    // The secondary guard, kept as a CLASS rather than a word list: the copy
    // must not assert presence or absence. Retained because it states the
    // PROPERTY, while the exact-text bind above is what actually enforces it —
    // if this test ever disagrees with that one, the copy changed and both
    // must be re-read.
    ground('could_not_check')
    render(<GroundedFocusNotice />)

    const text = screen.getByTestId(NOTICE).textContent ?? ''
    expect(text).not.toMatch(/removed|deleted|not found|doesn.t exist|no longer|is gone/i)
    // It says what is NOT known...
    expect(text).toMatch(/couldn.t read your model/i)
    // ...and does not tell the user their element is or is not there.
    expect(text).not.toMatch(/\bis (still )?(in|on) your model\b/i)
  })

  it('STAYS SILENT when the model was read and the element is not in it', () => {
    ground('not_in_model')
    render(<GroundedFocusNotice />)

    expect(screen.queryByTestId(NOTICE)).not.toBeInTheDocument()
  })

  it('the pair DISCRIMINATES on otherwise identical state', () => {
    // Asserted as a pair on the same empty id set, because each half alone is
    // satisfied by a component that renders unconditionally (or never).
    ground('could_not_check')
    const { unmount } = render(<GroundedFocusNotice />)
    const spoke = screen.queryByTestId(NOTICE) !== null
    unmount()

    ground('not_in_model')
    render(<GroundedFocusNotice />)
    const silent = screen.queryByTestId(NOTICE) === null

    expect(spoke).toBe(true)
    expect(silent).toBe(true)
  })

  it('stays silent on a fully resolved grounding', () => {
    ground('none', ['node-a'])
    render(<GroundedFocusNotice />)

    expect(screen.queryByTestId(NOTICE)).not.toBeInTheDocument()
  })

  it('stays silent on a turn that was never grounded at all', () => {
    useCanvasStore.getState().setGroundedFocus(null)
    render(<GroundedFocusNotice />)

    expect(screen.queryByTestId(NOTICE)).not.toBeInTheDocument()
    expect(useCanvasStore.getState().groundedFocus.unresolved).toBeNull()
  })

  it('is announced to assistive technology as status, not as an alert', () => {
    ground('could_not_check')
    render(<GroundedFocusNotice />)

    const notice = screen.getByTestId(NOTICE)
    expect(notice).toHaveAttribute('role', 'status')
    expect(notice).toHaveAttribute('aria-live', 'polite')
  })
})

describe('the mount path — trap 3b: a component the deployment never renders', () => {
  // This estate has twice shipped a badge dark by testing a component the
  // deployed flags do not mount. The render tests above are silent about that
  // by construction, so the mount path is asserted directly at the source of
  // the canvas that hosts it.
  //
  // ⚠ SCOPE, precisely: this is a STRUCTURAL claim about `ReactFlowGraph.tsx`
  // — that the notice sits in the same unconditional chip rail as a surface
  // already known to reach users. It is not a render proof of that file.
  const graphSource = readFileSync(
    resolve(__dirname, '../../ReactFlowGraph.tsx'),
    'utf8',
  )

  it('POSITIVE CONTROL: the probe finds FocusModeChip, a surface known to be live', () => {
    // Without this, "the notice is mounted" could be passing because the probe
    // matches anything, or because it read the wrong file.
    expect(graphSource.length).toBeGreaterThan(0)
    expect(graphSource).toMatch(/<FocusModeChip\s*\/>/)
  })

  it('BaseNode reads the grounded set and gives it the SAME emphasis treatment', () => {
    // The node marks are the other half of the visible slice, and after the
    // ownership fix they ride `groundedFocus.nodeIds` rather than the shared
    // `highlightedNodes`. Two claims, both structural: the selector exists,
    // and it drives the SAME `ai-highlight-pulse` class — one emphasis
    // language on the canvas, per the spec.
    const baseNode = readFileSync(resolve(__dirname, '../../nodes/BaseNode.tsx'), 'utf8')

    // POSITIVE CONTROL: the probe can see the pre-existing shared-channel
    // selector, so a miss below is absence rather than blindness.
    expect(baseNode).toMatch(/useCanvasStore\(s\s*=>\s*s\.highlightedNodes\.has\(id\)\)/)

    expect(baseNode).toMatch(/s\.groundedFocus\?\.nodeIds\?\.has\(id\)/)
    // Same treatment, one class, driven by either channel.
    expect(baseNode).toMatch(/isHighlighted \|\| isGroundedFocus\s*\?\s*'ring-4 ring-info\/60 ai-highlight-pulse'/)
  })

  it('mounts GroundedFocusNotice in the same rail as FocusModeChip', () => {
    expect(graphSource).toMatch(/<GroundedFocusNotice\s*\/>/)

    const chip = graphSource.indexOf('<FocusModeChip />')
    const notice = graphSource.indexOf('<GroundedFocusNotice />')
    expect(chip).toBeGreaterThan(-1)
    expect(notice).toBeGreaterThan(chip)

    // Nothing conditional between the two: the notice inherits exactly the
    // reachability of the chip. A flag or `&&` introduced here would make the
    // notice dark while every render test above stayed green.
    const between = graphSource.slice(chip, notice)
    expect(between).not.toMatch(/&&|\?\s*\(|\bif\s*\(/)
  })
})
