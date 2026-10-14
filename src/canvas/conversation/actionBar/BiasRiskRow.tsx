/**
 * The bias check, drawn as one more icon in the action bar's row.
 *
 * Paul 14 Oct 2026: icon-only row; bias is an icon that asks Olumi to explain and counter it. It replaces the
 * "Check for:" disclosure: a press sends one chip turn naming this bias and the reason CEE gave for it in this model.
 *
 * The busy and double-press rules are `pressOffer`'s (same notice, same 500 ms clock).
 */
import { ScanEye } from 'lucide-react'

import Tooltip from '../../../components/Tooltip'
import { icon } from '../../../components/results/analysisNew/panelSurfaces'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { ASK_BUSY_NOTICE } from '../askAi'
import { revealOlumiSurface } from '../revealOlumi'
import type { BiasRiskItemView, BiasRiskView } from './biasRiskContract'

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1)

export const BIAS_RISK_COPY = {
  name: (bias: string) => `Check for: ${bias}`,
  question: (bias: string, why: string) =>
    `Briefly explain how ${lowerFirst(bias.trim())} could be affecting this model — ${why.trim().replace(/[.!?]+$/, '')} — and suggest a few practical ways to counter it here.`,
} as const

export type AskBiasResult = 'sent' | 'busy' | 'refire' | 'none'

const REFIRE_MS = 500
const lastAsk = new Map<string, number>()

export function askAboutBias(item: BiasRiskItemView): AskBiasResult {
  const state = useGuidanceStore.getState()
  const dispatch = state._dispatchAction
  if (!dispatch) return 'none'
  const now = Date.now()
  const previous = lastAsk.get(item.claim_id)
  if (previous !== undefined && now - previous < REFIRE_MS) return 'refire'
  if (state._isConversationBusy?.()) {
    revealOlumiSurface()
    window.dispatchEvent(new CustomEvent('topbar:show-toast', { detail: { message: ASK_BUSY_NOTICE, level: 'warning' } }))
    return 'busy'
  }
  lastAsk.set(item.claim_id, now)
  const text = BIAS_RISK_COPY.question(item.name, item.why)
  // A chip turn, not typed words (the bar wrote them); `discuss` keeps it conversation-typed, as the Ask Olumi drawer sends.
  dispatch({ action_type: 'discuss', label: text, message: text, source: 'chip' })
  revealOlumiSurface()
  return 'sent'
}

interface BiasRiskIconsProps {
  view: BiasRiskView
  /** The bar's own icon-button classes, so the bias icon matches its neighbours. */
  className: string
  onResult: (result: AskBiasResult) => void
}

export function BiasRiskIcons({ view, className, onResult }: BiasRiskIconsProps) {
  return (
    <span data-testid="bias-risk-row" className="contents">
      {view.items.map((item) => {
        const name = BIAS_RISK_COPY.name(item.name)
        return (
          <Tooltip key={item.claim_id} asChild content={name}>
            <button
              type="button"
              aria-label={name}
              onClick={() => onResult(askAboutBias(item))}
              data-testid={`bias-risk-press-${item.claim_id}`}
              className={className}
            >
              <ScanEye className={icon('section')} aria-hidden={true} />
            </button>
          </Tooltip>
        )
      })}
    </span>
  )
}
