/**
 * CanvasFooterSummary — the missing canvas-foot line, DESIGN-GAP-AUDIT row 6
 * (MISSING, 24 Sep 2026, gap-frame-footer lane).
 *
 * Contract v3.1 `.canvas-foot`: "Model-relative findings · 11 nodes · 17
 * connections" plus a "Visual key" text link that opens the existing legend
 * (`CanvasLegendPopover`, rendered here with `variant="text-link"` — see that
 * file's header for why the trigger's chrome is a prop rather than a second
 * component). The audit found zero canvas hits for this line
 * (`rg -i "model-relative findings|visual key|CanvasFooter" src`, tests
 * excluded); it is genuinely new, not a rename.
 *
 * ⚠ THIS IS NOT `ModelExtentNotice`, WHICH IS DELIBERATELY UNMOUNTED
 * (`ReactFlowGraph.tsx`, 14 Sep 2026 founder ruling: "get rid of it
 * completely"; pinned by `overlayOwner.sourceScan.spec.ts`). That component
 * answered "how many of the model's elements are OFF-SCREEN right now", with
 * a camera-move remedy ("Show whole model"). This states the model's TOTAL
 * size — a graph-level fact independent of the viewport, camera position or
 * zoom — and offers no camera action at all; its only affordance opens the
 * legend. Different question, different (or no) remedy, so the founder's
 * ruling against the first does not reach the second. Checked, not assumed —
 * see the task brief's own gap-audit row 6 for the sanctioning read.
 *
 * Counts are REAL (non-ghost) nodes and edges — `excludeNonModelNodes` /
 * `isGhostNode` (`utils/fitTargets.ts`), the SAME predicate
 * `ModelExtentNotice` used for its own count, so "the model" does not mean a
 * third thing here. Ghost cards (the row-end "+ add" prompts) carry no edges
 * of their own, but an edge filter is applied anyway for the same honesty the
 * task asked for ("real (non-ghost) ... edges").
 *
 * Placed via the existing overlay band, bottom-left cell — the one cell with
 * a single existing claimant (`lens-info-panel`), so this rarely contends for
 * it. `lens-info-panel` OUTRANKS this component in `OVERLAY_PRIORITY`
 * (CanvasOverlayBand.tsx): the same "a live, user-invoked disclosure outranks
 * a standing fact" rule the band's own comments state for its other cells.
 * `wants` is simply "there is a model to summarise" (`nodeCount > 0`), so the
 * footer text is up almost always and steps aside only for that one transient
 * case.
 *
 * Added to `overlayOwner.sourceScan.spec.ts`'s `MIGRATED` list: declaring a
 * claimant in `OVERLAY_PRIORITY` without it is a "dead rule" by that guard's
 * own definition (its "no dead rules" assertion iterates the WHOLE table,
 * not just `MIGRATED`), and the guard's mount-completeness check is what
 * would have caught this component sitting in `OVERLAY_PRIORITY` with no JSX
 * mount anywhere — exactly the defect it exists to catch.
 */
import { useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useCanvasStore } from '../store'
import { excludeNonModelNodes, isGhostNode } from '../utils/fitTargets'
import { useOverlayCell } from './CanvasOverlayBand'
import { CanvasLegendPopover } from './CanvasLegendPopover'
import { typography } from '../../styles/typography'
import styles from './CanvasFooterSummary.module.css'

export const CANVAS_FOOTER_SUMMARY_TESTID = 'canvas-footer-summary'

/**
 * Below this cell width the footer withdraws rather than wrap into a column
 * taller than the band (see `CanvasFooterSummary.module.css`). The stylesheet's
 * `@container` threshold is bound to this number by the spec.
 */
export const CANVAS_FOOTER_MIN_WIDTH_PX = 160

/** "Model-relative findings · N nodes · M connections" — exported so a spec
 *  can bind to the composer rather than to a rendered string. */
export function composeCanvasFooterLine(nodeCount: number, edgeCount: number): string {
  const nodeWord = nodeCount === 1 ? 'node' : 'nodes'
  const edgeWord = edgeCount === 1 ? 'connection' : 'connections'
  return `Model-relative findings · ${nodeCount} ${nodeWord} · ${edgeCount} ${edgeWord}`
}

export function CanvasFooterSummary() {
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)

  const nodeCount = useMemo(() => excludeNonModelNodes(nodes).length, [nodes])
  const edgeCount = useMemo(
    () => edges.filter((e) => !isGhostNode(e.source) && !isGhostNode(e.target)).length,
    [edges],
  )

  // Nothing to summarise on an empty canvas — same "no model, no claim" rule
  // `FirstModelNotice`/`ModelExtentNotice` both apply.
  const wants = nodeCount > 0
  // Literal, not the exported testid constant: `overlayOwner.sourceScan.spec
  // .ts`'s static scan resolves a claimant id from either a quoted string
  // literal or an entry in its own `TOKEN_TO_ID` map — every other migrated
  // component (bar two) already passes the literal directly, and matching
  // that avoids adding a third entry to that hand-maintained map for a value
  // that is, byte for byte, the testid constant below.
  const { granted, target } = useOverlayCell('bottom-left', 'canvas-footer-summary', wants)

  if (!wants || !granted) return null

  const body = (
    <div className={styles.fit} data-testid={`${CANVAS_FOOTER_SUMMARY_TESTID}-fit`}>
      <div
        data-testid={CANVAS_FOOTER_SUMMARY_TESTID}
        className={`${styles.footer ?? ''} pointer-events-auto flex items-center gap-2`}
      >
        <span
          className={`${typography.caption} text-text-light`}
          data-testid="canvas-footer-summary-text"
        >
          {composeCanvasFooterLine(nodeCount, edgeCount)}
        </span>
        <CanvasLegendPopover variant="text-link" />
      </div>
    </div>
  )

  return target ? createPortal(body, target) : body
}
