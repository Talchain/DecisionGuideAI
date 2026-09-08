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

import { useCallback, useEffect, useMemo, useState } from 'react'
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
   * A group a deep link wants OPEN. One-way by design: a request opens, never
   * closes. See the effect that consumes it.
   */
  openGroupRequest?: ModelGroupId | null
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
  /**
   * Groups the reader closed BY HAND while this search is active.
   *
   * Separate from `openGroups`, and that separation is the fix: a search
   * reveals matches by overriding the resting closed-state, so if one set
   * carried both, clearing the search would leave the reader's search-time
   * clicks applied to their resting outline — which is how a click made to
   * CLOSE a group ended up leaving it open. Optional, so existing callers and
   * the pure-function tests are unchanged.
   */
  searchClosed: ReadonlySet<ModelGroupId> = new Set(),
): {
  groups: readonly { id: ModelGroupId; open: boolean; rows: readonly ModelRow[] }[]
  unknownGroupRowIds: readonly string[]
} {
  const needle = filter.trim().toLowerCase()
  const known = new Set<string>(MODEL_GROUP_IDS)
  const unknownGroupRowIds = rows.filter(r => !known.has(r.group)).map(r => r.id)

  const matches = (r: ModelRow) =>
    needle === '' || r.label.toLowerCase().includes(needle)

  // ⭐⭐ A SEARCH THAT REVEALS NOTHING IS NOT A SEARCH.
  //
  // ⚠ THIS IS A REGRESSION FIX, NOT A FEATURE, AND IT WAS FOUND BY A FAILING
  // TEST THAT I ALMOST "FIXED" THE WRONG WAY. Once the outline began opening
  // CLOSED (`initiallyClosedGroups`, this PR), `open` was still computed from
  // the closed-state ALONE — the needle was used to narrow `rows` and never
  // consulted for `open`. So a user who typed into the one search box on
  // arrival, with every group shut, matched rows that were never rendered: the
  // filter narrowed a list nobody could see.
  //
  // `ModelTabBody.spec.tsx`'s "the one search surface actually filters the
  // outline" caught it. The tempting repair was to open the groups in the TEST
  // and move on — which would have left the product defect live and the suite
  // green. Worse, that test's own negative assertion (`factor-budget` absent)
  // passes VACUOUSLY against a closed group, so half of it was already
  // incapable of failing.
  //
  // A group opens while searching only if it HAS a match: a group with nothing
  // to show stays shut, so the result reads as a result rather than as seven
  // headings. When the needle is empty this is exactly the previous behaviour.
  const searching = needle !== ''

  return {
    groups: MODEL_GROUP_IDS.map(id => {
      // `filter` preserves the caller's order by construction.
      const groupRows = rows.filter(r => r.group === id && matches(r))
      return {
        id,
        /**
         * This was `openGroups.has(id) || (searching && rows > 0)`, and the
         * disjunct made the header toggle INERT — measured on merged staging.
         * Both `aria-expanded` and the body gate read this value while the
         * click handler mutated only the resting `closed` set, so the chevron
         * never moved, a screen reader was told the button controlled an
         * expanded region it would not collapse, and the hidden flip surfaced
         * on clearing the search: the click meant to CLOSE the group had
         * removed it from `closed`, dumping the full list. A control that
         * cannot act is worse than one that is absent.
         *
         * While searching, the override decides the DEFAULT and the reader's
         * own click overrides the override. With an empty needle this is
         * exactly the previous behaviour.
         *
         * The `openGroups.has(id) ||` limb is NOT redundant, and dropping it
         * was a regression `ModelOutline.spec`'s "keeps every group heading
         * present and says a group has no matches" caught. A group the reader
         * already had OPEN must stay open while searching even with zero
         * matches, so it can render "No matches in this group" — otherwise the
         * search silently collapses a section the reader opened, which is the
         * defect this file is repairing, arriving from the other direction.
         *
         * ⚠ AND THAT SPEC WAS ALREADY PASSING FOR A WEAKER REASON THAN IT
         * READS: it renders `ModelOutline` with no `initiallyClosedGroups`, so
         * every group is open by default — while production passes all seven
         * as closed. It never exercised the closed-and-searching case at all.
         */
        open: searching
          ? (openGroups.has(id) || groupRows.length > 0) && !searchClosed.has(id)
          : openGroups.has(id),
        rows: groupRows,
      }
    }),
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
  openGroupRequest,
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
  /** Closes made BY HAND during the current search. Cleared when it ends. */
  const [searchClosed, setSearchClosed] = useState<ReadonlySet<ModelGroupId>>(() => new Set())
  const searching = filter.trim() !== ''

  // Search-scoped closes belong to ONE search. Leaving them behind would make
  // the next search start with groups the reader shut during the last one.
  useEffect(() => {
    if (!searching) setSearchClosed(prev => (prev.size === 0 ? prev : new Set()))
  }, [searching])

  /**
   * THE DEEP LINK MUST OPEN THE SECTION IT SCROLLS TO.
   *
   * `ModelTabBody` scrolls `model-group-v2-<id>` into view for five live
   * callers. That `<section>` wrapper renders unconditionally while its BODY is
   * gated on `open` — so once the outline began arriving closed, all five
   * landed the reader on a collapsed heading. The scroll succeeded and the list
   * they asked for stayed behind a click nobody told them to make.
   *
   * No test could see it: the only pin asserts the section ELEMENT was scrolled
   * to, and that element still renders. It binds to the container, not to
   * visible content.
   *
   * `closed` was `useState` initial-only with one setter and zero effects, so
   * nothing outside this component could open a group. This is that missing
   * door, and it is deliberately ONE-WAY — a request opens, never closes, so a
   * deep link can never collapse something the reader opened.
   */
  useEffect(() => {
    if (!openGroupRequest) return
    setClosed(prev => {
      if (!prev.has(openGroupRequest)) return prev
      const next = new Set(prev); next.delete(openGroupRequest); return next
    })
    setSearchClosed(prev => {
      if (!prev.has(openGroupRequest)) return prev
      const next = new Set(prev); next.delete(openGroupRequest); return next
    })
  }, [openGroupRequest])

  const openGroups = useMemo(
    () => new Set(MODEL_GROUP_IDS.filter(id => !closed.has(id))),
    [closed],
  )

  /**
   * Toggling one group NEVER touches another — design §2 F2.
   *
   * WHICH SET it mutates depends on whether a search is active, and that is the
   * repair: during a search the reader is acting on the SEARCH's outline, not
   * on their resting one, so the click must not silently rewrite the state they
   * return to when the needle clears.
   */
  const toggle = useCallback(
    (id: ModelGroupId) => {
      const flip = (prev: ReadonlySet<ModelGroupId>) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      }
      if (searching) setSearchClosed(flip)
      else setClosed(flip)
    },
    [searching],
  )

  const { groups } = outlineLayout(rows, filter, openGroups, searchClosed)

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

                  Tracks, and why each is what it is. ⚠ READ FROM THE CLASS
                  BELOW, WHICH IS THE ONLY PLACE THEY ARE DECLARED — this
                  legend is the block a later session reads INSTEAD of the
                  60-line history under it, and it had drifted from that class
                  in THREE of its four lines: it still described the identity
                  track as `minmax(0,1fr)` after the 6rem floor landed, and
                  both caps as `auto` after they were capped. A summary that
                  disagrees with the code it summarises is worse than no
                  summary, because it is the one that gets believed.
                    `auto`                  glyph — intrinsic, never negotiates
                    `minmax(6rem,1fr)`      identity — takes the slack, and the
                                            FLOOR is load-bearing. `1fr` alone
                                            resolves its automatic minimum to
                                            `min-content`, and a `0` floor is
                                            that same unbounded share spelled
                                            differently: either way a long
                                            label pushes the value column
                                            off-axis and reintroduces the
                                            defect. A track minimum is honoured
                                            before other tracks reach their
                                            maximum — that is what reserves the
                                            label's width first.
                    `fit-content(5.5rem)`   value — the column this change
                                            exists for, capped so a long prose
                                            value cannot take the label's width
                    `fit-content(5rem)`     meta — provenance, attention, id.
                                            ⚠ NOT the same story as the value
                                            track: this cell is `min-w-0`, so
                                            it has no automatic minimum and the
                                            5rem is a HARD cap on everything in
                                            it, shrinkable or not. Two of its
                                            atoms are `shrink-0`. The block
                                            above the class prices what is and
                                            is not known about that.
                  ⚠ THE TWO CAPS ARE MEASURED LENGTHS, NOT ROUND NUMBERS —
                  `rowAtomsAlignToOneGrid.spec.tsx` pins both, so changing
                  either REDs until a fresh measurement replaces the one
                  recorded below.

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
/* ⚠⚠ THE LABEL TRACK HAS A FLOOR, AND THE VALUE TRACK CAN GIVE.
                     Both halves are required; neither works alone.

                     MEASURED on a factor row with an estimate hint: the label
                     "Bottom-Up Adoption Friction" rendered at **37px** — about
                     four characters — while its value took 173px and the
                     attention column 111px. Unreadable, and present on
                     `staging` before this change (verified by reverting this
                     file to origin/staging and re-measuring: 51px of genuine
                     box overlap, identical).

                     WHY THE OBVIOUS FIXES DO NOT WORK, both tried and measured:
                     `1fr` means "a share of what is left AFTER the other tracks
                     are sized", so an `auto` track is satisfied to max-content
                     FIRST and the label only ever gets the remainder. And
                     `min-w-[6rem]` on the label ITEM cannot help either: these
                     rows are `grid-cols-subgrid`, so the PARENT sizes the track
                     across every row at once and one item's minimum is not the
                     track's.

                     A track MINIMUM is honoured before other tracks reach their
                     maximum. So the floor belongs on the TRACK —
                     `minmax(6rem,1fr)` — and that is the WHOLE change.

                     ⚠⚠ THE VALUE TRACK KEEPS ITS AUTOMATIC MINIMUM, AND AN
                     EARLIER CUT OF THIS FIX DID NOT. It read `minmax(0,auto)`, justified here by a
                     sentence claiming *"NUMBERS STAY SAFE BY CONSTRUCTION …
                     a bare '35 %' keeps its automatic minimum"*. That sentence
                     was FALSE THE DAY IT WAS WRITTEN: CSS Grid §6.6 grants the
                     automatic minimum only when the track's min sizing function
                     is `auto`, and `minmax(0,auto)` is exactly the spelling that
                     removes it. `ValueLeaf` cannot cover the gap either, because
                     `valueMayShrink` returns false for anything containing a
                     digit.

                     Measured on the DEPLOYED build's own rows (dock driven to
                     both reachable widths, value text set to
                     "£1,250,000 per year"): with `minmax(0,auto)` at the 280px
                     floor the value box is crushed to 44.4px against 118px of
                     content; with `auto` it sizes to 118.4px and fits. And the
                     identity floor ALONE reaches zero label-over-value at 416px
                     AND 280px — 51.6px and 96px of overlap removed — so the
                     second track change bought nothing and cost the numeric
                     case.

                     ⭐ 6 Sep 2026 — THE VALUE AND ATTENTION TRACKS ARE CAPPED
                     WITH `fit-content`, NOT `minmax(0, …)`. `fit-content(L)` is
                     `max(auto-minimum, min(L, max-content))`, so unlike
                     `minmax(0,L)` it keeps the automatic minimum AND does not
                     reserve its cap when the cell is empty. The identity track
                     receives whatever the two capped tracks do not use.

                     ⚠⚠ BUT THE AUTOMATIC MINIMUM IS A PROPERTY OF THE CELL, NOT
                     OF THE TRACK — AND ONLY ONE OF THESE TWO CELLS HAS ONE.
                     CSS Grid §6.6 grants it only where the item's own
                     `min-width` is `auto`, so a cell carrying `min-w-0` has
                     none and its cap is hard. Read at the bytes:

                       · VALUE — the two idle arms of `ValueCell` in
                         `ModelRowView.tsx` (the read-only `<span>` and the
                         editable `<button>`; grep the predicate
                         `estimate === null && !valueMayShrink(display)` and it
                         returns exactly those two) are `shrink-0` in exactly
                         the bare-number case, and `shrink-0` sets no
                         `min-width`. The automatic minimum SURVIVES there,
                         which is why "£1,250,000 per year" sizes to 118px
                         under `fit-content(5.5rem)` and not to 88px — the
                         measurement below is that claim's witness. The cap
                         binds on the other arm, whose container is `min-w-0`
                         and whose `ValueLeaf` applies `truncate min-w-0`
                         whenever `mayShrink` — the strength phrases.

                         The dark arms do not receive the cap either, and they
                         reach that by TWO DIFFERENT ROUTES, which the sentence
                         here collapsed into one until 6 Sep 2026. `case
                         'editing'` carries `shrink-0` outright. `case
                         'applied'`, `'inflight'` and `'refused'` carry
                         `className={typography.panelTabular}` and NOTHING
                         ELSE — no `shrink-0`, and equally no `min-w-0`, so
                         their `min-width` stays `auto` and CSS Grid §6.6
                         grants them the automatic minimum for free. ⚠ The
                         earlier wording said "the dark `editing`/`applied`
                         arms are `shrink-0` too". `applied` has never been
                         `shrink-0` — not at this PR's merge base, not at its
                         first head, not now; the claim was false when written
                         and the right conclusion was reached by a mechanism
                         the sentence misnamed. Either way the "loaded gun"
                         hazard recorded in `ModelRowView` is UNCHANGED by this
                         change — but an arm that keeps its automatic minimum
                         by ACCIDENT (no class at all) is one `min-w-0` away
                         from losing it, and an arm that keeps it by `shrink-0`
                         is not. Whoever wires those arms owns that difference.

                       · META — the `CELL 4 · META` container in
                         `ModelRowView.tsx`, the sole `justify-end` element in
                         that file, is `min-w-0` UNCONDITIONALLY: the class is
                         a static string literal, not a ternary, so there is no
                         arm in which it is absent. Its automatic minimum is
                         therefore ZERO and `fit-content(5rem)` is a hard 5rem
                         cap. Nor is its content all shrinkable. Named by the
                         `data-testid` each atom renders, which is what a grep
                         finds and what the specs already bind to:

                           `model-row-v2-<id>-confirm-as-is`  `shrink-0`
                           `model-row-v2-<id>-attention-<r>`  `shrink-0`
                           `model-row-v2-<id>-provenance`     `truncate min-w-0`
                           `model-row-v2-<id>-id`             `truncate min-w-0`
                           `model-row-v2-<id>-deferred`       NEITHER

                         So two atoms cannot give, two can, and the deferred
                         marker carries no width class at all — it is not
                         `shrink-0`, so it may be squeezed, and it has no
                         `truncate`, so it has nothing to truncate WITH. That
                         fifth row went unlisted while these were line numbers.

                         ⚠ AND THE ATTENTION MARKER IS NOT WHAT THIS BLOCK SAID
                         IT WAS. Until 6 Sep 2026 it read "an attention marker
                         is a bare `⚠` glyph — not text that can truncate at
                         all". #1215 replaced that glyph. Read at the bytes:
                         `ATTENTION_MARK` in `rowPresentation.ts` is
                         `Record<AttentionReason, LucideIcon>` over five
                         DISTINCT `lucide-react` icons — `CircleDashed`,
                         `HelpCircle`, `Split`, `AlertTriangle`, `Target`, one
                         per reason — rendered as `<Mark className="w-3.5
                         h-3.5" />` inside the `shrink-0` span. The CONCLUSION
                         is unchanged and is now stronger: an SVG at a fixed
                         `w-3.5 h-3.5` cannot truncate for a better reason than
                         a text glyph could, because it is not text at all and
                         its width is authored, not intrinsic. The count is
                         also bounded differently — up to five marks, one per
                         distinct `AttentionReason`, not an unbounded map over
                         repeated `⚠`s, which is the specific thing #1215 fixed.

                         ⚠⚠ EVERY LINE NUMBER IN THIS BLOCK IS GONE, AND THE
                         REASON IS THIS PR'S OWN HISTORY. It shipped nine of
                         them — `:869`, `:903`, `:156`, `:646`, `:404`, `:492`,
                         `:508`, `:471`, `:600` — every one CORRECT when
                         written and reviewed. #1215 then rewrote
                         `ModelRowView.tsx` by +182/−18 (918 → 1082 lines)
                         before this branch landed, and ALL NINE moved. One of
                         them, `:492`, came to rest on a comment line THIS PR
                         had itself added. The numbers were not wrong; they
                         were unowned. A symbol a grep resolves survives an
                         insert above it, and a number does not — so the rule
                         this block already stated in words ("a line reference
                         in a comment is a mirror that the next edit breaks
                         silently") is now obeyed rather than annotated.

                         The classes above were read at the tip of this branch
                         rebased onto staging `acd3db4d`;
                         `rowAtomsDoNotWrap.spec` is the derived, non-drifting
                         statement of the same facts, and it asserts by name
                         that neither `Confirm` nor the attention marker may
                         shrink.

                     ⚠ SO THE SENTENCE THIS BLOCK SHIPPED WITH — "only content
                     that can shrink (the `truncate min-w-0` strength and
                     attention text) is capped" — WAS TRUE OF THE VALUE TRACK
                     AND FALSE OF THE OTHER ONE, and the false half was the half
                     doing the safety work. It named `attention text` as the
                     thing being capped; the attention atoms are the two things
                     in that cell that cannot give at all.

                     ⚠⚠ WHAT IS NOT MEASURED, STATED AS UNMEASURED. Whether
                     `Confirm` + one or more attention marks + their 6px gaps
                     (`gap-1.5`) exceed 5rem at any reachable dock width. ⚠ The
                     mark is no longer the `⚠` this sentence used to name, and
                     the substitution moved ONE of the three unknowns: each
                     mark is now an SVG at an AUTHORED `w-3.5`, so its width is
                     14px by declaration rather than font-dependent, and the
                     count is bounded at five. `Confirm` is still TEXT — the
                     word itself, sized by `typography.buttonSmall` and
                     carrying no padding class at all — so its width is a
                     function of font metrics, not of a class, and the sum
                     still needs layout. Two of three terms known is not a
                     measurement. ⚠ THE TWO LITERAL TOKEN NAMES THAT STOOD IN
                     THIS PARENTHESIS WERE REMOVED, NOT REWORDED, AND THE
                     REASON IS WORTH KNOWING BEFORE YOU WRITE THE NEXT COMMENT
                     HERE: the DS v5 drift guard
                     (`tools/ci-guards/check-ds-compliance.mjs`) scans FILE
                     TEXT, not JSX, so a scale token quoted inside a COMMENT
                     counts as a usage and reds the scoped-typography ratchet.
                     Naming it cost two net-new violations and a red CI job on
                     a comment-only change. Cite the `typography` symbol.
                     If they do exceed it they cannot yield, and
                     a `justify-end` flex line overflows past its START edge —
                     leftwards, over the value column. The measurement below
                     priced LABEL VISIBILITY and did not point at this cell, so
                     it cannot settle it either way. This file's own rule is
                     that a loss is priced at a WIDTH; this one has no width, so
                     it is recorded as open rather than claimed safe. The
                     honest reading of the 6 Sep run is that the identity track
                     gained what the two capped tracks gave up, and that what
                     the META cell gives up has not been looked at.

                     ⭐ AND THE REPO ALREADY HOLDS THE OTHER HALF OF THAT
                     CONTRADICTION, one directory over. `rowAtomsDoNotWrap.spec`
                     asserts, by name and green today, "the attention marker
                     never shrinks" and "Confirm never shrinks and never wraps —
                     a truncated affordance is a fake one". Those two guards and
                     this cap are each correct in isolation and answer different
                     questions — may this atom yield? vs how wide may this track
                     be? — which is exactly the shape that ships a defect
                     neither PR's tests can see. Whoever prices the width above
                     should read that spec first: it is the statement of what
                     the meta cell is NOT allowed to give up.

                     MEASURED on the deployed build `127bdee7` (guest scenario,
                     dock 372px, overrides applied to these `<ul>`s and restored
                     exactly): the relationships list's identity track went
                     96px → 181px and relationship labels from 0 to 8 of 13 more
                     than half visible (mean 28% → 53%); goal, option and factor
                     labels were unchanged (11 of 13 fully visible before and
                     after). The #1208 case "£1,250,000 per year" sized to 118px
                     under `fit-content(5.5rem)` exactly as under `auto`; the
                     rejected alternative `minmax(0,5.5rem)` crushed it to 80px
                     and cost four fully-visible option labels, because a
                     zero-minimum track reserves its cap even when empty.
                     `rowAtomsAlignToOneGrid.spec.tsx` pins both halves: the
                     automatic minimum, and the cap. */
                  className="grid grid-cols-[auto_minmax(6rem,1fr)_fit-content(5.5rem)_fit-content(5rem)]"
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
