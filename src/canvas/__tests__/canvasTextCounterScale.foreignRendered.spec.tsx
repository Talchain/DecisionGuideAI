/**
 * THE FOREIGN-RENDERED HALF OF THE COUNTER-SCALE CENSUS, MADE EXECUTABLE.
 *
 * `canvasTextCounterScale.census.spec.ts` derives which components render
 * inside the React Flow viewport transform, and pins — exactly, both
 * directions — the ones DEFINED outside the walked directories but RENDERED
 * from inside them. What it explicitly cannot do is census those files' own
 * font sizes, because they belong to other surfaces too. So it recorded their
 * declared sizes in a COMMENT, "so the gap is visible rather than invisible".
 *
 * A comment is a hand-maintained mirror (CLAUDE.md trap 12), and on 18 Aug 2026
 * two of its four entries turned out to be wrong when they were finally
 * derived. Both were recorded as rendering at 6.0px inside the transform. Both
 * were dispatched as defects to fix. Neither is a defect, and "fixing" either
 * one would have caused a visual regression:
 *
 *   DataBar.tsx      `typography.panelBody` sits behind `showPercent &&
 *                    size === 'standard'`. The ONLY caller in the tree that
 *                    passes `showPercent` is `components/results/
 *                    DriversSection.tsx` — a side PANEL, outside the transform.
 *                    The in-transform callers (FactorNode, GoalNode) pass
 *                    neither `showPercent` nor `trailingLabel`, so their
 *                    suffix slot renders `null`. The numeric readout beside a
 *                    Factor node's bars is not DataBar's at all: it is
 *                    FactorNode's own sibling `<span>`, already on the
 *                    counter-scaled `edgeLabel`. Routing `panelBody` to a
 *                    canvas token would have resized a panel's 12px readout to
 *                    11 or 13px to satisfy a scale that does not govern it,
 *                    and fixed nothing on canvas.
 *
 *   Tooltip.tsx      the raw `text-xs` is on the FLOATING element, inside
 *                    `<FloatingPortal>`. Derived at the installed bytes
 *                    (`@floating-ui/react` 0.26.9, `useFloatingPortalNode`):
 *                    with no `root` and no `id` prop, and with no
 *                    `FloatingPortal` ancestor anywhere around the canvas, the
 *                    container resolves to `document.body`. The half that IS
 *                    un-portalled and in-transform is the reference wrapper,
 *                    which declares no font size at all.
 *
 * This spec is what stops those two sentences drifting again. It asserts the
 * REACHABILITY, not the prose — and each assertion carries the contrast control
 * that proves it can still see the thing it claims is absent (trap 13e).
 *
 * ⚠ SCOPE, STATED. Routing and DOM placement only. jsdom has no layout, so no
 * claim here is about a rendered pixel (trap 3).
 */
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { DataBar } from '../ui/shared/DataBar'
import Tooltip from '../../components/Tooltip'

const ROOT = path.resolve(__dirname, '../../..')

/**
 * The census asserts BY IDENTITY that its derived in-transform scope is exactly
 * these two directories. Anything rendered from here is in the transform.
 */
const SCOPE_DIRS = ['src/canvas/nodes', 'src/canvas/edges']

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry)
    if (statSync(p).isDirectory()) {
      if (entry === '__tests__' || entry === '__fixtures__') continue
      walk(p, out)
    } else if (/\.tsx$/.test(entry) && !/\.spec\.|\.stories\./.test(entry)) {
      out.push(p)
    }
  }
  return out
}

/** Every `<DataBar … />` element, whole, from the in-transform directories. */
function inTransformDataBarCallSites(): { file: string; jsx: string }[] {
  const found: { file: string; jsx: string }[] = []
  for (const dir of SCOPE_DIRS) {
    for (const file of walk(path.join(ROOT, dir))) {
      const src = readFileSync(file, 'utf8')
      for (const m of src.matchAll(/<DataBar\b[\s\S]*?\/>/g)) {
        found.push({ file: path.relative(ROOT, file), jsx: m[0] })
      }
    }
  }
  return found
}

describe('DataBar — the panel token is unreachable from inside the transform', () => {
  const callSites = inTransformDataBarCallSites()

  it('POSITIVE CONTROL: the sweep actually finds in-transform DataBar call sites', () => {
    // Without this, every absence assertion below is satisfied by a sweep that
    // silently found nothing (trap 13).
    expect(callSites.length, 'no <DataBar> call site found under the in-transform directories')
      .toBeGreaterThanOrEqual(3)
    expect([...new Set(callSites.map(c => c.file))].sort())
      .toEqual(['src/canvas/nodes/FactorNode.tsx', 'src/canvas/nodes/GoalNode.tsx'])
  })

  it('no in-transform call site passes `showPercent`, so the panelBody branch is dead there', () => {
    const offenders = callSites.filter(c => /\bshowPercent\b/.test(c.jsx))
    expect(offenders.map(o => o.file), 'a canvas node now reaches DataBar\'s panel-token branch')
      .toEqual([])
  })

  it('CONTRAST CONTROL: the same matcher DOES see `showPercent` at the panel call site', () => {
    // Proves the assertion above discriminates rather than the regex having
    // quietly stopped matching anything at all.
    const drivers = readFileSync(path.join(ROOT, 'src/components/results/DriversSection.tsx'), 'utf8')
    const panelSites = [...drivers.matchAll(/<DataBar\b[\s\S]*?\/>/g)].map(m => m[0])
    expect(panelSites.length, 'the matcher found no <DataBar> in DriversSection').toBeGreaterThan(0)
    expect(panelSites.some(j => /\bshowPercent\b/.test(j)),
      'the matcher can no longer see showPercent anywhere — it is blind, not clean').toBe(true)
  })

  it('rendered with a canvas node\'s own props, DataBar emits no panel token', () => {
    // FactorNode.tsx: value / label / colour, nothing else.
    const { container } = render(<DataBar value={0.62} label="Influence" colour="info" />)
    expect(container.innerHTML, 'panelBody (text-xs) reached the canvas render path')
      .not.toContain('text-xs')
    // GoalNode.tsx: size="standard", still no suffix.
    const { container: goal } = render(<DataBar value={0.85} label="Stability" colour="goal" size="standard" />)
    expect(goal.innerHTML).not.toContain('text-xs')
  })

  it('CONTRAST CONTROL: the panel call shape DOES emit panelBody', () => {
    const { container } = render(<DataBar value={0.62} label="Influence" size="standard" showPercent />)
    expect(container.innerHTML, 'the probe cannot see panelBody even when it is emitted')
      .toContain('text-xs')
  })
})

describe('Tooltip — its sized element portals out of the transform', () => {
  it('PREMISE CONTROL: the installed floating-ui still defaults its portal to document.body', () => {
    // Derived, never mirrored: if this default moves, the claim below is not
    // safe to keep asserting on structure alone.
    const dist = readFileSync(
      path.join(ROOT, 'node_modules/@floating-ui/react/dist/floating-ui.react.mjs'), 'utf8')
    const hook = /function useFloatingPortalNode\([\s\S]*?\n {2}return portalNode;/.exec(dist)?.[0]
    expect(hook, 'could not locate useFloatingPortalNode in the installed @floating-ui/react').toBeTruthy()
    expect(hook!, 'the portal container no longer falls back to document.body')
      .toContain('container = container || document.body')
  })

  it('SOURCE PREMISE: Tooltip passes neither `root` nor `id` to FloatingPortal', () => {
    // Either prop would redirect the portal somewhere this claim has not checked.
    const src = readFileSync(path.join(ROOT, 'src/components/Tooltip.tsx'), 'utf8')
    const el = /<FloatingPortal[^>]*>/.exec(src)?.[0]
    expect(el, 'Tooltip no longer renders a <FloatingPortal>').toBeTruthy()
    expect(el!).toBe('<FloatingPortal>')
  })

  it('the in-transform half (the reference wrapper) declares no font size', () => {
    const { container } = render(
      <svg><g data-testid="edge-g"><Tooltip content="Estimated by Olumi"><span>anchor</span></Tooltip></g></svg>,
    )
    expect(container.innerHTML, 'a font size is declared on the un-portalled reference wrapper')
      .not.toContain('text-xs')
  })

  it('the sized content renders OUTSIDE the transformed subtree', () => {
    render(
      <div data-testid="transform-root">
        <Tooltip content="Estimated by Olumi"><span>anchor</span></Tooltip>
      </div>,
    )
    fireEvent.mouseEnter(screen.getByText('anchor').parentElement!)
    // Bound by identity: the tooltip element carrying THIS content.
    const tip = screen.getByRole('tooltip')
    expect(tip.className, 'the tooltip is no longer the raw text-xs this claim is about')
      .toContain('text-xs')
    const transformRoot = screen.getByTestId('transform-root')
    expect(transformRoot.contains(tip), 'the sized tooltip renders inside the transformed subtree')
      .toBe(false)
    expect(document.body.contains(tip)).toBe(true)
  })
})
