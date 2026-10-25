/**
 * Whether the saved model is an executable model (a program graph), read from the field CEE sets on it:
 * `graph.living_model.model_program`. Never guessed from shapes. A program's analysis is run by the host on every
 * change, and its effect links carry a `coefficient_id` naming the canonical quantity behind them.
 * Only the version this UI knows ("v1") counts: an unknown version keeps today's controls (Codex r1 on #2950).
 */
import { useMemo } from 'react'

import { useSavedGraph, useSavedGraphRead } from './savedGraph'
import { formatNumber } from '../../utils/formatValueWithUnit'
import { unitWords } from '../../../utils/unitClassifier'
import type { ValueProvenanceKind } from '../../domain/valueProvenance'

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
 */
export function useSavedModelProgramState(): 'program' | 'not_program' | 'unknown' {
  const read = useSavedGraphRead()
  if (read.status === 'none') return 'not_program'
  if (read.status === 'read') return isProgramGraph(read.graph) ? 'program' : 'not_program'
  return 'unknown'
}

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
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const markOf = (q: Rec): ValueProvenanceKind | null =>
  q.author === 'olumi' ? 'ai' : q.author === 'person' ? (typeof q.quote === 'string' && q.quote.length > 0 ? 'brief' : 'human') : null

/** The coefficient a program link names, or null when the link names none (or names one the read does not hold). */
export function programCoefficientOf(graph: unknown, edgeId: string): ProgramCoefficient | null {
  if (!isProgramGraph(graph)) return null
  const g = rec(graph)
  const edges = Array.isArray(g?.edges) ? g.edges : []
  const coefficientId = rec(edges.find((e) => rec(e)?.id === edgeId))?.coefficient_id
  if (typeof coefficientId !== 'string' || coefficientId.length === 0) return null
  const canonical = rec(rec(g?.living_model)?.canonical)
  const quantities = Array.isArray(canonical?.quantities) ? canonical.quantities : []
  const q = rec(quantities.find((x) => rec(x)?.id === coefficientId))
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
  }
}

/**
 * The link's words at rest: "+20 ticket/week/specialist", or with a range "about +20 (10–30) ticket/week/specialist".
 * The read's own numbers through the house formatter; null when the read gives no value.
 */
export function programFigureWords(c: ProgramCoefficient): string | null {
  if (c.value === null) return null
  // A positive dimensionless coefficient (unit "1") is a multiplier: "about ×1.15 (0.5–2)" (DL, 23 Oct). Every other
  // unit keeps the signed form, in the unit's reading words ("+0.15 per tech lead").
  const multiplier = (c.unit ?? '').trim() === '1' && c.value > 0
  const signed = multiplier ? `×${formatNumber(c.value)}` : `${c.value > 0 ? '+' : ''}${formatNumber(c.value)}`
  const range = c.low !== null && c.high !== null ? ` (${formatNumber(c.low)}–${formatNumber(c.high)})` : ''
  const words = unitWords(c.unit)
  const unit = words ? ` ${words}` : ''
  return range ? `about ${signed}${range}${unit}` : `${signed}${unit}`
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
