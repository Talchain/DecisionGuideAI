/**
 * ⭐⭐ THE HOVER HINT SAYS WHAT THE BUTTON DOES. THE ACCESSIBLE NAME SAYS WHICH
 * NODE IT ACTS ON. THEY ARE NOT THE SAME STRING, AND THIS FILE PINS BOTH.
 *
 * All three quick actions used to hand the node's own label to their tooltip:
 * "Ask Olumi about {label}", "Challenge {label} — what could be wrong or
 * missing?", "More actions for {label} — the same menu as right-click". Every
 * one was true. Together they were the wrong instrument for a canvas node:
 *
 *  - A node title clamps to two lines on the card; a tooltip has no clamp, and
 *    `Tooltip.tsx` caps width at 200px and WRAPS. So a real option name buys
 *    HEIGHT — a tall box painted over the card the pointer is resting on, i.e.
 *    over the thing you hovered in order to act on it.
 *  - The label is already on that card, and the pointer is inside it. Spending
 *    the hint on context the reader can see leaves the BUTTON's own meaning to
 *    be guessed from an 11px icon.
 *  - A screen-reader user reaching these by Tab has no spatial context at all,
 *    which is why `aria-label` must keep the node identity — and does.
 *
 * ⚠ WHY THIS SUITE MOCKS `Tooltip` RATHER THAN OPENING ONE. The real component
 * is floating-ui behind a 300 ms `useHover` delay and a `FloatingPortal`, so a
 * test that opens it measures timers and portals. The claim under test is
 * narrower and is entirely this component's: WHICH COPY IT HANDS THE TOOLTIP.
 * The mock is therefore the right instrument — and it is only sound because the
 * precondition below is pinned in-test: every button must be found INSIDE a
 * `[data-tooltip-content]` wrapper. Drop a `Tooltip` and this file REDs, rather
 * than reading `null` and agreeing with itself (trap 13b — a guard whose
 * discrimination depends on a fixture nothing pins).
 *
 * ⚠ WHAT IT DOES NOT PROVE: that a tooltip is visible, positioned, dismissible
 * or reachable by keyboard. Those are the real component's, covered where it
 * lives. jsdom cannot prove visibility (CLAUDE.md trap 3) and this file does not
 * claim to.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NodeQuickActions } from '../NodeQuickActions'
import { useCanvasStore } from '../../../store'
import { useGuidanceStore } from '../../../stores/guidanceStore'

vi.mock('../../../../components/Tooltip', () => ({
  default: ({ children, content }: { children: React.ReactNode; content: React.ReactNode }) => (
    <span data-tooltip-content={String(content)}>{children}</span>
  ),
}))

/**
 * Long on purpose, and shaped like a real one. This is the input class the
 * change exists for: a team's own option name, not "Hiring spend".
 */
const LABEL = 'Raise Pro from £49 to £59 alongside the Q3 feature release'

const NODE = { id: 'node-a', type: 'option', position: { x: 0, y: 0 }, data: { label: LABEL } }

/** The hint for one button, bound to that button BY IDENTITY (its testid). */
const hintFor = (testId: string): string => {
  const button = screen.getByTestId(testId)
  const wrapper = button.closest('[data-tooltip-content]')
  // PRECONDITION, PINNED IN-TEST: without a wrapper there is no tooltip at all,
  // and every assertion below would pass on an empty string.
  expect(wrapper, `${testId} is not inside a Tooltip`).not.toBeNull()
  return wrapper!.getAttribute('data-tooltip-content') ?? ''
}

describe('quick-action hints name the action, not the node', () => {
  beforeEach(() => {
    useCanvasStore.setState({ nodes: [NODE] } as never)
    // Both AI shortcuts need the send channel; with none, only More renders and
    // the label-absence sweep below would be near-vacuous.
    useGuidanceStore.setState({ _sendMessage: vi.fn() } as never)
  })

  it('gives each button a short hint that does NOT repeat the node label', () => {
    render(<NodeQuickActions nodeId="node-a" nodeType="option" label={LABEL} />)

    expect(hintFor('node-action-ask-node-a')).toBe('Ask Olumi')
    expect(hintFor('node-action-challenge-node-a')).toBe('Challenge this option')
    expect(hintFor('node-action-menu-node-a')).toBe('More actions')
  })

  it('sweeps EVERY hint in the row for the label, enumerated from the DOM', () => {
    render(<NodeQuickActions nodeId="node-a" nodeType="option" label={LABEL} />)
    const wrap = document.querySelector('.node-quick-actions') as HTMLElement
    const buttons = [...wrap.querySelectorAll('button')]

    // A hand-listed set of buttons is the mirror this estate keeps paying for:
    // a fourth action added later must be swept too, so they are enumerated.
    expect(buttons.length).toBeGreaterThanOrEqual(3)

    for (const button of buttons) {
      const id = button.getAttribute('data-testid') ?? '(unnamed)'
      const wrapper = button.closest('[data-tooltip-content]')
      expect(wrapper, `${id} is not inside a Tooltip`).not.toBeNull()
      const hint = wrapper!.getAttribute('data-tooltip-content') ?? ''
      expect(hint, `${id} has an empty hint`).not.toBe('')
      expect(hint, `${id}'s hint repeats the node label`).not.toContain(LABEL)
    }
  })

  it('KEEPS the node identity in the accessible name — the contrast control', () => {
    render(<NodeQuickActions nodeId="node-a" nodeType="option" label={LABEL} />)

    // Without this the suite above would pass just as well on a change that
    // deleted the identity everywhere, which is the opposite defect.
    for (const testId of [
      'node-action-ask-node-a',
      'node-action-challenge-node-a',
      'node-action-menu-node-a',
    ]) {
      expect(
        screen.getByTestId(testId).getAttribute('aria-label'),
        `${testId} lost the node identity from its accessible name`,
      ).toContain(LABEL)
    }
  })

  it('says "this option" on an option and "this node" on every other kind', () => {
    // ⭐ THE DISCRIMINATING PAIR. One case alone proves the string is present;
    // only the pair proves it is chosen BY KIND rather than being a constant.
    render(<NodeQuickActions nodeId="node-a" nodeType="option" label={LABEL} />)
    expect(hintFor('node-action-challenge-node-a')).toBe('Challenge this option')

    useCanvasStore.setState({ nodes: [{ ...NODE, type: 'factor' }] } as never)
    render(<NodeQuickActions nodeId="node-b" nodeType="factor" label="Hiring spend" />)
    expect(hintFor('node-action-challenge-node-b')).toBe('Challenge this node')
  })
})
