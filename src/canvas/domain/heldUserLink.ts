/**
 * ⭐ D3 cut 6, HOLD-AT-1.0 — the UI's MIRROR of CEE `heldLinkOf`'s predicate (Science d5 #87 6008807178; DL 0df0e1: a pure
 * predicate over exactly the fields CEE reads, no numbers computed, no second notion of "user-stated"). A link the USER
 * stated whose own stated range excludes zero is held at existence 1.0 on every Run's input, so the canvas must not show
 * Olumi's stored doubt for it. Read on the RAW wire edge at ingestion (`existenceHeld`); the displays read that flag.
 *
 * Fields read (and only these): strength.mean, provenance.source, provenance.magnitude, provenance.source_quote,
 * provenance.clamped_from, provenance.definitional, provenance.natural_effect.{amount, amount_unit, per_source_change,
 * per_source_change_unit, strength_mean, stated_range.{low, high}}, and the two END nodes' label and unit (`LinkEnds`).
 *
 * ⭐ S-DEF (Science 393023, DL P0, 7 Oct; CEE #2739 ← #2665): a VALIDATED DEFINITION holds whoever drew it, the CEE rule
 * `validatedDefinition`. A current definitional carrier, whose total's unit is the definition's (and the part's, where it
 * has one), and whose part's label holds the total's quantity words. The ends come from the graph at every hop
 * (`linkEndsOf`). A flag that fails any clause is not a definition, whoever flagged it: the user's link is an ordinary
 * user link (held only by its own range) and Olumi's keeps its doubt.
 *
 * ⛔ A MIRROR, NOT AN AUTHORITY: `__tests__/fixtures/held-link-parity.json` is byte-identical to CEE's copy and both repos
 * pin its sha256 ("held-link parity fixture digest"). Register row (cut 7): move this into @talchain/schemas.
 */
type Rec = Record<string, unknown>
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v)
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

const TOL = 1e-9
const near = (a: number, b: number): boolean => Math.abs(a - b) <= TOL * Math.max(1, Math.abs(b))

/** CEE `carriesStatedSize`: the link still carries the user's β, or a verified stored clamp of it. */
function carriesStatedSize(e: Rec, beta: number): boolean {
  const mean = isRec(e.strength) ? e.strength.mean : undefined
  if (!finite(mean)) return false
  if (near(mean, beta)) return true
  const clampedFrom = isRec(e.provenance) ? e.provenance.clamped_from : undefined
  return finite(clampedFrom) && near(clampedFrom, beta) && near(Math.abs(mean), 1) && Math.sign(mean) === Math.sign(beta)
}

/**
 * CEE `currentDefinitionalCarrier`: a definitional link whose stored size is still the definition, ±1 per 1 in ONE unit
 * string at both ends, its β still carried. A band edit keeps the flag but moves the size (Codex r1 CEE #2653).
 */
function isCurrentDefinition(e: Rec, p: Rec): boolean {
  if (p.definitional !== true) return false
  const ne = p.natural_effect
  if (!isRec(ne) || !finite(ne.amount) || Math.abs(ne.amount) !== 1 || ne.per_source_change !== 1 || !finite(ne.strength_mean)) return false
  const u = ne.amount_unit
  if (typeof u !== 'string' || u.trim() === '' || ne.per_source_change_unit !== u) return false
  return carriesStatedSize(e, ne.strength_mean)
}

/** CEE `isUserStatedLink`: the user sized it (`linkSizing` 'user'), or their brief stated it WITH its quote. */
function isUserStatedLink(p: Rec): boolean {
  if (p.source === 'user_specified' || p.magnitude === 'user_stated') return true
  return p.source === 'brief_extraction' && typeof p.source_quote === 'string' && p.source_quote.trim() !== ''
}

/**
 * CEE `LinkEnds`: the two ends of a link as the validated-definition test reads them, the labels and the unit each end's
 * level is read in. Built once per graph (`linkEndsOf`) and passed at every hop, so no hop holds a link another does not.
 */
export interface LinkEnds {
  readonly fromLabel?: string
  readonly toLabel?: string
  readonly fromUnit?: string
  readonly toUnit?: string
}

/** Ends with no labels and no units: nothing validates against them, so only the user's own range can hold the link. */
export const NO_LINK_ENDS: LinkEnds = Object.freeze({})

const text = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() !== '' ? v : undefined)

/** A CEE wire node carries `kind` and `label` at the top level (NodeV3Schema; `isCanvasShapedNode`'s positive marker). */
const isWireNode = (n: Rec): boolean => typeof n.kind === 'string' && typeof n.label === 'string'

/**
 * The fields CEE reads for a node's ends. A WIRE node is read exactly as CEE reads it: its own fields, never a nested
 * `data` (Codex r1 #2602 P0). A CANVAS node is read as registration SENDS it (`projectNodeFieldsForWire`): `data`'s
 * fields, the observed bundle `observedState ?? observed_state` (camel-case first, Codex r1 P0), the kind its data names.
 */
function nodeFields(n: Rec): { label: unknown; unit: unknown; observed: unknown; kind: unknown; goalUnit: unknown; reading: unknown } {
  if (!isWireNode(n) && isRec(n.data)) {
    const d = n.data
    return { label: d.label, unit: d.unit, observed: d.observedState ?? d.observed_state, kind: d.kind ?? d.type ?? n.type,
      goalUnit: d.goal_threshold_unit, reading: d.unit_reading }
  }
  return { label: n.label, unit: n.unit, observed: n.observed_state, kind: n.kind, goalUnit: n.goal_threshold_unit, reading: n.unit_reading }
}

/** CEE `nodeUnitOf`: the first own unit (unit, observed, a goal's threshold unit), else the user's own stated reading. */
function nodeUnit(n: Rec): string | undefined {
  const f = nodeFields(n)
  const reading = isRec(f.reading) && f.reading.source === 'user_stated' ? f.reading.unit : undefined
  return [f.unit, isRec(f.observed) ? f.observed.unit : undefined, f.kind === 'goal' ? f.goalUnit : undefined, reading]
    .find((x): x is string => typeof x === 'string' && x.trim() !== '')
}

/** CEE `endsOfGraph`, over the wire graph's nodes or the canvas's (the edge's `from`/`to`, or `source`/`target`). */
export function linkEndsOf(nodes: readonly unknown[] | undefined | null): (edge: unknown) => LinkEnds {
  const byId = new Map<unknown, Rec>()
  for (const n of nodes ?? []) if (isRec(n)) byId.set(n.id, n)
  const labelOf = (n: Rec | undefined): string | undefined => (n === undefined ? undefined : text(nodeFields(n).label))
  return (edge) => {
    if (!isRec(edge)) return NO_LINK_ENDS
    const from = byId.get(edge.from ?? edge.source)
    const to = byId.get(edge.to ?? edge.target)
    return { fromLabel: labelOf(from), toLabel: labelOf(to), fromUnit: from && nodeUnit(from), toUnit: to && nodeUnit(to) }
  }
}

const QUANTITY_STOP = new Set(['a', 'an', 'the', 'of', 'to', 'from', 'for', 'in', 'on', 'per', 'by', 'and', 'or', 'with', 'at', 'into', 'its', 'their'])
const singularWord = (w: string): string => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w)
const quantityWords = (label: string): string[] =>
  label.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w !== '' && !QUANTITY_STOP.has(w)).map(singularWord)

/** CEE `labelHoldsQuantity`, verbatim: the part's label holds every content word of the total's, or its acronym. */
export function labelHoldsQuantity(sourceLabel: string, targetLabel: string): boolean {
  const source = new Set(quantityWords(sourceLabel))
  const target = quantityWords(targetLabel)
  if (source.size === 0 || target.length === 0) return false
  if (target.every((w) => source.has(w))) return true
  return target.length >= 2 && source.has(target.map((w) => w[0]).join(''))
}

/**
 * The definition's unit test: a strict SUBSET of CEE `sameUnit` (it may abstain where CEE equates, never the reverse).
 * The same unit string, or money per month/year in £/GBP or €/EUR spelt "/", "per" or "a" ("£/month" = "GBP per
 * month"). Measured against CEE `sameUnit` at 428a3240: 0 pairs equated here that CEE refuses, over the 276 units in
 * CEE's captured fixtures (76,176 pairs) and a 228-spelling sweep (51,984 pairs). An abstention shows Olumi's doubt, as
 * before S-DEF; it never shows a hold the Run does not use.
 */
const MONEY_PER_PERIOD = /^(£|gbp|€|eur)(?:\s*\/\s*|\s+per\s+|\s+a\s+)(month|year)$/
const CURRENCY_CODE: Record<string, string> = { '£': 'gbp', gbp: 'gbp', '€': 'eur', eur: 'eur' }
function unitKey(u: string): string {
  const t = u.trim().replace(/\s+/g, ' ')
  const m = MONEY_PER_PERIOD.exec(t.toLowerCase())
  return m ? `money:${CURRENCY_CODE[m[1]!]}/${m[2]}` : `text:${t}`
}
export function definitionUnitsMatch(a: string, b: string): boolean {
  if (a.trim() === '' || b.trim() === '') return false
  return unitKey(a) === unitKey(b)
}

/** CEE `currentDefinitionalCarrier`'s unit, else undefined. */
function definitionUnit(e: Rec): string | undefined {
  const p = e.provenance
  if (!isRec(p) || !isCurrentDefinition(e, p)) return undefined
  return (p.natural_effect as Rec).amount_unit as string
}

/** CEE `validatedDefinition(e, ends) !== undefined`: a current carrier whose ends hold the definition. */
export function isValidatedDefinition(wireEdge: unknown, ends: LinkEnds): boolean {
  if (!isRec(wireEdge)) return false
  const u = definitionUnit(wireEdge)
  if (u === undefined) return false
  if (ends.toUnit === undefined || !definitionUnitsMatch(ends.toUnit, u) || (ends.fromUnit !== undefined && !definitionUnitsMatch(ends.fromUnit, u))) return false
  return ends.fromLabel !== undefined && ends.toLabel !== undefined && labelHoldsQuantity(ends.fromLabel, ends.toLabel)
}

/**
 * The ONE ingestion reader, every hop (like `strengthPlaceholderPatch`): `{ existenceHeld: true }` iff CEE holds the link,
 * plus WHY when it is a validated definition (`existenceHeldByDefinition`), so a display never guesses the reason (Codex r1
 * #2602 P1: a flagged link held only by the user's range is not "by definition").
 * `ends` is REQUIRED: a hop with no graph passes `NO_LINK_ENDS` on purpose, and then only the user's own range holds.
 */
export function existenceHeldPatch(wireEdge: unknown, ends: LinkEnds): { existenceHeld?: true; existenceHeldByDefinition?: true } {
  if (isValidatedDefinition(wireEdge, ends)) return { existenceHeld: true, existenceHeldByDefinition: true }
  return isHeldUserLink(wireEdge, ends) ? { existenceHeld: true } : {}
}

/** Whether CEE holds this wire edge at existence 1.0 on the Run's input (CEE `heldLinkOf(e, ends) !== null`). */
export function isHeldUserLink(wireEdge: unknown, ends: LinkEnds): boolean {
  if (!isRec(wireEdge) || !isRec(wireEdge.provenance)) return false
  // S-DEF: a validated definition holds whoever drew it.
  if (isValidatedDefinition(wireEdge, ends)) return true
  const p = wireEdge.provenance
  if (!isUserStatedLink(p)) return false
  const ne = p.natural_effect
  if (!isRec(ne) || !isRec(ne.stated_range)) return false
  const { low, high } = ne.stated_range
  if (!finite(low) || !finite(high) || !finite(ne.amount) || ne.amount === 0 || !finite(ne.strength_mean)) return false
  if (!carriesStatedSize(wireEdge, ne.strength_mean)) return false
  if (!((low > 0 && high > 0) || (low < 0 && high < 0))) return false
  // CEE holds only when its spread is finite and positive — the SAME arithmetic (Codex r2 #2643: an underflowing β or an
  // overflowing range is refused there, so it is here); the value itself is never used.
  const spread = Math.abs((high - low) * (ne.strength_mean / ne.amount)) / 3.29
  return Number.isFinite(spread) && spread > 0
}
