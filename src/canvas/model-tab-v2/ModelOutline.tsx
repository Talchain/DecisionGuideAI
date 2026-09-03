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
import { classifyValueProvenance } from '../domain/valueProvenance'
import { typography } from '../../styles/typography'
import { ModelRowView } from './ModelRowView'
import { ModelGroupActions } from './ModelGroupActions'
import { GROUP_ACTIONS, type GroupAction, type GroupActionContext } from './groupActions'
import {
  discussActionFor,
  rowsThisSectionCannotResolve,
  sectionWriterNoticeText,
  SECTION_WRITER_NOTICE_TESTID,
} from './sectionWriterNotice'
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
  /** Ratify an AI estimate as correct — passed straight through to the row. */
  onConfirmValueAsIs?: (id: string) => void
  /**
   * The group-level affordances rehomed from the v1 stack (add a factor, add a
   * relationship, explore other strategies, identify risks, discuss each group).
   *
   * ⚠ ABSENT MEANS THE BUTTONS DO NOT RENDER, not that they render inert. There
   * is deliberately no default: the v1 sections guarded every send-to-AI control
   * behind `{onSendMessage && …}`, and dropping that guard would put an
   * undeliverable affordance on screen (preamble P8).
   */
  onGroupAction?: (action: GroupAction, message: string) => void
  /**
   * What a group action's message may interpolate. Sourced from the rows this
   * outline is rendering, so a quoted target is the one the user can see.
   */
  groupActionContext?: GroupActionContext
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

/**
 * One sentence for a section that DISPLAYS a blocker it cannot clear.
 *
 * ⚠ SILENT BY DEFAULT, on the same reasoning as the unknown summary above: a
 * notice that always renders is chrome, and chrome states nothing about the
 * data. This appears only where there is genuinely a blocked row with no
 * writer, and RETIRES ITSELF the moment one is connected — the predicate reads
 * the same `editConnectedIds` the row's value cell reads, so the notice cannot
 * outlive its cause or disagree with the control beside it.
 */
function SectionWriterNotice({
  group,
  rows,
  editConnectedIds,
  actionsWillRender,
}: {
  group: ModelGroupId
  rows: readonly ModelRow[]
  editConnectedIds?: ReadonlySet<string>
  /**
   * ⚠ WHETHER THE ACTION ROW ACTUALLY RENDERS — not whether an action is
   * DEFINED. `ModelGroupActions` returns `null` when it has no `onAction`, so a
   * host that omits the handler shows no buttons at all. Without this the
   * notice would say *Use "Discuss the options with Olumi" below* with no such
   * control below it — naming a control the user cannot find, which is exactly
   * the circularity this notice exists to avoid, merely relocated.
   *
   * Found by a FIXTURE GAP, not by inspection: the first version of the spec
   * omitted `onGroupAction`, the button did not render, and the assertion that
   * the notice quotes the BUTTON's own text failed. The test was right.
   */
  actionsWillRender: boolean
}) {
  const blocked = rowsThisSectionCannotResolve(rows, editConnectedIds)
  const discuss = discussActionFor(GROUP_ACTIONS[group])
  // No blocked row, no affordance defined, or no affordance on screen: say
  // nothing. A notice pointing at an absent control is worse than silence.
  if (blocked.length === 0 || discuss === null || !actionsWillRender) return null
  return (
    <p
      data-testid={SECTION_WRITER_NOTICE_TESTID(group)}
      className={`${typography.panelBody} text-text-light px-4 py-1`}
    >
      {sectionWriterNoticeText(blocked.length, discuss.label)}
    </p>
  )
}

/**
 * ⭐ THE COUNT WAS RIGHT AND THE SENTENCE NAMED THE OTHER AXIS.
 *
 * The COUNT is `primaryValue === null`, i.e. `getPrimaryValue`, i.e.
 * **`raw_value` is undefined** — "nobody has SUPPLIED a number". That is a
 * useful, honest count and it is unchanged here.
 *
 * The sentence it carried — *"N of M have no value yet"* — is the OTHER
 * question, and it was false. Measured on a live signed-in journey
 * (`20260826T082826Z-fresh-extended-17c4a0`, quartet UI `d0e24ccc` /
 * CEE `c24bfe3`), the persisted graph held:
 *
 *   Sales Rep Adoption Rate   value 0.6   raw_value —      display "High (0.6)"
 *   CRM Feature Fit           value —     raw_value —      display "0.25 to 0.75"
 *
 * Both counted as "have no value yet". The first HAS a value — Olumi estimated
 * it — and the product had already computed the words for it. Four inches away
 * the context pack said "one factor has no value", because CEE's `has_value`
 * reads `value`. Neither surface was lying; together they were incoherent, and
 * that incoherence sent an expert lane chasing a regression that did not exist.
 *
 * ⚠ THE TWO PREDICATES ARE DELIBERATELY SEPARATE AND STAY SEPARATE.
 * `valueProvenance.ts:389` says so in as many words — *"NOT THE SAME QUESTION AS
 * `no-value` (trap 21) … named apart on purpose rather than aligned."* This is
 * not a call to align them. It is the copy finally naming the one it counts,
 * and reading the OTHER from the predicate that already exists rather than
 * re-deriving half of it — the exact correction `ModelRowView`'s confirm chip
 * received when it read `primaryValue !== null` to answer a `value` question.
 *
 * `null` renders nothing: a group where every row is set states nothing rather
 * than announcing a zero.
 */
function unsetSummary(rows: readonly ModelRow[]): string | null {
  // `primaryValue === null` is the projection's OWN definition of "nothing is
  // stated" (`types.ts`: *"`null` means nothing is stated — which is a fact to
  // render, never a zero to invent"*). Reading that same field is what keeps
  // this heading and the value cells from drifting apart — the reason the count
  // itself is untouched.
  const unset = rows.filter(r => r.primaryValue === null)
  if (unset.length === 0) return null

  // Read from the SHARED predicate (`factorIsConfirmable`, surfaced as this
  // attention reason) — never a second local answer to "has Olumi estimated
  // this?", which is how the confirm chip went wrong.

  // ⛔⛔ NO UMBRELLA CLAIM — THE FOURTH ATTEMPT, AND THE FIRST THAT IS NOT AN
  // ADJECTIVE. Three previous heads each characterised the whole `unset`
  // population, and each was FALSE for a class the corpus behind it excluded:
  //
  //   "have no value yet"        FALSE for a band  (cell shows "Olumi: 0.25 to 0.75")
  //   "not set by your team"     FALSE for a user-set factor with no `raw_value`
  //                              (measured: typing 0.8 persists {value, source:'user'})
  //   "without a figure"         FALSE for a numeric estimate — `estimateText` is
  //                              CEE's `display_value` with only an EMPTINESS check,
  //                              and the estate's fixtures carry '£20,000' (11×),
  //                              '£30k', '£49', '3 months', '20%', '0.7'. A row can
  //                              render "Olumi: £20,000" under a heading calling it
  //                              figureless.
  //
  // ⚠ THE POPULATION IS HETEROGENEOUS, SO NO ADJECTIVE CAN BE TRUE OF IT. Three
  // rounds is past the point where one more wording is a fix rather than the
  // next refutation, so this states the COMPOSITION instead of characterising it:
  // three DISJOINT buckets, each clause independently true, and nothing asserted
  // about the whole.
  //
  // ⚠ AND THE BUCKETS READ WHAT THE CELL READS. "Olumi has something here" is
  // answered by `estimateText` — the very field `ModelRowView` renders — NOT by a
  // second predicate over the same question. `factorIsConfirmable` answers a
  // different one ("is there a value to RATIFY?"), which is why a band satisfies
  // this and not that. The heading's job is to be consistent with the cell beside
  // it, so it reads the cell's own field.
  const yours = unset.filter(
    r => classifyValueProvenance(r.provenanceSource)?.userOwned === true,
  ).length
  // ⚠ TWO FACTS, ONE QUESTION — NOT TWO PREDICATES OVER IT. Olumi can have
  // something here in two independently-owned ways, and a row may carry either
  // without the other:
  //   · `estimateText`         — CEE sent display text, and the CELL RENDERS IT.
  //   · `unconfirmed-estimate` — `factorIsConfirmable`: a numeric value to
  //                              RATIFY, which a band does not satisfy and a
  //                              text-less numeric estimate does.
  // Bucketing on only the first calls a ratifiable estimate "no value yet";
  // only the second calls a band that. Neither fact is re-derived here — both
  // are read from their existing owners, and their union is the one question
  // this clause asks.
  const fromOlumi = unset.filter(
    r =>
      classifyValueProvenance(r.provenanceSource)?.userOwned !== true &&
      (r.estimateText !== undefined ||
        (Array.isArray(r.attention) && r.attention.includes('unconfirmed-estimate'))),
  ).length
  const nothing = unset.length - yours - fromOlumi

  const clauses = [
    nothing > 0 ? `${nothing} with no value yet` : null,
    fromOlumi > 0 ? `${fromOlumi} estimated by Olumi` : null,
    yours > 0 ? `you set ${yours}` : null,
  ].filter((c): c is string => c !== null)

  return clauses.join(' · ')
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
  onConfirmValueAsIs,
  onGroupAction,
  groupActionContext,
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
            className={`${typography.panelHeader} text-text-header w-full text-left px-2 py-1.5`}
          >
            {group.open ? '▾' : '▸'} {GROUP_TITLE[group.id]}
            <span className={`${typography.panelMeta} text-text-light ml-2`}>
              {group.rows.length}
            </span>
            {/*
              The unknown summary — ONE sentence in place of N identical "Not
              set" strings down the rows (see `ModelRowView`'s value cell).

              ⚠ DERIVED FROM THE SAME FIELD THE CELL READS (`primaryValue ===
              null`), not from a separately maintained count, so the heading and
              the rows cannot disagree about what is unstated (trap 12).

              ⚠ RENDERED ONLY WHEN THERE ARE UNKNOWNS. A permanent "0 of 4"
              would be its own wall — chrome that always renders states nothing
              about the data.
            */}
            {unsetSummary(group.rows) !== null && (
              <span
                data-testid={`model-group-v2-${group.id}-unknown-summary`}
                className={`${typography.panelMeta} text-text-light ml-2`}
              >
                {unsetSummary(group.rows)}
              </span>
            )}
          </button>

          {group.open && (
            <>
              {group.rows.length === 0 ? (
                <p
                  data-testid={`model-group-v2-${group.id}-empty`}
                  className={`${typography.panelBody} text-text-light px-4 py-1`}
                >
                  {filter.trim() === ''
                    ? 'Nothing in this group yet'
                    : 'No matches in this group'}
                </p>
              ) : (
                /*
                  ⭐ THE ONE GRID. Four tracks defined ONCE here; every row is
                  `grid-cols-subgrid col-span-4` and adopts them, so the value
                  column is a real column across the whole group rather than a
                  per-row accident.

                  Tracks, and why each is what it is:
                    `auto`            glyph — intrinsic, never negotiates
                    `minmax(0,1fr)`   identity — takes the slack. The `0` floor
                                      is load-bearing: `1fr` alone resolves its
                                      automatic minimum to `min-content`, so a
                                      long label would push the value column
                                      off-axis and reintroduce the defect.
                    `auto`            value — the column this change exists for
                    `auto`            meta — provenance, attention, id

                  ⚠ THE COLUMN COUNT IS A CONTRACT WITH `ModelRowView`. A
                  subgrid item adopts only the tracks it SPANS, so adding a
                  fifth track here without moving `col-span-4` there makes rows
                  silently stop aligning — no error, no red, just the old
                  behaviour back. `rowAtomsAlignToOneGrid.spec.tsx` derives both
                  numbers and asserts they agree.
                */
                <ul
                  role="listbox"
                  aria-label={GROUP_TITLE[group.id]}
                  data-testid={`model-outline-v2-${group.id}-rows`}
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto]"
                >
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
                      onConfirmValueAsIs={onConfirmValueAsIs}
                    />
                  ))}
                </ul>
              )}
              {/*
                ⭐ THE SECTION NAMES WHAT CAN RESOLVE WHAT IT IS DISPLAYING.
                Rendered immediately ABOVE the actions, so the sentence and the
                control it names are in one glance — a notice that points at a
                button the user has to go and find is a notice that arrives too
                late. See `sectionWriterNotice.ts` for why this is a notice and
                not an edit control: there is no writer to give it.
              */}
              <SectionWriterNotice
                group={group.id}
                rows={group.rows}
                editConnectedIds={editConnectedIds}
                actionsWillRender={typeof onGroupAction === 'function'}
              />
              {/*
                THE ACTIONS RENDER EVEN WHEN THE GROUP IS EMPTY, and that is the
                point of putting them here. "Add a factor" is at its most useful
                when there are no factors — the v1 risks CTA rendered ONLY in the
                empty state and the v1 factor CTA only in the populated one, so
                each was missing exactly where the other proved it was wanted.
              */}
              <ModelGroupActions
                groupId={group.id}
                actions={GROUP_ACTIONS[group.id]}
                context={groupActionContext ?? { goalLabel: null, goalTarget: null }}
                onAction={onGroupAction}
              />
            </>
          )}
        </section>
      ))}
    </div>
  )
}
