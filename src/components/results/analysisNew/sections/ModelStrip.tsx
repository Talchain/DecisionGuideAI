/**
 * Analysis (New) — "Your model so far".
 *
 * The design's first element, and the only genuinely visual one on the panel:
 * marks grouped by kind, each a route to that node on canvas, under the goal or
 * decision the model is about.
 *
 * ⭐⭐ WHY IT IS NOW A SUMMARY LINE WITH THE MARKS BEHIND IT — measured, and the
 * measurement is the whole argument.
 *
 * On the deployed build at the real shipped width the panel is 278 x 702px and
 * this strip occupied 235 x 155px: 22% OF THE PANEL'S HEIGHT, permanently,
 * above everything the reader came for. Three findings settled what to do:
 *
 *   1. THE MARK ARRAY IS A UNARY RESTATEMENT OF THE NUMBER BESIDE IT. Every
 *      mark here is identical and means exactly "a node of this kind exists"
 *      (`buildModelStrip.ts`, and it is deliberate — see the provenance note
 *      there). So N identical marks say "N nodes of this kind exist", which is
 *      precisely what the tally at the end of the same row already said, more
 *      precisely, in a tenth of the space. The panel's own first-viewport
 *      census exists to catch a claim stated twice; it counts SENTENCES, so it
 *      could not see the same defect expressed as an encoding.
 *   2. WHAT THE MARKS ADD OVER THE NUMBER IS A WEAK AFFORDANCE. A 12px
 *      unlabelled shape whose accessible name lives in a screen-reader-only
 *      span, on a panel where every finding below already carries a named
 *      "Show on canvas" control, and beside a canvas that is itself the primary
 *      navigation surface. Real, worth keeping, not worth 22% of the panel.
 *   3. THE REST OF THIS PANEL IS ALREADY A LIST OF COLLAPSED ROWS.
 *      `SectionShell` makes every section below the glance mount CLOSED, and
 *      `collapsedIA.spec.tsx` pins that as the information architecture. An
 *      always-expanded block at the top was the one thing exempt from the
 *      surface's own rule.
 *
 * So the census and the vocabulary stay visible and the mark array goes behind
 * a disclosure. What survives collapse is everything the canvas does NOT say:
 * the subject, a per-kind COUNT (a spatial graph cannot be counted at a
 * glance), and one labelled mark per kind — which is a better vocabulary key
 * for the marks used on the findings below than twelve unlabelled repeats,
 * because the label is attached to it.
 *
 * ⚠ DEFAULT OPEN BEFORE A RUN. Orientation is worth most when there is nothing
 * else on the panel — pre-run this tab has a status line and empty sections,
 * and the strip was written partly because "before a run it had almost nothing
 * to show at all". Post-run the glance, the insights and the recommendations
 * are what the reader came for, and the strip is what was pushing them down.
 *
 * ⚠ THE SUBJECT'S OWN MARK IS GONE, AND NOT FOR SPACE. The header used to draw
 * the canvas goal glyph beside the label. `buildModelStrip` resolves that label
 * from the goal node OR, failing that, from the DECISION node — one field, two
 * origins — so the glyph was drawn as a goal on every model that names a
 * decision and no goal. A mark that means something it is not is the exact
 * defect `nodeMarks.tsx` exists to prevent, so it is removed rather than
 * guessed at. Restoring it needs the builder to say which node the subject came
 * from; the four tallies below carry the vocabulary in the meantime.
 *
 * ⚠⚠ NO PROVENANCE CLAIM, UNCHANGED AND NON-NEGOTIABLE. Every mark is identical
 * and means exactly "a node of this kind exists". The filled-vs-hollow
 * distinction the design draws needs per-value provenance the estate does not
 * have, and a fill this data cannot justify is the defect the strip exists to
 * expose. With no fill there is nothing to explain, so the strip needs NO
 * LEGEND — the legend was furniture bought entirely by the fill.
 *
 * ⭐⭐ AND WHAT MAKES IT A TOOL RATHER THAN A STATUS BAR (Paul, 31 Aug 2026):
 * "each one of those is meant to represent the data point within the model and
 * display an information panel or a few key data points and actionable coaching
 * below it."
 *
 * A mark now OPENS THE RUN'S OWN COACHING FOR THAT NODE. Nothing on that detail
 * is authored here: the finding's `title` and `tryThis` are the engine's own
 * sentences, the technique is the catalogue's, the driver line is the glance's.
 * The join is `targetId`, made once in `nodeInsights.ts` and handed in as a
 * prop, so the strip and any later surface cannot derive two different answers
 * to "what does this run say about node X" (CLAUDE.md trap 12).
 *
 * ⭐ AND THE OTHER HALF OF THE SAME SENTENCE — "possibly highlight the relevant
 * items in the graph". Pointing at or focusing a mark RINGS THAT NODE ON THE
 * CANVAS, through the same results-panel → canvas channel the compare tab
 * already uses and which `BaseNode` renders. The reader sees which shape the
 * mark is before deciding to move the camera to it.
 *
 * ⚠ THREE ROUTES IN, NOT ONE. Hover is a mouse affordance and nothing else:
 * touch has no hover and the keyboard has no pointer. Pointing at a mark,
 * FOCUSING a mark and ACTIVATING a mark all open the same detail, and
 * activation additionally does what it always did — routes to the node on
 * canvas. `aria-expanded` on the mark and `aria-controls` at the detail are what
 * make the disclosure legible to a screen reader rather than a visual-only
 * change of state.
 *
 * ⚠ THE DETAIL DOES NOT CLEAR ON MOUSE-OUT, DELIBERATELY. A panel that empties
 * the instant the pointer leaves cannot be READ — the reader has to travel to
 * it, and the trip erases it. It is replaced by the next mark and by nothing
 * else, which is also what the approved prototype does.
 *
 * ⚠ AND THE ABSENCE IS RENDERED. A node with no finding and no driver row says
 * so. The alternative — showing nothing, or showing a reassurance — is the
 * "advertisement, not affordance" defect: a reader who picks a mark and gets
 * silence cannot tell a node nobody flagged from a control that is broken.
 *
 * ⭐⭐⭐ AND THE THING THAT WAS STILL MISSING (Paul, 1 Sep 2026): *"The top
 * component still doesn't feel like a tool. The information shown when you
 * hover over it isn't very action-oriented. It doesn't give you any additional
 * icons or clickable elements to make it valuable."*
 *
 * ⚠ THAT IS NOT AN IMPRESSION, IT IS A DESCRIPTION OF THE DOM — measured on
 * the deployed build at `19fe8710`, hovering the RICHEST case available (a
 * factor that is also a named driver). The detail rendered exactly three lines
 * — `detail-title` (the node's name), `detail-kind` ("Factor"), and one
 * `detail-driver` chip — and `querySelectorAll('button,a,[role="button"]')`
 * inside it returned EMPTY. Two of those three lines restate what the mark
 * already carries: the name is the mark's own label and the kind is its shape
 * and colour. So on the best node in the model, the panel said one new thing
 * and offered nothing to do.
 *
 * Three changes answer it, and each is bound to a datum that already exists:
 *
 *   1. A ROW IS A CONTROL. The row label is now a button. Pressing it rings
 *      every node of that kind on the canvas AND lifts the mark cap for that
 *      row, so the reader sees all twenty factors instead of twelve and a
 *      withheld count. That second half is the part a reader could not get
 *      any other way, which is why the row does more than filter.
 *   2. THE STRIP CARRIES A WORKLIST. `needsCheck` is the product's own
 *      "N to verify" state (`factorIsConfirmable`, the write authority's own
 *      condition — see `buildModelStrip.ts`). The toggle narrows the strip to
 *      exactly those factors and rings them. It renders ONLY when the count is
 *      non-zero, which is the rule `ModelTabV2Panel` already applies to the
 *      same number: a chip reading "0 to verify" is a dead affordance.
 *   3. THE DETAIL HAS ACTIONS AND ONE MORE FACT. A named "Show on canvas"
 *      button — the detail is where the reader's eyes are, activation of the
 *      mark is a different gesture, and on touch that gesture is what opened
 *      the detail in the first place — and the "Estimate not yet confirmed"
 *      state when this node carries one, which is the one thing on the detail
 *      the mark cannot already show.
 *
 * ⚠⚠ AND WHAT IS STILL REFUSED, BECAUSE THE OBVIOUS NEXT STEPS ARE THE UNSAFE
 * ONES ONCE THE ROWS ARE INTERACTIVE:
 *
 *   · NO RENAME FROM THE STRIP. `onLabelChange` has zero product callers and
 *     no server carrier exists for a node label — the four carriers are
 *     `factor_value_edit`, `prior_range_edit`, `edge_adjudication`,
 *     `structural_delete`. A rename would be discarded on the next load.
 *   · NO FILLED-VS-HOLLOW MARK. Unchanged and non-negotiable — see below.
 *     `needsCheck` is deliberately NOT drawn as a fill: it is a different and
 *     weaker claim than provenance, and a reader who learned to read fill as
 *     "whose value is this" would read it wrong.
 *   · NO "RUN THIS FINDING" BUTTON. A recommendation's primary action is
 *     dispatched by `runPrimaryAction` in `StrengthenTheReasoning`, which
 *     carries modal routing and a `hasServerGraphAuthority` gate. A second
 *     copy here is the two-authorities defect (CLAUDE.md traps 12 and 21), and
 *     that file is not this lane's to change. The METHOD chip stays, because
 *     it dispatches through `openAskOlumi` with no branching of its own.
 */

import { useCallback, useId, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Crosshair, Lightbulb, ListChecks, Pencil } from 'lucide-react'

import { useCanvasStore } from '../../../../canvas/store'
import { UNCONFIRMED_ESTIMATE_LABEL } from '../../../../canvas/domain/vocabulary'
import {
  classifyValueProvenance,
  VALUE_PROVENANCE_LABEL,
} from '../../../../canvas/domain/valueProvenance'
import { useModelEditAuthority } from '../../../../canvas/hooks/useModelEditAuthority'
import { NodeMark, type MarkKind } from '../nodeMarks'
import { focusModelTarget } from '../../../../canvas/utils/focusHelpers'
import { useShowToastSafe } from '../../../../canvas/ToastContext'
import { highlightNode, clearHighlight } from '../../../../canvas/utils/highlightHelpers'
import { typography } from '../../../../styles/typography'
import { openAskOlumi } from '../../coaching/askOlumiStore'
import { STRENGTHEN_COPY } from '../../strengthen/strengthenCopy'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import { buildModelStrip, MARK_CAP, type StripNode, type StripRow } from '../buildModelStrip'
import type { NodeInsight, NodeInsightIndex } from '../nodeInsights'

/**
 * The subject line when the model names neither a goal nor a decision.
 *
 * Deliberately the strip's own name rather than an invented subject: with no
 * goal node there is no question to state, and a header that guessed one would
 * be a claim. It doubles as the landmark's accessible name in that case.
 */
const NO_SUBJECT_LABEL = 'Your model so far'

/**
 * A stable empty index, so an unwired mount does not allocate a new Map on
 * every render and re-run every memo downstream of it.
 */
const NO_INSIGHTS: NodeInsightIndex = new Map()

/** What a node's detail has to say when the run named it nowhere. */
const EMPTY_INSIGHT: NodeInsight = { driverLabel: null, findings: [], withheldFindings: 0 }

/**
 * Ring several nodes at once on the canvas.
 *
 * ⚠ THE STORE DIRECTLY, AND ONLY BECAUSE THE HELPER MODULE HAS NO MULTI-NODE
 * FORM. `highlightHelpers` exports `highlightNode` (one id) and
 * `clearHighlight`; the underlying store action has always taken an array.
 * Adding `highlightNodes` there is the tidier home for this and it is a canvas
 * file, outside this lane's ownership — so the call is made here, named, and
 * reported as the delta rather than smuggled in. It writes the SAME channel
 * `highlightNode` writes, so a row ring and a mark ring can never coexist as
 * two competing highlights.
 */
function ringNodes(ids: readonly string[]): void {
  useCanvasStore.getState().setHighlightedNodes([...ids])
}

/**
 * One row as the current narrowing leaves it.
 *
 * ⚠ `nodes` IS WHAT THIS ROW CONTRIBUTES, `drawMarks` IS WHETHER IT DRAWS THEM,
 * AND THEY ARE DIFFERENT QUESTIONS (CLAUDE.md trap 21). Selecting a KIND does
 * not shrink any row's membership — it decides which row draws marks, and the
 * counts stay the model's. Selecting the WORKLIST does shrink membership, and
 * only then does a row state two numbers. Collapsing the two into one field
 * would make an unselected row report "0 of 20", which is a claim about the
 * model rather than about the control.
 */
interface VisibleRow {
  row: StripRow
  nodes: StripNode[]
  drawMarks: boolean
  /** `nodes` is a strict subset of `row.nodes` — the count must state both. */
  narrowed: boolean
  /** The selected row shows everything it has; see `MARK_CAP`. */
  uncapped: boolean
}

export interface ModelStripProps {
  testId?: string
  /**
   * The run's findings and drivers, indexed by the node they NAME — built once
   * by `buildNodeInsights` at the mount and passed in.
   *
   * ⚠ A PROP RATHER THAN A HOOK, AND THAT IS THE POINT. The strip has no access
   * to the view model and must not grow one: a second derivation of "what does
   * this run say about node X" is the mirror defect, and this surface already
   * carries two components that would want the same answer. Absent = the strip
   * still navigates, and every detail honestly reports that nothing on the
   * panel refers to the node.
   */
  insights?: NodeInsightIndex
  /**
   * Nothing has been analysed yet. Chooses the DEFAULT open state only — a
   * reader who toggles keeps their choice for as long as the panel is mounted.
   *
   * ⚠ IT IS READ ON EVERY RENDER, NOT CAPTURED ON MOUNT, and that is the point.
   * A reader who lands pre-run gets the strip open; when their run completes
   * the panel fills with the glance and four sections, and a strip captured as
   * "open" at mount would keep 155px of census above all of it at exactly the
   * moment the space is worth most. It closes on that transition — unless they
   * opened it themselves, which is recorded separately and wins.
   */
  isPreRun?: boolean
}

export function ModelStrip({
  testId = 'analysis-new-model-strip',
  isPreRun = false,
  insights = NO_INSIGHTS,
}: ModelStripProps) {
  const showToast = useShowToastSafe()
  /**
   * ⚠ THE BOOLEAN IS THE POINT. `focusModelTarget` is fail-CLOSED: it returns
   * `false` when the target is no longer on the canvas and moves nothing. Both
   * call sites in this file discarded it, so on a model that has moved on since
   * the run, a mark and its detail button did nothing, silently — this estate's
   * signature defect, an affordance that cannot act still advertising itself.
   *
   * Reported by the reorder lane, which hit the same class one file over and
   * declined to replicate it. Same repair as #1078 and `OptionsComparison
   * .tsx:159`: honour the return, and degrade with the sentence that already
   * exists at `strengthenCopy.ts:51` — imported, never respelled.
   */
  const focusOrSay = useCallback(
    (targetId: string) => {
      if (!focusModelTarget(targetId)) showToast(STRENGTHEN_COPY.focusFailedNotice)
    },
    [showToast],
  )
  /**
   * ⚠ SUBSCRIBED THROUGH A SIGNATURE, NOT THROUGH THE NODE ARRAY. React Flow
   * replaces `nodes` on every drag, so selecting the array itself would
   * re-render this component continuously while a user moves the canvas. The
   * signature changes only when a node is added, removed or retyped — which is
   * the only thing this component displays.
   *
   * ⚠ `?? []` IS NOT DEFENSIVE HABIT, IT IS SIZED TO THE BLAST RADIUS.
   * `AnalysisNewTabBody` is NOT wrapped in a `SectionErrorBoundary` — unlike
   * every section of `ResultsBody` — so a throw here does not degrade one
   * region, it takes the whole tab down. The store's initial `nodes` could not
   * be confirmed to be an array at every point in its lifecycle (the `[]` in
   * `store.ts` is a reset path, not an initialiser), and the cost of being
   * wrong is a blank surface rather than a missing strip.
   */
  const signature = useCanvasStore((s) =>
    (s.nodes ?? []).map((n) => `${n.id}:${n.type ?? ''}`).join('|'),
  )
  const strip = useMemo(
    () => buildModelStrip(useCanvasStore.getState().nodes ?? []),
    [signature],
  )

  /**
   * `null` until the reader touches the control, so the default can keep
   * tracking the run state. An initialiser would freeze it at mount and the
   * strip would stay open across the pre-run boundary — see `isPreRun`.
   */
  const [override, setOverride] = useState<boolean | null>(null)
  /**
   * The node whose detail is on screen, by ID.
   *
   * ⚠ AN ID, NOT THE NODE OBJECT. The strip is rebuilt whenever the canvas
   * signature moves, so a captured object would go stale against a renamed or
   * retyped node while still rendering its old label. Resolving the id against
   * the CURRENT strip on every render also makes deletion self-healing: a node
   * that is no longer there resolves to nothing and the detail closes, with no
   * effect to keep in sync.
   */
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null)
  /**
   * The two narrowings, and they are MUTUALLY EXCLUSIVE by construction.
   *
   * ⚠ NOT BECAUSE COMPOSING THEM IS HARD — because their intersection is a
   * claim. "Options, needing a check" is empty for every model by the
   * predicate's own domain, and an empty result would have to be explained
   * with a sentence that reads as a finding about the model ("no option needs
   * a check") rather than as the state of two controls. One narrowing at a
   * time has no empty state to explain, and each control is its own off
   * switch, so no third "clear" button is needed either.
   */
  const [kindFilter, setKindFilter] = useState<MarkKind | null>(null)
  const [verifyOnly, setVerifyOnly] = useState(false)
  const regionId = useId()
  const subjectId = useId()
  const detailId = useId()
  const valueInputId = useId()
  /**
   * ⚠ THE NODE ID, NOT A BOOLEAN, AND FOR THE SAME REASON `activeNodeId` IS AN
   * ID. An open editor is only open FOR one factor; a boolean would survive the
   * reader moving to another mark and offer them a field pre-filled from a
   * different factor's value. Holding the id makes the editor close itself when
   * the detail moves, is filtered away, or is deleted — no effect to keep in
   * sync, the mechanism this file already uses twice.
   */
  const [editingFor, setEditingFor] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  /**
   * ⭐ THE ONE WRITE AUTHORITY, NOT A SECOND ONE. `useModelEditAuthority` is
   * what the Model tab's factor rows dispatch through, and it owns the parts
   * that are dangerous to re-derive: the SCALE the typed number is read at
   * (from the node's own cap/unit), the optimistic local write, and the undo
   * that reverts it if the turn is refused. This surface supplies a number and
   * renders the outcome; it decides nothing.
   *
   * ⚠ CALLED UNCONDITIONALLY AND PARAMETERISED BY THE ACTIVE ID — the hook's
   * own documented contract ("pass `null` when no edit is active"). Every
   * proposal is then `not_encodable`, which is the honest answer.
   */
  const editAuthority = useModelEditAuthority(editingFor)

  // Nothing on the canvas: the panel's other surfaces already say so, and a
  // strip of empty rows would be furniture claiming to be information.
  if (strip.rows.length === 0) return null

  const open = override ?? isPreRun

  /**
   * ⚠ DERIVED, NOT READ OFF THE STATE, AND IT IS THE STRANDING GUARD. The
   * reader can confirm the last unconfirmed factor while the worklist is on;
   * the toggle then unmounts (it renders only above zero) and a `verifyOnly`
   * read straight from state would leave an empty row list with no control to
   * turn it off. Deriving it heals that with no effect to keep in sync — the
   * same rule `active` follows.
   */
  const verifyActive = verifyOnly && strip.needsCheckTotal > 0

  /** The rows as the current narrowing leaves them — see `VisibleRow`. */
  const visible: VisibleRow[] = strip.rows
    .map((row) => {
      const nodes = verifyActive ? row.nodes.filter((n) => n.needsCheck) : row.nodes
      return {
        row,
        nodes,
        drawMarks: kindFilter === null || kindFilter === row.kind,
        narrowed: nodes.length !== row.nodes.length,
        uncapped: kindFilter === row.kind,
      }
    })
    // A row the worklist empties is DROPPED rather than drawn at zero — the
    // same rule the builder applies to a kind the canvas does not carry, and
    // for the same reason: "Options 0" reads as a finding about the model.
    .filter((v) => v.nodes.length > 0)

  /**
   * Every node id the current narrowing names, in row order. This is what the
   * canvas rings, and it is derived rather than stored so it cannot drift from
   * what is on screen.
   */
  const narrowedIds = (kind: MarkKind | null, onlyVerify: boolean): string[] => {
    /**
     * ⚠ NO NARROWING IS NOT "EVERY NODE", AND THE FIRST DRAFT GOT IT WRONG.
     * With both controls off the loop below matches everything, so releasing a
     * row selection RANG THE WHOLE MODEL instead of clearing, and simply
     * pointing at a mark and leaving did the same. Two cases in this file
     * caught it. An empty narrowing names nothing; the caller clears.
     */
    if (kind === null && !onlyVerify) return []
    const out: string[] = []
    for (const row of strip.rows) {
      if (kind !== null && row.kind !== kind) continue
      for (const n of row.nodes) {
        if (onlyVerify && !n.needsCheck) continue
        out.push(n.id)
      }
    }
    return out
  }

  /**
   * What the canvas should show once a POINTER GESTURE ENDS.
   *
   * ⚠ THE MARK'S `clearHighlight` WOULD OTHERWISE ERASE THE ROW'S RING. Both
   * write one channel (see `ringNodes`), so leaving a mark inside a selected
   * row used to blank the selection the reader had just made. The gesture
   * returns the channel to the narrowing's state, not to empty.
   */
  const restoreRing = () => {
    const ids = narrowedIds(kindFilter, verifyActive)
    if (ids.length > 0) ringNodes(ids)
    else clearHighlight()
  }

  const pickKind = (kind: MarkKind) => {
    const next = kindFilter === kind ? null : kind
    setKindFilter(next)
    setVerifyOnly(false)
    const ids = narrowedIds(next, false)
    if (ids.length > 0) ringNodes(ids)
    else clearHighlight()
  }

  const toggleVerify = () => {
    const next = !verifyActive
    setVerifyOnly(next)
    setKindFilter(null)
    const ids = narrowedIds(null, next)
    if (ids.length > 0) ringNodes(ids)
    else clearHighlight()
  }

  /**
   * Resolved against the VISIBLE rows — see `activeNodeId`.
   *
   * ⚠ VISIBLE, NOT `strip.rows`, AND THAT IS THE SELF-HEALING PART. A detail
   * left open on a node the reader has just filtered away would be a panel
   * describing something no longer on screen. Resolving against what is drawn
   * closes it with no effect to keep in sync — the same mechanism that already
   * handles a deleted node.
   */
  const active:
    | {
        id: string
        label: string
        kind: MarkKind
        needsCheck: boolean
        valueText: string | null
        valueSource: string | undefined
      }
    | null = (() => {
    if (activeNodeId === null) return null
    for (const v of visible) {
      if (!v.drawMarks) continue
      const found = v.nodes.find((n) => n.id === activeNodeId)
      if (found) {
        return {
          id: found.id,
          label: found.label,
          kind: v.row.kind,
          needsCheck: found.needsCheck,
          valueText: found.valueText,
          valueSource: found.valueSource,
        }
      }
    }
    return null
  })()
  /**
   * ⚠ THE CLASSIFIER IS CALLED HERE, NOT IN THE BUILDER, AND IT MAY ANSWER
   * `null`. `classifyValueProvenance` refuses to guess at a literal it does not
   * know, and this surface renders that refusal as SILENCE rather than as a
   * fallback word. A guessed fallback is how "AI estimate" lands over a number
   * the user typed.
   */
  const activeValueProvenance = (() => {
    const cls = classifyValueProvenance(active?.valueSource)
    return cls === null ? null : VALUE_PROVENANCE_LABEL[cls.kind]
  })()
  /** Open only for the factor whose detail is on screen — see `editingFor`. */
  const isEditingActive = active !== null && editingFor === active.id

  /**
   * Send the typed value to the one write authority and SAY WHICH OF THE THREE
   * THINGS HAPPENED.
   *
   * ⚠ NOT A `useCallback`. It reads `active`, which is derived after this
   * component's early return, so a hook here would be conditional. It is used
   * only in event handlers, where the identity does not matter.
   *
   * ⚠ AND THE OUTCOME IS NEVER FLATTENED TO "SAVED". `proposeFactorValue`
   * answers `dispatched | local_only | not_encodable` precisely so a caller
   * cannot claim a server acceptance it did not observe; the three sentences
   * are three different truths. On `not_encodable` the editor STAYS OPEN —
   * nothing was written anywhere, so closing it would look like a success.
   */
  const commitValue = () => {
    const typed = draft.trim()
    const parsed = Number(typed)
    if (typed === '' || !Number.isFinite(parsed)) {
      showToast(COPY.modelStrip.valueNotEncodable)
      return
    }
    const outcome = editAuthority.proposeFactorValue(parsed)
    showToast(
      outcome === 'dispatched'
        ? COPY.modelStrip.valueDispatched
        : outcome === 'local_only'
          ? COPY.modelStrip.valueLocalOnly
          : COPY.modelStrip.valueNotEncodable,
    )
    if (outcome !== 'not_encodable') setEditingFor(null)
  }
  const activeInsight = (active && insights.get(active.id)) || EMPTY_INSIGHT
  const activeHasNothing =
    activeInsight.driverLabel === null && activeInsight.findings.length === 0

  return (
    /* ⚠ A LABELLED LANDMARK, NAMED BY ITS OWN SUBJECT. A `section` is a
       landmark and an unnamed one is an unlabelled region for anyone navigating
       by landmark — the dock's own spec pins this, and `SectionShell` follows
       the same rule. Pointing at the subject line rather than carrying a fixed
       string means the landmark is announced as the decision it is about. */
    <section
      data-testid={testId}
      aria-labelledby={subjectId}
      data-strip-open={open ? 'true' : 'false'}
    >
      {/* ⚠ THE WHOLE BLOCK IS ONE CONTROL, per `DisclosureRow`'s rule: the
          target is large and the keyboard reaches it once rather than three
          times. The census sits INSIDE it, so a screen-reader user is told what
          the model contains without having to expand anything. */}
      <button
        type="button"
        onClick={() => setOverride(!open)}
        aria-expanded={open}
        // Points at the region ONLY while it exists. A collapsed region is
        // UNMOUNTED rather than hidden, so a resting reference would dangle.
        aria-controls={open ? regionId : undefined}
        className="w-full text-left flex items-start gap-2 py-1 rounded hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-info"
        data-testid={`${testId}-toggle`}
      >
        <span className="min-w-0 flex-1">
          <span
            id={subjectId}
            // ⚠ CLAMPED TO ONE LINE WHILE CLOSED, FULL WHILE OPEN — one
            // element, not two. A second copy of the subject inside the region
            // would put the same sentence on screen twice, which is exactly
            // what the first-viewport census exists to stop.
            className={`${typography.panelBody} text-text-header block ${open ? '' : 'truncate'}`}
            data-testid={`${testId}-goal`}
            title={strip.goalLabel ?? undefined}
          >
            {strip.goalLabel ?? NO_SUBJECT_LABEL}
          </span>

          {/* ⚠ THE CENSUS, AND IT IS THE THING THE CANVAS CANNOT SAY. A reader
              can see the shapes on the canvas; they cannot count fourteen
              factors at a glance. Each tally is a mark, its kind, and its
              number — which is also the vocabulary key for the marks the
              findings below carry, with the label attached to it.

              It is replaced by the rows when open rather than shown alongside
              them: the rows carry the same label and the same number, and two
              copies of one tally is the restatement this panel keeps paying
              for. */}
          {open ? null : (
            <span
              className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1"
              data-testid={`${testId}-tallies`}
            >
              {strip.rows.map((row) => (
                <span
                  key={row.kind}
                  className="flex items-center gap-1"
                  data-testid={`${testId}-tally`}
                  data-kind={row.kind}
                >
                  <NodeMark kind={row.kind} />
                  <span className={`${typography.panelMeta} text-text-light`}>{row.label}</span>
                  <span className={`${typography.panelMeta} text-text-light tabular-nums`}>
                    {row.nodes.length}
                  </span>
                </span>
              ))}
              {/* ⭐ THE CLOSED LINE ADVERTISES THE WORKLIST, and it is a SPAN
                  rather than a second control on purpose: the header is one
                  button (see below) and a button cannot be nested inside one.
                  Reading it and pressing it are the same gesture — the press
                  opens the strip, where the toggle it names is waiting. Absent
                  at zero, like every other tally here. */}
              {strip.needsCheckTotal > 0 ? (
                <span
                  className={`${typography.panelMeta} text-warning`}
                  data-testid={`${testId}-verify-summary`}
                >
                  {COPY.modelStrip.toVerify(strip.needsCheckTotal)}
                </span>
              ) : null}
            </span>
          )}
        </span>

        {open ? (
          <ChevronDown className="w-4 h-4 shrink-0 mt-0.5 text-text-light" aria-hidden={true} />
        ) : (
          <ChevronRight className="w-4 h-4 shrink-0 mt-0.5 text-text-light" aria-hidden={true} />
        )}
      </button>

      {/* ── THE MARKS, one per node, each a route to that node on canvas ─────
          Unchanged from the always-visible version, including the cap: this is
          the navigation layer, and moving it behind a disclosure is the only
          thing that happened to it. */}
      {open ? (
        <div id={regionId} data-testid={`${testId}-region`} className="pb-1">
        {/* ── THE WORKLIST TOGGLE ─────────────────────────────────────────
            Rendered only when it has something to show. `ModelTabV2Panel`
            applies the same rule to the same number, and its reason is this
            file's own: a control that cannot change anything is furniture
            wearing an affordance. */}
        {strip.needsCheckTotal > 0 ? (
          <button
            type="button"
            onClick={toggleVerify}
            aria-pressed={verifyActive}
            /* CONTAINS the visible text, so the control keeps label-in-name.
               "3 to verify" alone announces a count and not what pressing it
               does. */
            aria-label={COPY.modelStrip.toVerifyToggleName(strip.needsCheckTotal)}
            className={`${typography.panelMeta} inline-flex items-center gap-1 rounded-full px-2 py-0.5 mb-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-info ${
              verifyActive ? 'bg-warning text-text-on-color' : 'bg-warning/10 text-warning hover:bg-warning/20'
            }`}
            data-testid={`${testId}-verify-toggle`}
          >
            <ListChecks className="w-3 h-3" aria-hidden={true} />
            {COPY.modelStrip.toVerify(strip.needsCheckTotal)}
          </button>
        ) : null}

        {/* ⚠ THE CRITERION, VISIBLE AND ONLY WHILE IT APPLIES. "3 to verify"
            does not say what qualified them, and a `title` would put that
            explanation out of reach of touch entirely. */}
        {verifyActive ? (
          <p
            className={`${typography.panelMeta} text-text-light m-0 mb-1`}
            data-testid={`${testId}-narrowed-note`}
          >
            {COPY.modelStrip.toVerifyNarrowed}
          </p>
        ) : null}

        <ul className="list-none p-0 m-0 flex flex-col gap-1">
          {visible.map(({ row, nodes, drawMarks, narrowed, uncapped }) => (
            <li
              key={row.kind}
              className="grid grid-cols-[76px_1fr_auto] items-center gap-2"
              data-testid={`${testId}-row`}
              data-kind={row.kind}
              data-selected={kindFilter === row.kind ? 'true' : undefined}
            >
              {/* ⭐ THE ROW IS A CONTROL. It rings its kind on the canvas and
                  lifts this row's mark cap — the second half is the part the
                  reader cannot get any other way, and it is why the row does
                  more than hide its neighbours. The mark travels with the
                  label so the open state carries the same vocabulary key the
                  closed tallies do. */}
              <button
                type="button"
                onClick={() => pickKind(row.kind)}
                aria-pressed={kindFilter === row.kind}
                aria-label={COPY.modelStrip.onlyKind(row.label)}
                className={`flex items-center gap-1 rounded px-1 py-0.5 min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-info ${
                  kindFilter === row.kind ? 'bg-panel-hover' : 'hover:bg-panel-hover'
                }`}
                data-testid={`${testId}-row-filter`}
                data-kind={row.kind}
              >
                <NodeMark kind={row.kind} />
                <span className={`${typography.panelMeta} text-text-light truncate`}>
                  {row.label}
                </span>
              </button>

              {(() => {
                /**
                 * ⚠⚠ AN EARLIER DRAFT PUT A FULL-WIDTH BAR HERE AND THAT WAS A
                 * CLAIM I CANNOT MAKE. A bar reads as a proportion — of what?
                 * The only proportion worth showing is "how much of this have
                 * you reviewed", and that needs the provenance this strip
                 * explicitly does not have. A bar filled to 100% because there
                 * is nothing to fill it against says "complete" about a model
                 * nobody has checked. That is the advertisement-not-affordance
                 * defect, in the component built to avoid it.
                 *
                 * Over the cap the row therefore shows the first `MARK_CAP`
                 * nodes as real click targets and states plainly how many it is
                 * not showing. Nothing is implied about the remainder except
                 * that it exists, which is the only thing known.
                 */
                /* ⚠ THE CAP IS RECOMPUTED AGAINST WHAT IS ON SCREEN, never
                   read off `row.overCap`, which describes the unfiltered row.
                   A withheld count taken from the wrong denominator is a
                   number about a list the reader is not looking at. Selecting
                   the row lifts it entirely: nothing is then withheld, so
                   there is nothing to disclose. */
                const shown =
                  !drawMarks ? [] : uncapped || nodes.length <= MARK_CAP ? nodes : nodes.slice(0, MARK_CAP)
                const hidden = drawMarks ? nodes.length - shown.length : 0
                return (
                  <span
                    className="flex flex-wrap items-center gap-1"
                    data-testid={`${testId}-marks`}
                  >
                    {shown.map((node) => {
                      const isActive = active?.id === node.id
                      return (
                      <button
                        key={node.id}
                        type="button"
                        /* Activation keeps doing what it always did — this is
                           the affordance the disclosure was moved to preserve —
                           and additionally pins the detail, which is the only
                           route a touch device has to it. */
                        onClick={() => {
                          setActiveNodeId(node.id)
                          focusOrSay(node.id)
                        }}
                        /* ⭐ AND THE GRAPH ANSWERS. `highlightNode` is the
                           results-panel → canvas channel the compare tab
                           already uses this way, and `BaseNode` renders it as a
                           ring on the node itself — so pointing at a mark shows
                           the reader WHICH shape on the canvas it is, before
                           they commit to moving the camera.

                           ⚠ TRANSIENT, AND THE ASYMMETRY WITH THE DETAIL IS
                           DELIBERATE. The detail is a thing you READ and so it
                           persists; the ring is a POINTER and belongs to the
                           gesture. A highlight left behind by a pointer that
                           has moved on would also sit on a shared channel that
                           the applied-edit pulse and the AI's own directives
                           write to. */
                        onMouseEnter={() => {
                          setActiveNodeId(node.id)
                          highlightNode(node.id)
                        }}
                        onMouseLeave={restoreRing}
                        /* Keyboard parity. Tabbing across the row reads each
                           node's detail in turn and rings each node in turn,
                           without committing a canvas move the reader did not
                           ask for. */
                        onFocus={() => {
                          setActiveNodeId(node.id)
                          highlightNode(node.id)
                        }}
                        onBlur={restoreRing}
                        aria-expanded={isActive}
                        /* Points at the detail ONLY while this mark owns it —
                           the detail is unmounted otherwise, so a resting
                           reference on every mark would dangle on all but one. */
                        aria-controls={isActive ? detailId : undefined}
                        className={`rounded hover:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-info ${
                          isActive ? 'ring-2 ring-info' : ''
                        }`}
                        data-testid={`${testId}-mark`}
                        data-node-id={node.id}
                        data-active={isActive ? 'true' : undefined}
                        title={node.label || undefined}
                      >
                        <NodeMark kind={row.kind} />
                        <span className="sr-only">
                          {node.label
                            ? `Show ${node.label} on the canvas`
                            : `Show this ${row.kind} on the canvas`}
                        </span>
                      </button>
                      )
                    })}
                    {hidden > 0 ? (
                      <span
                        className={`${typography.panelMeta} text-text-light`}
                        data-testid={`${testId}-overflow`}
                      >
                        {`+${hidden} not shown`}
                      </span>
                    ) : null}
                  </span>
                )
              })()}

              {/* ⚠ TWO NUMBERS WHENEVER THE WORKLIST NARROWED THIS ROW. The
                  narrowed count alone would read as the row's size and
                  silently shrink the model. */}
              <span
                className={`${typography.panelMeta} text-text-light tabular-nums`}
                data-testid={`${testId}-row-count`}
                data-kind={row.kind}
              >
                {narrowed
                  ? COPY.modelStrip.narrowedCount(nodes.length, row.nodes.length)
                  : row.nodes.length}
              </span>
            </li>
          ))}
        </ul>

        {/* ── WHAT THIS RUN SAYS ABOUT THE PICKED NODE ────────────────────
            One slot, replaced rather than accumulated: a stack of open details
            in a 280px column is the density this panel was cut down from.

            ⚠ EVERY SENTENCE BELOW IS THE ENGINE'S OR THE CATALOGUE'S. The only
            strings this component contributes are the affordance line, the
            absence line and the cap disclosure — furniture and honesty, never a
            statement about the model. */}
        {active === null ? (
          <p
            className={`${typography.panelMeta} text-text-light mt-1 mb-0`}
            data-testid={`${testId}-hint`}
          >
            {COPY.modelStrip.hint}
          </p>
        ) : (
          <div
            id={detailId}
            /* `min-w-0` on the flex children and wrapping on every producer
               string: at the 280px floor a long factor name or an engine
               sentence with no spaces must wrap inside this box rather than
               widen the panel. */
            className="mt-1 rounded bg-panel-hover p-2 space-y-1 min-w-0"
            data-testid={`${testId}-detail`}
            data-node-id={active.id}
          >
            <p
              className={`${typography.panelBody} text-text-header m-0 flex items-start gap-1 min-w-0`}
              data-testid={`${testId}-detail-title`}
            >
              <NodeMark kind={active.kind} className="w-3 h-3 mt-0.5" />
              {/* No label recorded is not an error and not a blank: the kind
                  noun is the only true name available, and it is the same
                  substitution the mark's own accessible name makes. */}
              <span className="min-w-0 break-words">
                {active.label || COPY.modelStrip.kindNoun[active.kind]}
              </span>
            </p>

            <div className="flex flex-wrap items-center gap-1">
              <span
                className={`${typography.panelMeta} text-text-light`}
                data-testid={`${testId}-detail-kind`}
              >
                {COPY.modelStrip.kindNoun[active.kind]}
              </span>
              {/* ⚠ PRESENCE ONLY, AND THE ASYMMETRY IS DELIBERATE. The glance's
                  driver list is capped, so membership licenses "the glance named
                  this among what matters most" and non-membership licenses
                  nothing — which is why no chip renders for its absence. The
                  magnitude is deliberately not repeated here: a bar or a
                  percentage is only readable beside the basis caption the glance
                  carries, and duplicating that caption into every node's detail
                  would restate a claim this panel already makes once. */}
              {activeInsight.driverLabel !== null ? (
                <span
                  className={`${typography.panelMeta} inline-flex items-center rounded-full bg-info/10 px-2 py-0.5 text-info`}
                  data-testid={`${testId}-detail-driver`}
                >
                  {COPY.glance.whatMattersMost}
                </span>
              ) : null}
              {/* ⭐ THE ONE FACT ON THIS DETAIL THE MARK CANNOT ALREADY SHOW.
                  The sentence is `domain/vocabulary`'s, shared with the Model
                  tab's own row marker rather than respelled here — two
                  spellings of one state is the mirror this estate pays for
                  (CLAUDE.md trap 12), and it would put the two surfaces in
                  disagreement about one factor.

                  ⚠ IT LIVES IN `domain/` AND NOT IN `model-tab-v2/`, WHERE IT
                  WAS AUTHORED, BECAUSE THAT DIRECTORY IS SEALED. Its boundary
                  guard permits exactly one outside reference — its named mount
                  host — since a second reference is a second mount path. The
                  first draft of this component imported straight through that
                  door and the guard caught it, which is what it is for. */}
              {active.needsCheck ? (
                <span
                  className={`${typography.panelMeta} inline-flex items-center rounded-full bg-warning/10 px-2 py-0.5 text-warning`}
                  data-testid={`${testId}-detail-verify`}
                >
                  {UNCONFIRMED_ESTIMATE_LABEL}
                </span>
              ) : null}
            </div>

            {/* ⭐ THE DETAIL'S OWN ACTION. Activating the mark routes to the
                canvas and always has; this is the same route offered where the
                reader is actually looking, and it is the ONLY one a touch
                reader has twice — their first tap is what opened the detail,
                so without this there is no way to ask again without closing
                it. Named in text, not in a `title`: a tooltip is unreachable
                on touch and suppressed by many browsers. */}
            <button
              type="button"
              onClick={() => focusOrSay(active.id)}
              className={`${typography.panelMeta} inline-flex items-center gap-1 rounded-full bg-info/10 px-2 py-0.5 text-info hover:bg-info/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
              data-testid={`${testId}-detail-focus`}
              data-node-id={active.id}
            >
              <Crosshair className="w-3 h-3" aria-hidden={true} />
              {COPY.modelStrip.showOnCanvas}
            </button>

            {/* ⭐⭐ THE DATA BEHIND THIS FACTOR, AND WHOSE IT IS.
                The detail could name a factor and say nothing about the number
                the run was computed from — the one thing a reader clicking a
                factor is asking for. Three statements, each bound to a datum
                that already exists and each with its own honest empty state:
                the value as the canvas renders it (or that there is none),
                whose it is (or silence), and a way to change it.

                ⚠ FACTORS ONLY. `valueText` and `valueSource` are populated for
                factors alone — see their fields in `buildModelStrip.ts` — and
                a row rendering "No value set" over an option would assert
                something false about a node that has no observed value to
                carry. */}
            {active.kind === 'factor' ? (
              <div className="space-y-1 min-w-0" data-testid={`${testId}-detail-value`}>
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 min-w-0">
                  <span className={`${typography.panelMeta} text-text-light`}>
                    {COPY.modelStrip.valueLabel}
                  </span>
                  <span
                    className={`${typography.panelBody} text-text-header break-words min-w-0`}
                    data-testid={`${testId}-detail-value-text`}
                    /* The two states are distinguishable by an assertion, not
                       only by reading the copy — a test that matched on the
                       sentence would pass on a reworded no-value string. */
                    data-has-value={active.valueText !== null}
                  >
                    {active.valueText ?? COPY.modelStrip.noValue}
                  </span>
                  {activeValueProvenance !== null ? (
                    <span
                      className={`${typography.panelMeta} text-text-light`}
                      data-testid={`${testId}-detail-value-source`}
                    >
                      {activeValueProvenance}
                    </span>
                  ) : null}
                </div>

                {isEditingActive ? (
                  <div className="flex flex-wrap items-center gap-1 min-w-0">
                    <label className="sr-only" htmlFor={valueInputId}>
                      {COPY.modelStrip.valueInputLabel(
                        active.label || COPY.modelStrip.kindNoun[active.kind],
                      )}
                    </label>
                    <input
                      id={valueInputId}
                      type="number"
                      inputMode="decimal"
                      value={draft}
                      autoFocus={true}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          commitValue()
                        } else if (e.key === 'Escape') {
                          e.preventDefault()
                          setEditingFor(null)
                        }
                      }}
                      className={`${typography.panelBody} w-24 min-w-0 rounded border border-panel-border bg-panel px-2 py-0.5 text-text-header focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
                      data-testid={`${testId}-detail-value-input`}
                    />
                    <button
                      type="button"
                      onClick={commitValue}
                      className={`${typography.panelMeta} inline-flex items-center rounded-full bg-info/10 px-2 py-0.5 text-info hover:bg-info/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
                      data-testid={`${testId}-detail-value-save`}
                    >
                      {COPY.modelStrip.saveValue}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingFor(null)}
                      className={`${typography.panelMeta} inline-flex items-center rounded-full px-2 py-0.5 text-text-light hover:text-text-header focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
                      data-testid={`${testId}-detail-value-cancel`}
                    >
                      {COPY.modelStrip.cancelValue}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      /* ⚠ THE FIELD OPENS EMPTY, NEVER PRE-FILLED FROM
                         `valueText`. That string is a DISPLAY rendering — it can
                         carry a currency symbol, a percent sign, thousands
                         separators or a qualitative tier word — and seeding a
                         numeric input with it would either be silently dropped
                         by the browser or, worse, parse to a different number
                         than the one shown. The reader states the value they
                         mean. */
                      setDraft('')
                      setEditingFor(active.id)
                    }}
                    className={`${typography.panelMeta} inline-flex items-center gap-1 rounded-full bg-info/10 px-2 py-0.5 text-info hover:bg-info/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
                    data-testid={`${testId}-detail-value-edit`}
                    data-node-id={active.id}
                  >
                    <Pencil className="w-3 h-3" aria-hidden={true} />
                    {COPY.modelStrip.changeValue}
                  </button>
                )}
              </div>
            ) : null}

            {activeInsight.findings.map((finding) => {
              // Hoisted so the narrowing survives into the handler below; a
              // property check does not narrow inside a closure.
              const method = finding.method
              return (
              <div
                key={finding.recommendationId}
                className="space-y-1 min-w-0"
                data-testid={`${testId}-detail-finding`}
                data-recommendation-id={finding.recommendationId}
              >
                <p
                  className={`${typography.panelBody} text-text-header m-0 break-words`}
                  data-testid={`${testId}-detail-finding-title`}
                >
                  {finding.title}
                </p>
                {/* The lead-in is the Strengthen panel's own, imported rather
                    than respelled, and the emphasis is carried semantically —
                    the panel scale defines its own weights and a raw utility
                    here would be a design-system violation as well as a second
                    spelling of one label.

                    ⚠ AND THE WHOLE LINE GOES when the finding names no
                    instruction. This detail is the DENSEST place the phrase
                    appears — one node can carry several findings — so a
                    placeholder here stacks. Same rule as the panel: see
                    `Recommendation.tryThis`. */}
                {finding.tryThis !== null ? (
                  <p className={`${typography.panelBody} text-text-body m-0 break-words`}>
                    <strong>{STRENGTHEN_COPY.tryThisLead}</strong> {finding.tryThis}
                  </p>
                ) : null}
                {/* ⭐ THE TECHNIQUE, ON THE NODE THAT WARRANTED IT — the same
                    control `StrengthenTheReasoning` renders, reached from the
                    model rather than from a list. `null` for most findings by
                    design (`recommendationMethod.ts`): no placeholder, no
                    default technique. Identity rides the dispatch so CEE learns
                    which technique was invoked. */}
                {method ? (
                  <button
                    type="button"
                    onClick={() =>
                      openAskOlumi({
                        context: finding.context,
                        draft: method.prompt,
                        label: method.title,
                        parameters: { method_id: method.id },
                        source: 'chip',
                        targetId: active.id,
                      })
                    }
                    className={`${typography.panelMeta} inline-flex items-center gap-1 rounded-full bg-info/10 px-2 py-0.5 text-info hover:bg-info/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
                    data-testid={`${testId}-detail-method`}
                    data-method-id={method.id}
                    title={method.description}
                  >
                    <Lightbulb className="w-3 h-3" aria-hidden={true} />
                    {method.title}
                    {/* A browser renders `title` on pointer hover only, so the
                        science content would otherwise be withheld from anyone
                        navigating by keyboard. */}
                    <span className="sr-only">{method.description}</span>
                  </button>
                ) : null}
              </div>
              )
            })}

            {activeInsight.withheldFindings > 0 ? (
              <p
                className={`${typography.panelMeta} text-text-light m-0`}
                data-testid={`${testId}-detail-more`}
              >
                {COPY.modelStrip.moreFindings(activeInsight.withheldFindings)}
              </p>
            ) : null}

            {/* ⚠ THE ABSENCE IS THE RESULT, AND IT IS RENDERED. Silence here
                would be indistinguishable from a broken control, and a
                reassurance would be a claim nothing measured. */}
            {activeHasNothing ? (
              <p
                className={`${typography.panelMeta} text-text-light m-0`}
                data-testid={`${testId}-detail-empty`}
              >
                {COPY.modelStrip.noInsight}
              </p>
            ) : null}
          </div>
        )}
        </div>
      ) : null}
    </section>
  )
}
