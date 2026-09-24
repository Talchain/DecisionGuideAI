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
 * `vm.atAGlance.inputProvenance`, `vm.optionsComparison`, `vm.uncertainty`,
 * `vm.deeper`), plus three values the tab body already holds and hands the
 * view model (`nSamples`, `seedUsed`) or holds beside it (`outcomeFormat`,
 * read off `resultsSectionData.recommendation`). The only arithmetic is
 * COUNTING rows the view model already emitted.
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
 * @panel-act-opt-out full-width disclosure toggles; a tier is an inline control and would shrink each row to its text width
 */
import { useId, useState } from 'react'
import type { ComponentType, ReactNode } from 'react'
import {
  ChevronDown,
  ChevronRight,
  CircleDot,
  Clock,
  Dices,
  FileSearch,
  Scale,
  Shield,
  Users,
} from 'lucide-react'

import { typography } from '../../../../styles/typography'
import { useContextIntegrityStore } from '../../../../canvas/stores/contextIntegrityStore'
import { useWhatIWasGivenWillRender } from '../../contextIntegrity/WhatIWasGivenSection'
import { SCIENCE_LIMITATIONS_DISCLOSURE } from '../../analysisMethodCopy'
import { formatThreshold } from '../../RangeVisualization'
import type { OutcomeUnitType } from '../../types'
import { NOT_ANALYSED_BADGE, NOT_COMPUTED_BADGE } from '../../utils/notAnalysedCopy'
import { figureTallySubtitle } from '../../contextIntegrity/figureTallySubtitle'
import { ANALYSIS_NEW_COPY as COPY, formatConjunctionList } from '../analysisNewCopy'
import type {
  AnalysisNewViewModel,
  ChecksCode,
  ChecksItem,
  ComparisonOption,
  GlanceInputProvenance,
} from '../analysisNewTypes'
import { FactorValueControl } from '../FactorValueControl'
import { CritiqueWarningStrip } from '../../CritiqueWarningStrip'
import { InferenceWarningStrip } from '../../InferenceWarningStrip'
import { PanelIconButton } from '../PanelIconButton'
import { ACTION_FOCUS, icon, PANEL_RULE } from '../panelSurfaces'

// ─────────────────────────────────────────────────────────────────────────────
// Copy. Furniture and short status values only; every claim-bearing sentence
// below is read from `ANALYSIS_NEW_COPY` or the view model.
// ─────────────────────────────────────────────────────────────────────────────

const RANGE_ARM = COPY.optionFigures.rangeLensArms

export const ABOUT_COPY = {
  title: 'About this analysis',
  ask: 'Ask Olumi about this analysis and its limits',
  askDraft: 'What are the limits of this analysis?',
  rows: {
    freshness: 'Freshness',
    compared: 'Compared',
    evidence: 'Evidence',
    robustness: 'Robustness',
    leader: 'Most likely option',
    inputs: "Your inputs and Olumi's",
    method: 'Method',
  },
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
  /** Everything that is not the view model's gated word. */
  robustnessNotEstablished: 'Not established',
  /**
   * Keyed by the leader CHECK CODE — the one authority for which of the three
   * states this is. "Not confirmed" (not "withheld", not "not assessed") for
   * the reason `checks.leader_not_assessed.label` records: it is true both of a
   * run that assessed nothing and of one that assessed and was withheld.
   */
  leader: {
    leader_present: 'Identified in this model',
    leader_tied: 'None clearly most likely',
    leader_not_assessed: 'Not confirmed',
  },
  /** One short value per `GlanceInputProvenance` kind — the glance's sentence, shortened, never widened. */
  inputs: {
    estimated: "Olumi's estimates",
    partly_estimated: "Partly Olumi's estimates",
    mixed: "A mix of yours and Olumi's",
    user_supplied: 'Your figures',
    partly_user_supplied: 'Partly your figures',
    undetermined: 'Source not established',
  } satisfies Record<GlanceInputProvenance, string>,
  inputsNotReported: 'Not reported',
  estimatedCount: (n: number): string => `Olumi estimated ${n} ${n === 1 ? 'value' : 'values'}`,
  method: (samples: string | null, seed: string | null): string =>
    samples !== null && seed !== null
      ? `${samples} simulations, seed ${seed}`
      : samples !== null
        ? `${samples} simulations`
        : `Seed ${seed ?? ''}`,
  details: {
    values: 'Values and ranges',
    limitations: 'Limitations',
    record: 'Run record',
  },
  values: {
    low: `${RANGE_ARM.cautious} (p10)`,
    mid: `${RANGE_ARM.middle} (p50)`,
    high: `${RANGE_ARM.optimistic} (p90)`,
    /** Neutral by instruction: what the figure IS, with no ranking word. */
    share: 'Share of simulations where this option came out highest',
    notReturned: 'Not returned',
    /** `DecisionResultData.isNormalised`: the UI must not present these as the user's units. */
    normalised: 'Relative scores in this model, not in your units.',
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
  /** The value the body already passes `useAnalysisNewViewModel`. */
  nSamples?: number
  /** The value the body already passes `useAnalysisNewViewModel`. */
  seedUsed?: number | string
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
   * The value control on "Model gaps the analysis worked around" rows.
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

const checkCode = (vm: AnalysisNewViewModel, id: 'leader' | 'robustness' | 'evidence'): ChecksCode | null =>
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
    Icon: Scale,
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
  return { key: 'evidence', Icon: FileSearch, value, detail: [] }
}

function leaderRow(vm: AnalysisNewViewModel): StatusRow | null {
  const code = checkCode(vm, 'leader')
  if (code !== 'leader_present' && code !== 'leader_tied' && code !== 'leader_not_assessed') return null
  return {
    key: 'leader',
    Icon: CircleDot,
    value: ABOUT_COPY.leader[code],
    // ⭐ The producer's cause, composed ONCE by the view model and gated there
    // on this same code. Never re-derived from a reason string here.
    detail: code === 'leader_not_assessed' && vm.checks.leaderWithholdCause !== null
      ? [vm.checks.leaderWithholdCause]
      : [],
  }
}

function inputsRow(
  vm: AnalysisNewViewModel,
  briefDetail: string[],
): StatusRow | null {
  const kind = vm.atAGlance.inputProvenance
  if (kind === null && briefDetail.length === 0) return null
  return {
    key: 'inputs',
    Icon: Users,
    value: kind !== null ? ABOUT_COPY.inputs[kind] : ABOUT_COPY.inputsNotReported,
    detail: briefDetail,
  }
}

function methodRow(nSamples: number | undefined, seedUsed: number | string | undefined): StatusRow | null {
  const samples =
    typeof nSamples === 'number' && Number.isFinite(nSamples) ? nSamples.toLocaleString('en-GB') : null
  const seed = seedUsed !== undefined && String(seedUsed) !== '' ? String(seedUsed) : null
  if (samples === null && seed === null) return null
  return { key: 'method', Icon: Dices, value: ABOUT_COPY.method(samples, seed), detail: [] }
}

/**
 * The context-integrity counts — the SAME store `WhatIWasGivenSection` renders
 * from, behind ITS exported gate (`useWhatIWasGivenWillRender`, which carries
 * the positive scenario-identity match), so this row can never count another
 * decision's brief and the gate has one home.
 */
function useBriefDetail(): string[] {
  const registerRenders = useWhatIWasGivenWillRender()
  const manifest = useContextIntegrityStore((s) => s.manifest)
  if (!registerRenders || manifest === null) return []
  const out: string[] = []
  // Counts from the manifest's own tally, through the register's own sentence
  // builder and its own `derived` condition — never from the capped `items`
  // array, never re-worded.
  const tally = manifest.status === 'derived' ? manifest.quantities : null
  if (tally !== null) out.push(figureTallySubtitle(tally, 'not_counted'))
  // The rows the register's "What I estimated" list renders — the same
  // expression it uses, with no conjunct it does not have.
  const estimated = manifest.inferredFactors.items.length
  if (estimated > 0) out.push(ABOUT_COPY.estimatedCount(estimated))
  return out
}

export function AboutThisAnalysis({
  vm,
  nSamples,
  seedUsed,
  outcomeFormat,
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
  const briefDetail = useBriefDetail()

  const preRun = vm.status.isPreRun
  if (preRun && !foldedHasContent) return null

  // Pre-run: no row and no detail — each is a statement about a run.
  const rows: StatusRow[] = preRun ? [] : [
    { key: 'freshness', Icon: Clock, value: freshnessValue(vm), detail: [] },
    comparedRow(vm),
    evidenceRow(vm),
    {
      key: 'robustness',
      Icon: Shield,
      // ⛔ ONLY the view model's gated word (`VERDICT_WORD` under
      // `mayStateStability`, #1206). No word ⇒ not established, never a guess.
      value: vm.atAGlance.verdict?.label ?? ABOUT_COPY.robustnessNotEstablished,
      detail: [],
    },
    leaderRow(vm),
    inputsRow(vm, briefDetail),
    methodRow(nSamples, seedUsed),
  ].filter((r): r is StatusRow => r !== null)

  const analysed = vm.optionsComparison.rows.filter(
    (r): r is Extract<ComparisonOption, { kind: 'analysed' }> => r.kind === 'analysed',
  )

  /**
   * The not-assessed MEANINGS `WhatWeChecked` renders, read off the copy deck by
   * code. The leader's producer cause is NOT appended here — it already sits on
   * the leader row, and saying it twice in one surface is the defect this
   * utility exists to remove.
   */
  // ⛔ NOT THE LEADER ITEM. Its meaning ("could not confirm which option is
  // most likely…") is already the commitment block's "What remains uncertain"
  // bullet at rest, and the leader row here says "Not confirmed"; listing it
  // again restored Paul's 20 Sep duplicate (V2 census, B2).
  const limitations = vm.checks.items
    .filter((i) => i.state === 'not_assessed' && i.id !== 'leader')
    .flatMap((i): Array<{ id: ChecksItem['id']; text: string }> => {
      const entry = COPY.checks[i.code]
      return 'meaning' in entry ? [{ id: i.id, text: entry.meaning }] : []
    })

  const details: DetailKey[] = preRun ? [] : [
    ...(analysed.length > 0 ? (['values'] as const) : []),
    'limitations',
    ...(vm.deeper.groups.length > 0 ? (['record'] as const) : []),
  ]

  const ask = () =>
    onAsk?.({
      context: rows
        .flatMap((r) => [`${ABOUT_COPY.rows[r.key]}: ${r.value}`, ...r.detail])
        .join('\n'),
      draft: ABOUT_COPY.askDraft,
      label: ABOUT_COPY.ask,
    })

  const fmt = (v: number) =>
    formatThreshold(v, outcomeFormat.unit, outcomeFormat.symbol, outcomeFormat.isNormalised)

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
          className={`${typography.panelMeta} text-text-light flex min-w-0 flex-1 min-h-[27px] items-center gap-1.5 text-left rounded hover:opacity-80 ${ACTION_FOCUS}`}
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
          <dl className="m-0 space-y-0.5" data-testid={`${testId}-rows`}>
            {rows.map((r) => (
              /* dl > div > dt + dd(s): the value in column two, any supporting
                 lines spanning both columns under it. */
              <div
                key={r.key}
                className="grid grid-cols-[minmax(0,1fr)_minmax(0,auto)] items-start gap-x-2 py-0.5"
                data-testid={`${testId}-row-${r.key}`}
              >
                <dt className={`${typography.panelBody} text-text-body flex min-w-0 items-start gap-1.5`}>
                  <r.Icon className={`${icon('row')} mt-[3px] shrink-0 text-text-light`} aria-hidden={true} />
                  <span className="min-w-0">{ABOUT_COPY.rows[r.key]}</span>
                </dt>
                <dd
                  className={`${typography.panelMeta} text-text-light m-0 mt-[2px] max-w-[11rem] text-right break-words`}
                  data-testid={`${testId}-row-${r.key}-value`}
                >
                  {r.value}
                </dd>
                {r.detail.map((line, i) => (
                  <dd
                    key={i}
                    className={`${typography.panelMeta} text-text-light m-0 col-span-2 pl-5 break-words`}
                    data-testid={`${testId}-row-${r.key}-detail`}
                  >
                    {line}
                  </dd>
                ))}
              </div>
            ))}
          </dl>
          ) : null}

          {details.length > 0 ? (
          <div className="mt-2">
            {details.map((key) => {
              const isOpen = detailOpen.has(key)
              const bodyId = `${regionId}-${key}`
              return (
                <div key={key} data-testid={`${testId}-detail-${key}`}>
                  <h4 className="m-0">
                    <button
                      type="button"
                      onClick={() =>
                        setDetailOpen((prev) => {
                          const next = new Set(prev)
                          if (next.has(key)) next.delete(key)
                          else next.add(key)
                          return next
                        })
                      }
                      aria-expanded={isOpen}
                      aria-controls={isOpen ? bodyId : undefined}
                      className={`${typography.panelBody} text-text-body flex w-full min-h-[24px] items-center gap-1.5 py-1 text-left rounded hover:opacity-80 ${ACTION_FOCUS}`}
                      data-testid={`${testId}-detail-${key}-toggle`}
                    >
                      <span className="min-w-0 flex-1">{ABOUT_COPY.details[key]}</span>
                      {isOpen ? (
                        <ChevronDown className={`${icon('row')} shrink-0 text-text-light`} aria-hidden={true} />
                      ) : (
                        <ChevronRight className={`${icon('row')} shrink-0 text-text-light`} aria-hidden={true} />
                      )}
                    </button>
                  </h4>
                  {isOpen ? (
                    <div id={bodyId} className="pb-2 pl-5" data-testid={`${testId}-detail-${key}-body`}>
                      {key === 'values' ? (
                        <ValuesAndRanges options={analysed} fmt={fmt} normalised={outcomeFormat.isNormalised === true} goalOnly={vm.checks.sharesExcludeLimits} testId={testId} />
                      ) : key === 'limitations' ? (
                        <>
                        {/* ⭐ V2: THE ENGINE'S CAVEATS LIVE HERE NOW. They were an
                            amber box at the top of the tab; the tab now carries one
                            qualifier under the chart (`commitmentQualifier.ts`) and
                            the full list is here. Same two components, unchanged,
                            so the copy is the one the legacy tab also shows. */}
                        <CritiqueWarningStrip critiques={vm.deeper.critiques} className="mb-2" />
                        <InferenceWarningStrip
                          warnings={vm.deeper.caveats}
                          className="mb-2"
                          heldBackListedUnder={vm.deeper.groups.length > 0 ? ABOUT_COPY.details.record : null}
                        />
                        <ul className="m-0 list-none space-y-1 p-0">
                          {limitations.map((m) => (
                            <li
                              key={m.id}
                              className={`${typography.panelMeta} text-text-body`}
                              data-testid={`${testId}-limitation-${m.id}`}
                            >
                              {m.text}
                            </li>
                          ))}
                          <li
                            className={`${typography.panelMeta} text-text-light`}
                            data-testid={`${testId}-science-limitations`}
                          >
                            {SCIENCE_LIMITATIONS_DISCLOSURE}
                          </li>
                        </ul>
                        </>
                      ) : (
                        <RunRecord
                          groups={vm.deeper.groups}
                          offerFactorValueControl={offerFactorValueControl}
                          testId={testId}
                        />
                      )}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
          ) : null}

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
 * Per option, the range this run produced and the share figure — the same
 * `outcomeRange` and `winReadout` the comparison draws from, in the order the
 * view model gave them (a designation authored upstream, never re-sorted here).
 */
function ValuesAndRanges({
  options,
  fmt,
  normalised,
  goalOnly,
  testId,
}: {
  options: Array<Extract<ComparisonOption, { kind: 'analysed' }>>
  fmt: (v: number) => string
  normalised: boolean
  /** `vm.checks.sharesExcludeLimits` — the same flag and constant the comparison uses. */
  goalOnly: boolean
  testId: string
}) {
  const cell = (v: number | null | undefined) =>
    typeof v === 'number' && Number.isFinite(v) ? fmt(v) : ABOUT_COPY.values.notReturned
  /* ⭐ THE SHARES CARRY THEIR SCOPE HERE TOO. V2 moved the share figures into
     this section and left the comparison's "Goal only" line behind, so on the
     served withheld run (c3a39ae7) they printed with no word that the limits
     are not in them. Only when a share figure is actually on screen. */
  const showsAShare = options.some((o) => o.winReadout != null)
  return (
    <div className="space-y-2">
      {goalOnly && showsAShare ? (
        <p className={`${typography.panelMeta} text-text-light m-0`} data-testid={`${testId}-values-goal-only`}>
          {COPY.optionFigures.goalOnlyQualifier}
        </p>
      ) : null}
      {normalised ? (
        <p className={`${typography.panelMeta} text-text-light m-0`} data-testid={`${testId}-values-normalised`}>
          {ABOUT_COPY.values.normalised}
        </p>
      ) : null}
      {options.map((o) => (
        <div key={o.id} data-testid={`${testId}-values-${o.id}`}>
          <p className={`${typography.panelBody} text-text-body m-0 break-words`}>{o.label}</p>
          <dl className="m-0 mt-0.5 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5">
            {(
              [
                ['low', ABOUT_COPY.values.low, cell(o.outcomeRange?.p10)],
                ['mid', ABOUT_COPY.values.mid, cell(o.outcomeRange?.p50)],
                ['high', ABOUT_COPY.values.high, cell(o.outcomeRange?.p90)],
                ['share', ABOUT_COPY.values.share, o.winReadout ?? ABOUT_COPY.values.notReturned],
              ] as const
            ).map(([k, label, value]) => (
              <div key={k} className="contents">
                <dt className={`${typography.panelMeta} text-text-light min-w-0 break-words`}>{label}</dt>
                <dd
                  className={`${typography.panelMeta} text-text-body m-0 text-right tabular-nums`}
                  data-testid={`${testId}-values-${o.id}-${k}`}
                >
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  )
}

/**
 * `vm.deeper.groups` — everything `DeeperAnalysis` printed, in the builder's
 * order. ⚠ THE STATEMENT-ROW RULE IS `DeeperAnalysis`'s, kept exactly: a row
 * flagged `statement` carries the producer's CODE as its label, which is kept
 * in the DOM (`sr-only` term + `data-gap-code`) and never printed as a heading.
 * Keys are positional because labels repeat when one code is raised about two
 * nodes.
 */
function RunRecord({
  groups,
  offerFactorValueControl,
  testId,
}: {
  groups: AnalysisNewViewModel['deeper']['groups']
  offerFactorValueControl: boolean
  testId: string
}) {
  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <div key={group.title} data-testid={`${testId}-record-group`}>
          <h5 className={`${typography.panelMeta} text-text-header m-0`}>{group.title}</h5>
          <dl className="m-0 mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            {group.rows.map((r, i) => (
              <div key={`${i}:${r.label}`} className="contents">
                {r.statement ? (
                  <>
                    <dt className="sr-only">{r.label}</dt>
                    <dd
                      className={`${typography.panelMeta} text-text-body m-0 col-span-2 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 break-words`}
                      data-gap-code={r.label || undefined}
                    >
                      <span className="min-w-0 break-words">{r.value}</span>
                      {offerFactorValueControl && r.nodeId ? (
                        <FactorValueControl nodeId={r.nodeId} testIdPrefix={testId} />
                      ) : null}
                    </dd>
                  </>
                ) : (
                  <>
                    <dt className={`${typography.panelMeta} text-text-light break-words`}>{r.label}</dt>
                    <dd className={`${typography.panelMeta} text-text-body m-0 min-w-0 break-words`}>{r.value}</dd>
                  </>
                )}
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  )
}
