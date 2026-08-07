import { useCallback, useRef } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { useCanvasStore } from '../store'
import { useShowToastSafe } from '../ToastContext'
import { confirmReplaceCanvas } from '../blueprints/loadTemplateBlueprint'
import { STARTERS, applyStarter, loadStarterPayload } from '../starters/loadStarter'
import { typography } from '../../styles/typography'

/**
 * The one user-facing failure string for a starter that will not open. Exported
 * so the spec pins the same constant rather than a hand-copied literal.
 */
export const STARTER_LOAD_FAILED_MESSAGE =
  'Couldn’t open that example. Try another, or describe your own decision above.'

/**
 * StarterDecisions — the first-run way in.
 *
 * A new user meets one empty textarea that asks for five structured components
 * before they know what the product is. These cards give them a real,
 * enterprise-shaped decision model in one click.
 *
 * WHAT CHANGED AND WHY (P1-2). This strip previously listed four PLoT template
 * fixtures. Those are engineering fixtures — 12–14 nodes, no goal node, no
 * risks, no estimates, no coaching — and, because insertBlueprint stamps
 * `data.templateId`, every one of them landed on a canvas whose Analyse button
 * was structurally disabled by `computeCeeCannotSeeModel`. Verified live on
 * staging 2026-07-25: after clicking "Market Expansion", `Analyse first pass`
 * read `disabled === true` and 15/15 autosaved nodes carried `templateId`.
 *
 * They are now REAL Olumi drafts — verbatim response bodies from
 * `POST /assist/v1/draft-graph` on CEE build `1b9d596`: 16–19 nodes, 26–37
 * edges, 3–4 options, goal + risks + outcomes, complete coaching. Ruling D-73
 * ships them pre-drafted rather than drafted live, because the shapes a design
 * partner expects draft live at only 5/14 = 35.7%
 * (`parallel-briefs/STARTER-BRIEF-VALIDATION-2026-07-24.md`). The full PLoT
 * template catalogue is unchanged and still one `T` away.
 *
 * Honesty rules observed:
 * - Card title and summary are the graph's OWN `decision` and `goal` node
 *   labels, verbatim, derived by `scripts/build-starter-fixtures.mjs`. No
 *   invented titles, no fabricated category/difficulty/time estimate. The only
 *   words authored here are our framing of our own UI.
 * - The heading says these are saved examples. A starter is NOT a live
 *   computation and the UI must never imply it was just generated — see
 *   StarterProvenanceBanner for the on-canvas disclosure and the redraft.
 * - `T` is advertised because it was verified at the bytes
 *   (useCanvasKeyboardShortcuts.ts — `e.key === 't'` opens the panel). No other
 *   shortcut is advertised.
 */
export function StarterDecisions() {
  // Re-entrancy latch for handlePick. A ref, not state: it must flip
  // synchronously within one click's async flow and never trigger a render.
  const pickInFlight = useRef(false)

  // Same emptiness condition the composer uses: any node or edge ⇒ hasGraph.
  // The hero already unmounts at nodeCount > 0, but the strip self-gates so a
  // starter can never sit over a real graph if it is ever mounted elsewhere.
  const hasGraph = useCanvasStore((s) => s.nodes.length > 0 || s.edges.length > 0)

  // Safe variant: no-ops outside a ToastProvider rather than throwing. This
  // component sits on the first screen — it must never be the thing that
  // crashes it.
  const showToast = useShowToastSafe()

  const handlePick = useCallback(
    async (starterId: string) => {
      // Without this latch a double-click (or a second card clicked while the
      // first chunk is still loading) runs two full load→apply cycles: both
      // pass the confirm gate while the canvas is empty, and the second apply
      // silently replaces the first starter the user just chose.
      if (pickInFlight.current) return
      pickInFlight.current = true

      try {
        // Shared P0-6 gate. On the pristine first-run canvas this returns true
        // without prompting (isDirty false, nodes.length 0).
        if (!confirmReplaceCanvas()) return

        // Warm the fixture chunk WITHOUT touching the store. The payload is
        // ~28 KB over the network on a cold first click, which is long enough
        // for the canvas to gain content underneath us (a hydrating saved
        // scenario, a CEE draft landing). Loading first puts the emptiness
        // re-check immediately before the only call that mutates the canvas,
        // rather than in front of the fetch.
        await loadStarterPayload(starterId)

        // applyStarter REPLACES the whole graph. If content arrived while the
        // chunk was in flight it is visible on screen, and dropping a stale
        // click is the honest outcome — silently destroying it is not. The
        // user's click was made against an empty canvas, so re-prompting would
        // be asking them to confirm a decision they never made.
        if (useCanvasStore.getState().nodes.length > 0) return

        // The dynamic import is module-cached by now, so this does not refetch.
        await applyStarter(starterId)
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error('[StarterDecisions] Failed to open starter:', starterId, err)
        }
        // A dead click is the worst possible first impression: the user pressed
        // a card and the product did nothing, on the first screen they ever
        // see. 'error', not the default 'info': info auto-dismisses in 5s, and
        // a first-screen failure must not vanish while the user glances away.
        showToast(STARTER_LOAD_FAILED_MESSAGE, 'error')
      } finally {
        pickInFlight.current = false
      }
    },
    [showToast],
  )

  // A graph exists → the starters are not the user's way in any more.
  if (hasGraph) return null

  // Fail closed rather than render a heading over an empty row. Unreachable
  // while the manifest is non-empty (loadStarter throws at import on
  // manifest/loader drift), but it keeps the empty case defined.
  if (STARTERS.length === 0) return null

  return (
    <div
      className="w-full max-w-2xl"
      data-testid="starter-decisions"
      role="group"
      aria-label="Saved example decisions"
    >
      {/* Our framing of our own UI. "saved example" is load-bearing: these are
          previously-drafted models, not something generated on this click. */}
      <p className={`mb-3 text-center ${typography.bodySmall} text-text-light`}>
        Or open a saved example — a real decision Olumi has modelled
      </p>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {STARTERS.map((s) => (
          <button
            key={s.id}
            type="button"
            data-testid={`starter-decision-${s.id}`}
            // The title span truncates in the 2-col grid; the tooltip gives the
            // full label back.
            title={s.title}
            onClick={() => handlePick(s.id)}
            className="group flex items-start gap-2 rounded-lg border border-panel-border bg-transparent p-3 text-left transition-colors hover:border-info/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-info"
          >
            <span className="min-w-0 flex-1">
              <span className={`block truncate ${typography.label} text-text-body`}>{s.title}</span>
              <span className={`mt-0.5 block ${typography.caption} text-text-light`}>{s.summary}</span>
            </span>
            <ArrowUpRight
              aria-hidden="true"
              className="mt-0.5 h-4 w-4 shrink-0 text-text-light transition-colors group-hover:text-info"
            />
          </button>
        ))}
      </div>

      {/* `T` verified at the bytes before being advertised. */}
      <p className={`mt-3 text-center ${typography.caption} text-text-light`}>
        Press <kbd className="rounded border border-panel-border px-1 font-sans">T</kbd> for all templates
      </p>
    </div>
  )
}
