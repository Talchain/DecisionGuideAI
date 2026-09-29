/**
 * NodeHoverCard — the card hover pop-up (Paul, 29 Sep 2026: "bring both pop-ups
 * back … more valuable … more aligned with the new graph design system").
 *
 * It shows ONLY what the server sent, read through the same owners the card
 * reads, so the two can never disagree:
 *   · the full name (the card title may wrap or clip);
 *   · a factor's recorded value as the card formats it (`factorDisplayText`),
 *     with WHO put it there (`factorValueSourceMark`); for other kinds, who put
 *     the element there (`resolveProvenanceMarks`);
 *   · what it affects (outgoing connections) and, on outcomes, risks and the
 *     goal, what drives it — each with its direction ONLY where one was stated.
 * Nothing is computed, banded or defaulted: an absent field renders nothing,
 * and a factor with no value says "not on record".
 *
 * Mounted once, in `BaseNode`, for every kind. Portalled to `document.body` at a
 * fixed position so the card's size and layout never change, and placed beside
 * its card on the side that covers the fewest other cards
 * (`hoverCardPlacement`). `pointer-events: none`: it can never take a click, a
 * double-click-to-rename or a drag from the card underneath.
 */
import { useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useCanvasStore } from '../../store'
import { NODE_REGISTRY, type NodeType } from '../../domain/nodes'
import { resolveEdgeDirectionDisplay, resolveEdgeSignedStrengthDisplay } from '../../domain/edgeValueProvenance'
import { StrengthBar } from './StrengthBar'
import { factorDisplayText } from '../../../utils/formatFactorDisplayValue'
import { readoutIsBareModelScale } from '../../nodes/shared/FactorValueFigure'
import { factorValueSourceMark } from '../../nodes/shared/valueSourceMark'
import { resolveProvenanceMarks } from '../../nodes/shared/NodeProvenanceMark'
import { provenanceClaimLabel } from '../../domain/nodeProvenanceClaim'
import { isSuppressedUnit } from '../../utils/labelUtils'
import { CANVAS_LAYER_CLASS } from '../../layers'
import { typography } from '../../../styles/typography'
import {
  HOVER_CARD_MAX_WIDTH,
  HOVER_CARD_SURFACE_CLASS,
  canvasCardRects,
  placeHoverCard,
  viewportSize,
  type HoverCardPlacement,
} from './hoverCardPlacement'

export const NOT_ON_RECORD = 'Not on record'
const MAX_LINKED_NAMES = 4

type LinkedName = { name: string; direction: 'positive' | 'negative' | null; strength: number | null }
export interface NodeHoverLinkGroup { heading: string; items: LinkedName[]; more: number }
export interface NodeHoverFacts {
  title: string | null
  kind: string | null
  /** Factor only. `null` text with `missing` = the factor has no recorded value. */
  value: { text: string | null; source: string | null; missing: boolean } | null
  /** Non-factor: who put the element on the board. */
  source: string | null
  links: NodeHoverLinkGroup[]
}

type GraphNode = { id: string; type?: string; data?: Record<string, unknown> }
type GraphEdge = { source: string; target: string; data?: unknown }

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null)

function group(heading: string, edges: GraphEdge[], other: (e: GraphEdge) => string, byId: Map<string, GraphNode>, causal: boolean): NodeHoverLinkGroup | null {
  const items: LinkedName[] = []
  for (const e of edges) {
    const name = str(byId.get(other(e))?.data?.label)
    if (name === null) continue // never a name we do not have
    const dir = causal ? resolveEdgeDirectionDisplay(e.data as Record<string, unknown> | undefined) : null
    // The server's stated strength only (`resolveEdgeSignedStrengthDisplay` withholds a UI default), drawn as a bar.
    const str8 = causal ? resolveEdgeSignedStrengthDisplay(e.data as Record<string, unknown> | undefined) : null
    items.push({ name, direction: dir?.show ? dir.direction : null, strength: str8?.show ? Math.abs(str8.value) : null })
  }
  if (items.length === 0) return null
  return { heading, items: items.slice(0, MAX_LINKED_NAMES), more: Math.max(0, items.length - MAX_LINKED_NAMES) }
}

/** The pop-up's content, from the node's own data and the graph's connections. Pure. */
export function nodeHoverFacts(
  nodeId: string,
  nodeType: NodeType,
  data: Record<string, unknown> | undefined,
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
): NodeHoverFacts {
  const d = data ?? {}
  const facts: NodeHoverFacts = {
    title: str(d.label),
    kind: NODE_REGISTRY[nodeType as keyof typeof NODE_REGISTRY]?.label ?? null,
    value: null,
    source: null,
    links: [],
  }

  if (nodeType === 'factor') {
    // The card's own value read (`FactorNode` `valueDisplayData`): a descriptor
    // unit is suppressed, never shown as if measured.
    const obs = d.observedState as Record<string, unknown> | undefined
    const displayData = obs && typeof obs === 'object'
      ? { ...d, observedState: { ...obs, unit: isSuppressedUnit((obs.unit as string | undefined) ?? undefined) ? undefined : obs.unit } }
      : d
    const text = factorDisplayText(displayData)
    const mark = factorValueSourceMark(d)
    // A bare 0–1 Olumi placeholder is omitted on the card (contract v3.1 #20);
    // the pop-up omits it too and keeps only whose it is.
    const shown = text !== null && !readoutIsBareModelScale(text, displayData) ? text : null
    facts.value = { text: shown, source: mark?.label ?? null, missing: text === null }
  } else {
    const labels = resolveProvenanceMarks(nodeType, d).map(m => provenanceClaimLabel(m.claim, m.kind))
    facts.source = labels.length > 0 ? labels.join(' · ') : null
  }

  const byId = new Map(nodes.map(n => [n.id, n]))
  const kindOf = (id: string) => byId.get(id)?.type
  const out = edges.filter(e => e.source === nodeId)
  const into = edges.filter(e => e.target === nodeId)
  const groups: (NodeHoverLinkGroup | null)[] = []
  if (nodeType === 'decision') {
    groups.push(group('Options', out.filter(e => kindOf(e.target) === 'option'), e => e.target, byId, false))
  } else if (nodeType === 'option') {
    groups.push(group('Changes', out, e => e.target, byId, false))
  } else {
    groups.push(group('Affects', out, e => e.target, byId, true))
  }
  if (nodeType === 'outcome' || nodeType === 'risk' || nodeType === 'goal') {
    const causalIn = into.filter(e => kindOf(e.source) !== 'option' && kindOf(e.source) !== 'decision')
    groups.push(group('Driven by', causalIn, e => e.source, byId, true))
  }
  facts.links = groups.filter((g): g is NodeHoverLinkGroup => g !== null)
  return facts
}

const EMPTY: readonly never[] = []

interface NodeHoverCardProps {
  nodeId: string
  nodeType: NodeType
  data: Record<string, unknown> | undefined
  visible: boolean
  anchorRef: RefObject<HTMLElement | null>
}

export function NodeHoverCard(props: NodeHoverCardProps) {
  if (!props.visible) return null
  return <OpenNodeHoverCard {...props} />
}

function Row({ label, testId, children }: { label: string; testId: string; children: ReactNode }) {
  return (
    <div className="flex gap-2" data-testid={testId}>
      <dt className={`${typography.panelMeta} text-text-light shrink-0 w-16 pt-px`}>{label}</dt>
      <dd className={`${typography.panelBody} text-text-body m-0 min-w-0 break-words`}>{children}</dd>
    </div>
  )
}

function OpenNodeHoverCard({ nodeId, nodeType, data, anchorRef }: NodeHoverCardProps) {
  const nodes = useCanvasStore(s => (s.nodes as GraphNode[] | undefined) ?? EMPTY)
  const edges = useCanvasStore(s => (s.edges as GraphEdge[] | undefined) ?? EMPTY)
  const facts = useMemo(() => nodeHoverFacts(nodeId, nodeType, data, nodes, edges), [nodeId, nodeType, data, nodes, edges])
  const cardRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<HoverCardPlacement | null>(null)

  // Place before paint, then follow the card through pan, zoom and relayout.
  useLayoutEffect(() => {
    let raf = 0
    let last = ''
    const place = () => {
      const anchor = anchorRef.current
      const card = cardRef.current
      if (anchor && card) {
        const a = anchor.getBoundingClientRect()
        const size = { width: card.offsetWidth, height: card.offsetHeight }
        const key = `${a.left}|${a.top}|${a.width}|${a.height}|${size.width}|${size.height}`
        if (key !== last) {
          last = key
          const next = placeHoverCard(a, size, viewportSize(), canvasCardRects(anchor.closest('.react-flow__node')))
          setPos(prev => (prev && prev.left === next.left && prev.top === next.top ? prev : next))
        }
      }
      raf = requestAnimationFrame(place)
    }
    place()
    return () => cancelAnimationFrame(raf)
  }, [anchorRef])

  if (typeof document === 'undefined') return null
  const { title, kind, value, source, links } = facts

  return createPortal(
    <div
      ref={cardRef}
      role="tooltip"
      data-testid="node-hover-card"
      data-node-hover-card={nodeId}
      data-placement={pos?.side}
      className={`fixed ${CANVAS_LAYER_CLASS.hoverPreview} ${HOVER_CARD_SURFACE_CLASS}`}
      style={{
        left: pos?.left ?? 0,
        top: pos?.top ?? 0,
        width: 'max-content',
        maxWidth: HOVER_CARD_MAX_WIDTH,
        pointerEvents: 'none',
        visibility: pos ? 'visible' : 'hidden',
      }}
    >
      {title !== null && (
        <div data-testid="node-hover-card-title" className={`${typography.panelBody} font-semibold text-text-header break-words`}>
          {title}
        </div>
      )}
      {kind !== null && (
        <div data-testid="node-hover-card-kind" className={`${typography.panelMeta} text-text-light`}>{kind}</div>
      )}
      {(value !== null || source !== null || links.length > 0) && (
        <dl className="mt-1.5 mb-0 space-y-1">
          {value !== null && (value.text !== null || value.missing) && (
            <Row label="Value" testId="node-hover-card-value">
              {value.text ?? NOT_ON_RECORD}
              {value.text !== null && value.source !== null && (
                <span className="text-text-light"> · {value.source}</span>
              )}
            </Row>
          )}
          {value !== null && value.text === null && !value.missing && value.source !== null && (
            <Row label="Source" testId="node-hover-card-source">{value.source}</Row>
          )}
          {source !== null && <Row label="Source" testId="node-hover-card-source">{source}</Row>}
          {links.map(g => (
            <Row key={g.heading} label={g.heading} testId={`node-hover-card-links-${g.heading.toLowerCase().replace(/\s+/g, '-')}`}>
              {g.items.map((item, i) => (
                <span key={`${item.name}-${i}`}>
                  {i > 0 && ', '}
                  {item.name}
                  {item.strength !== null && <StrengthBar magnitude={item.strength} direction={item.direction} testId={`node-hover-card-link-bar-${i}`} />}
                  {item.direction !== null && <span className="text-text-light"> ({item.direction})</span>}
                </span>
              ))}
              {g.more > 0 && <span className="text-text-light">{` +${g.more} more`}</span>}
            </Row>
          ))}
        </dl>
      )}
    </div>,
    document.body,
  )
}
