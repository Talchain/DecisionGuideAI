/**
 * ⭐⭐ EVERY QUICK ACTION IS A 24px TARGET, AND NO TWO TARGETS TOUCH.
 *
 * ⚠ THE DEFECT THIS PINS WAS MEASURED ON THE DEPLOYED BUILD, NOT INFERRED.
 * Real Chrome against staging `a2fd0656`, founder fixture, 1280×800, canvas at
 * its default `zoom 0.5`, hard-fail rAF/`innerWidth` control passed:
 *
 *     button                       css     rendered   gap to next   ::before
 *     node-action-ask-*           20×20      10×10          1px      (none)
 *     node-action-inspect-*       20×20      10×10          1px      (none)
 *     node-action-menu-*          20×20      10×10           —       -2px
 *
 * `document.elementFromPoint` two pixels right of **ask**'s edge returned
 * **inspect**. The three controls were effectively contiguous at a rendered
 * 1px separation, and `handleAsk` AUTO-SENDS a turn to the AI while its
 * neighbours only open a panel or a menu. **A one-pixel slip on a ten-pixel
 * target sent an unintended message.**
 *
 * ⭐ SIZE ALONE WOULD NOT HAVE FIXED IT — and that is why this file asserts an
 * arithmetic invariant rather than a class literal. Enlarging abutting targets
 * makes each easier to hit and does nothing for telling them APART; only
 * SEPARATION discriminates. So the fix is both: `before:-inset-[2px]` on all
 * four (24×24, WCAG 2.2 AA 2.5.8) and `gap-1.5` (6px) so two 2px expansions
 * leave a 2px neutral band instead of overlapping.
 *
 * The invariant, stated against the spec rather than against the failure mode:
 *
 *     gap  >  2 × expansion            (hit areas must not overlap)
 *     visual + 2 × expansion  >=  24   (WCAG 2.2 AA minimum)
 *
 * Both are computed from the classes actually on the element, so shrinking the
 * gap, dropping an expansion, or shrinking a button REDs this file — including
 * on a button added later, because the buttons are enumerated from the DOM and
 * not listed here (a hand-listed set is the mirror this estate keeps paying
 * for). ⚠ jsdom cannot prove pixels: these are the declared classes, and the
 * deployed-build measurement above is the witness that they describe reality.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NodeQuickActions } from '../NodeQuickActions'
import { useCanvasStore } from '../../../store'
import { useGuidanceStore } from '../../../stores/guidanceStore'

const NODE = { id: 'node-a', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Hiring spend' } }

/** px from the Tailwind spacing token in `h-N` / `w-N` (0.25rem = 4px steps). */
const spacing = (n: string): number => parseFloat(n) * 4
/** px from `gap-N`. */
const gapPx = (cls: string): number | null => {
  const m = cls.match(/(?:^|\s)gap-([0-9.]+)(?:\s|$)/)
  return m ? spacing(m[1]) : null
}
/** px of hit expansion per side from `before:-inset-[Npx]`; 0 when absent. */
const expansionPx = (cls: string): number => {
  const m = cls.match(/before:-inset-\[(\d+)px\]/)
  return m ? parseInt(m[1], 10) : 0
}
const visualPx = (cls: string): number | null => {
  const m = cls.match(/(?:^|\s)h-([0-9.]+)(?:\s|$)/)
  return m ? spacing(m[1]) : null
}

describe('quick actions are reachable targets that do not touch', () => {
  beforeEach(() => {
    useCanvasStore.setState({ nodes: [NODE] } as never)
    // ⚠ THE ASK BUTTON IS GATED, AND AN UNSEEDED FIXTURE HIDES IT. `canAsk`
    // reads `canReceiveAsk` off the guidance store; with none of
    // `_prefillChat` / `_sendMessage` / `_dispatchAction` set, only INSPECT and
    // MENU render — measured, and it is why the precondition below asserts a
    // button count rather than trusting the render. The deployed build shows
    // ask/inspect/menu on a real node, so an unseeded fixture would have
    // certified a cluster the user never sees.
    useGuidanceStore.setState({ _sendMessage: vi.fn() } as never)
  })

  it('gives EVERY quick action a >= 24px target, enumerated from the DOM', () => {
    render(<NodeQuickActions nodeId="node-a" nodeType="factor" label="Hiring spend" />)
    const wrap = document.querySelector('.node-quick-actions')
    expect(wrap).not.toBeNull()
    const buttons = [...wrap!.querySelectorAll('button')]

    // PRECONDITION PINNED IN-TEST: without several buttons the separation
    // invariant below is vacuous, so assert the fixture actually produces them.
    expect(buttons.length).toBeGreaterThanOrEqual(3)

    for (const b of buttons) {
      const cls = b.className
      const id = b.getAttribute('data-testid') ?? b.getAttribute('aria-label') ?? '(unnamed)'
      const visual = visualPx(cls)
      expect(visual, `${id}: no h-N class to size from`).not.toBeNull()
      // `before:-inset` only anchors on a positioned box.
      expect(cls, `${id}: expansion needs 'relative' to anchor`).toContain('relative')
      expect(
        visual! + 2 * expansionPx(cls),
        `${id}: target is ${visual! + 2 * expansionPx(cls)}px, WCAG 2.2 AA 2.5.8 minimum is 24px`,
      ).toBeGreaterThanOrEqual(24)
    }
  })

  it('separates the hit areas so a near miss cannot fire the neighbour', () => {
    render(<NodeQuickActions nodeId="node-a" nodeType="factor" label="Hiring spend" />)
    const wrap = document.querySelector('.node-quick-actions') as HTMLElement
    const gap = gapPx(wrap.className)
    expect(gap, 'no gap-N class on the quick-action row').not.toBeNull()

    const worst = Math.max(...[...wrap.querySelectorAll('button')].map(b => expansionPx(b.className)))
    // The whole point: two adjacent expansions must not meet inside the gap.
    expect(
      gap!,
      `gap is ${gap}px but two ${worst}px expansions consume ${2 * worst}px — hit areas would overlap`,
    ).toBeGreaterThan(2 * worst)
  })

  it('keeps ask and inspect distinguishable — the pair whose consequences differ', () => {
    render(<NodeQuickActions nodeId="node-a" nodeType="factor" label="Hiring spend" />)
    // Bound by IDENTITY, never by a value predicate a sibling could satisfy:
    // `ask` auto-sends a turn, `inspect` only opens a panel.
    const ask = screen.getByTestId('node-action-ask-node-a')
    const inspect = screen.getByTestId('node-action-inspect-node-a')
    for (const [name, el] of [['ask', ask], ['inspect', inspect]] as const) {
      expect(expansionPx(el.className), `${name} has no hit expansion`).toBeGreaterThan(0)
    }
  })
})
