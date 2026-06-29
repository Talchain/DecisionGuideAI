/**
 * Coaching panel — UI-authored copy + display lookups.
 *
 * Everything here is sentence case, British English, no all-caps, no em dashes,
 * and free of the forbidden glossary terms (node, edge, graph, coefficient,
 * weight, EVPI, winner, recommended). The copyHygiene test enforces this over
 * THIS object only — model-supplied strings are rendered verbatim and are never
 * scanned or rewritten by the UI (F.6 / UX amendment 3).
 */
import type { NodeType } from '@/canvas/domain/nodes'

/** Rows shown before the "show all / fewer" reveal. Display chunking, not selection. */
export const COACHING_DEFAULT_VISIBLE = 3

export const COACHING_COPY = {
  /** Region accessible name. */
  panelAria: 'Coaching',
  /** Shown when there are no signals (absence of data, not a computed judgement). */
  emptyState: 'No coaching to show yet.',
  /** Reveal-toggle copy. `showMore` is reserved for a future paged variant. */
  showMore: (n: number) => `Show ${n} more`,
  showAll: (n: number) => `Show all ${n}`,
  showFewer: 'Show fewer',
  /** Icon-only, display-only affordance label. */
  askOlumi: 'Ask Olumi',
  /**
   * Generic accessible name for a row whose observation is empty — an
   * operability affordance, not an invented title (it asserts no meaning).
   */
  itemFallback: 'Coaching item',
  /** Panel-level stale banner. Fixture-only until CEE provides a staleness signal. */
  staleBanner: 'This coaching may be out of date.',
} as const

/**
 * Known entity kinds (mirrors the canvas `NodeType` set). Used only to decide
 * whether to render the entity shape; unknown values fall through to neutral.
 */
export const KNOWN_ENTITY_KINDS: readonly NodeType[] = [
  'goal',
  'decision',
  'option',
  'factor',
  'risk',
  'outcome',
  'action',
  'constraint',
]

/**
 * target_kind → secondary entity colour token for the label text. Static display
 * lookup ONLY — colour is keyed to entity kind, never inferred from observation
 * text or sentiment (F.6). Shape is the primary cue; this is secondary support.
 * Kinds not listed render in neutral body text.
 */
export const ENTITY_COLOUR: Record<string, string> = {
  goal: 'text-goal',
  option: 'text-option',
  factor: 'text-factor',
  risk: 'text-danger',
  outcome: 'text-success',
  decision: 'text-info',
}
