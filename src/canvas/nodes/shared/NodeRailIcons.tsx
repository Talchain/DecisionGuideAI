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
import { NODE_RAIL_BUTTON_CLASSES, NODE_RAIL_GLYPH_CLASSES, NODE_RAIL_GLYPH_PX } from './nodeCardRailStyles'
import { selectRestingGlyphsShown } from './restingGlyphRung'
import type { AttentionReason } from './nodeAttention'

/**
 * ⭐ REVEALED ON HOVER/FOCUS — contract v3.1 `.icon-btn.revealed` (deltas
 * OPT-02 / ICON-03; DS v5 §9.3 Tier 2 "Pencil … hidden at rest, revealed on
 * card hover", with the touch override). An EDIT route is not a resting icon:
 * at rest the rail's only unconditional member is the one discreet coaching
 * icon (Paul 23 Sep pt 6).
 *
 * The SAME opacity/pointer-events mirror the hover-only quick actions use
 * (`NodeQuickActions`, `.node-quick-actions`), spelled out literally so the
 * Tailwind scanner emits it, and for the same reasons: `group-hover` /
 * `group-focus-within` key off the CARD, each `pointer-events` variant is the
 * twin of its `opacity` variant (an invisible button must not swallow the
 * card's clicks), and `pointer: coarse` keeps it visible and tappable on touch.
 * Opacity keeps the button's box, so the coaching icon beside it never moves,
 * and the button stays in the tab order and the accessibility tree.
 */
export const NODE_RAIL_REVEAL_CLASSES =
  'opacity-0 pointer-events-none transition-opacity duration-150 motion-reduce:transition-none ' +
  'group-hover:opacity-100 group-hover:pointer-events-auto ' +
  'group-focus-within:opacity-100 group-focus-within:pointer-events-auto ' +
  '[@media(pointer:coarse)]:opacity-100 [@media(pointer:coarse)]:pointer-events-auto'

/** Each rail tone's RESTING ink — the one owner the icons and the canvas key read. */
export const NODE_RAIL_TONE_CLASS = {
  info: 'text-info',
  behaviour: 'text-text-body',
  muted: 'text-text-light',
} as const

/**
 * The evidence and behaviour marks as drawn, owned HERE and read by the canvas
 * key (`CanvasLegendPopover`, contract v3.1 §03 "Evidence worth seeking" /
 * "Behavioural check"), so the key imports these marks rather than redrawing them.
 */
export const EVIDENCE_RAIL_GLYPH = { Icon: SearchCheck, tone: 'muted' } as const
export const BEHAVIOUR_RAIL_GLYPH = { Icon: Brain, tone: 'behaviour' } as const

export function NodeRailIcon({
  testId,
  label,
  icon: Icon,
  tone,
  onActivate,
  reveal = false,
}: {
  testId: string
  label: string
  icon: LucideIcon
  /**
   * The RESTING colour, by meaning. Never warning. Every tone goes Info on an
   * info-soft ground on hover and keyboard focus — that half lives in
   * `NODE_RAIL_BUTTON_CLASSES`, so the rail has one hover language.
   * `info` is Info at rest too. Contract v3.1 keeps Info at rest for the
   * attention cue (Paul 23 Sep pt 9), so a DATA icon is `muted`.
   */
  tone: 'info' | 'behaviour' | 'muted'
  onActivate: () => void
  /** Hidden at rest, shown on card hover/focus and on touch (see `NODE_RAIL_REVEAL_CLASSES`). */
  reveal?: boolean
}) {
  const toneClass = NODE_RAIL_TONE_CLASS[tone]
  return (
    <Tooltip asChild delay={NODE_TOOLTIP_DELAY_MS} content={label}>
      <button
        type="button"
        data-testid={testId}
        data-node-tooltip="true"
        data-rail-reveal={reveal ? 'true' : undefined}
        aria-label={label}
        className={`${NODE_RAIL_BUTTON_CLASSES} ${toneClass}${reveal ? ` ${NODE_RAIL_REVEAL_CLASSES}` : ''}`}
        onClick={(e) => {
          e.stopPropagation()
          onActivate()
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <Icon aria-hidden="true" size={NODE_RAIL_GLYPH_PX} className={NODE_RAIL_GLYPH_CLASSES} />
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
  /**
   * ⭐ ONE RESTING ICON SET — contract v3.1 pt 6 (delta ICON-04, its fallback:
   * the served `quiet` rung stays "quiet/far zoom"). At quiet/line the coaching
   * icon, the corner coaching marker and the "?" have already left the card
   * (`selectRestingGlyphsShown`); these data icons were the rail members still
   * standing without the coaching icon beside them. Far zoom keeps "readable
   * identity and a simple attention cue" — and the attention marker, which reads
   * these SAME reasons, stays, so the signal is not lost at quiet.
   * `=== false` so a store double that cannot answer reads as `full`, the same
   * undefined-safe reading the predicate itself gives an absent rung.
   */
  const shownAtThisRung = useCanvasStore(selectRestingGlyphsShown)
  if (shownAtThisRung === false) return null
  if (!evidence && !behaviour) return null
  return (
    <>
      {evidence && (
        <NodeRailIcon
          testId={`node-rail-evidence-${nodeId}`}
          label={EVIDENCE_ICON_LABEL}
          icon={EVIDENCE_RAIL_GLYPH.Icon}
          // Contract v3.1: a data icon is `.icon-btn` muted at rest and Info on
          // hover/focus (ICON-06 / F11). The attention marker, which reads the
          // same evidence_gap reason, is the one Info-at-rest mark (Paul pt 9),
          // so two blue marks no longer compete on one card.
          tone={EVIDENCE_RAIL_GLYPH.tone}
          onActivate={() => openNodeInspector(nodeId)}
        />
      )}
      {behaviour && (
        <NodeRailIcon
          testId={`node-rail-behaviour-${nodeId}`}
          label={`${behaviour.label} A reflective prompt, not a diagnosis.`}
          icon={BEHAVIOUR_RAIL_GLYPH.Icon}
          tone={BEHAVIOUR_RAIL_GLYPH.tone}
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
