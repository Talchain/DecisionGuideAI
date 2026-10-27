/**
 * Whether the saved model is an executable model (a program graph), read from the field CEE sets on it:
 * `graph.living_model.model_program`. Never guessed from shapes. A program's analysis is run by the host on every
 * change, and its effect links carry a `coefficient_id` naming the canonical quantity behind them.
 * Only the version this UI knows ("v1") counts: an unknown version keeps today's controls (Codex r1 on #2950).
 */
import { useMemo } from 'react'

import { useSavedGraph, useSavedGraphRead } from './savedGraph'
import { useCanvasStore } from '../../store'
import { formatNumber } from '../../utils/formatValueWithUnit'
import { unitWords } from '../../../utils/unitClassifier'
import type { ValueProvenanceKind } from '../../domain/valueProvenance'
import type { CEEGoalConstraint } from '../../../adapters/cee/types'

type Rec = Record<string, unknown>
const rec = (v: unknown): Rec | null => (v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Rec) : null)

const PROGRAM_VERSION = 'v1'

export function isProgramGraph(graph: unknown): boolean {
  const program = rec(rec(graph)?.living_model)?.model_program
  return program === PROGRAM_VERSION
}

export function useSavedModelIsProgram(): boolean {
  return isProgramGraph(useSavedGraph())
}

/**
 * Whether the saved model on screen is a program, saying when that is not known: `unknown` while its read is pending
 * (a saved scenario with no saved hash yet included) or after it failed. With no read to make (off the core lane, or no
 * saved scenario) no program is on screen.
 * A scenario a read has shown to be a program stays one while a later read of it is pending or failed: every program turn
 * moves the saved hash and reads again, and the board must not fall back to the legacy surfaces in that window (or for
 * good when the re-read fails or its hash does not match). Only a read that answers decides otherwise.
 */
export function useSavedModelProgramState(): 'program' | 'not_program' | 'unknown' {
  const read = useSavedGraphRead()
  const scenarioId = useCanvasStore((s) => s.currentScenarioId)
  if (read.status === 'none') return 'not_program'
  if (read.status === 'read') {
    const program = isProgramGraph(read.graph)
    if (typeof scenarioId === 'string') answeredProgram.set(scenarioId, program)
    return program ? 'program' : 'not_program'
  }
  return typeof scenarioId === 'string' && answeredProgram.get(scenarioId) === true ? 'program' : 'unknown'
}

/** The last answered read's verdict per scenario, as `answeredCore` keeps it (savedModelIsCore.ts). */
const answeredProgram = new Map<string, boolean>()

/** The canonical coefficient behind one program link, in its natural units, as the read states it. */
export interface ProgramCoefficient {
  id: string
  label: string | null
  value: number | null
  low: number | null
  high: number | null
  unit: string | null
  /** The figure's author mark, from the quantity's own `author`: the brief's words, the person's, or Olumi's. */
  mark: ValueProvenanceKind | null
  /**
   * Whether the inspector offers a field for it. DL ruling (23 Oct): a coefficient the model works out (its node's
   * `value_basis` is worked_out) or that has no value is not the person's to type (as #2954 does for structure-fixed
   * figures); the link still says any figure it has.
   */
  editable: boolean
  /** Whether the read's effect relation adds it to a base (`defines = base + coefficient × driver`), so it is a change. */
  addedToBase?: boolean
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const markOf = (q: Rec): ValueProvenanceKind | null =>
  q.author === 'olumi' ? 'ai' : q.author === 'person' ? (typeof q.quote === 'string' && q.quote.length > 0 ? 'brief' : 'human') : null

/** The canonical quantity record with this id on a program graph, or null (not a program, or no such quantity). */
function canonicalQuantity(graph: unknown, id: string): Rec | null {
  if (!isProgramGraph(graph)) return null
  const canonical = rec(rec(rec(graph)?.living_model)?.canonical)
  const quantities = Array.isArray(canonical?.quantities) ? canonical.quantities : []
  return rec(quantities.find((x) => rec(x)?.id === id))
}

/**
 * One quantity of a program, as its canonical record states it: its figure and its range ends (null where it holds
 * none), whose it is (`person`, `olumi` or `structure`) and whether the person approved it.
 */
export interface ProgramQuantity {
  id: string
  value: number | null
  low: number | null
  high: number | null
  author: string | null
  approval: string | null
}

/** The canonical quantity behind a program card (a card's id is its quantity's id), or null off a program or for none. */
export function programQuantityOf(graph: unknown, id: string): ProgramQuantity | null {
  const q = canonicalQuantity(graph, id)
  const str = (v: unknown): string | null => (typeof v === 'string' ? v : null)
  return q ? { id, value: num(q.value), low: num(q.low), high: num(q.high), author: str(q.author), approval: str(q.approval) } : null
}

/**
 * One canonical item of a program (an option or a goal), as its record states it: whose it is (`person`, `olumi`), the
 * person's quote where the record keeps one, and whether the person approved it. Null off a program or for no such item.
 */
export interface ProgramItem {
  id: string
  author: string | null
  quote: string | null
  approval: string | null
}
export function programItemOf(graph: unknown, list: 'options' | 'goals', id: string): ProgramItem | null {
  if (!isProgramGraph(graph)) return null
  const canonical = rec(rec(rec(graph)?.living_model)?.canonical)
  const items = Array.isArray(canonical?.[list]) ? canonical[list] as unknown[] : []
  const item = rec(items.find((x) => rec(x)?.id === id))
  if (item === null) return null
  const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null)
  return { id, author: str(item.author), quote: str(item.quote), approval: str(item.approval) }
}

/** A reasoning record the program keeps beside its figures: an assumption, a claim, a disagreement or a condition. */
export type ProgramRecordKind = 'dissent' | 'assumption' | 'condition' | 'claim'
export interface ProgramReasoningRecord {
  kind: ProgramRecordKind
  id: string
  /** The record's own words: its text, else the person's quote (a disagreement's position, else its quote). */
  text: string
  /** `person` or `olumi`, as the record states it; null when it states neither. */
  author: string | null
  /** Who holds it, as the record names them (a disagreement's holder, a party); null when it names no one. */
  holder: string | null
  approved: boolean
  /** The model items it concerns, in the record's order. */
  concerns: string[]
}
const RECORD_FIELDS: ReadonlyArray<readonly [ProgramRecordKind, string]> = [
  ['dissent', 'dissent'], ['assumption', 'assumptions'], ['condition', 'conditions'], ['claim', 'claims'],
]
/**
 * The program's reasoning records (canonical `dissent`, `assumptions`, `conditions`, `claims`), in that order and each list
 * in the record's own order, with the words, author, holder and approval each record states. Empty off a program.
 */
export function programReasoningRecords(graph: unknown): ProgramReasoningRecord[] {
  if (!isProgramGraph(graph)) return []
  const canonical = rec(rec(rec(graph)?.living_model)?.canonical)
  const words = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null)
  return RECORD_FIELDS.flatMap(([kind, field]) => (Array.isArray(canonical?.[field]) ? canonical[field] as unknown[] : []).flatMap((x) => {
    const r = rec(x)
    const id = words(r?.id)
    const text = kind === 'dissent' ? words(r?.position) ?? words(r?.quote) : words(r?.text) ?? words(r?.quote)
    if (r === null || id === null || text === null) return []
    return [{
      kind, id, text,
      author: r.author === 'person' || r.author === 'olumi' ? r.author : null,
      holder: words(r.holder) ?? words(r.party),
      approved: r.approval === 'approved',
      concerns: Array.isArray(r.concerns) ? r.concerns.filter((c): c is string => typeof c === 'string') : [],
    }]
  }))
}

/**
 * The program's limits that the projection does not list as goal constraints, as limit rows with no figure. CEE lists a
 * limit in `goal_constraints` only when its bound is one stated figure; it draws any other as a "Limit: …" text card
 * ("its figure is not given yet"). Each row keeps the canonical record's label, what it measures and the person's words
 * (CEE's own rule for the listed rows); its figure is not a number. Empty off a program.
 */
export function programLimitsWithoutFigure(
  graph: unknown,
  listed: readonly Pick<CEEGoalConstraint, 'constraint_id'>[] | null | undefined,
): CEEGoalConstraint[] {
  if (!isProgramGraph(graph)) return []
  const canonical = rec(rec(rec(graph)?.living_model)?.canonical)
  const limits = Array.isArray(canonical?.limits) ? canonical.limits : []
  const shown = new Set((listed ?? []).map((c) => c.constraint_id))
  return limits.flatMap((x) => {
    const l = rec(x)
    const id = typeof l?.id === 'string' ? l.id : null
    if (l === null || id === null || shown.has(id)) return []
    const measure = rec(l.measure)
    const quote = l.author === 'person' && typeof l.quote === 'string' && l.quote.length > 0 ? l.quote.slice(0, 200) : null
    return [{
      constraint_id: id,
      ...(typeof l.label === 'string' ? { label: l.label } : {}),
      ...(typeof measure?.quantity === 'string' ? { node_id: measure.quantity } : {}),
      operator: typeof measure?.cmp === 'string' && measure.cmp.startsWith('>') ? '>=' : '<=',
      value: Number.NaN,
      ...(quote === null ? {} : { source_quote: quote }),
      provenance: l.author === 'olumi' ? 'inferred' : 'explicit',
    }]
  })
}

/** The coefficient a program link names, or null when the link names none (or names one the read does not hold). */
export function programCoefficientOf(graph: unknown, edgeId: string): ProgramCoefficient | null {
  if (!isProgramGraph(graph)) return null
  const g = rec(graph)
  const edges = Array.isArray(g?.edges) ? g.edges : []
  const coefficientId = rec(edges.find((e) => rec(e)?.id === edgeId))?.coefficient_id
  if (typeof coefficientId !== 'string' || coefficientId.length === 0) return null
  const q = canonicalQuantity(graph, coefficientId)
  if (!q) return null
  const nodes = Array.isArray(g?.nodes) ? g.nodes : []
  const workedOut = rec(rec(nodes.find((n) => rec(n)?.id === coefficientId))?.value_basis)?.kind === 'worked_out'
  return {
    id: coefficientId,
    label: typeof q.label === 'string' ? q.label : null,
    value: num(q.value),
    low: num(q.low),
    high: num(q.high),
    unit: typeof q.unit === 'string' && q.unit.length > 0 ? q.unit : null,
    mark: markOf(q),
    editable: num(q.value) !== null && !workedOut,
    addedToBase: relationsOf(graph).some((r) => r.form === 'effect' && typeof r.base === 'string'
      && Array.isArray(r.terms) && r.terms.some((t) => rec(t)?.coefficient === coefficientId)),
  }
}

/**
 * The link's words at rest: "+20 ticket/week/specialist", or with a range "+20 (10–30) ticket/week/specialist".
 * The read's own numbers through the house formatter; null when the read gives no value.
 */
export function programFigureWords(c: ProgramCoefficient): string | null {
  if (c.value === null) return null
  // A positive dimensionless coefficient (unit "1") is a multiplier: "about ×1.15 (0.5–2)" (DL, 23 Oct) — unless the read's
  // effect relation adds it to a base (`defines = base + coefficient × driver`): then it is a change of that size. It
  // read "about ×0.5" for a +0.5 "proportional pace change" on Paul's board (27 Oct). Every other unit keeps the signed
  // form, in the unit's reading words ("+0.15 per tech lead").
  const multiplier = (c.unit ?? '').trim() === '1' && c.value > 0 && c.addedToBase !== true
  const signed = multiplier ? `×${formatNumber(c.value)}` : `${c.value > 0 ? '+' : ''}${formatNumber(c.value)}`
  const range = c.low !== null && c.high !== null ? ` (${formatNumber(c.low)}–${formatNumber(c.high)})` : ''
  const words = unitWords(c.unit)
  const unit = words ? ` ${words}` : ''
  // Vision spec §2b hover chip "+ 0.6": the range and the author mark say it is uncertain; no "about" (static text).
  return `${signed}${range}${unit}`
}

/** The glyph a definition draws on its link: how the part enters the figure it works out. */
export type ProgramLinkOperator = '+' | '−' | '×' | '÷'
export const PROGRAM_OPERATOR_WORDS: Readonly<Record<ProgramLinkOperator, string>> = { '+': 'added', '−': 'subtracted', '×': 'multiplied by', '÷': 'divided by' }

const relationsOf = (graph: unknown): Rec[] => {
  if (!isProgramGraph(graph)) return []
  const relations = rec(rec(rec(graph)?.living_model)?.canonical)?.relations
  return Array.isArray(relations) ? relations.map(rec).filter((r): r is Rec => r !== null) : []
}

/**
 * How the link from `from` enters the figure `to` works out, read from the canonical relation that defines `to`
 * (decision 8 A, Paul 26 Oct: definition links carry + − × ÷). A sum part is + or − by its sign, a product part × or ÷
 * by its power, a stock's start and inflows +, its outflows −, an effect's base +. Null for an effect's driver (its
 * size is its coefficient, said by the link's figure) and off a program.
 */
export function programLinkOperator(graph: unknown, from: string, to: string): ProgramLinkOperator | null {
  // CEE #3859: a risk's link says how its severity applies (`effect_mode`); a multiplying risk draws ×.
  if (programEdgeOf(graph, from, to)?.effect_mode === 'multiply') return '×'
  for (const r of relationsOf(graph)) {
    if (r.defines !== to) continue
    const parts = Array.isArray(r.parts) ? r.parts.map(rec) : []
    const part = parts.find((p) => p?.id === from)
    if (r.form === 'definition' && part) {
      if (r.op === 'sum') return part.sign === -1 ? '−' : '+'
      if (r.op === 'product') return part.power === -1 ? '÷' : '×'
    }
    if (r.form === 'stock') {
      if (r.start === from || (Array.isArray(r.inflows) && r.inflows.includes(from))) return '+'
      if (Array.isArray(r.outflows) && r.outflows.includes(from)) return '−'
    }
    if (r.form === 'effect' && r.base === from) return '+'
  }
  return null
}

/** The saved program edge from → to, or null off a program or for none. */
function programEdgeOf(graph: unknown, from: string, to: string): Rec | null {
  if (!isProgramGraph(graph)) return null
  const edges = rec(graph)?.edges
  return Array.isArray(edges) ? rec(edges.find((e) => { const x = rec(e); return (x?.from ?? x?.source) === from && (x?.to ?? x?.target) === to })) : null
}

/**
 * CEE #3859: the link's range crosses zero, so which way it pushes is not settled (`direction_settled: false`). The sign
 * CEE draws is its median's; the canvas says it is unsettled (vision §2b: "?" when the direction is not set).
 */
export function programLinkDirectionUnsettled(graph: unknown, from: string, to: string): boolean {
  return programEdgeOf(graph, from, to)?.direction_settled === false
}

export function useProgramLinkDirectionUnsettled(from: string, to: string): boolean {
  const graph = useSavedGraph()
  return useMemo(() => programLinkDirectionUnsettled(graph, from, to), [graph, from, to])
}

export function useProgramLinkOperator(from: string, to: string): ProgramLinkOperator | null {
  const graph = useSavedGraph()
  return useMemo(() => programLinkOperator(graph, from, to), [graph, from, to])
}

/**
 * How a worked-out figure is worked out, in its parts' labels ("Current team delivery pace × Delivery pace relative to
 * the current approach"), read from the canonical relation that defines it. Null when no relation defines it.
 */
export function programFormulaWords(graph: unknown, id: string): string | null {
  const r = relationsOf(graph).find((x) => x.defines === id)
  if (!r) return null
  const quantities = rec(rec(rec(graph)?.living_model)?.canonical)?.quantities
  const labelOf = (qid: unknown): string => {
    const q = Array.isArray(quantities) ? rec(quantities.find((x) => rec(x)?.id === qid)) : null
    return typeof q?.label === 'string' ? q.label : String(qid)
  }
  // A sum or product does not depend on its parts' order: the kept parts (+, ×) lead, so a ratio reads "A ÷ B", and a
  // relation with none reads from 0 or 1 ("− A", "1 ÷ B").
  const join = (items: Array<[ProgramLinkOperator, unknown]>): string => {
    const kept = items.filter(([op]) => op === '+' || op === '×')
    const ordered = [...kept, ...items.filter(([op]) => op === '−' || op === '÷')]
    return ordered.map(([op, qid], i) => i === 0 && kept.length > 0 ? labelOf(qid)
      : i === 0 && op === '÷' ? `1 ÷ ${labelOf(qid)}` : `${op} ${labelOf(qid)}`).join(' ')
  }
  const parts = Array.isArray(r.parts) ? r.parts.map(rec).filter((p): p is Rec => p !== null) : []
  if (r.form === 'definition' && r.op === 'sum') return join(parts.map((p) => [p.sign === -1 ? '−' : '+', p.id]))
  if (r.form === 'definition' && r.op === 'product') return join(parts.map((p) => [p.power === -1 ? '÷' : '×', p.id]))
  if (r.form === 'stock') {
    // `start` is the level at period 0; each later period carries the last level forward, plus inflows, less outflows.
    const flows: Array<[ProgramLinkOperator, unknown]> = [
      ...(Array.isArray(r.inflows) ? r.inflows.map((f): [ProgramLinkOperator, unknown] => ['+', f]) : []),
      ...(Array.isArray(r.outflows) ? r.outflows.map((f): [ProgramLinkOperator, unknown] => ['−', f]) : []),
    ]
    const change = flows.map(([op, qid]) => `${op} ${labelOf(qid)}`).join(' ')
    return `Starts at ${labelOf(r.start)}; each period, the last level ${change}`
  }
  if (r.form === 'effect') {
    const terms = Array.isArray(r.terms) ? r.terms.map(rec).filter((t): t is Rec => t !== null) : []
    return [labelOf(r.base), ...terms.map((t) => `+ ${labelOf(t.coefficient)} × ${labelOf(t.driver)}`)].join(' ')
  }
  return null
}

/** The program figure for one link on the saved model on screen, or null (not a program, or no coefficient). */
export function useProgramLinkFigure(edgeId: string): (ProgramCoefficient & { words: string }) | null {
  const graph = useSavedGraph()
  return useMemo(() => {
    const c = programCoefficientOf(graph, edgeId)
    const words = c ? programFigureWords(c) : null
    return c && words ? { ...c, words } : null
  }, [graph, edgeId])
}
