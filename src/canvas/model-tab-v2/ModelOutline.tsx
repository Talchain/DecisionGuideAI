/**
 * Model tab v2 — THE OUTLINE. Two tiers, seven groups, one scroll (design §4.3).
 *
 * MOUNTED since the 16 Aug 2026 mount train, via `ModelTabV2Panel` (hosted by
 * `ModelTabBody`). The boundary guard pins the mount path.
 *
 * ⚠ THE LOAD-BEARING PROPERTY: THE TIER IS A CONTENT SWITCH, NEVER A LAYOUT
 * SWITCH. Today's `expertMode` drives BOTH the scientific detail AND the
 * accordion mode — `ModelTabBody.tsx:116-122` returns `{}` when expert (making
 * the accordion multi-open) and a controlled single-open object otherwise, while
 * `:761` feeds the same flag to `DetailToggleContext`. So a non-scientist who
 * merely wants two groups open at once has to switch on the scientist view, and
 * a scientist who wants parameters silently gets a different layout. That is
 * design §2 F1, and it is the reason the advanced toggle "overwhelms
 * non-scientists": it is two controls wearing one switch.
 *
 * Here the tier governs CONTENT ONLY. `outlineLayout()` below is a pure function
 * of (rows, filter, openGroups) and takes NO tier argument — the separation is
 * structural, not a promise in a comment, so a future edit that made layout
 * depend on the tier would have to change the function's signature to do it.
 *
 * MULTI-OPEN ALWAYS, IN BOTH TIERS, INDEPENDENTLY REMEMBERED. Opening Options
 * never closes Factors (design §2 F2). All seven groups are always PRESENT: a
 * filter that empties a group says so in words rather than removing the heading,
 * so the user never has to wonder whether a group disappeared or never existed.
 */

import { useCallback, useMemo, useState } from 'react'
import { typography } from '../../styles/typography'
import { ModelRowView } from './ModelRowView'
import { GROUP_TITLE } from './rowPresentation'
import {
  MODEL_GROUP_IDS,
  type DetailTier,
  type EditCommitState,
  type ModelGroupId,
  type ModelRow,
} from './types'

export interface ModelOutlineProps {
  /**
   * The projection. RENDERED IN THE ORDER GIVEN — the outline never sorts. Order
   * is the producer's business; re-sorting here would silently disagree with the
   * order every other surface shows.
   */
  rows: readonly ModelRow[]
  tier: DetailTier
  /** The working filter (design §7.2 KEEP+FIX — today's search box filters nothing, F3). */
  filter?: string
  selectedId?: string | null
  onSelect?: (id: string) => void
  onFocusOnCanvas?: (id: string) => void
  /** Groups closed at first render. Everything else is open (multi-open always). */
  initiallyClosedGroups?: readonly ModelGroupId[]
  /**
   * The host's edit state per row, keyed by row id. Absent entries render idle.
   * There is deliberately no default map literal here — an absent prop means
   * "no live editing on this outline", exactly as before the mount.
   */
  commitByRowId?: ReadonlyMap<string, EditCommitState>
  /**
   * Rows whose edit class has a CANONICAL transaction behind it. When provided,
   * only these rows get a live editor affordance; everything else renders the
   * honest disabled control. When absent, presence-of-`onBeginEdit` semantics
   * are unchanged (back-compatible with render-only callers).
   */
  editConnectedIds?: ReadonlySet<string>
  onBeginEdit?: (id: string) => void
  onDraftChange?: (id: string, draft: string) => void
  onProposeEdit?: (id: string) => void
  onDiscardEdit?: (id: string) => void
  onConfirmEdit?: (id: string) => void
}

/**
 * The layout decision, isolated as a PURE function — and deliberately WITHOUT a
 * tier parameter, so "the tier cannot change the layout" is enforced by the type
 * system rather than asserted in prose.
 *
 * A row whose `group` is not one of the seven is DROPPED and reported, never
 * silently rendered into an arbitrary group.
 */
export function outlineLayout(
  rows: readonly ModelRow[],
  filter: string,
  openGroups: ReadonlySet<ModelGroupId>,
): {
  groups: readonly { id: ModelGroupId; open: boolean; rows: readonly ModelRow[] }[]
  unknownGroupRowIds: readonly string[]
} {
  const needle = filter.trim().toLowerCase()
  const known = new Set<string>(MODEL_GROUP_IDS)
  const unknownGroupRowIds = rows.filter(r => !known.has(r.group)).map(r => r.id)

  const matches = (r: ModelRow) =>
    needle === '' || r.label.toLowerCase().includes(needle)

  return {
    groups: MODEL_GROUP_IDS.map(id => ({
      id,
      open: openGroups.has(id),
      // `filter` preserves the caller's order by construction.
      rows: rows.filter(r => r.group === id && matches(r)),
    })),
    unknownGroupRowIds,
  }
}

export function ModelOutline({
  rows,
  tier,
  filter = '',
  selectedId = null,
  onSelect,
  onFocusOnCanvas,
  initiallyClosedGroups,
  commitByRowId,
  editConnectedIds,
  onBeginEdit,
  onDraftChange,
  onProposeEdit,
  onDiscardEdit,
  onConfirmEdit,
}: ModelOutlineProps) {
  const [closed, setClosed] = useState<ReadonlySet<ModelGroupId>>(
    () => new Set(initiallyClosedGroups ?? []),
  )

  const openGroups = useMemo(
    () => new Set(MODEL_GROUP_IDS.filter(id => !closed.has(id))),
    [closed],
  )

  /** Toggling one group NEVER touches another — design §2 F2. */
  const toggle = useCallback((id: ModelGroupId) => {
    setClosed(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const { groups } = outlineLayout(rows, filter, openGroups)

  return (
    <div data-testid="model-outline-v2" data-tier={tier} className="flex flex-col">
      {groups.map(group => (
        <section
          key={group.id}
          data-testid={`model-group-v2-${group.id}`}
          data-open={group.open}
        >
          <button
            type="button"
            data-testid={`model-group-v2-${group.id}-toggle`}
            aria-expanded={group.open}
            onClick={() => toggle(group.id)}
            className={`${typography.label} text-text-header w-full text-left px-2 py-1.5`}
          >
            {group.open ? '▾' : '▸'} {GROUP_TITLE[group.id]}
            <span className={`${typography.caption} text-text-light ml-2`}>
              {group.rows.length}
            </span>
          </button>

          {group.open &&
            (group.rows.length === 0 ? (
              <p
                data-testid={`model-group-v2-${group.id}-empty`}
                className={`${typography.caption} text-text-light px-4 py-1`}
              >
                {filter.trim() === ''
                  ? 'Nothing in this group yet'
                  : 'No matches in this group'}
              </p>
            ) : (
              <ul role="listbox" aria-label={GROUP_TITLE[group.id]}>
                {group.rows.map(row => (
                  <ModelRowView
                    key={row.id}
                    row={row}
                    tier={tier}
                    selected={row.id === selectedId}
                    commit={commitByRowId?.get(row.id)}
                    editConnected={
                      editConnectedIds === undefined ? true : editConnectedIds.has(row.id)
                    }
                    onSelect={onSelect}
                    onFocusOnCanvas={onFocusOnCanvas}
                    onBeginEdit={onBeginEdit}
                    onDraftChange={onDraftChange}
                    onProposeEdit={onProposeEdit}
                    onDiscardEdit={onDiscardEdit}
                    onConfirmEdit={onConfirmEdit}
                  />
                ))}
              </ul>
            ))}
        </section>
      ))}
    </div>
  )
}
