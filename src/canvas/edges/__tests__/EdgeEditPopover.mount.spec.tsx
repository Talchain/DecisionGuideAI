/**
 * EdgeEditPopover — WHERE IT MOUNTS, which decides everything else about it.
 *
 * WHY THIS EXISTS (18 Aug 2026).
 * ---------------------------------------------------------------------------
 * The counter-scale census pinned this component for its TYPOGRAPHY: it used
 * the PANEL tokens `panelHeader` (14px) and `panelMeta` (11px) while rendering
 * inside the React Flow viewport transform, so they were recorded as rendering
 * at 7.0px and 5.5px. The pin also noted, as an aside, that the popover is
 * `position: fixed` inside a transformed ancestor.
 *
 * Both readings were downstream of a larger fact nobody had measured: derived
 * at the bytes of the installed renderer (`@xyflow/react` 12.10.2), an edge
 * component is rendered by `EdgeWrapper` as
 *
 *     <svg><g class="react-flow__edge …">{EdgeComponent}</g></svg>
 *
 * and `StyledEdge` returns `<EdgeEditPopover/>` as a plain sibling of its edge
 * path — NOT inside an `<EdgeLabelRenderer>`, which is the thing that portals
 * an edge's HTML out into `.react-flow__edgelabel-renderer`. React creates the
 * children of an `<svg>` in the SVG namespace, so every element of this
 * popover was being created as an SVG-namespaced `div`: an unknown SVG
 * element, not an HTML box.
 *
 * That reframes all three symptoms as ONE defect with ONE fix:
 *   - the typography was never the user-visible problem;
 *   - `position: fixed` cannot mean what it says on an element the SVG
 *     rendering model does not lay out, and the popover is handed
 *     `event.clientX/clientY` (VIEWPORT coordinates, `StyledEdge.tsx`
 *     `handleLabelDoubleClick`), which `fixed` only honours when the viewport
 *     really is the containing block;
 *   - so the fix is to portal to `document.body`, exactly as the sibling
 *     `nodes/shared/NodePopover.tsx` already does ("Renders via createPortal to
 *     escape ReactFlow's stacking context"), which the census recognises as an
 *     earned exclusion rather than a gap.
 *
 * Once it portals, the popover is a floating PANEL surface outside the
 * transform, so `panelHeader`/`panelMeta` are the CORRECT tokens under DS v5
 * §2.2 and no size ruling is owed. Routing them to canvas tokens instead would
 * have shrunk a panel's 14px to 13px to satisfy the §2.3 canvas scale, which
 * does not govern this component — i.e. it would have been another instance of
 * the very defect class the census exists to catch: a declared size routed
 * around its actual scale authority.
 *
 * ⚠ WHAT THIS SPEC PROVES AND WHAT IT CANNOT. It proves NAMESPACE and PORTAL
 * TARGET, which are DOM facts jsdom models exactly. It does NOT prove a
 * rendered pixel, a paint, or a layout position — jsdom has no layout
 * (CLAUDE.md trap 3). The claim "an SVG-namespaced div is not painted" is a
 * property of the SVG rendering model, not something measured here.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { EdgeEditPopover, type EdgeEditPopoverProps } from '../EdgeEditPopover'

const SVG_NS = 'http://www.w3.org/2000/svg'
const HTML_NS = 'http://www.w3.org/1999/xhtml'

const props: EdgeEditPopoverProps = {
  edge: { id: 'edge-under-test', data: { weight: 0.6, belief: 0.8 } },
  position: { x: 400, y: 300 },
  onUpdate: () => {},
  onClose: () => {},
}

/**
 * Reproduces `EdgeWrapper`'s real structure. The PREMISE that this is the real
 * structure is not written down here — it is re-derived from the installed
 * package below, so this harness cannot silently stop reproducing the
 * condition it exists to reproduce (CLAUDE.md trap 13b).
 */
function EdgeMountHarness({ children }: { children: React.ReactNode }) {
  return (
    <svg>
      <g className="react-flow__edge react-flow__edge-styled" data-testid="edge-g">{children}</g>
    </svg>
  )
}

describe('EdgeEditPopover — mounts as HTML, not as an SVG-namespaced element', () => {
  it('PREMISE CONTROL: the installed renderer still wraps an edge component in <svg>', () => {
    // Derived, never mirrored. If @xyflow changes how edges are hosted, this
    // REDs and says so, rather than leaving the harness below quietly wrong.
    const dist = readFileSync(
      path.resolve(__dirname, '../../../../node_modules/@xyflow/react/dist/esm/index.js'),
      'utf8',
    )
    const wrapper = /function EdgeWrapper\(\{[\s\S]*?\n\}\nvar EdgeWrapper\$1 = memo\(EdgeWrapper\)/.exec(dist)?.[0]
    expect(wrapper, 'could not locate EdgeWrapper in the installed @xyflow/react').toBeTruthy()
    expect(wrapper!, 'EdgeWrapper no longer hosts the edge component inside an <svg>')
      .toMatch(/return \(jsx\("svg",/)
    expect(wrapper!, 'EdgeWrapper no longer renders EdgeComponent inside that <svg>')
      .toMatch(/jsx\(EdgeComponent,/)
  })

  it('PRECONDITION: the harness really does create an SVG-namespaced subtree', () => {
    // Without this, a later tidy-up could turn the harness into a plain <div>
    // and every assertion below would pass while measuring nothing.
    render(<EdgeMountHarness><text /></EdgeMountHarness>)
    expect(screen.getByTestId('edge-g').namespaceURI).toBe(SVG_NS)
  })

  it('the dialog is an HTML element even when mounted inside the edge <svg>', () => {
    render(<EdgeMountHarness><EdgeEditPopover {...props} /></EdgeMountHarness>)
    // Bound by IDENTITY (role + the popover's own aria-label), never by a
    // predicate another element on the page could satisfy.
    const dialog = screen.getByRole('dialog', { name: 'Edit edge weight and belief' })
    expect(dialog.namespaceURI, 'popover subtree is created in the SVG namespace').toBe(HTML_NS)
    expect(dialog instanceof HTMLElement, 'popover root is not an HTMLElement').toBe(true)
  })

  it('escapes the edge <svg> entirely, so `position: fixed` resolves against the viewport', () => {
    render(<EdgeMountHarness><EdgeEditPopover {...props} /></EdgeMountHarness>)
    const dialog = screen.getByRole('dialog', { name: 'Edit edge weight and belief' })
    const edgeG = screen.getByTestId('edge-g')
    expect(edgeG.contains(dialog), 'popover is still inside the transformed edge subtree').toBe(false)
    expect(dialog.closest('svg'), 'popover still has an <svg> ancestor').toBeNull()
    // It is `fixed` with the VIEWPORT coordinates StyledEdge hands it, so the
    // containing block must be the viewport for those coordinates to be true.
    expect(dialog.className).toContain('fixed')
    expect((dialog as HTMLElement).style.left).toBe('400px')
    expect((dialog as HTMLElement).style.top).toBe('300px')
  })

  it('CONTRAST CONTROL: an unportalled div in the same harness IS SVG-namespaced', () => {
    // Proves the two assertions above discriminate, rather than the harness
    // having quietly stopped producing an SVG context at all.
    render(<EdgeMountHarness><div data-testid="unportalled" /></EdgeMountHarness>)
    expect(screen.getByTestId('unportalled').namespaceURI).toBe(SVG_NS)
  })

  // FORWARD GUARD, not a pin of today's defect: this one is green on both sides
  // of the fix, and says so. It exists because the OBVIOUS reading of the census
  // pin was "route these two panel tokens to canvas tokens", which would have
  // shrunk a panel heading 14 -> 13px to satisfy a scale that does not govern
  // this component. `getAttribute('class')` is used rather than `.className` so
  // that this asserts TYPOGRAPHY only — on an SVG-namespaced element
  // `.className` is an `SVGAnimatedString`, and a namespace failure reported as
  // a typography failure is a confusing alarm.
  it('keeps the DS v5 §2.2 PANEL tokens, because it is a panel outside the transform', () => {
    render(<EdgeMountHarness><EdgeEditPopover {...props} /></EdgeMountHarness>)
    const heading = screen.getByRole('heading', { name: 'Edit Edge' })
    // panelHeader is `text-sm` (14px). A canvas token here would read
    // `calc(13px*var(--canvas-label-scale…))` and would be a silent resize.
    expect(heading.getAttribute('class')).toContain('text-sm')
    expect(heading.getAttribute('class'), 'a canvas token has been routed into a panel surface')
      .not.toContain('--canvas-label-scale')
    const weightLabel = screen.getByText('Weight')
    expect(weightLabel.getAttribute('class')).toContain('text-[11px]')
    expect(weightLabel.getAttribute('class'), 'a canvas token has been routed into a panel surface')
      .not.toContain('--canvas-label-scale')
  })
})
