import { useCallback, useEffect, useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { plot } from '../../adapters/plot'
import { useCanvasStore } from '../store'
import { blueprintEventBus } from '../blueprints/eventBus'
import { useShowToastSafe } from '../ToastContext'
import { loadTemplateBlueprint, confirmReplaceCanvas } from '../blueprints/loadTemplateBlueprint'

/**
 * FEATURED_STARTER_IDS — a curation decision, NOT a mirror of the producer.
 *
 * This is an ALLOW-LIST and it must stay one. It fails CLOSED: if PLoT adds a
 * new engineering fixture tomorrow, it simply is not featured. A deny-list
 * ("hide small/medium/edge") would fail OPEN and leak the next fixture straight
 * onto a new user's first screen — which is exactly what happens today, where
 * the three dev fixtures sort FIRST in the Templates panel.
 *
 * Chosen for a genuine multi-factor trade-off plus breadth — supplier selection
 * is deliberately non-software so Olumi doesn't read as a dev tool. Order here
 * is the render order.
 *
 * These ids are NOT a claim that PLoT serves them. Any id missing from the
 * response renders nothing (see `featured` below) — never a placeholder.
 */
export const FEATURED_STARTER_IDS = [
  'hiring_strategy_tech_lead',
  'architecture_choice',
  'market_expansion_choice',
  'supplier_selection_resilience',
] as const

interface StarterTemplate {
  id: string
  /** The producer's `label`, verbatim (adapter maps label → name). */
  name: string
  /** The producer's `summary`, verbatim (adapter maps summary → description). */
  description: string
}

/**
 * StarterDecisions — the first-run way in.
 *
 * Today a new user meets one empty textarea that demands five structured
 * components before they know what the product is. The only route to a worked
 * example is the `T` shortcut, advertised nowhere. This strip COMPLEMENTS the
 * draft prompt: type, or pick a real decision and see one modelled.
 *
 * Honesty rules observed:
 * - label + summary render VERBATIM from the producer. No invented copy, no
 *   rewritten titles, no fabricated category/difficulty/time estimate. The only
 *   words we author are our own framing of our own UI.
 * - `T` is mentioned because it was verified at the bytes
 *   (useCanvasKeyboardShortcuts.ts — `e.key === 't'` opens the panel). No other
 *   shortcut is advertised.
 */
export function StarterDecisions() {
  const [featured, setFeatured] = useState<StarterTemplate[]>([])

  // Same emptiness condition the composer uses: any node or edge ⇒ hasGraph.
  // The hero already unmounts at nodeCount > 0, but the strip self-gates so a
  // starter can never sit over a real graph if it is ever mounted elsewhere.
  const hasGraph = useCanvasStore((s) => s.nodes.length > 0 || s.edges.length > 0)

  useEffect(() => {
    let cancelled = false

    plot
      .templates()
      .then((list: any) => {
        if (cancelled) return

        const items: any[] = Array.isArray(list) ? list : Array.isArray(list?.items) ? list.items : []
        const byId = new Map<string, any>(items.map((t) => [t.id, t]))

        // Allow-list resolution. `flatMap` + empty array is the fail-closed
        // step: an id PLoT doesn't serve contributes no card at all, and one
        // without usable producer copy is dropped rather than padded with our
        // own words.
        const resolved: StarterTemplate[] = FEATURED_STARTER_IDS.flatMap((id) => {
          const t = byId.get(id)
          if (!t || typeof t.name !== 'string' || t.name.length === 0) return []
          return [{ id, name: t.name, description: typeof t.description === 'string' ? t.description : '' }]
        })

        setFeatured(resolved)
      })
      .catch(() => {
        // Fail closed: no starters rather than a broken or invented surface.
        if (!cancelled) setFeatured([])
      })

    return () => {
      cancelled = true
    }
  }, [])

  // Safe variant: no-ops outside a ToastProvider rather than throwing. This
  // component sits on the first screen — it must never be the thing that
  // crashes it.
  const showToast = useShowToastSafe()

  const handlePick = useCallback(async (templateId: string) => {
    // Shared P0-6 gate. On the empty first-run canvas this returns true
    // without prompting (isDirty false, nodes.length 0).
    if (!confirmReplaceCanvas()) return

    try {
      const { blueprint } = await loadTemplateBlueprint(templateId)
      // PATH NOTE (deliberate divergence, recorded because it is invisible in
      // the diff): this emits on the blueprint bus DIRECTLY, where the
      // Templates panel goes through CanvasMVP.handleInsertBlueprint. So the
      // strip skips that path's closeTemplatesPanel / setShowResultsPanel /
      // auto-run. That is correct HERE — there is no panel to close, and a
      // first-time user should meet their model, not an auto-running
      // analysis. But it also means we inherit none of that path's error
      // surface, which is why the catch below must raise its own.
      blueprintEventBus.emit(blueprint)
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('[StarterDecisions] Failed to load template:', templateId, err)
      }
      // A dead click is the worst possible first impression: the user pressed
      // a card and the product did nothing, on the first screen they ever see.
      // Same string as the Templates panel (TemplatesPanel.tsx:203) so the two
      // surfaces fail identically rather than inventing their own dialects.
      showToast('Failed to load template.')
    }
  }, [showToast])

  // A graph exists → the starters are not the user's way in any more.
  if (hasGraph) return null

  // None of the featured ids resolved → render nothing at all. The screen is
  // exactly as it is today: no heading orphaned above an empty row.
  if (featured.length === 0) return null

  return (
    <div className="w-full max-w-2xl" data-testid="starter-decisions">
      {/* Our framing of our own UI — never a claim about the producer's data. */}
      <p className="mb-3 text-center text-sm text-text-light">Or start from an example</p>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {featured.map((t) => (
          <button
            key={t.id}
            type="button"
            data-testid={`starter-decision-${t.id}`}
            onClick={() => handlePick(t.id)}
            className="group flex items-start gap-2 rounded-lg border border-panel-border bg-transparent p-3 text-left transition-colors hover:border-info/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-info"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-text-body">{t.name}</span>
              {t.description ? (
                <span className="mt-0.5 block text-xs leading-snug text-text-light">{t.description}</span>
              ) : null}
            </span>
            <ArrowUpRight
              aria-hidden="true"
              className="mt-0.5 h-4 w-4 shrink-0 text-text-light transition-colors group-hover:text-info"
            />
          </button>
        ))}
      </div>

      {/* `T` verified at the bytes before being advertised. */}
      <p className="mt-3 text-center text-xs text-text-light">
        Press <kbd className="rounded border border-panel-border px-1 font-sans">T</kbd> for all templates
      </p>
    </div>
  )
}
