import { memo } from 'react'
import type { LucideIcon } from 'lucide-react'
import Tooltip from '../../../components/Tooltip'
import { useCanvasStore } from '../../store'
import { requestAsk } from '../../ui/inspector-v2/askSemantic'
import { resolveBiasSignal } from '../../shared/biasSignalTitles'
import { PROVENANCE_ICON_SIZE_CLASSES } from '../../domain/valueProvenanceIcon'
import { NODE_TOOLTIP_DELAY_MS } from './nodeTooltip'
import { NODE_RAIL_BEHAVIOUR_TONE_CLASS } from './nodeCardRailStyles'
import { selectRestingGlyphsShown } from './restingGlyphRung'
import { BottomCardMark } from './CardMark'
import type { AttentionReason } from './nodeAttention'

/** The reflective close every bias mark's hover and accessible name carries (spec §7: never a diagnosis). */
export const BIAS_MARK_REFLECTIVE = 'A reflective prompt, not a diagnosis.'

/**
 * ⭐ A BIAS RISK IS ITS OWN GLYPH IN THE CARD'S ROW (Paul, 24 Oct 2026: "Behavioural science is a huge part of the value…
 * At the very least, it has to be specific icons in the bottom row"). Only a finding CEE serves and grounds on this
 * element (`nodeAttention`'s `behavioural` reason); the glyph is the design system §9.6 icon the registry maps its code to
 * (anchoring, framing, confidence, blind spots), read by code, never by its words. Hover or focus says what to check;
 * a click asks Olumi about it, with the element attached (prefill-and-confirm), as the rail icon did.
 */
/** The finding this card's row draws, or null (none grounded here, an unknown code, or a zoom rung that hides it). */
export function useBiasMark(reasons: readonly AttentionReason[]): { finding: AttentionReason; Icon: LucideIcon } | null {
  const shownAtThisRung = useCanvasStore(selectRestingGlyphsShown)
  const finding = reasons.find((r) => r.kind === 'behavioural') ?? null
  const signal = finding ? resolveBiasSignal(finding.biasCode) : null
  return shownAtThisRung === false || !finding || !signal ? null : { finding, Icon: signal.icon }
}

export const NodeBiasMarks = memo(function NodeBiasMarks({ nodeId, label, reasons }: {
  nodeId: string
  label: string
  reasons: readonly AttentionReason[]
}) {
  const mark = useBiasMark(reasons)
  if (!mark) return null
  const { finding, Icon } = mark
  const words = `${finding.label} ${BIAS_MARK_REFLECTIVE}`
  return (
    <BottomCardMark>
      <Tooltip asChild delay={NODE_TOOLTIP_DELAY_MS} content={words}>
        <button
          type="button"
          data-testid={`node-bias-${nodeId}`}
          data-bias-code={finding.biasCode}
          data-node-tooltip="true"
          aria-label={words}
          className={`nodrag nopan inline-flex shrink-0 items-center rounded-sm ${NODE_RAIL_BEHAVIOUR_TONE_CLASS} hover:text-info focus:outline-none focus-visible:text-info focus-visible:ring-2 focus-visible:ring-info`}
          onClick={(e) => {
            e.stopPropagation()
            const store = useCanvasStore.getState() as { selectNodeWithoutHistory?: (id: string) => void }
            store.selectNodeWithoutHistory?.(nodeId)
            requestAsk({
              text: `${finding.label} This is about ${label.trim() || 'this element'}.`,
              label: 'Worth checking',
              targetId: nodeId,
              source: 'node-bias-mark',
            })
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <Icon aria-hidden="true" className={PROVENANCE_ICON_SIZE_CLASSES} />
        </button>
      </Tooltip>
    </BottomCardMark>
  )
})
