/**
 * The rail's persistent DATA icons (locked spec §3 "Factor icons", §4 "Option
 * icons", §7 "Behavioural science"). Each renders ONLY when its signal applies
 * to this element — an ordinary element carries none of them (spec §12: "Ordinary
 * factor does not receive the same attention/evidence/behaviour icons by
 * default").
 *
 *   · Evidence — this element is a TARGETED evidence gap: top 3 by the existing
 *     value-of-information ordering, while the analysis is current. No new UI
 *     threshold. Click → the element's existing inspector.
 *   · Behaviour — a GROUNDED finding maps to this element (see `nodeAttention`).
 *     Reflective copy only ("Worth checking: …", never a diagnosis). Click → AI,
 *     with the finding and the element attached (prefill-and-confirm).
 *
 * Both read the SAME reasons the "Worth reviewing" marker reads, so an icon and
 * the marker can never disagree about whether a signal exists.
 */
import { SearchCheck, Brain, type LucideIcon } from 'lucide-react'
import Tooltip from '../../../components/Tooltip'
import { useCanvasStore } from '../../store'
import { requestAsk } from '../../ui/inspector-v2/askSemantic'
import { openNodeInspector } from './openNodeInspector'
import { NODE_TOOLTIP_DELAY_MS } from './nodeTooltip'
import { NODE_RAIL_BUTTON_CLASSES, NODE_RAIL_GLYPH_CLASSES } from './nodeCardRailStyles'
import type { AttentionReason } from './nodeAttention'

export function NodeRailIcon({
  testId,
  label,
  icon: Icon,
  tone,
  onActivate,
}: {
  testId: string
  label: string
  icon: LucideIcon
  /** Colour by MEANING: evidence/provenance are informational, behaviour is its own family. Never warning. */
  tone: 'info' | 'behaviour' | 'muted'
  onActivate: () => void
}) {
  const toneClass =
    tone === 'info' ? 'text-info' : tone === 'behaviour' ? 'text-text-body' : 'text-text-light'
  return (
    <Tooltip asChild delay={NODE_TOOLTIP_DELAY_MS} content={label}>
      <button
        type="button"
        data-testid={testId}
        data-node-tooltip="true"
        aria-label={label}
        className={`${NODE_RAIL_BUTTON_CLASSES} ${toneClass}`}
        onClick={(e) => {
          e.stopPropagation()
          onActivate()
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <Icon aria-hidden="true" className={NODE_RAIL_GLYPH_CLASSES} />
      </button>
    </Tooltip>
  )
}

export const EVIDENCE_ICON_LABEL =
  'Evidence here would most reduce uncertainty in the comparison (top 3 by value of information). Open its details.'

/** The evidence and behaviour icons for one element, from its grounded reasons. */
export function NodeSignalRailIcons({
  nodeId,
  label,
  reasons,
}: {
  nodeId: string
  label: string
  reasons: readonly AttentionReason[]
}) {
  const evidence = reasons.some((r) => r.kind === 'evidence_gap')
  const behaviour = reasons.find((r) => r.kind === 'behavioural') ?? null
  if (!evidence && !behaviour) return null
  return (
    <>
      {evidence && (
        <NodeRailIcon
          testId={`node-rail-evidence-${nodeId}`}
          label={EVIDENCE_ICON_LABEL}
          icon={SearchCheck}
          tone="info"
          onActivate={() => openNodeInspector(nodeId)}
        />
      )}
      {behaviour && (
        <NodeRailIcon
          testId={`node-rail-behaviour-${nodeId}`}
          label={`${behaviour.label} A reflective prompt, not a diagnosis.`}
          icon={Brain}
          tone="behaviour"
          onActivate={() => {
            const store = useCanvasStore.getState() as { selectNodeWithoutHistory?: (id: string) => void }
            store.selectNodeWithoutHistory?.(nodeId)
            requestAsk({
              text: `${behaviour.label} This is about ${label.trim() || 'this element'}.`,
              label: 'Worth checking',
              targetId: nodeId,
              source: 'node-rail-behaviour',
            })
          }}
        />
      )}
    </>
  )
}
