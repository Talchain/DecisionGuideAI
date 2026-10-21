import { createContext, useCallback, useContext, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Tooltip from '../../../components/Tooltip'
import { NODE_TOOLTIP_DELAY_MS } from './nodeTooltip'
import { cardMark } from './cardMarks'
import { PROVENANCE_ICON_SIZE_CLASSES } from '../../domain/valueProvenanceIcon'

/**
 * ⭐ ONE OLUMI SPARKLE PER CARD (Paul, 14 Oct 2026).
 *
 * Measured on the local build, example scenario, option "O3 Split Sprint Capacity": the card's bottom band showed
 * THREE identical sparkles — the node-authorship mark ("Olumi suggested this") and one `est.` mark per change row,
 * each portalled into the band away from its row. Three copies of one glyph say "Olumi" three times and say nothing
 * about which is which.
 *
 * The decision: ONE sparkle per card, whose hover/accessible name lists what Olumi did on that card —
 * "Olumi suggested this option · 2 target values are Olumi estimates". A card with a single Olumi sparkle keeps it
 * exactly as before (same words, testid and route); only where a card would otherwise paint two or more do they
 * collapse into one. Nothing is classified here: each participant passes the claim its own owner already resolved
 * (`NodeProvenanceMark` for authorship, `ValueSourceMark` for a value's source). Every other mark — "From your brief",
 * "you", "no source" — is untouched and keeps its own glyph. The inspector and Detailed lists keep full detail.
 */
export interface OlumiMarkEntry {
  role: 'authorship' | 'estimate'
  /** Authorship: the clause as it reads inside the merged name. Estimate: the singular noun ("target value"). */
  text: string
  /** An Olumi figure the user accepted — still Olumi's number, said as such. */
  accepted?: boolean
  /** The mark's route to its source detail (the inspector), if it had one. */
  onOpen?: () => void
}
type RegisteredEntry = OlumiMarkEntry & { id: string }

interface OlumiMarkGroupValue {
  entries: readonly RegisteredEntry[]
  register: (entry: RegisteredEntry) => () => void
}
const OlumiMarkGroupContext = createContext<OlumiMarkGroupValue | null>(null)

/** Scoped to one card (mounted beside `BottomMarksProvider`). */
export function OlumiMarkGroupProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<readonly RegisteredEntry[]>([])
  const register = useCallback((entry: RegisteredEntry) => {
    setEntries(prev => {
      const at = prev.findIndex(e => e.id === entry.id)
      if (at === -1) return [...prev, entry]
      const old = prev[at]
      if (old.role === entry.role && old.text === entry.text && old.accepted === entry.accepted && old.onOpen === entry.onOpen) return prev
      const next = prev.slice()
      next[at] = entry
      return next
    })
    return () => setEntries(prev => prev.filter(e => e.id !== entry.id))
  }, [])
  const value = useMemo(() => ({ entries, register }), [entries, register])
  return <OlumiMarkGroupContext.Provider value={value}>{children}</OlumiMarkGroupContext.Provider>
}

/** "2 target values are Olumi estimates" / "1 target value is an Olumi estimate you accepted". */
function estimateClause(noun: string, count: number, accepted: boolean): string {
  const base = count === 1 ? `1 ${noun} is Olumi's estimate` : `${count} ${noun}s are Olumi's estimates`
  return accepted ? `${base} you accepted` : base
}

/** The merged mark's name: authorship first (the question a reader asks first), then each estimate group, counted. */
export function olumiMergedLabel(entries: readonly OlumiMarkEntry[]): string {
  const clauses: string[] = []
  const authorship = entries.find(e => e.role === 'authorship')
  if (authorship) clauses.push(authorship.text)
  const groups = new Map<string, { noun: string; accepted: boolean; count: number }>()
  for (const e of entries) {
    if (e.role !== 'estimate') continue
    const key = `${e.text}\u0000${e.accepted ? 1 : 0}`
    const g = groups.get(key)
    if (g) g.count += 1
    else groups.set(key, { noun: e.text, accepted: Boolean(e.accepted), count: 1 })
  }
  for (const g of groups.values()) clauses.push(estimateClause(g.noun, g.count, g.accepted))
  return clauses.join(' · ')
}

export type OlumiMarkSlot =
  | { render: 'self' }
  | { render: 'none' }
  | { render: 'merged'; label: string; estimateCount: number; onOpen?: () => void }

/**
 * Join this card's Olumi group. `entry: null` = this mark is not an Olumi sparkle (renders itself).
 * With fewer than two sparkles on the card every participant renders itself, unchanged; with two or more, the
 * authorship mark (or, with none, the first estimate) renders the ONE merged mark and the others render nothing.
 */
export function useOlumiMarkSlot(entry: OlumiMarkEntry | null): OlumiMarkSlot {
  const group = useContext(OlumiMarkGroupContext)
  const id = useId()
  const openRef = useRef(entry?.onOpen)
  openRef.current = entry?.onOpen
  const hasOpen = entry?.onOpen !== undefined
  const stableOpen = useMemo(() => (hasOpen ? () => openRef.current?.() : undefined), [hasOpen])
  const register = group?.register
  const role = entry?.role
  const text = entry?.text
  const accepted = entry?.accepted
  useLayoutEffect(() => {
    if (!register || role === undefined || text === undefined) return
    return register({ id, role, text, accepted, onOpen: stableOpen })
  }, [register, id, role, text, accepted, stableOpen])

  if (!group || !entry) return { render: 'self' }
  const entries = group.entries
  if (entries.length < 2 || !entries.some(e => e.id === id)) return { render: 'self' }
  const leader = entries.find(e => e.role === 'authorship') ?? entries[0]
  if (leader.id !== id) return { render: 'none' }
  const onOpen = entries.find(e => e.role === 'estimate' && e.onOpen)?.onOpen
  return {
    render: 'merged',
    label: olumiMergedLabel(entries),
    estimateCount: entries.filter(e => e.role === 'estimate').length,
    onOpen,
  }
}

/**
 * The one sparkle. Same glyph, size and colour as the authorship mark it replaces; a real button when any merged
 * estimate carried a route to its source detail (contract v3.1 pt 1: every mark opens it), else a named image.
 */
export function OlumiMergedMark({
  label,
  estimateCount,
  onOpen,
  provenance,
}: {
  label: string
  estimateCount: number
  onOpen?: () => void
  /** Present when the authorship mark leads: keeps its identity attributes for every reader that binds to them. */
  provenance?: { kind: string; claim: string }
}) {
  const definition = cardMark('source-olumi')
  const Icon = definition.Icon
  const attrs = {
    'data-testid': provenance ? 'node-provenance-mark' : 'node-olumi-mark',
    'data-node-tooltip': 'true',
    'data-card-mark': definition.id,
    'data-olumi-mark': 'merged',
    'data-olumi-estimates': String(estimateCount),
    'data-provenance-kind': provenance?.kind,
    'data-provenance-claim': provenance?.claim,
    'aria-label': label,
  }
  const classes = 'inline-flex shrink-0 items-center rounded-sm text-text-light cursor-help hover:text-info focus-visible:text-info focus:outline-none focus-visible:ring-2 focus-visible:ring-info'
  const glyph = <Icon aria-hidden="true" className={PROVENANCE_ICON_SIZE_CLASSES} />
  return (
    <Tooltip asChild content={label} delay={NODE_TOOLTIP_DELAY_MS}>
      {onOpen ? (
        <button
          type="button"
          {...attrs}
          data-source-mark="true"
          className={`nodrag nopan border-0 bg-transparent p-0 ${classes}`}
          onClick={(e) => { e.stopPropagation(); onOpen() }}
          onPointerDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          {glyph}
        </button>
      ) : (
        <span {...attrs} role="img" tabIndex={0} className={classes}>{glyph}</span>
      )}
    </Tooltip>
  )
}
