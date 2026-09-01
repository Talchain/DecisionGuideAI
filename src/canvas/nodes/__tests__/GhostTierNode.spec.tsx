/**
 * ⭐ THE DOOR ITSELF — the component that had NO TEST AT ALL.
 *
 * `GhostTierNode` is the rendered half of the reasoning frontier: the dashed
 * door a team clicks to ask Olumi what the model might be missing, or — after
 * a result — what could overturn it. It shipped in `#1060`, was generalised
 * here, and until this file nothing in the repo rendered it.
 *
 * ⚠ TWO MUTANTS PROVED THE HOLE, and both are the reason each test below
 * exists rather than a generic "it renders" pass:
 *
 *   1. `const Icon = data.variant === 'challenge' ? HelpCircle : Plus`
 *      → `const Icon = Plus` — the whole glyph distinction reverted, so a
 *      post-analysis "What could break this" door tells the user it INSERTS a
 *      node. **46/46 green.**
 *   2. `data-variant={data.variant ?? 'extend'}` → `data-variant="extend"` —
 *      hardcoded. This attribute is the PR's own stated witness handle, the
 *      thing a driven browser check would read to tell the two frontiers apart
 *      in the DOM without depending on copy. **46/46 green**, i.e. it was
 *      cited as the witness while nothing read it.
 *
 * So this file makes the attribute load-bearing rather than decorative, and
 * binds the glyph by IDENTITY.
 *
 * ⚠ THE GLYPH EXPECTATION IS DERIVED, NOT SPELLED. `lucide-plus` /
 * `lucide-help-circle` are lucide's own class names, and a hand-copied pair
 * would be a mirror that goes stale on a library bump while reading green. The
 * markers below are read out of the SAME `Plus` / `HelpCircle` components the
 * node imports, so a rename cannot produce a false pass.
 *
 * ⚠ AND WHAT THIS CANNOT SHOW: jsdom proves the attribute and the glyph are in
 * the DOM. It proves nothing about what a user SEES — size, contrast, whether
 * the door is inside the viewport. That is a browser claim and is not made here.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ComponentType } from 'react'
import { Plus, HelpCircle } from 'lucide-react'
import { ReactFlowProvider } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { GhostTierNode, GHOST_TIER_TESTID } from '../GhostTierNode'
import { useGuidanceStore } from '../../stores/guidanceStore'

/**
 * The `lucide-*` class the library gives an icon, read from the component
 * itself. This is the derivation that keeps the two glyph assertions honest:
 * nothing here restates a string lucide owns.
 */
function lucideMarker(Icon: ComponentType<{ className?: string }>): string {
  const { container, unmount } = render(<Icon />)
  const cls = container.querySelector('svg')?.getAttribute('class') ?? ''
  unmount()
  const marker = cls.split(/\s+/).find((t) => t.startsWith('lucide-'))
  // An extraction that silently produced nothing agrees with every other
  // extraction that produced nothing — refuse rather than assert on ''.
  if (!marker) throw new Error(`refusing to assert: no lucide-* class in "${cls}"`)
  return marker
}

type GhostData = { label?: string; prompt?: string; tier?: string; variant?: 'extend' | 'challenge' }

function renderDoor(data: GhostData) {
  const utils = render(
    <ReactFlowProvider>
      <GhostTierNode {...({ id: 'n', data, type: 'ghost-tier' } as unknown as NodeProps)} />
    </ReactFlowProvider>,
  )
  return { ...utils, door: screen.getByTestId(GHOST_TIER_TESTID) }
}

const glyphOf = (door: HTMLElement) => door.querySelector('svg')?.getAttribute('class') ?? ''

describe('GhostTierNode — the door a team opens to ask what the model is missing', () => {
  beforeEach(() => {
    useGuidanceStore.setState({ _sendMessage: null })
  })

  it('carries the tier and the label it was given', () => {
    const { door } = renderDoor({ label: 'Another risk', tier: 'risk', variant: 'extend' })
    expect(door).toHaveAttribute('data-tier', 'risk')
    expect(door).toHaveAccessibleName('Another risk')
    expect(door.textContent).toContain('Another risk')
  })

  it('SURFACES THE VARIANT — the witness handle, now actually read by something', () => {
    // Mutant 2 above: hardcoding this to "extend" was invisible to 46 tests.
    // Both directions are asserted, so a hardcode in EITHER direction reds.
    expect(renderDoor({ variant: 'challenge', tier: 'option' }).door).toHaveAttribute(
      'data-variant',
      'challenge',
    )
  })

  it('SURFACES THE VARIANT: the pre-analysis door says so too', () => {
    expect(renderDoor({ variant: 'extend', tier: 'option' }).door).toHaveAttribute(
      'data-variant',
      'extend',
    )
  })

  it('defaults the variant to extend when a node is built by an older path', () => {
    // The component's stated fallback: a door with no variant keeps the
    // appearance it already had rather than silently acquiring a new one.
    const { door } = renderDoor({ tier: 'option' })
    expect(door).toHaveAttribute('data-variant', 'extend')
    expect(glyphOf(door)).toContain(lucideMarker(Plus))
  })

  it('THE GLYPH FOLLOWS THE VARIANT — a challenge door does not say "insert"', () => {
    // Mutant 1 above. A `+` on "What could break this" would tell the user the
    // door adds a node to the model, which it has never done.
    const { door } = renderDoor({ variant: 'challenge', tier: 'risk' })
    expect(glyphOf(door)).toContain(lucideMarker(HelpCircle))
  })

  it('DISCRIMINATING PAIR: the extend door carries the other glyph, not this one', () => {
    // Neither half alone binds the assertion above to the VARIANT — a node that
    // always rendered HelpCircle would satisfy it. This is the twin that makes
    // the pair discriminate, and it is why `const Icon = Plus` cannot survive.
    const plus = lucideMarker(Plus)
    const help = lucideMarker(HelpCircle)
    expect(plus).not.toEqual(help)
    const extend = glyphOf(renderDoor({ variant: 'extend', tier: 'risk' }).door)
    expect(extend).toContain(plus)
    expect(extend).not.toContain(help)
  })

  it('SENDS THE PROMPT IT WAS BUILT WITH — verbatim, not a sentence of its own', () => {
    // ⚠ BOUND BY IDENTITY TO THE STRING PASSED IN. The whole reason the
    // post-analysis option door is a `ghost-tier` and not the legacy
    // `GhostOptionNode` is that the legacy component HARDCODES its sentence and
    // cannot carry a prompt built from the model and the run. A node that
    // composed its own text would re-open exactly that defect, and an assertion
    // like "sendMessage was called" could not see it.
    const send = vi.fn()
    useGuidanceStore.setState({ _sendMessage: send })
    const prompt = 'My model has 2 options: Segment, Rudderstack. I have run an analysis on these.'
    const { door } = renderDoor({ prompt, variant: 'challenge', tier: 'option' })
    fireEvent.click(door)
    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith(prompt)
  })

  it('opens on Enter and on Space — the door is operable without a mouse', () => {
    const send = vi.fn()
    useGuidanceStore.setState({ _sendMessage: send })
    const { door } = renderDoor({ prompt: 'ask', variant: 'extend', tier: 'factor' })
    fireEvent.keyDown(door, { key: 'Enter' })
    fireEvent.keyDown(door, { key: ' ' })
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('CONTRAST CONTROL: an unrelated key does not open it', () => {
    // Without this, "Enter sends" is equally satisfied by a handler that sends
    // on every keystroke.
    const send = vi.fn()
    useGuidanceStore.setState({ _sendMessage: send })
    const { door } = renderDoor({ prompt: 'ask', variant: 'extend', tier: 'factor' })
    fireEvent.keyDown(door, { key: 'a' })
    expect(send).not.toHaveBeenCalled()
  })

  it('a door with no prompt asks NOTHING — it does not fall back to a generic line', () => {
    // A default sentence here would be the generic ask `#1060` exists to
    // abolish, and it would arrive in the user's own transcript under the
    // user's own name. Silence is the honest failure mode.
    const send = vi.fn()
    useGuidanceStore.setState({ _sendMessage: send })
    const { door } = renderDoor({ variant: 'extend', tier: 'risk' })
    fireEvent.click(door)
    expect(send).not.toHaveBeenCalled()
  })

  it('ADDS NOTHING TO THE MODEL: the door is not selectable, draggable or connectable', () => {
    // Asserted where the node is BUILT rather than here — see
    // `ghostSuggestionsMountPath.spec.ts`. Recorded in this file only so the
    // claim is not assumed to live in the component: `GhostTierNode` renders a
    // button, and it is `composeFrontier`/`withGhostTiers` that fix the flags.
    const { door } = renderDoor({ variant: 'extend', tier: 'risk' })
    expect(door).toHaveAttribute('role', 'button')
    expect(door).toHaveAttribute('tabIndex', '0')
  })
})
