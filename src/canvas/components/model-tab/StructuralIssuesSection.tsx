/**
 * StructuralIssuesSection — an OBSERVATION about the connectors drawn on the canvas.
 *
 * ⭐ WHY THIS EXISTS: a real model on deployed staging `7573bb0e` (2026-09-16) had three options,
 * none of them joined to the goal by connectors. The canvas showed nothing, and the only route to
 * that fact was typing a question into the chat. `useModelHealth` had been computing the
 * reachability all along and no user could see it: its only consumer
 * (`canvas/components/ModelHealthSection.tsx`) had ZERO importers, while an IDENTICALLY-NAMED twin
 * in this directory occupied the name `ModelTabBody` mounts.
 *
 * ⛔⛔ THE NARROWING THAT MADE THIS HONEST (Codex, CX292 + the #1639 block). The first version of
 * this file rendered `issue.description` VERBATIM — *"Its interventions can't influence the
 * outcome."* — and its `severity: 'blocker'`. Both are CALCULATION CLAIMS, and the reachability
 * behind them **starts at `option.id` and follows CONNECTORS ONLY**. An option can legitimately act
 * through canonical pins / interventions with NO connector drawn, so that version called a VALID
 * status-quo model failed. **A false claim about a correct model is worse than the silence it
 * replaced.**
 *
 * So this surface now states ONLY what it can see: **no connector path is shown**. It says nothing
 * about influence, about interventions, about whether the model can be analysed, and nothing about
 * severity. The copy is authored HERE rather than inherited from the hook, precisely so the hook's
 * calculation vocabulary cannot leak onto a screen.
 *
 * ⛔ AND THE GUARD FAILURE WORTH RECORDING, because I got it wrong twice. My first boundary test
 * asserted a list of forbidden phrases I invented myself ('excluded from', 'withheld', …). The
 * sentence that actually breached the boundary was not in my list — a guard agreeing with itself.
 * The spec beside this now pins the OPTION-WITH-PINS-BUT-NO-CONNECTOR case, which is the case that
 * can only pass if the copy is genuinely neutral.
 *
 * ⛔ NO AMBER: `text-warning` (#FFA656) on `--bg-panel-hover` is 1.85:1 against SC 1.4.3's 4.5:1,
 * and the per-site contrast guard caught it. Of the 21 `--*-rgb` tokens exactly three clear 4.5:1
 * on both panel grounds (`--text-header`, `--text-light`, `--info`); NOT ONE semantic colour clears
 * even 3:1, and a tinted pill makes it WORSE. Do not repaint this to look more urgent.
 *
 * ⚠ jsdom cannot prove visibility (CLAUDE.md trap 3). The specs assert MOUNTING and TEXT only.
 */
import { useCallback } from 'react'
import { useModelHealth } from '../../hooks/useModelHealth'
import { useCanvasStore } from '../../store'
import { focusNodeById } from '../../utils/focusHelpers'
import { typography } from '../../../styles/typography'
import { buildCanvasLabelMap, resolveCanvasLabel, UNNAMED_ELEMENT_LABEL } from '../../domain/canvasLabels'

/** The one check this surface reports. Narrow by construction, not by filtering later. */
const CONNECTOR_ISSUE_PREFIX = 'disconnected-option-'

export function StructuralIssuesSection() {
  const issues = useModelHealth()
  const nodes = useCanvasStore(s => s.nodes)

  // ⛔ ONE check, never "all blockers". Mounting every existing blocker claim unchanged is exactly
  // what CX292 refused, and the other checks carry their own vocabulary that has not been read.
  const connectorGaps = issues.filter(i => i.key.startsWith(CONNECTOR_ISSUE_PREFIX))

  /**
   * ⭐⭐ V2 GAP 35 — NO RAW WIRE ID MAY REACH THE READER. This fell back to the
   * bare `nodeId` when a label was blank — exactly the `label ?? <id>` shape
   * `modelTabNoRawIdFallback.sourceScan.spec.ts` bans in the sibling
   * canonical editor, one door over from the guard's own reach. THE ONE id →
   * label policy (`ModelTabBody.tsx` uses the identical pair) resolves a
   * genuine label or names the absence honestly — never the id itself.
   */
  const labelFor = useCallback(
    (nodeId: string): string =>
      resolveCanvasLabel(nodeId, buildCanvasLabelMap(nodes ?? [])) ?? UNNAMED_ELEMENT_LABEL,
    [nodes],
  )

  if (connectorGaps.length === 0) return null

  return (
    <section
      data-testid="structural-issues-section"
      aria-label="Options with no connector path shown to the goal"
      // V2 gap 35 — no card. The same full-width hairline every other
      // top-level Model-tab section uses.
      className="border-b border-panel-border py-2.5"
    >
      {/* V2 gap 35 — `panelHeader`/`panelBody`, not `nodeLabel`. `nodeLabel`
          is the CANVAS type token: it scales with `--canvas-label-scale`, a
          variable this panel chrome has no business tracking (a reader who
          zooms the canvas would find this section's text growing or
          shrinking with it). */}
      <h3 className={`${typography.panelHeader} mb-1 text-text-header`}>
        {connectorGaps.length === 1
          ? 'One option has no connector path shown to your goal'
          : `${connectorGaps.length} options have no connector path shown to your goal`}
      </h3>
      {/* ⛔ VISIBLE, not an aria-label. This canvas's honesty layer is almost entirely invisible to
          a sighted reader, and the whole point of this surface is that it must not be mistaken for
          an analysis verdict. */}
      <p className={`${typography.panelBody} mb-2 text-text-light`}>
        This describes the connectors drawn on your canvas. It is not an analysis result.
      </p>
      <ul className="flex flex-col gap-1.5">
        {connectorGaps.map(issue => {
          const nodeId = issue.affectedIds[0]
          return (
            <li
              key={issue.key}
              data-testid={`structural-issue-${issue.key}`}
              className="flex items-center justify-between gap-2"
            >
              <span className={`${typography.panelBody} text-text-light`}>{labelFor(nodeId)}</span>
              {/* The mounted action CX292 asked for: a route to the node, not another warning.
                  `focusNodeById` selects and centres it — the same helper ContestedEdgeCard uses
                  from this directory — and mutates no graph structure. */}
              <button
                type="button"
                data-testid={`structural-issue-show-${nodeId}`}
                onClick={() => focusNodeById(nodeId)}
                className={`${typography.panelBody} shrink-0 rounded border border-panel-border px-2 py-0.5 text-text-header hover:bg-panel-hover`}
              >
                Show on canvas
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
