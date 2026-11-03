/**
 * Suggestion preview: the GHOST of a proposed change, drawn on the canvas while the latest reply offers its consent
 * chip (DL ruling 5941839936; carrier proposalPreview.ts, bridge useProposalGhostBridge.ts, geometry
 * proposalGhostGeometry.ts).
 *
 * ⛔ Render-only, through `ViewportPortal` like `TierLanes`: it never enters `nodes`/`edges`, so nothing can save, send,
 *   count, fit, select or infer over it. `pointer-events: none` throughout, EXCEPT the ghost's own two buttons
 *   (`GhostActions`), which press the reply's own consent chips (`consentChipsFor`) through the conversation's chip path
 *   (`_sendChip`), so approving from the ghost is the chat card's approval, in its words (canvas plan step 3).
 * ⛔ Styling (DS v5): a dashed or dotted border on the canvas MEANS confidence (§11.3), so a ghost never uses one. It is
 *   a translucent card with a solid 1px `border-info`, the kind's shape badge (§10, 14px) and a "Proposed" caption;
 *   lines are solid `stroke-info` at partial opacity. Text goes through the counter-scaled canvas tokens only
 *   (`canvasTextCounterScale.census.spec.ts` declares this file in VIEWPORT_PORTALLED).
 * ⛔ Words: a link's band in the PRODUCER's words (the consent card says "as moderate" too). A keep (`keeps: true`, the
 *   Yes only records the strength the link already has) is never drawn as a change: "Record as moderate", the consent
 *   card's own verb ("Record this link strength … as moderate"). An option's status uses the card's imported words
 *   (`OPTION_TAKEN_OUT_COPY`), never restated.
 */
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ViewportPortal, useEdges, useNodes, useReactFlow, useStore } from '@xyflow/react'
import { X } from 'lucide-react'
import { typography } from '../../styles/typography'
import { useProposalGhostStore } from '../stores/proposalGhostStore'
import { useGuidanceStore } from '../stores/guidanceStore'
import { action, ACTION_FOCUS } from '../../components/results/analysisNew/panelSurfaces'
import type { ActionChip } from '../conversation/types'
import { GHOST_CARD_HEIGHT, ghostActionsPosition, proposalGhostGeometry, type GhostMeasures } from '../utils/proposalGhostGeometry'
import { DOCK_SELECTOR } from '../utils/computeFitPadding'
import { OPTION_TAKEN_OUT_COPY } from '../domain/optionStatus'
import type { PreviewBand, PreviewOptionStatus } from '../conversation/proposalPreview'
import { NodeShapeIndicator } from './NodeShapeIndicator'
import { NodeTypeEnum } from '../domain/nodes'
import { revealOlumiSurface } from '../conversation/revealOlumi'
import { formatMoneyFigure } from '../../utils/unitClassifier'

export const PROPOSAL_GHOST_TESTID = 'proposal-ghost-layer'
export const PROPOSAL_GHOST_ACTIONS_TESTID = 'proposal-ghost-actions'

/**
 * The ghost's own Approve / Not now: the reply's consent chips, pressed through the conversation's chip path with their
 * own id, words and type. Once pressed, both wait for the reply: it settles the proposal (the ghost goes) or offers the
 * chips again (new chip objects, so the buttons are live again).
 */
/** The ghost's words when its card holds changes the canvas cannot draw: approval happens only where every one is listed. */
export const otherChangesText = (n: number): string => `+${n} other change${n === 1 ? '' : 's'}`
export const REVIEW_ON_THE_CARD = 'Review on the card'
/**
 * The ghost's words shrink (vision spec §2c/§3, 23 Oct): approve reads "Add" on a ghost that only adds, dismiss is an
 * icon, and the other changes are "+N". The full words stay in the accessible name and the tooltip; what each press
 * sends is unchanged (the reply's own chip).
 */
export const GHOST_ADD_WORD = 'Add'
export const GHOST_DISMISS_WORD = 'Dismiss'
/** The approve button's accessible name: its visible word first (label in name), then the chip's own words. */
export const ghostAddName = (chipLabel: string): string =>
  chipLabel.toLowerCase().startsWith(GHOST_ADD_WORD.toLowerCase()) ? chipLabel : `${GHOST_ADD_WORD}: ${chipLabel}`
/** Breathing room between the ghost's action row and the panel covering the canvas's right edge (screen px). */
const GHOST_ACTIONS_DOCK_GAP = 12

/** Front the chat and bring the held card's "Also changes" list into view. */
function reviewOnTheCard(proposalId: string) {
  revealOlumiSurface()
  requestAnimationFrame(() => document.querySelector(`[data-testid="proposal-change-notes-${proposalId}"]`)?.scrollIntoView({ block: 'center' }))
}

function GhostActions({ approve, decline, anchor, proposalId, otherChanges, addsOnly }: {
  approve: ActionChip; decline: ActionChip | null; anchor: { x: number; top: number; bottom: number }; proposalId: string; otherChanges?: number
  addsOnly: boolean
}) {
  const send = useGuidanceStore((s) => s._sendChip)
  const [pressed, setPressed] = useState(false)
  // Never under the outputs dock: the row's own width and the dock's left edge, in flow units, on every pan or zoom.
  useStore((s) => s.transform)
  const { screenToFlowPosition } = useReactFlow()
  const rowRef = useRef<HTMLDivElement>(null)
  const [row, setRow] = useState({ w: 0, h: 0 })
  // eslint-disable-next-line react-hooks/exhaustive-deps -- after every render; an equal size bails out
  useLayoutEffect(() => {
    const w = rowRef.current?.offsetWidth ?? 0; const h = rowRef.current?.offsetHeight ?? 0
    if (w !== row.w || h !== row.h) setRow({ w, h })
  })
  // Never over a card on the canvas either (Paul's pre-flight 22 Oct): the cards as React Flow has them.
  const nodes = useNodes()
  const dock = typeof document === 'undefined' ? null : document.querySelector(DOCK_SELECTOR)?.getBoundingClientRect() ?? null
  const visibleRight = dock && dock.width > 0 ? screenToFlowPosition({ x: dock.left - GHOST_ACTIONS_DOCK_GAP, y: dock.top }).x : null
  const { x, y } = ghostActionsPosition(anchor, row, nodes, visibleRight)
  useEffect(() => setPressed(false), [approve, decline])
  const press = (chip: ActionChip) => {
    if (!send || pressed) return
    setPressed(true)
    send(chip.label, chip.message ?? chip.label, { id: chip.id, ...(chip.action_type ? { action_type: chip.action_type } : {}) })
  }
  const button = (chip: ActionChip, kind: 'primary' | 'secondary') => {
    // Approve on a ghost that only adds reads "Add"; any other change keeps the chip's own words. Dismiss is the X.
    const short = kind === 'secondary' ? null : addsOnly ? GHOST_ADD_WORD : chip.label
    const name = kind === 'secondary' ? GHOST_DISMISS_WORD : short === chip.label ? chip.label : ghostAddName(chip.label)
    return (
      <button
        type="button"
        data-testid={`${PROPOSAL_GHOST_ACTIONS_TESTID}-${kind === 'primary' ? 'approve' : 'decline'}`}
        disabled={!send || pressed}
        onClick={() => press(chip)}
        aria-label={name}
        title={chip.label}
        className={`${typography.edgeLabel} ${action(kind)} inline-flex items-center rounded-full ${short === null ? 'p-1' : 'px-3 py-1'} disabled:opacity-50 ${ACTION_FOCUS}`}
      >
        {short ?? <X size={12} aria-hidden="true" />}
      </button>
    )
  }
  return (
    <div
      ref={rowRef}
      data-testid={PROPOSAL_GHOST_ACTIONS_TESTID}
      className="nodrag nopan absolute flex items-center"
      style={{ left: x, top: y, gap: 6, pointerEvents: 'auto' }}
    >
      {/* ⛔ CONSENT (DL 22 Oct): a card that also changes things the canvas cannot draw is approved only on the card. */}
      {otherChanges === undefined ? button(approve, 'primary') : <>
        {/* "+N" opens the card that lists the other changes; its full words are the name and the tooltip. */}
        <button type="button" data-testid={`${PROPOSAL_GHOST_ACTIONS_TESTID}-review`} onClick={() => reviewOnTheCard(proposalId)}
          aria-label={otherChanges > 0 ? `${otherChangesText(otherChanges)}: ${REVIEW_ON_THE_CARD}` : REVIEW_ON_THE_CARD}
          title={otherChanges > 0 ? `${otherChangesText(otherChanges)}: ${REVIEW_ON_THE_CARD}` : REVIEW_ON_THE_CARD}
          className={`${typography.edgeLabel} ${action('primary')} whitespace-nowrap rounded-full px-3 py-1 ${ACTION_FOCUS}`}>
          {otherChanges > 0
            ? <span data-testid={`${PROPOSAL_GHOST_ACTIONS_TESTID}-other-changes`}>+{otherChanges}</span>
            : REVIEW_ON_THE_CARD}
        </button>
      </>}
      {decline !== null && button(decline, 'secondary')}
    </div>
  )
}

/**
 * The word the canvas shows for each producer band. ⛔ COPIED VERBATIM from CEE `src/orchestrator-v5/format/
 * edge-strength-bands.ts` CANVAS_BAND_WORD @ `41105c78c328335be76cea712a15169e5e5ef0e4`: only the lowest differs (the
 * enum keeps `weak`, the canvas pill and the card say "slight", the same range). Served: the M3 ghost read "Proposed:
 * weak" beside a card saying "as slight" (R3 #85 5943748459). A row pins these literals.
 */
export const CANVAS_BAND_WORD: Readonly<Record<PreviewBand, string>> = {
  weak: 'slight',
  moderate: 'moderate',
  strong: 'strong',
  'very strong': 'very strong',
}

/** A ghost is Olumi's, never saved model state: every mark and card says whose proposal it is (DL, 21 Oct 2026). */
export const OLUMI_PROPOSES = 'Olumi proposes'
// Whose figure it is, in the held card's words (HeldProposalPanel `sourceWords`); Olumi's own is said once, by the prefix.
const VALUE_SOURCE_WORDS = { estimate: '', yours: ' · from your message', from_brief: ' · from your brief' } as const

/** A link mark's words: a change says "Proposed", a keep says what the Yes records; the band in the canvas's word. */
export function ghostBandText(b: {
  band: PreviewBand | null; keeps: boolean; reverses: boolean; direction?: 'positive' | 'negative'; source?: 'estimate' | 'yours'
}): string {
  const whose = b.source === undefined ? '' : VALUE_SOURCE_WORDS[b.source]
  // A new link with no size (core): which way it moves, in the canvas legend's words.
  if (b.band === null) return `${OLUMI_PROPOSES}: ${b.direction === 'negative' ? 'lowers' : 'raises'}${whose}`
  const word = CANVAS_BAND_WORD[b.band]
  if (b.keeps && !b.reverses) return `Record as ${word}`
  return `${OLUMI_PROPOSES}: ${word}${b.reverses ? ', direction reversed' : ''}${whose}`
}

/** An option mark's words: the card's own words, verbatim, for taken out (they carry a colon, hence the dot). */
export function ghostStatusText(status: PreviewOptionStatus): string {
  return `${OLUMI_PROPOSES} · ${status === 'feasible' ? 'Back in the comparison' : OPTION_TAKEN_OUT_COPY[status]}`
}


/** A factor's proposed value: the figure as the held card says it, and whose it is. */
export function ghostValueText(v: { value: number; unit: string; source: keyof typeof VALUE_SOURCE_WORDS }): string {
  return `${OLUMI_PROPOSES}: ${figureText(v)}${VALUE_SOURCE_WORDS[v.source]}`
}

/** A figure as the held card says it. */
export const figureText = (v: { value: number; unit: string }): string =>
  formatMoneyFigure(v.value, v.unit) ?? (v.unit === '%' ? `${v.value}%` : `${v.value} ${v.unit}`.trim())

/** A new factor's second line (core): its level, when it has one, and whose item it is; null when there is nothing to say. */
export function ghostCardDetail(c: { value?: { value: number; unit: string } | null; source?: 'estimate' | 'yours' }): string | null {
  const figure = c.value ? figureText(c.value) : null
  const whose = c.source === 'yours' ? 'from your message' : null
  return figure && whose ? `${figure} · ${whose}` : figure ?? whose
}

/** Where along a real edge a band mark may sit, middle first (geometry takes the first that covers nothing). */
const BAND_ALONG = [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8, 0.15, 0.85] as const
const measuresKey = (m: GhostMeasures) =>
  JSON.stringify([
    [...(m.heights ?? [])], [...(m.markSizes ?? [])], [...(m.bandPaths ?? [])], [...(m.bandEdgePaths ?? [])], m.obstacles ?? [],
  ])

export const ProposalGhostLayer = memo(function ProposalGhostLayer() {
  const ghost = useProposalGhostStore((s) => s.ghost)
  const chips = useProposalGhostStore((s) => s.chips)
  const nodes = useNodes()
  const edges = useEdges()
  const { screenToFlowPosition } = useReactFlow()
  // Measured, not guessed: a card's height and a band's size follow the counter-scaled text (so they change with the
  // zoom: re-render on zoom), and a band sits on the real edge's DRAWN path. Re-measure after every render; the values
  // depend on label, zoom and edge route only, so this settles in one pass.
  useStore((s) => s.transform[2])
  const layerRef = useRef<HTMLDivElement>(null)
  const [measures, setMeasures] = useState<GhostMeasures>({})
  const geo = useMemo(() => (ghost ? proposalGhostGeometry(ghost, nodes, measures) : null), [ghost, nodes, measures])
  // eslint-disable-next-line react-hooks/exhaustive-deps -- after EVERY render by design; equal measures bail out
  useLayoutEffect(() => {
    const root = layerRef.current
    const heights = new Map<string, number>()
    const markSizes = new Map<string, { w: number; h: number }>()
    const bandPaths = new Map<string, Array<{ x: number; y: number }>>()
    const bandEdgePaths = new Map<string, string>()
    root?.querySelectorAll<HTMLElement>('[data-ghost-id]').forEach((el) => heights.set(el.dataset.ghostId!, el.offsetHeight))
    root?.querySelectorAll<HTMLElement>('[data-ghost-mark]').forEach((el) => {
      if (el.offsetWidth > 0) markSizes.set(el.dataset.ghostMark!, { w: el.offsetWidth, h: el.offsetHeight })
    })
    const flow = root?.closest('.react-flow')
    for (const op of ghost?.ops ?? []) {
      if ((op.op !== 'set_link_strength' && op.op !== 'update_edge') || !flow) continue
      const edge = edges.find((e) => e.source === op.fromId && e.target === op.toId)
      const path = edge
        ? flow.querySelector<SVGPathElement>(`.react-flow__edge[data-id="${CSS.escape(edge.id)}"] path.react-flow__edge-path`)
        : null
      const length = path && typeof path.getTotalLength === 'function' ? path.getTotalLength() : 0
      const d = path?.getAttribute('d')
      if (!path || !d || !(length > 0)) continue
      bandEdgePaths.set(`${op.fromId}->${op.toId}`, d)
      bandPaths.set(`${op.fromId}->${op.toId}`, BAND_ALONG.map((t) => {
        const q = path.getPointAtLength(length * t)
        return { x: Math.round(q.x), y: Math.round(q.y) }
      }))
    }
    // The edges' own labels (sign, strength), in flow units: a ghost must not cover them.
    const obstacles: Array<{ x: number; y: number; w: number; h: number }> = []
    flow?.querySelectorAll<HTMLElement>('.react-flow__edgelabel-renderer > *').forEach((el) => {
      const r = el.getBoundingClientRect()
      if (r.width === 0) return
      const a = screenToFlowPosition({ x: r.left, y: r.top })
      const b = screenToFlowPosition({ x: r.right, y: r.bottom })
      obstacles.push({ x: Math.round(a.x), y: Math.round(a.y), w: Math.round(b.x - a.x), h: Math.round(b.y - a.y) })
    })
    const next = { heights, markSizes, bandPaths, bandEdgePaths, obstacles }
    setMeasures((prev) => (measuresKey(prev) === measuresKey(next) ? prev : next))
  })
  if (!geo || geo.cards.length + geo.lines.length + geo.bands.length + geo.statuses.length + geo.values.length === 0) return null
  // The buttons sit just under the first thing the ghost draws: its first new card, else its first mark.
  const firstCard = geo.cards[0]
  const firstMark = [...geo.bands, ...geo.statuses, ...geo.values][0]
  // What the row sits under (and, when that spot covers a card, above): its top and bottom edges in flow units.
  const actionsAnchor = firstCard !== undefined
    ? { x: firstCard.x, top: firstCard.y, bottom: firstCard.y + (measures.heights?.get(firstCard.id) ?? GHOST_CARD_HEIGHT) }
    : firstMark !== undefined
      ? { x: firstMark.x, top: firstMark.y - (measures.markSizes?.get(firstMark.key)?.h ?? 18) / 2, bottom: firstMark.y + 8 }
      : null

  return (
    <ViewportPortal>
      <div ref={layerRef} aria-hidden="true" data-testid={PROPOSAL_GHOST_TESTID} style={{ pointerEvents: 'none' }}>
        <svg className="absolute overflow-visible" style={{ left: 0, top: 0, pointerEvents: 'none' }} width={1} height={1}>
          {[...geo.bands, ...geo.statuses, ...geo.values].map((b) => (
            <g key={b.key}>
              {'edgePath' in b && b.edgePath && (
                <path
                  data-testid={`proposal-ghost-edge-${b.key}`}
                  d={b.edgePath}
                  fill="none"
                  className="stroke-info"
                  strokeOpacity={0.35}
                  strokeWidth={6}
                  strokeLinecap="round"
                />
              )}
              {b.connector && (
                <line
                  data-testid={`proposal-ghost-connector-${b.key}`}
                  x1={b.connector.x1}
                  y1={b.connector.y1}
                  x2={b.connector.x2}
                  y2={b.connector.y2}
                  className="stroke-info"
                  strokeOpacity={0.55}
                  strokeWidth={1.5}
                />
              )}
            </g>
          ))}
          {geo.lines.map((l) => (
            <line
              key={l.key}
              data-testid={`proposal-ghost-line-${l.key}`}
              x1={l.x1}
              y1={l.y1}
              x2={l.x2}
              y2={l.y2}
              className="stroke-info"
              strokeOpacity={0.55}
              strokeWidth={1.5}
              strokeDasharray="5 5"
            />
          ))}
        </svg>
        {geo.cards.map((c) => {
          // The wire's kind, validated: an unknown kind draws no shape rather than a wrong one.
          const kind = c.kind ? NodeTypeEnum.safeParse(c.kind) : null
          return (
          <div
            key={c.id}
            data-testid={`proposal-ghost-node-${c.id}`}
            data-ghost-id={c.id}
            className="absolute flex flex-col justify-center rounded-lg border border-dashed border-info bg-panel opacity-80"
            style={{ left: c.x, top: c.y, width: c.w, minHeight: GHOST_CARD_HEIGHT, padding: 12, gap: 4, pointerEvents: 'none' }}
          >
            <span className="flex items-center" style={{ gap: 4 }}>
              {kind?.success && <NodeShapeIndicator nodeKind={kind.data} size={14} />}
              <span className={`${typography.nodeLabel} text-text-light`}>{OLUMI_PROPOSES}</span>
            </span>
            <span className={`${typography.nodeTitle} text-text-header`}>{c.label}</span>
            {ghostCardDetail(c) !== null && <span className={`${typography.edgeLabel} text-text-body`} data-testid={`proposal-ghost-node-${c.id}-detail`}>{ghostCardDetail(c)}</span>}
          </div>
          )
        })}
        {[
          ...geo.bands.map((b) => ({ key: b.key, testid: `proposal-ghost-band-${b.key}`, x: b.x, y: b.y, text: ghostBandText(b) })),
          ...geo.statuses.map((st) => ({
            key: st.key, testid: `proposal-ghost-status-${st.optionId}`, x: st.x, y: st.y, text: ghostStatusText(st.status),
          })),
          ...geo.values.map((v) => ({ key: v.key, testid: `proposal-ghost-value-${v.nodeId}`, x: v.x, y: v.y, text: ghostValueText(v) })),
        ].map((m) => (
          <span
            key={m.key}
            data-testid={m.testid}
            data-ghost-mark={m.key}
            className={`absolute rounded border border-info bg-panel opacity-80 ${typography.edgeLabel} text-text-header`}
            style={{ left: m.x, top: m.y, transform: 'translate(-50%, -50%)', padding: '2px 8px', whiteSpace: 'nowrap', pointerEvents: 'none' }}
          >
            {m.text}
          </span>
        ))}
      </div>
      {chips !== null && ghost !== null && actionsAnchor !== null && (
        <GhostActions key={ghost.proposalId} approve={chips.approve} decline={chips.decline} anchor={actionsAnchor}
          proposalId={ghost.proposalId} otherChanges={ghost.otherChanges}
          addsOnly={ghost.ops.every((o) => o.op === 'add_node' || o.op === 'add_edge')} />
      )}
    </ViewportPortal>
  )
})
