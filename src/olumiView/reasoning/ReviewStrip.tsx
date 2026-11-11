/**
 * UI restore, 11 Nov (DL: "the previous tab's top was a compact strip"): under the model strip, what core says is held or asked, and the two
 * ways the previous tab's method chips map to a lens core has.
 *   - "N to review": the cards core points at (`focus`), challenges (`challenged`) or proposes to change (`change`). A count of cards, never a
 *     value; pressing it goes to the next such card on the canvas (the card is selected and centred, as a mark does).
 *   - "What would change" and "If it failed": core's own lens words (`lens_words.label`), each its lens (as the lens bar); "What would change"
 *     waits, as in the bar, until core names a driver.
 * Not here (no core route today, so none is drawn): the previous "Review this model" and "Strengthen the model" chips.
 */
import { useState } from 'react'
import type { ViewModel } from '../client'
import { useViewLens, useDrivers, type ViewLens } from '../lens'
import { useViewStore } from '../store'
import { typography } from '../../styles/typography'
import { ACTION_FOCUS } from '../../components/results/analysisNew/panelSurfaces'
import { pressCard } from './tabRing'

const CHIP = `${typography.viewPanelMeta} inline-flex min-h-6 items-center rounded-full border border-panel-border px-2 text-text-body hover:bg-panel-hover disabled:cursor-not-allowed disabled:text-text-light ${ACTION_FOCUS}`
const METHODS: readonly ViewLens[] = ['what_changes', 'premortem']

export function ReviewStrip({ model, review }: { model: ViewModel; review: string }) {
  const W = useViewStore((s) => s.view?.lens_words ?? null)
  const lens = useViewLens((s) => s.lens), waits = useDrivers().size === 0
  const [at, setAt] = useState(0)
  const flagged = model.cards.filter((c) => c.focus || c.challenged || c.change != null)
  if (W === null) return null
  const next = () => { const c = flagged[at % flagged.length]; if (c !== undefined) { pressCard(c.id); setAt(at + 1) } }
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="view-reasoning-review">
      {flagged.length === 0 ? null : (
        <button type="button" onClick={next} className={`${typography.viewPanelMeta} rounded text-info underline ${ACTION_FOCUS}`} data-testid="view-reasoning-to-review">
          <span data-count={flagged.length}>{flagged.length}</span> <span>{review}</span>
        </button>
      )}
      {METHODS.map((id) => {
        const waiting = id === 'what_changes' && waits
        return (
          <button key={id} type="button" aria-pressed={lens === id} disabled={waiting} title={waiting ? W.needsRun : W.hint[id]} className={`${CHIP} ${lens === id ? 'border-text-header text-text-header' : ''}`}
            data-testid={`view-reasoning-method-${id}`} onClick={() => useViewLens.setState({ lens: lens === id ? 'full' : id })}>
            <span data-view={`lens_words.label.${id}`}>{W.label[id]}</span>
          </button>
        )
      })}
    </div>
  )
}
