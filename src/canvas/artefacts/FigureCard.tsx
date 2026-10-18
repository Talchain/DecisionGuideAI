/**
 * One picked figure, opened in place under its row: the user acts on it here, but only through the model's own
 * controls. A factor's value is set with `FactorValueControl` (the same control and writer the Analysis tab uses); a
 * link's strength is set in the link's own editor (`openEdgeStrengthEditor`); Ask Olumi sends the question the ask
 * registry already holds for that element (`askAi`). The element's own control is the one act in front: for a factor,
 * its value control, so Ask Olumi steps back beside it. Accepting Olumi's figure as it stands is offered only where
 * the model has a carrier for it (a link's "Keep Olumi's estimate", in the link's editor); a factor has none
 * (`CANONICAL_EDIT_AUTHORITY.modelFactorConfirmation` is disabled), so none is offered here. Nothing here writes the model itself, and a viewer gets the
 * reading and "Show on the model" only.
 */
import { ArrowUpRight, MessageCircle, Crosshair } from 'lucide-react'
import { FactorValueControl } from '../../components/results/analysisNew/FactorValueControl'
import { action } from '../../components/results/analysisNew/panelSurfaces'
import { typography } from '../../styles/typography'
import { useIsViewer } from '../../lib/viewerMode'
import { askAi, type AskAiRequest } from '../conversation/askAi'
import { revealOlumiSurface } from '../conversation/revealOlumi'
import { ACTION_BAR_COPY } from '../conversation/actionBar/ActionBar'
import { canvasLinkOfTarget } from '../graphChanges/rowCanvasLink'
import { openEdgeStrengthEditor } from '../utils/openEdgeStrengthEditor'
import type { AssumptionItem } from './assumptionMapModel'

export const FIGURE_CARD_COPY = {
  setStrength: 'Set its strength',
  checkStrength: 'Check its strength',
  changeStrength: 'Change its strength',
  ask: 'Ask Olumi',
  show: 'Show on the model',
} as const

const STRENGTH_ACT = {
  missing: FIGURE_CARD_COPY.setStrength,
  unchecked: FIGURE_CARD_COPY.checkStrength,
  yours: FIGURE_CARD_COPY.changeStrength,
} as const

/** The question each figure asks of Olumi, from the ask registry: never product text sent as the user's words. */
function askOf(item: AssumptionItem): AskAiRequest {
  if (item.target.kind === 'edge') return { intent: 'question-link', edgeIds: [item.target.id] }
  return { intent: item.column === 'yours' ? 'evidence' : 'estimate', nodeIds: [item.target.id] }
}

function ask(item: AssumptionItem): void {
  const result = askAi(askOf(item))
  if (result === 'sent') revealOlumiSurface()
  if (result === 'none') {
    window.dispatchEvent(new CustomEvent('topbar:show-toast', { detail: { message: ACTION_BAR_COPY.noConversation, level: 'warning' } }))
  }
}

export function FigureCard({ item }: { item: AssumptionItem }) {
  const viewer = useIsViewer()
  const { target } = item
  const link = canvasLinkOfTarget(target)
  return (
    <div data-testid="assumption-map-figure" data-target={target.id} className="space-y-3 px-3 pb-3 pt-1">
      {target.kind === 'node' && !viewer ? (
        <FactorValueControl nodeId={target.id} label={item.label} testIdPrefix="assumption-map-figure" />
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {target.kind === 'edge' && !viewer ? (
          <button
            type="button"
            data-testid="assumption-map-figure-edit"
            className={`${typography.panelBody} ${action('primary')} gap-1 rounded-full px-3`}
            onClick={() => openEdgeStrengthEditor(target.id)}
          >
            {STRENGTH_ACT[item.column]}
            <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
        ) : null}
        {!viewer ? (
          <button
            type="button"
            data-testid="assumption-map-figure-ask"
            className={target.kind === 'node'
              ? `${typography.panelBody} ${action('quiet')} gap-1 px-1 no-underline hover:text-text-body`
              : `${typography.panelBody} ${action('secondary')} gap-1 px-3`}
            onClick={() => ask(item)}
          >
            <MessageCircle aria-hidden="true" className="h-3.5 w-3.5" />
            {FIGURE_CARD_COPY.ask}
          </button>
        ) : null}
        {link ? (
          <button
            type="button"
            data-testid="assumption-map-figure-show"
            className={`${typography.panelBody} ${action('quiet')} gap-1 px-1 no-underline hover:text-text-body`}
            onClick={() => link.focus()}
          >
            <Crosshair aria-hidden="true" className="h-3.5 w-3.5" />
            {FIGURE_CARD_COPY.show}
          </button>
        ) : null}
      </div>
    </div>
  )
}
