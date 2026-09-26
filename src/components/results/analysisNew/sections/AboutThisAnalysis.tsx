/**
 * About this analysis — ONE collapsed audit utility at the foot of the
 * Reasoning tab (Reasoning V2, 24 Sep 2026).
 *
 * The audit answer used to be spread across five surfaces: `TrustLine` (verdict
 * word + counts + a link), `WhatWeChecked` (three check chips), the "How this
 * was worked out" group, `DeeperAnalysis` (run receipts, doubly closed inside
 * "What moves the outcome") and the stale ribbon's reason. This states it once,
 * as short status rows, and keeps the receipts one click further down.
 *
 * ⛔ IT COMPUTES NOTHING. Every value below is a VIEW-MODEL field read as the
 * builder left it (`vm.status`, `vm.checks`, `vm.atAGlance.verdict`,
 * `vm.optionsComparison`, `vm.uncertainty`, `vm.deeper`), plus what the tab
 * body holds beside it (`outcomeFormat`, read off
 * `resultsSectionData.recommendation`; the review tool's own queue inputs).
 * The only arithmetic is COUNTING rows the view model or the review queue
 * already emitted.
 *
 * ⛔ WHAT IT DELIBERATELY DOES NOT ABSORB, and why:
 *   · `RobustnessCaveat` — the producer's sentence naming a condition under
 *     which the ordering could change. That is a caveat the reader must carry
 *     INTO the reading; behind a closed chevron at the foot of the panel it
 *     would arrive after the reading it qualifies. It stays beside the
 *     comparison.
 *   · `ModelHeldUp` — the panel's terminal state, stated with its limit "in the
 *     same breath as the good news". It qualifies the reading too, and it reads
 *     `useRobustnessCaveatOnScreen` so it must stay paired with the caveat.
 *
 * ⭐ V2 FIDELITY GAP 24 (24 Sep 2026): THE TAIL FOLDS IN HERE. The "If you want
 * to go further" zone and its two group shells ("Coaching and method", "How
 * this was worked out") are gone; the prototype ends commitment → About. What
 * they held — bias grounding, key insights, the input register
 * (`WhatIWasGivenSection`) and "Uncertainty and gaps" — arrives as `folded`,
 * mounted by the body UNCHANGED (same components, same gates, same testids,
 * same acts) at the end of this region. The reach is the same: one toggle
 * (About) where there used to be one toggle (the group). This component does
 * not know what the folded blocks are; it only places them.
 *
 * ⚠ PRE-RUN IT RENDERS NO ROWS. Every row is a statement about a run; the tab
 * already says "No analysis has run yet for this model" once, and a Freshness
 * row reading "Not run" would say it a second time. It renders NOTHING AT ALL
 * pre-run unless `foldedHasContent` says a folded block will render — the input
 * register renders pre-run by design (it is about the brief, not the run), and
 * folding it in here must not delete the one section a reader has before any
 * analysis exists.
 *
 * ⭐ V2 DESIGN PASS (26 Sep 2026) — THE PROTOTYPE'S `aboutHTML()`, ELEMENT BY
 * ELEMENT (`Olumi_Reasoning_Prototype_V2.html`, audit B11):
 *   · FIVE status rows, each with its own ✦ — Freshness (clock), Compared
 *     (chart), Evidence (link), Review topics (search, "N open"), Robustness
 *     (info). "Most likely option", "Your inputs and Olumi's" and "Method" are
 *     gone: the first repeated the commitment block's withheld sentence, the
 *     second the folded input register, and the third printed "Seed null".
 *     Simulations and seed remain as Run record rows (the builder's own).
 *   · Disclosures named "Inspect values and units" / "Sources and limits" /
 *     "Run record", chevron at the right.
 *   · Values are a TABLE (Option · P10 · P50 · P90). P50, not the prototype's
 *     "Mean": the view model carries the median. No share column — the
 *     prototype has none.
 *   · Sources and limits are one bullet list. The engine's caveats are bullets
 *     too (no amber strip), and the gaps the analysis worked around moved here
 *     from the Run record, so no producer CODE is text anywhere in this region.
 *   · Run record is one label/value list of the builder's non-statement rows.
 *   NOT RENDERED, because nothing honest feeds them (never invented here): the
 *   lineage "Question → Model N → run" (no model revision exists), "Inspect
 *   beliefs and source notes" (the review tool has no open request), "Export
 *   review record" (no export exists), a unit caption on the values (units are
 *   paused pending the producer ruling).
 *
 * @panel-act-opt-out full-width disclosure toggles; a tier is an inline control and would shrink each row to its text width
 */
import { useId, useState } from 'react'
import type { ComponentType, ReactNode } from 'react'
import {
  BarChart3,
  ChevronDown,
  ChevronRight,
  Clock,
  Info,
  Link as LinkIcon,
  Search,
} from 'lucide-react'

import { typography } from '../../../../styles/typography'
import { SCIENCE_LIMITATIONS_DISCLOSURE } from '../../analysisMethodCopy'
import { formatThreshold } from '../../RangeVisualization'

/** ONE definition of a normalised model score for the tab (`modelScore.ts`); re-exported for this file's spec. */
import { formatModelScore } from '../modelScore'
export { formatModelScore }
import type { OutcomeUnitType } from '../../types'
import { NOT_ANALYSED_BADGE, NOT_COMPUTED_BADGE } from '../../utils/notAnalysedCopy'
import {
  humaniseInferenceWarningTitle,
  selectRestingStripEntries,
} from '../../utils/humaniseInferenceWarning'
import { selectRenderableCritiqueEntries } from '../../CritiqueWarningStrip'
import { ANALYSIS_NEW_COPY as COPY, formatConjunctionList } from '../analysisNewCopy'
import type {
  AnalysisNewViewModel,
  ChecksCode,
  ChecksItem,
  ComparisonOption,
  InspectRow,
} from '../analysisNewTypes'
import { FactorValueControl } from '../FactorValueControl'
import { PanelIconButton } from '../PanelIconButton'
import { ACTION_FOCUS, icon, PANEL_RULE } from '../panelSurfaces'
import { useReviewTopicCount } from '../useReviewTopicCount'
import type { ReviewTopicSource } from '../useReviewTopicCount'

// ─────────────────────────────────────────────────────────────────────────────
// Copy. Furniture and short status values only; every claim-bearing sentence
// below is read from `ANALYSIS_NEW_COPY` or the view model.
// ─────────────────────────────────────────────────────────────────────────────

export const ABOUT_COPY = {
  title: 'About this analysis',
  /** The prototype's own name for the header act. */
  ask: 'Ask Olumi about this analysis and its limitations',
  askDraft: 'What are the limits of this analysis?',
  /** The prototype's five rows, in its order. */
  rows: {
    freshness: 'Freshness',
    compared: 'Compared',
    evidence: 'Evidence',
    review: 'Review topics',
    robustness: 'Robustness',
  },
  /** Each row's own ✦ — the prototype's `Discuss <label> with Olumi`. */
  rowAsk: (label: string): string => `Discuss ${label.toLowerCase()} with Olumi`,
  rowAskDraft: (label: string): string => `Help me understand the ${label.toLowerCase()} of this analysis.`,
  /**
   * ⚠ "No change detected", NOT "Current". `isStale === false` is
   * `displayedFreshness` being neither `'stale'` nor `'unknown'`
   * (`OutputsDock.tsx`'s `analysisNotConfirmedFresh`), and that covers
   * `'fresh'` AND `'none'`/`null` — a run with no freshness verdict at all. The
   * view model cannot tell those apart, so the only sentence true of both is
   * the weaker one.
   */
  freshness: {
    changed: 'Model changed',
    unconfirmed: 'Cannot confirm',
    noChangeDetected: 'No change detected',
  },
  compared: (analysed: number, total: number): string =>
    `${analysed} of ${total} ${total === 1 ? 'option' : 'options'}`,
  evidence: {
    evidence_not_assessed: (): string => 'Not assessed',
    evidence_none_flagged: (): string => 'Assessed, no gaps flagged',
    evidence_gaps: (n: number): string => `Assessed, ${n} ${n === 1 ? 'gap' : 'gaps'} found`,
    evidence_all_addressed: (n: number): string =>
      `Assessed, ${n} ${n === 1 ? 'gap' : 'gaps'} found, all addressed`,
  },
  /** The review tool's queue length — the prototype's "N open". */
  reviewOpen: (n: number): string => `${n} open`,
  /** Everything that is not the view model's gated word. */
  robustnessNotEstablished: 'Not established',
  details: {
    values: 'Inspect values and units',
    limitations: 'Sources and limits',
    record: 'Run record',
  },
  values: {
    option: 'Option',
    /** ⚠ P50, not the prototype's "Mean": `outcomeRange` carries the median. */
    low: 'P10',
    mid: 'P50',
    high: 'P90',
    notReturned: 'Not returned',
    /** `DecisionResultData.isNormalised`: the UI must not present these as the user's units. */
    normalised: 'Relative scores in this model, not in your units.',
    question: 'How should these ranges be interpreted?',
    questionAsk: 'Ask about these ranges and their limits',
  },
} as const

/**
 * ⚠ THE BUILDER'S OWN ID FOR AN EVIDENCE-GAP FINDING (`evidenceGapFinding` in
 * `buildAnalysisNewViewModel.ts`: `id: \`gap:${g.factorId}\``). `uncertainty.findings`
 * also carries value-of-information, assumed-strength and ledger rows, so its
 * length is NOT the gap count — `TrustLine` calls that number "open questions"
 * for exactly this reason. The spec pins this prefix against the fixture's own
 * `confidence.evidenceGaps.length`, so a rename in the builder REDs there.
 */
const EVIDENCE_GAP_ID_PREFIX = 'gap:'

// ─────────────────────────────────────────────────────────────────────────────

/** What the body hands `openAskOlumi` — the three fields `AskOlumiPayload` requires, nothing invented. */
export interface AboutAskPayload {
  context: string
  draft: string
  label: string
}

/** The run's outcome unit, exactly as `ModelImplication`'s readout formats it. */
export interface AboutOutcomeFormat {
  unit: OutcomeUnitType | undefined
  symbol: string | undefined
  isNormalised: boolean | undefined
}

export interface AboutThisAnalysisProps {
  vm: AnalysisNewViewModel
  /**
   * ⚠ REQUIRED, NEVER DEFAULTED. `outcomeRange` carries bare numbers; printed
   * without the run's unit they read as the user's own scale, which is the
   * claim `OptionsComparison` refuses to make. The body reads it off
   * `resultsSectionData.recommendation` (`outcomeUnit`, `outcomeUnitSymbol`,
   * `isNormalised`) — the three arguments the builder's own outcome readout
   * passes `formatThreshold`.
   */
  outcomeFormat: AboutOutcomeFormat
  /**
   * The inputs the body hands `ModelReviewTool`, so "Review topics N open"
   * counts THAT queue. Absent ⇒ no Review topics row.
   */
  reviewTopics?: ReviewTopicSource
  /**
   * The value control on a gap the analysis worked around.
   * Default `false`, as on `DeeperAnalysis`: a surface must opt in to a writer.
   */
  offerFactorValueControl?: boolean
  /** Absent ⇒ no AI act is drawn. Never a control that does nothing. */
  onAsk?: (payload: AboutAskPayload) => void
  /**
   * V2 gap 24: the blocks the deleted "If you want to go further" tail held,
   * mounted by the body as they were. Rendered last in the open region.
   */
  folded?: ReactNode
  /**
   * ⚠ THE BODY'S OWN GATE for "will any folded block render" — never re-derived
   * here. It decides ONLY whether About renders pre-run; post-run About renders
   * regardless. False (the default) keeps the old rule: nothing pre-run.
   */
  foldedHasContent?: boolean
  testId?: string
}

type RowKey = keyof typeof ABOUT_COPY.rows
type GlyphProps = { className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }

interface StatusRow {
  key: RowKey
  Icon: ComponentType<GlyphProps>
  value: string
  /** Supporting lines under the row — each one the view model's or the copy deck's. */
  detail: string[]
}

type DetailKey = keyof typeof ABOUT_COPY.details

const checkCode = (vm: AnalysisNewViewModel, id: 'robustness' | 'evidence'): ChecksCode | null =>
  vm.checks.items.find((i) => i.id === id)?.code ?? null

function freshnessValue(vm: AnalysisNewViewModel): string {
  if (!vm.status.isStale) return ABOUT_COPY.freshness.noChangeDetected
  // Fail-closed: only the authority's own 'changed' licenses the stronger claim.
  return vm.status.staleKind === 'changed'
    ? ABOUT_COPY.freshness.changed
    : ABOUT_COPY.freshness.unconfirmed
}

function comparedRow(vm: AnalysisNewViewModel): StatusRow | null {
  const { rows, totalCount } = vm.optionsComparison
  if (totalCount === 0) return null
  const named = (kind: ComparisonOption['kind']) => rows.filter((r) => r.kind === kind).map((r) => r.label)
  const notAnalysed = named('not_analysed')
  const notComputed = named('not_computed')
  const unnamed = totalCount - rows.length
  const detail: string[] = []
  if (notAnalysed.length > 0) detail.push(`${NOT_ANALYSED_BADGE}: ${formatConjunctionList(notAnalysed)}`)
  if (notComputed.length > 0) detail.push(`${NOT_COMPUTED_BADGE}: ${formatConjunctionList(notComputed)}`)
  if (unnamed > 0) detail.push(COPY.disclosure.unnamedOptions(unnamed))
  return {
    key: 'compared',
    Icon: BarChart3,
    value: ABOUT_COPY.compared(named('analysed').length, totalCount),
    detail,
  }
}

function evidenceRow(vm: AnalysisNewViewModel): StatusRow | null {
  const code = checkCode(vm, 'evidence')
  if (code === null) return null
  const gaps = vm.uncertainty.findings.filter((f) => f.id.startsWith(EVIDENCE_GAP_ID_PREFIX)).length
  const value =
    code === 'evidence_gaps'
      ? ABOUT_COPY.evidence.evidence_gaps(gaps)
      : code === 'evidence_all_addressed'
        ? ABOUT_COPY.evidence.evidence_all_addressed(gaps)
        : code === 'evidence_none_flagged'
          ? ABOUT_COPY.evidence.evidence_none_flagged()
          : ABOUT_COPY.evidence.evidence_not_assessed()
  return { key: 'evidence', Icon: LinkIcon, value, detail: [] }
}

function reviewRow(count: number | null): StatusRow | null {
  if (count === null) return null
  return { key: 'review', Icon: Search, value: ABOUT_COPY.reviewOpen(count), detail: [] }
}

/** One status row as the text its AI act hands on: the label, the value, its lines. */
const rowContext = (r: StatusRow): string[] => [`${ABOUT_COPY.rows[r.key]}: ${r.value}`, ...r.detail]

/**
 * A bullet in "Sources and limits". `code` is the producer's, kept as a DATA
 * ATTRIBUTE ONLY — never text, never screen-reader text (the audit's
 * "EDGE_E_VALUE_NON_FINITE_DROPPED" was an `sr-only` term the DOM still read).
 */
interface LimitBullet {
  key: string
  text: string
  /** The producer's remediation, when it sent one — a second, quieter line. */
  note?: string
  gapCode?: string
  /**
   * The strip's own identity attributes, on the entry the strip selects
   * (`selectRestingStripEntries`) — so a reader bound to `data-warning-code`
   * finds the same object it found in the strip, and a held-back sibling does
   * not carry them.
   */
  warningCode?: string
  warningSeverity?: string
  critiqueCode?: string
  nodeId?: string
  testId: string
}

export function AboutThisAnalysis({
  vm,
  outcomeFormat,
  reviewTopics,
  offerFactorValueControl = false,
  onAsk,
  folded = null,
  foldedHasContent = false,
  testId = 'analysis-new-about',
}: AboutThisAnalysisProps) {
  const [open, setOpen] = useState(false)
  /*
   * Each detail row opens on its own. It was one-at-a-time, which hid a row the
   * reader had just opened whenever they opened the next, and made "open every
   * section" impossible (the shared spec helper looped on it).
   */
  const [detailOpen, setDetailOpen] = useState<ReadonlySet<DetailKey>>(() => new Set())
  const regionId = useId()
  // Hooks before the pre-run return, as hooks must be.
  const reviewCount = useReviewTopicCount(reviewTopics)

  const preRun = vm.status.isPreRun
  if (preRun && !foldedHasContent) return null

  // Pre-run: no row and no detail — each is a statement about a run.
  const rows: StatusRow[] = preRun ? [] : [
    { key: 'freshness', Icon: Clock, value: freshnessValue(vm), detail: [] },
    comparedRow(vm),
    evidenceRow(vm),
    reviewRow(reviewCount),
    {
      key: 'robustness',
      Icon: Info,
      // ⛔ ONLY the view model's gated word (`VERDICT_WORD` under
      // `mayStateStability`, #1206). No word ⇒ not established, never a guess.
      value: vm.atAGlance.verdict?.label ?? ABOUT_COPY.robustnessNotEstablished,
      detail: [],
    } satisfies StatusRow,
  ].filter((r): r is StatusRow => r !== null)

  const analysed = vm.optionsComparison.rows.filter(
    (r): r is Extract<ComparisonOption, { kind: 'analysed' }> => r.kind === 'analysed',
  )

  /*
   * ⛔ NOT THE LEADER ITEM. Its meaning ("could not confirm which option is
   * most likely…") is already the commitment block's "What remains uncertain"
   * bullet at rest; listing it here restored Paul's 20 Sep duplicate (V2
   * census, B2).
   */
  const meanings = vm.checks.items
    .filter((i) => i.state === 'not_assessed' && i.id !== 'leader')
    .flatMap((i): Array<{ id: ChecksItem['id']; text: string }> => {
      const entry = COPY.checks[i.code]
      return 'meaning' in entry ? [{ id: i.id, text: entry.meaning }] : []
    })

  /*
   * ⭐ ONE LIST OF THE ENGINE'S OWN LIMITS, EACH ONCE. The strip's resting entry
   * (`selectRestingStripEntries`, humanised as the strip humanises it) and the
   * builder's statement rows (`selectHumanisedInferenceWarningsOutsideStrip`,
   * the strip's exact complement) together are every inference warning — so
   * nothing is "held back" to another section and nothing repeats. Critiques
   * are the strip's own selection, CEE's copy verbatim.
   */
  const statementRows = vm.deeper.groups.flatMap((g) => g.rows.filter((r) => r.statement === true))
  /**
   * ⛔ GROUPED, WITH THEIR TITLES (#2069 review). The builder's groups carry
   * meaning in their titles: "Readiness signals" emits rows labelled
   * Evidence / Robustness / Framing that are coaching-layer quality signals
   * ABOUT THE MODEL, "not a readiness verdict". Flattened, an ungated
   * "Robustness 40%" sat unlabelled one click under About's gated
   * "Robustness: Stable". Each group keeps its title as a sub-label.
   */
  const recordGroups = vm.deeper.groups
    .map((g) => ({ title: g.title, rows: g.rows.filter((r) => r.statement !== true) }))
    .filter((g) => g.rows.length > 0)
  const recordRows: InspectRow[] = recordGroups.flatMap((g) => g.rows)
  const limits: LimitBullet[] = [
    ...selectRenderableCritiqueEntries(vm.deeper.critiques).map((c, i) => ({
      key: `critique:${i}`,
      text: c.displayText,
      note: c.suggestion,
      critiqueCode: c.code,
      testId: `${testId}-limit-critique`,
    })),
    ...selectRestingStripEntries(vm.deeper.caveats).map((w, i) => ({
      key: `caveat:${i}`,
      text: humaniseInferenceWarningTitle(w),
      gapCode: w.code,
      warningCode: w.code,
      warningSeverity: w.severity,
      testId: `${testId}-limit-caveat`,
    })),
    ...statementRows.map((r, i) => ({
      key: `gap:${i}`,
      text: r.value,
      gapCode: r.label || undefined,
      nodeId: r.nodeId,
      testId: `${testId}-limit-gap`,
    })),
  ]

  const details: DetailKey[] = preRun ? [] : [
    ...(analysed.length > 0 ? (['values'] as const) : []),
    'limitations',
    ...(recordRows.length > 0 ? (['record'] as const) : []),
  ]

  const ask = () =>
    onAsk?.({
      context: rows.flatMap(rowContext).join('\n'),
      draft: ABOUT_COPY.askDraft,
      label: ABOUT_COPY.ask,
    })

  /**
   * ⛔ A NORMALISED OUTCOME IS A MODEL SCORE: NO `%`, NO `+` (AI Quality,
   * #70 5841808930). `formatThreshold` (shared with the Analysis tab) reframes
   * it as "+9%", which reads as "a 9% change, up from now" — a unit and a
   * direction these origin-form scores do not have. Here it prints as the
   * comparison axis does: three significant figures, no sign, no symbol.
   * A real unit still goes through `formatThreshold`.
   */
  const fmt = (v: number) =>
    outcomeFormat.isNormalised === true
      ? formatModelScore(v)
      : formatThreshold(v, outcomeFormat.unit, outcomeFormat.symbol, outcomeFormat.isNormalised)

  const toggleDetail = (key: DetailKey) =>
    setDetailOpen((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  return (
    /* ⭐ V2 FIDELITY GAP 27: A QUIET AUDIT FOOTER, NOT A PEER SECTION. The
       prototype's `.about .disclose` is 11px light text with the chevron FIRST
       (rotating 90° open), under a rule that runs the full panel width
       (`.about:before{left:-16px;right:-16px}` against the 16px scroll gutter).
       `-mx-4 px-4` cancels the content column's `px-4` so the rule reaches both
       edges; the text stays on the column's measure. */
    <section
      /* fidelity gap 6/11: `PANEL_RULE` — the shared full-width rule, not a
         bare `border-t` inset inside the column's own `px-4` gutter.
         Prototype `.about`: 11px above, 10px under a full-width rule. */
      className={PANEL_RULE}
      data-testid={testId}
      aria-labelledby={`${testId}-heading`}
      data-about-open={open ? 'true' : 'false'}
    >
      <div className="flex items-center gap-1.5">
        {/* ⚠ V2 gap 27: NOT A HEADING. The prototype's About toggle is a bare
            `.disclose` button, not a section title — and this panel reserves
            h1–h3 for section titles on `panelHeader`
            (`sectionHeadingsUseHeaderToken.spec.ts`). A footer line typed as a
            heading would either lie about the outline or wear the peer-section
            type gap 27 removes. The region stays a labelled landmark: its name
            is the title span below. */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={open ? regionId : undefined}
          /* Prototype `.about .disclose`: 27px tall — the 24px floor plus padding. */
          className={`${typography.panelMeta} text-text-light flex min-w-0 flex-1 min-h-[24px] py-1.5 items-center gap-1.5 text-left rounded hover:opacity-80 ${ACTION_FOCUS}`}
          data-testid={`${testId}-toggle`}
        >
          <ChevronRight
            className={`${icon('row')} shrink-0 text-text-light transition-transform${open ? ' rotate-90' : ''}`}
            aria-hidden={true}
            data-testid={`${testId}-chevron`}
          />
          <span id={`${testId}-heading`} className="min-w-0 flex-1">{ABOUT_COPY.title}</span>
        </button>
        {open && onAsk && !preRun ? (
          <PanelIconButton ai label={ABOUT_COPY.ask} onClick={ask} testId={`${testId}-ask`} />
        ) : null}
      </div>

      {open ? (
        <div id={regionId} className="pb-3" data-testid={`${testId}-region`}>
          {rows.length > 0 ? (
          /* Prototype `.audit-status` / `.audit-row`: 4px apart, 29px tall,
             icon · label · light value · ✦. dl > div > dt + dd. */
          <dl className="m-0 my-[7px] grid gap-1" data-testid={`${testId}-rows`}>
            {rows.map((r) => (
              <div
                key={r.key}
                /* ⚠ The LABEL column is `auto` and the value takes the rest and
                   wraps: a long value ("Assessed, 3 gaps found, all addressed")
                   must never slide under its label at 280px. */
                className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-1.5 min-h-[29px]"
                data-testid={`${testId}-row-${r.key}`}
              >
                <dt className={`${typography.panelBody} text-text-body flex items-center gap-1.5`}>
                  <span className="inline-flex w-4 shrink-0 items-center justify-center">
                    <r.Icon className={`${icon('row')} text-text-light`} aria-hidden={true} />
                  </span>
                  <span className="min-w-0">{ABOUT_COPY.rows[r.key]}</span>
                </dt>
                <dd className="m-0 flex min-w-0 items-center justify-end gap-1.5">
                  <span
                    className={`${typography.panelMeta} text-text-light min-w-0 text-right break-words`}
                    data-testid={`${testId}-row-${r.key}-value`}
                  >
                    {r.value}
                  </span>
                  {onAsk ? (
                    <PanelIconButton
                      ai
                      label={ABOUT_COPY.rowAsk(ABOUT_COPY.rows[r.key])}
                      onClick={() =>
                        onAsk({
                          context: rowContext(r).join('\n'),
                          draft: ABOUT_COPY.rowAskDraft(ABOUT_COPY.rows[r.key]),
                          label: ABOUT_COPY.rowAsk(ABOUT_COPY.rows[r.key]),
                        })
                      }
                      testId={`${testId}-row-${r.key}-ask`}
                    />
                  ) : null}
                </dd>
                {r.detail.map((line, i) => (
                  <dd
                    key={i}
                    className={`${typography.panelMeta} text-text-light m-0 col-span-2 pl-[22px] break-words`}
                    data-testid={`${testId}-row-${r.key}-detail`}
                  >
                    {line}
                  </dd>
                ))}
              </div>
            ))}
          </dl>
          ) : null}

          {details.map((key) => {
            const isOpen = detailOpen.has(key)
            const bodyId = `${regionId}-${key}`
            return (
              <div key={key} data-testid={`${testId}-detail-${key}`}>
                {/* Prototype `.audit-link`: a full-width 30px row (the 24px
                    floor plus 5px a side), the name left and the chevron right
                    (down when open). */}
                <button
                  type="button"
                  onClick={() => toggleDetail(key)}
                  aria-expanded={isOpen}
                  aria-controls={isOpen ? bodyId : undefined}
                  className={`${typography.panelBody} text-text-body flex w-full min-h-[24px] py-[5px] items-center justify-between gap-2 text-left rounded hover:opacity-80 ${ACTION_FOCUS}`}
                  data-testid={`${testId}-detail-${key}-toggle`}
                >
                  <span className="min-w-0">{ABOUT_COPY.details[key]}</span>
                  {isOpen ? (
                    <ChevronDown className={`${icon('row')} shrink-0`} aria-hidden={true} />
                  ) : (
                    <ChevronRight className={`${icon('row')} shrink-0`} aria-hidden={true} />
                  )}
                </button>
                {isOpen ? (
                  <div id={bodyId} className="pb-1" data-testid={`${testId}-detail-${key}-body`}>
                    {key === 'values' ? (
                      <ValuesTable options={analysed} fmt={fmt} normalised={outcomeFormat.isNormalised === true} onAsk={onAsk} testId={testId} />
                    ) : key === 'limitations' ? (
                      <SourcesAndLimits
                        limits={limits}
                        meanings={meanings}
                        offerFactorValueControl={offerFactorValueControl}
                        testId={testId}
                      />
                    ) : (
                      <RunRecord groups={recordGroups} testId={testId} />
                    )}
                  </div>
                ) : null}
              </div>
            )
          })}

          {/* V2 gap 24 — the folded tail, last. `data-testid` so a reader of
              the DOM can tell a folded block from About's own rows. */}
          {folded !== null && folded !== undefined ? (
            <div className="mt-2 space-y-3" data-testid={`${testId}-folded`}>
              {folded}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

/**
 * Prototype `valuesHTML()`: one table, Option · P10 · P50 · P90, the builder's
 * own formatter, in the order the view model gave (a designation authored
 * upstream, never re-sorted here). ⚠ NO UNIT CAPTION: the prototype's
 * "<outcome> (<unit>)" caption waits on the units ruling; the only caption is
 * the existing relative-scores sentence on a normalised run.
 */
function ValuesTable({
  options,
  fmt,
  normalised,
  onAsk,
  testId,
}: {
  options: Array<Extract<ComparisonOption, { kind: 'analysed' }>>
  fmt: (v: number) => string
  normalised: boolean
  onAsk?: (payload: AboutAskPayload) => void
  testId: string
}) {
  const cell = (v: number | null | undefined) =>
    typeof v === 'number' && Number.isFinite(v) ? fmt(v) : ABOUT_COPY.values.notReturned
  const table = options.map((o) => ({
    id: o.id,
    label: o.label,
    cells: [
      ['low', cell(o.outcomeRange?.p10)],
      ['mid', cell(o.outcomeRange?.p50)],
      ['high', cell(o.outcomeRange?.p90)],
    ] as const,
  }))
  /* ⚠ `[font-weight:inherit]`, NOT A WEIGHT: it undoes the user agent's
     `th { font-weight: bold }` so the header wears the panelMeta token's own
     (inherited) weight, as the prototype's `.audit-table th{font-weight:400}`
     does. DS §2.4 bans introducing a raw weight; this introduces none. */
  const th = `${typography.panelMeta} text-text-light [font-weight:inherit] text-right px-1 py-[7px] first:pl-0 first:text-left last:pr-0`
  const td = 'text-right px-1 py-[7px] border-t border-panel-border first:pl-0 first:text-left last:pr-0'
  return (
    <>
      <div className="max-w-full overflow-auto">
        <table className={`${typography.panelMeta} text-text-body my-1.5 w-full border-collapse tabular-nums`}>
          {normalised ? (
            <caption
              className={`${typography.panelMeta} text-text-light py-[3px] text-left`}
              data-testid={`${testId}-values-normalised`}
            >
              {ABOUT_COPY.values.normalised}
            </caption>
          ) : null}
          <thead>
            <tr>
              <th scope="col" className={th}>{ABOUT_COPY.values.option}</th>
              <th scope="col" className={th}>{ABOUT_COPY.values.low}</th>
              <th scope="col" className={th}>{ABOUT_COPY.values.mid}</th>
              <th scope="col" className={th}>{ABOUT_COPY.values.high}</th>
            </tr>
          </thead>
          <tbody>
            {table.map((row) => (
              <tr key={row.id} data-testid={`${testId}-values-${row.id}`}>
                <td className={`${td} break-words`}>{row.label}</td>
                {row.cells.map(([k, v]) => (
                  <td key={k} className={td} data-testid={`${testId}-values-${row.id}-${k}`}>
                    {v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {onAsk ? (
        <div
          className={`${typography.panelBody} text-text-body mt-1.5 flex items-center justify-between gap-2`}
          data-testid={`${testId}-values-question`}
        >
          <span className="min-w-0">{ABOUT_COPY.values.question}</span>
          <PanelIconButton
            ai
            label={ABOUT_COPY.values.questionAsk}
            onClick={() =>
              onAsk({
                context: table
                  .map((r) => `${r.label}: ${r.cells.map(([, v]) => v).join(' / ')}`)
                  .join('\n'),
                draft: ABOUT_COPY.values.question,
                label: ABOUT_COPY.values.questionAsk,
              })
            }
            testId={`${testId}-values-ask`}
          />
        </div>
      ) : null}
    </>
  )
}

/**
 * Prototype `sourcesHTML()`: short bullets (`.tiny-list`, a centred-dot marker).
 * Engine limits first, in producer order, then the unassessed meanings by
 * check code, then the standing science disclosure.
 */
function SourcesAndLimits({
  limits,
  meanings,
  offerFactorValueControl,
  testId,
}: {
  limits: LimitBullet[]
  meanings: Array<{ id: ChecksItem['id']; text: string }>
  offerFactorValueControl: boolean
  testId: string
}) {
  const li = "relative pl-[11px] before:absolute before:left-px before:content-['·']"
  return (
    <ul
      /* `.tiny-list`: 6px margin + each item's 3px, and 6px + 3px + 3px between items. */
      className={`${typography.panelBody} text-text-body m-0 my-[9px] list-none space-y-3 pl-[15px]`}
      data-testid={`${testId}-limits`}
    >
      {limits.map((b) => (
        <li
          key={b.key}
          className={`${li} break-words`}
          data-testid={b.testId}
          data-gap-code={b.gapCode}
          data-warning-code={b.warningCode}
          data-warning-severity={b.warningSeverity}
          data-critique-code={b.critiqueCode}
        >
          <span>{b.text}</span>
          {b.note ? (
            <span className={`${typography.panelMeta} text-text-light block`}>{b.note}</span>
          ) : null}
          {offerFactorValueControl && b.nodeId ? (
            <span className="block">
              <FactorValueControl nodeId={b.nodeId} testIdPrefix={testId} />
            </span>
          ) : null}
        </li>
      ))}
      {meanings.map((m) => (
        <li key={m.id} className={li} data-testid={`${testId}-limitation-${m.id}`}>
          {m.text}
        </li>
      ))}
      <li className={li} data-testid={`${testId}-science-limitations`}>
        {SCIENCE_LIMITATIONS_DISCLOSURE}
      </li>
    </ul>
  )
}

/**
 * Prototype run receipt (`.dl`): label/value rows. The label column is the
 * prototype's 95px at a 420px panel and 75px at 280px (its `@container
 * panel (max-width:320px)` step), interpolated between them. Every
 * NON-statement row the builder put in `vm.deeper.groups`, flattened in its
 * order; the statement rows (the gaps worked around) are limits, not receipts,
 * and render in "Sources and limits".
 */
function RunRecord({
  groups,
  testId,
}: {
  groups: ReadonlyArray<{ title: string; rows: InspectRow[] }>
  testId: string
}) {
  return (
    <div className="m-0 my-1.5 space-y-2" data-testid={`${testId}-record-rows`}>
      {groups.map((g, gi) => (
        <div key={`${gi}:${g.title}`} data-testid={`${testId}-record-group`} data-group-title={g.title}>
          <p className={`${typography.panelMeta} text-text-light m-0 mb-1`} data-testid={`${testId}-record-group-title`}>
            {g.title}
          </p>
          <dl
            className={`${typography.panelBody} m-0 grid grid-cols-[clamp(75px,calc(14.29%_+_39.57px),95px)_minmax(0,1fr)] gap-x-3 gap-y-1.5`}
          >
            {g.rows.map((r, i) => (
              /* Positional keys: one label can repeat across groups. */
              <div key={`${i}:${r.label}`} className="contents" data-testid={`${testId}-record-row`}>
                <dt className="text-text-light min-w-0 break-words">{r.label}</dt>
                <dd className="m-0 min-w-0 text-text-body break-words">{r.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  )
}
