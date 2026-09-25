/**
 * ⭐ MOVE TOWARDS COMMITMENT — Reasoning V2's closing zone (prototype
 * `commitHTML()` / `synthesisHTML()` / `positionHTML()`).
 *
 * Three parts, top to bottom:
 *   1. the three synthesis bullets, from `buildCommitmentSynthesis` (nothing
 *      here decides which sentence appears; see that module);
 *   2. a slot (`children`) for the options comparison, which the tab body
 *      places here — the chart is not this component's;
 *   3. "Record your view": the EXISTING decision record. The same store, the
 *      same modal (`openDecisionRecord`), the same door gate as
 *      `DecisionRecorded` (`isPreRun`, `canCapture`, `record`), and its own
 *      exported formatters, so a record reads back here exactly as it does
 *      there. It adds no field: "not ready to choose" and "next action" do not
 *      exist on `DecisionRecord` and are not faked.
 *
 * The header row carries at most two icon acts: ask Olumi what remains, and
 * compare with the last run (disabled when no route is supplied).
 *
 * ── ⛔ WHAT IT REFUSES TO SAY ──────────────────────────────────────────────
 * · Pre-run it renders NOTHING — no heading, no door, no icons.
 * · The recorded view is labelled as the USER'S view. Nothing here says Olumi
 *   chose, decided or recommended anything.
 * · A record field that is absent or blank gets no row (the `DecisionRecorded`
 *   honesty rule, reused).
 *
 * ── DS v5 ──────────────────────────────────────────────────────────────────
 * Neutral surface: no fill, no nested card. Three type sizes only. Fluid at
 * the 280px dock floor.
 *
 * ⭐ V2 (fidelity gap 6/11, 24 Sep 2026): the separator is `PANEL_RULE` — a
 * full-width rule ABOVE the section, not the inset bottom border this
 * docblock used to describe. See `panelSurfaces.ts` for why.
 */
import type { ReactNode } from 'react'
import { ChevronRight, GitCompare, Info, NotebookPen } from 'lucide-react'
import { typography } from '../../../../styles/typography'
import type { DecisionRecord } from '../../modals'
import type { AskOlumiPayload } from '../../coaching/askOlumiStore'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import {
  COMMITMENT_COPY,
  commitmentAskContext,
  commitmentBullets,
  type CommitmentSynthesis,
} from '../commitmentSynthesis'
import { PanelIconButton } from '../PanelIconButton'
import { action, icon, PANEL_RULE } from '../panelSurfaces'
import {
  formatConfidence,
  formatRecordedOn,
  recordedOptionText,
  storageSentenceFor,
} from './DecisionRecorded'

/**
 * What the AI icon hands the caller: exactly the three fields `openAskOlumi`
 * requires, so the body can pass it straight through. Typed off the store's
 * own payload so the two cannot drift.
 */
export type CommitmentAsk = Pick<AskOlumiPayload, 'context' | 'draft' | 'label'>

export interface CommitmentSummaryProps {
  /** `buildCommitmentSynthesis(vm)`. */
  synthesis: CommitmentSynthesis
  /** `vm.status.isPreRun`. Pre-run the zone renders nothing at all. */
  isPreRun: boolean
  /**
   * `hasAnalysedOptions(nodes, results.status)` — the capture modal's own
   * predicate, as `DecisionRecorded` takes it. Gates the door and the update
   * control, never the read-back.
   */
  canCapture: boolean
  /** `useDecisionRecordForScenario(currentScenarioId)`. */
  record: DecisionRecord | null
  /** `openDecisionRecord`. */
  onRecord: () => void
  /** Opens an ask about what remains before committing. */
  onAsk: (ask: CommitmentAsk) => void
  /**
   * Compare with the last run. ⛔ ABSENT MEANS NO ICON, not a disabled one: the
   * agreed rule (#63, 5806411059) is to render Compare only where a real route
   * exists. No host passes one today, and the OpenAI lane sends no `run_delta`,
   * so a greyed icon was the only comparison a reader met after a re-run.
   */
  onCompare?: () => void
  /** The options comparison, placed between the bullets and the record row. */
  children?: ReactNode
  /**
   * `buildCommitmentQualifier(vm)` — one borderless line directly under the
   * comparison it qualifies (V2 prototype `.qualifier`). Null renders nothing.
   */
  qualifier?: string | null
  testId?: string
}

/** One compact read-back line, or nothing when the value is absent or blank. */
function RecordLine({ label, value, testId }: { label: string; value: string | null | undefined; testId: string }) {
  const text = value?.trim()
  if (!text) return null
  return (
    <div className={`${typography.panelBody} text-text-body`} data-testid={testId}>
      <dt className="inline text-text-light">{label}: </dt>
      <dd className="inline m-0">{text}</dd>
    </div>
  )
}

function RecordYourView({
  canCapture,
  record,
  onRecord,
  testId,
}: {
  canCapture: boolean
  record: DecisionRecord | null
  onRecord: () => void
  testId: string
}) {
  if (record === null) {
    return (
      <div className="mt-3" data-testid={testId}>
        {/* ⭐ V2 FIDELITY (gap 21): a DISCLOSURE-SHAPED control, not an
            underlined hyperlink. The prototype's `.disclose` carries no
            underline (`button{background:transparent;border:0}` is the only
            rule that touches it) — the icon-plus-chevron SHAPE is what marks
            it as a control, the way `SectionShell`'s own toggle already does,
            so dropping `action('inline')`'s underline here does not trade away
            the "shape or fill, never colour alone" rule that underline exists
            to satisfy elsewhere on this panel. The route is UNCHANGED: this
            still opens the existing decision-record modal (`onRecord`); no
            inline form is added, because `DecisionRecord` has no "next action"
            or "not ready" field to back one. */}
        {/* ⚠ `min-h-6` (24px from Tailwind's own scale), NOT the literal
            `min-h-[24px]` — this file also carries `action('inline')` (the
            "Update" button below), and `everyInlineActIsReachableByTouch`
            bans a hand-rolled 24px literal anywhere beside it: that guard
            exists because `action('inline')` is the ONE owner of the 24px
            fix, and a second, file-local spelling is exactly the 1-of-12 drift
            it was written to stop. This button is not `action('inline')`
            (it is shape-carried, not underlined — see above), so it still
            needs its OWN target; `min-h-6` reaches the identical 24px without
            re-deriving the tier's literal, the same move `OptionsComparison`'s
            option-name button already makes for the same reason. */}
        <button
          type="button"
          onClick={onRecord}
          className="w-full -ml-2 flex items-center justify-between gap-1.5 min-h-6 px-2 py-1 rounded text-left hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-info"
          data-testid={`${testId}-open`}
        >
          {/* Body colour, not `text-info`: the prototype's `.disclose` door is
              `--text-body` with an icon and a chevron, and a blue label with no
              underline relied on colour alone (render-discipline RULE B). */}
          <span className={`${typography.panelBody} inline-flex items-center gap-1.5 text-text-body`}>
            <NotebookPen className={`${icon('inline')} text-text-light`} aria-hidden={true} />
            {COMMITMENT_COPY.record.open}
          </span>
          <ChevronRight className={`${icon('inline')} text-text-light shrink-0`} aria-hidden={true} />
        </button>
      </div>
    )
  }

  const recordedOn = formatRecordedOn(record.savedAt)
  return (
    <div className="mt-3" data-testid={testId}>
      <div className="flex flex-wrap items-center gap-1.5">
        <p
          className={`${typography.panelBody} text-text-header m-0 min-w-0 flex-1`}
          data-testid={`${testId}-title`}
        >
          {COMMITMENT_COPY.record.recorded}
        </p>
        {canCapture ? (
          <button
            type="button"
            onClick={onRecord}
            className={`${typography.panelMeta} ${action('inline')}`}
            data-testid={`${testId}-update`}
          >
            {COPY.decisionRecord.update}
          </button>
        ) : null}
      </div>
      {/* ⚠ V2 gap 21, CORRECTED BY PRE-REVIEW: the read-back is NOT trimmed.
          Every field the reader recorded stays on screen. "Update" is gated on
          `canCapture` (false during any re-run), so "one click away" was false
          exactly when a run was in flight, and confidence, expectation,
          rationale and the assumption to watch became unreachable. Only the
          control's styling follows the prototype. */}
      <dl className="m-0 mt-1 space-y-0.5">
        <RecordLine
          label={COMMITMENT_COPY.record.optionLabel}
          value={recordedOptionText(record)}
          testId={`${testId}-option`}
        />
        {/* V2 `positionHTML()`: "Your view · Next · Revisit when". The form has
            collected the next action since #1929; the read-back now shows it,
            under the form's own label. */}
        <RecordLine
          label={COPY.decisionRecord.nextActionLabel}
          value={record.nextAction}
          testId={`${testId}-next-action`}
        />
        <RecordLine
          label={COPY.decisionRecord.confidenceLabel}
          value={formatConfidence(record.confidence)}
          testId={`${testId}-confidence`}
        />
        <RecordLine label={COPY.decisionRecord.expectationLabel} value={record.expectation} testId={`${testId}-expectation`} />
        <RecordLine label={COPY.decisionRecord.rationaleLabel} value={record.rationale} testId={`${testId}-rationale`} />
        <RecordLine label={COPY.decisionRecord.assumptionLabel} value={record.assumptionToWatch} testId={`${testId}-assumption`} />
        <RecordLine
          label={COPY.decisionRecord.revisitLabel}
          value={record.revisitTrigger}
          testId={`${testId}-revisit`}
        />
      </dl>
      <p className={`${typography.panelMeta} text-text-light mt-1 mb-0`} data-testid={`${testId}-storage`}>
        {recordedOn !== null ? `${COPY.decisionRecord.recordedOnPrefix} ${recordedOn} · ` : null}
        {storageSentenceFor(record)}
      </p>
    </div>
  )
}

export function CommitmentSummary({
  synthesis,
  isPreRun,
  canCapture,
  record,
  onRecord,
  onAsk,
  onCompare,
  children,
  qualifier = null,
  testId = 'analysis-new-commitment',
}: CommitmentSummaryProps) {
  if (isPreRun) return null

  const bullets = commitmentBullets(synthesis)
  /** `DecisionRecorded`'s gate: no row when there is neither a record nor a capture to offer. */
  const showRecord = record !== null || canCapture
  const hasSlot = children !== undefined && children !== null && children !== false
  if (bullets.length === 0 && !hasSlot && !showRecord) return null

  return (
    <section
      /* fidelity gap 6/11: full-width top rule (`PANEL_RULE`), not the
         inset bottom border this section drew before. */
      className={`${PANEL_RULE} pb-3`}
      data-testid={testId}
      aria-labelledby={`${testId}-title`}
    >
      <div className="flex items-center gap-1.5">
        <h3
          id={`${testId}-title`}
          className={`${typography.panelHeader} text-text-header m-0 min-w-0 flex-1`}
        >
          {COMMITMENT_COPY.heading}
        </h3>
        <PanelIconButton
          ai
          label={COMMITMENT_COPY.ask.label}
          onClick={() =>
            onAsk({
              label: COMMITMENT_COPY.ask.label,
              draft: COMMITMENT_COPY.ask.draft,
              context: commitmentAskContext(synthesis),
            })
          }
          testId={`${testId}-ask`}
        />
        {onCompare ? (
          <PanelIconButton
            Icon={GitCompare}
            label={COMMITMENT_COPY.compare.label}
            onClick={onCompare}
            testId={`${testId}-compare`}
          />
        ) : null}
      </div>

      {bullets.length > 0 ? (
        <div className="mt-1.5" data-testid={`${testId}-synthesis`}>
          {/* ⛔ NO STALE MARKER HERE. The glance's freshness ribbon is always
              mounted above this block on a stale post-run tab and says which
              staleness it is; a second marker stated freshness twice, and its
              "From an earlier run" asserted a changed model on runs we only
              cannot confirm (V2 census, B3). */}
          {/* ⭐ V2 FIDELITY (gap 18): `list-disc pl-3.5` replaces `list-none p-0`
              — the prototype's `.commit-synthesis` sets no `list-style: none`,
              so its three lines keep the browser's own disc markers at a 14px
              indent. a `<b>` label matches its `b{font-weight:
              600}`, against the plain body weight the label shared with its
              sentence before. */}
          <ul className="list-disc pl-3.5 m-0 space-y-1">
            {bullets.map((b) => (
              <li
                key={b.key}
                className={`${typography.panelBody} text-text-body m-0`}
                data-testid={`${testId}-${b.key}`}
                data-source={b.source}
              >
                <b className="text-text-header">{b.label}: </b>
                <span data-testid={`${testId}-${b.key}-text`}>{b.text}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {hasSlot ? (
        <div className="mt-3" data-testid={`${testId}-slot`}>
          {children}
        </div>
      ) : null}

      {/* Directly under the comparison slot, never above it (it renders only
          beside that slot). Neutral ink: the words carry the caution, not an
          amber box. */}
      {hasSlot && qualifier ? (
        <p
          className={`${typography.panelMeta} text-text-light m-0 mt-1.5 flex items-center gap-1`}
          data-testid={`${testId}-qualifier`}
        >
          <Info className="h-3 w-3 shrink-0" aria-hidden={true} />
          <span>{qualifier}</span>
        </p>
      ) : null}

      {showRecord ? (
        <RecordYourView canCapture={canCapture} record={record} onRecord={onRecord} testId={`${testId}-record`} />
      ) : null}
    </section>
  )
}
