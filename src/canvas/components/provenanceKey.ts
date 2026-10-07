/**
 * ⭐ THE PROVENANCE / UNCERTAINTY KEY (DL #85 5939855664 queue; PTL 5941434564 §6): what the marks already on the
 * canvas mean, for the cues THIS board actually draws.
 *
 * ⛔ EXISTING CUES ONLY: no new semantic state, no confidence score, no new words for a cue. Every entry is derived by
 * the SAME function that draws the cue, and its words are that cue's own exported words:
 *   - a card's provenance mark → `resolveProvenanceMarks` + `provenanceClaimLabel` (NodeProvenanceMark);
 *   - a thin link              → `isStrengthPlaceholder` (StyledEdge's not-set width) + `EDGE_STRENGTH_PLACEHOLDER_SENTENCE`;
 *   - a dashed link            → `resolveExistenceDash` over `resolveEdgeValueDisplay(…, 'beliefExists')`, stated with a
 *                                dash (StyledEdge's doubt condition) + `EDGE_EXISTENCE_DOUBT_SENTENCE`.
 *   - a value's source word    → `factorValueSourceMark` (the card's own function) + `VALUE_SOURCE_MARK_TOKEN` /
 *                                `VALUE_SOURCE_MARK_LABEL` ("est." = Olumi estimate, not yet confirmed), for factors that
 *                                carry a value (a finite `observedState.value`, the line the word sits on);
 *   - an option's "Compared · share not shown" → `NOT_RANKED_MARKER` + the gate's own reason
 *                                (`selectWinShareWithheldReason`), only while the Run withheld shares.
 * A cue the board does not draw has no entry. The board's default kind (cards carrying ONLY it show no mark at rest,
 * `provenanceDefaultKind`) is named, so an unmarked card is not read as "unknown".
 */
import { RENDERED_CARD_MARKS, type CardMarkDefinition } from '../nodes/shared/cardMarks'
import { routeOnceHeldEdges } from '../domain/routeOnceHeld'
import type { NodeProvenanceClaim } from '../domain/nodeProvenanceClaim'
import { provenanceClaimLabel } from '../domain/nodeProvenanceClaim'
import type { ValueProvenanceKind } from '../domain/valueProvenance'
import { resolveNodeTypeLiteral } from '../domain/nodes'
import { isStrengthPlaceholder } from '../domain/strengthPlaceholder'
import { resolveEdgeValueDisplay } from '../domain/edgeValueProvenance'
import { provenanceDefaultKind, resolveProvenanceMarks } from '../nodes/shared/NodeProvenanceMark'
import { EDGE_EXISTENCE_DOUBT_SENTENCE, EDGE_STRENGTH_PLACEHOLDER_SENTENCE } from '../edges/connectorCopy'
import { resolveExistenceDash } from '../utils/graphDisplayCalculations'
import { NOT_RANKED_MARKER } from '../state/winShareGate'
import { factorValueSourceMark, VALUE_SOURCE_MARK_LABEL, VALUE_SOURCE_MARK_TOKEN, type ValueSourceMarkKind } from '../nodes/shared/valueSourceMark'

export interface ProvenanceMarkEntry {
  readonly claim: Exclude<NodeProvenanceClaim, 'none'>
  readonly kind: ValueProvenanceKind
  /** The mark's own words (`provenanceClaimLabel`). */
  readonly label: string
  /** The board's default kind: cards carrying only it show no mark at rest. */
  readonly isDefault: boolean
}

export interface LinkCueEntry {
  readonly cue: 'placeholder' | 'doubt'
  /** The cue's own sentence (connectorCopy). */
  readonly label: string
  /** The dash the doubted link is drawn with (the same `resolveExistenceDash` value), for the swatch. */
  readonly dash?: string
}

export interface ValueMarkEntry {
  readonly kind: ValueSourceMarkKind
  /** The word the card prints after the value (`VALUE_SOURCE_MARK_TOKEN`), e.g. "est.". */
  readonly token: string
  /** Its meaning (`VALUE_SOURCE_MARK_LABEL`), the card's own hover/accessible name. */
  readonly label: string
}

export interface OptionCueEntry {
  /** The marker the option card shows (`NOT_RANKED_MARKER`). */
  readonly label: string
  /** The gate's own reason for withholding (`selectWinShareWithheldReason`), verbatim. */
  readonly reason: string
}

export interface ProvenanceKey {
  readonly cardMarks: readonly CardMarkDefinition[]
  readonly marks: readonly ProvenanceMarkEntry[]
  readonly values: readonly ValueMarkEntry[]
  readonly links: readonly LinkCueEntry[]
  readonly options: OptionCueEntry | null
  readonly empty: boolean
}

type NodeLike = { type?: string; data?: unknown }
type EdgeLike = { data?: unknown }

/** `withheldReason`: `selectWinShareWithheldReason(state)`, non-null exactly while the Run withheld the win shares. */
export function provenanceKey(
  nodes: ReadonlyArray<NodeLike>,
  edges: ReadonlyArray<EdgeLike>,
  withheldReason: string | null = null,
  hasRun = false,
): ProvenanceKey {
  const defaultKind = provenanceDefaultKind(nodes as never)
  const seen = new Map<string, ProvenanceMarkEntry>()
  for (const n of nodes) {
    const nodeType = resolveNodeTypeLiteral(n as never)
    if (!nodeType) continue
    for (const m of resolveProvenanceMarks(nodeType, n.data)) {
      const key = `${m.claim}\u0000${m.kind}`
      if (!seen.has(key)) {
        seen.set(key, { claim: m.claim, kind: m.kind, label: provenanceClaimLabel(m.claim, m.kind), isDefault: m.kind === defaultKind })
      }
    }
  }
  // The default first (it is what most cards are), then the exceptions in a stable order.
  const marks = [...seen.values()].sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.label.localeCompare(b.label))

  const valueKinds = new Set<ValueSourceMarkKind>()
  for (const n of nodes) {
    if (resolveNodeTypeLiteral(n as never) !== 'factor') continue
    const v = ((n.data as Record<string, unknown> | undefined)?.observedState as { value?: unknown } | undefined)?.value
    if (typeof v !== 'number' || !Number.isFinite(v)) continue
    const mark = factorValueSourceMark(n.data)
    if (mark) valueKinds.add(mark.kind)
  }
  const VALUE_ORDER: readonly ValueSourceMarkKind[] = ['olumi', 'brief', 'you', 'panel', 'unknown']
  const values = VALUE_ORDER.filter((k) => valueKinds.has(k)).map((k) => ({ kind: k, token: VALUE_SOURCE_MARK_TOKEN[k], label: VALUE_SOURCE_MARK_LABEL[k] }))

  const heldEdges = routeOnceHeldEdges(nodes, edges)
  const links: LinkCueEntry[] = []
  if (edges.some((e) => isStrengthPlaceholder(e.data as Record<string, unknown> | undefined))) {
    links.push({ cue: 'placeholder', label: EDGE_STRENGTH_PLACEHOLDER_SENTENCE })
  }
  for (const e of edges) {
    const existence = resolveExistenceDash(resolveEdgeValueDisplay(e.data as Record<string, unknown> | undefined, 'beliefExists', { routeOnceHeld: heldEdges.has(e) }))
    if (existence.kind === 'stated' && existence.dash !== undefined) {
      links.push({ cue: 'doubt', label: EDGE_EXISTENCE_DOUBT_SENTENCE, dash: existence.dash })
      break
    }
  }
  const options = withheldReason !== null ? { label: NOT_RANKED_MARKER, reason: withheldReason } : null
  const types = new Set(nodes.map(n => resolveNodeTypeLiteral(n as never)))
  const cardMarks = RENDERED_CARD_MARKS.filter(m => m.nodeTypes.some(t => types.has(t as never)))
  return { cardMarks, marks, values, links, options, empty: cardMarks.length === 0 && !(hasRun && types.has('option')) && !nodes.some(n => (n.data as { is_baseline?: boolean } | undefined)?.is_baseline === true) && marks.length === 0 && values.length === 0 && links.length === 0 && options === null }
}
