/**
 * StructuralIssuesSection — the model's own structural blockers, on a mounted surface.
 *
 * ⭐⭐ WHY THIS FILE EXISTS: THE CHECK WAS ALREADY WRITTEN AND NO USER COULD SEE IT.
 *
 * `useModelHealth` (`canvas/hooks/useModelHealth.ts`) computes real structural health —
 * including, at `:103-120`, a per-option BFS reachability test that produces
 * *"X has no path to the goal. Its interventions can't influence the outcome."*
 * It is tested (`useModelHealth.spec.ts`, 10 `renderHook` cases). It was also DARK:
 *
 *   src/canvas/components/ModelHealthSection.tsx            calls useModelHealth   importers: 0
 *   src/canvas/components/model-tab/ModelHealthSection.tsx  props only             MOUNTED by ModelTabBody
 *
 * Two components share one name, and the identically-named twin occupies the mounted one — so
 * "is ModelHealthSection mounted?" answers YES about the other file. Measured with contrast
 * controls (target 0; `useNodeDisplayMetadata` importers 450; `model-tab/ModelHealthSection`
 * imported at `ModelTabBody.tsx:46`).
 *
 * The cost was measured on the deployed build, 2026-09-16, staging `7573bb0e`: a real model with
 * three options, NONE of which had a path to the goal. Re-analyse was correctly disabled, and the
 * ONLY way to learn why was to type a question into the chat. This surface is the canvas answering
 * for itself.
 *
 * ⛔ THE BOUNDARY THIS MUST NOT CROSS — "not connected" and "excluded from this calculation" are
 * DIFFERENT FACTS. The first is a property of the graph, derivable from its edges. The second is a
 * DECISION only CEE may make. Everything rendered here is the first: derived from the CURRENT
 * `nodes`/`edges` in the canvas store, recomputed on every mutation. Nothing here may claim an
 * analysis verdict, or the canvas and CEE become two authorities on one question.
 *
 * ⚠ THAT LIVENESS IS ALSO WHY THIS IS NOT `composeBlockedReason`'s job. That module deliberately
 * falls back to a NON-CLAIMING sentence ("Olumi needs something more from this model…") because its
 * rungs render a VERDICT, and a verdict goes stale the moment the user edits the graph — its header
 * records that "a confident false claim in exactly this position" is the defect it exists to fix.
 * A fact derived from the live graph cannot go stale that way, so it belongs here and not there.
 *
 * ⛔ NO AMBER HERE, AND THAT IS DELIBERATE — this heading shipped `text-warning` and the
 * per-site contrast guard caught it: #FFA656 on `--bg-panel-hover` is **1.85:1** against the
 * 4.5:1 SC 1.4.3 needs. Of the 21 `--*-rgb` tokens, exactly three clear 4.5:1 on both panel
 * grounds (`--text-header`, `--text-light`, `--info`) and NOT ONE semantic colour clears even
 * 3:1, so there is no darker amber to reach for and a tinted pill makes it WORSE (it moves the
 * ground towards the text). The caution is carried by the WORDS and the triangle's shape
 * instead. Do not repaint this amber to make it look more urgent.
 *
 * ⚠ jsdom cannot prove visibility (CLAUDE.md trap 3). The spec beside this asserts MOUNTING and
 * TEXT. It does not claim the user can see it; that needs a browser.
 */
import { AlertTriangle } from 'lucide-react'
import { useModelHealth } from '../../hooks/useModelHealth'
import { typography } from '../../../styles/typography'

/**
 * Blockers only, deliberately.
 *
 * `useModelHealth` also emits `warning`-severity issues (extreme edge weights, duplicate edges).
 * Those are judgements about a model that still runs; a `blocker` is a statement that the graph
 * cannot answer the question as drawn. Only the second is worth interrupting the reader for, and
 * widening this later is a decision with its own evidence rather than a default.
 */
export function StructuralIssuesSection() {
  const issues = useModelHealth()
  const blockers = issues.filter(i => i.severity === 'blocker')

  if (blockers.length === 0) return null

  return (
    <section
      data-testid="structural-issues-section"
      aria-label="Structural problems with this model"
      className="rounded-lg border border-panel-border bg-panel px-3 py-2.5"
    >
      <h3 className={`${typography.nodeLabel} mb-1.5 flex items-center gap-1.5 text-text-header`}>
        <AlertTriangle size={14} aria-hidden="true" />
        {blockers.length === 1
          ? 'One thing stops this model answering'
          : `${blockers.length} things stop this model answering`}
      </h3>
      <ul className="flex flex-col gap-1.5">
        {blockers.map(issue => (
          <li
            key={issue.key}
            data-testid={`structural-issue-${issue.key}`}
            className={`${typography.nodeLabel} text-secondary`}
          >
            {issue.description}
          </li>
        ))}
      </ul>
    </section>
  )
}
