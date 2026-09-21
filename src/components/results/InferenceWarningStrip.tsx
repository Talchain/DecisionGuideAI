/**
 * InferenceWarningStrip — compact honest-caveat strip for warning-severity
 * producer `inference_warnings` on the Analysis tab (roadmap 1.12; tagged
 * provisional_doctrine_v0).
 *
 * Contract:
 *   - Renders ONLY entries whose producer `severity` is exactly 'warning'.
 *     Info-severity entries stay hidden here (they remain available to the
 *     Advanced/Confidence surfaces and the debug bundle). Entries with no
 *     severity are NOT promoted — the UI never invents a severity.
 *   - Copy is HUMANISED via the same `humaniseCritique` path every other
 *     critique surface uses (ConfidenceSection, useResultsSectionData) — the
 *     UI keys off producer `code`, never renders the raw `message` in JSX
 *     (V14.3 no-message-render guard). Unmapped codes fall through to
 *     humaniseCritique's safe generic copy rather than the raw string; an
 *     entry without a usable message renders nothing (fail-closed; no
 *     fabricated copy from `code` alone).
 *   - Display-only: never blocks analysis, never mutates state.
 *
 * Visual idiom mirrors AnalysisFreshnessNotice (the strip mounts directly
 * below it in ResultsBody): bg-panel card, border via opacity token,
 * lucide icon, panelBody typography.
 */
import { useEffect, useRef, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { typography } from '@/styles/typography'
import {
  humaniseInferenceWarningTitle,
  heldBackStripCount,
  isStripEntry,
  selectRestingStripEntries,
} from './utils/humaniseInferenceWarning'
import type { InferenceWarning } from './types'

export interface InferenceWarningStripProps {
  /** Producer inference warnings (all severities); the strip filters. */
  warnings?: InferenceWarning[]
  className?: string
}

/**
 * Entries the strip will show: severity === 'warning' AND a non-empty producer
 * message.
 *
 * The predicate itself now lives in `utils/humaniseInferenceWarning.ts` as
 * `isStripEntry`, because `AdvancedSection` renders this set's COMPLEMENT and
 * a second spelling of it would be a mirror that drifts silently — the two
 * surfaces would start repeating each other and no guard would notice
 * (CLAUDE.md trap 12). This wrapper keeps the strip's own named selector.
 */
/**
 * ⭐⭐ ONE ENTRY, CLAMPED AT REST — AND THE REASON IS A MEASUREMENT, NOT TASTE.
 *
 * Measured on deployed `e30ca697` through the guest path, Reasoning tab at
 * 1600x1000 (panel 331px wide, 715px visible, 1974px of content):
 *
 *     inference-warning-strip     174px   <- 24% of the FIRST SCREEN
 *     analysis-new-model-strip    132px
 *     analysis-new-zone-focus     221px
 *     ------------------------------------
 *     527px of 715px before the reader meets a single finding.
 *
 * The 174px is ONE entry. `GOAL_DIRECTION_UNATTESTED` has the longest title in
 * the whole vocabulary — **303 characters, three sentences, against a median of
 * 155 across 30 codes** (derived by calling `humaniseCritique` for every code,
 * not by reading the file) — and `humaniseCritique.ts` records that it **fires
 * on every run**. So the longest warning we have is the first thing on the
 * panel, every single time.
 *
 * ⛔ THE COPY IS NOT THE DEFECT AND MUST NOT BE SHORTENED. The obvious fix is
 * to move sentences two and three into `description`. **That would delete
 * them.** `humaniseCritique.ts:506` states it in capitals: *"Both live surfaces
 * render the TITLE ONLY ... A route parked in `description`/`suggestion` would
 * be invisible."* The title is long BECAUSE this surface renders one field.
 * Its two load-bearing facts are pinned by
 * `humaniseCritique.inferenceWarningVocabulary.spec.ts` (`/largest value/i` and
 * `/different question/i`), so they are not mine to trade away either.
 *
 * ⭐ SO THE FIX IS THE SURFACE, NOT THE SENTENCE. Clamped to two lines at rest,
 * expandable in place. Every word stays reachable; none of it is deleted, and
 * no producer copy changes.
 *
 * ⚠ THE TOGGLE IS MEASURED, NEVER GUESSED FROM A CHARACTER COUNT. A threshold
 * like "over 120 characters" is a constant that silently decays the first time
 * the dock width or the type scale moves — this estate has shipped exactly that
 * defect (a character budget inside a pixel box, three times on one canvas).
 * `scrollHeight > clientHeight` asks the browser the actual question. In jsdom
 * both read 0, so the toggle does not render there: the clamp CLASS is the
 * jsdom-observable half, and the toggle is browser-gate territory.
 *
 * ⚠ WHY THIS IS NOT A SILENT TRUNCATION, which the strip already forbids for
 * held-back ENTRIES: the control is present and labelled whenever there is
 * anything behind it, and it expands in place rather than sending the reader
 * elsewhere.
 */
function StripEntry({ warning }: { warning: InferenceWarning }): JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const [overflows, setOverflows] = useState(false)
  const textRef = useRef<HTMLSpanElement>(null)

  const title = humaniseInferenceWarningTitle(warning)

  useEffect(() => {
    const el = textRef.current
    if (el === null) return
    // +1 absorbs sub-pixel line-height rounding, which otherwise reports a
    // one-line entry as overflowing on some zoom levels.
    setOverflows(el.scrollHeight > el.clientHeight + 1)
  }, [title])

  return (
    <div
      data-testid="inference-warning-strip-entry"
      data-warning-code={warning.code}
      data-warning-severity={warning.severity}
      /* `items-start`, not `items-center`: once the text can run to two lines
         the icon must hold the FIRST line, not float to the block's middle. */
      className="flex items-start gap-2 rounded-md border px-3 py-2 bg-panel border-warning/30"
    >
      <AlertTriangle size={14} className="flex-none mt-0.5 text-warning" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        {/* Humanised copy — never the producer's raw message (V14.3 guard). */}
        <span
          ref={textRef}
          data-testid="inference-warning-strip-entry-text"
          className={`${typography.panelBody} text-text-body block ${expanded ? '' : 'line-clamp-2'}`}
        >
          {title}
        </span>
        {overflows ? (
          <button
            type="button"
            data-testid="inference-warning-strip-entry-toggle"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className={`${typography.panelMeta} inline-flex items-center min-h-[24px] text-info underline mt-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
        ) : null}
      </span>
    </div>
  )
}

export function selectWarningSeverityEntries(
  warnings: InferenceWarning[] | undefined,
): InferenceWarning[] {
  return (warnings ?? []).filter(isStripEntry)
}

/**
 * ⭐ WHAT THE READER MEETS AT REST — capped, with the remainder disclosed.
 * `selectRestingStripEntries` and `selectHumanisedInferenceWarningsOutsideStrip`
 * are defined against the SAME pass, so the held-back entries render in the
 * detail row rather than nowhere.
 */
export function selectRestingEntries(
  warnings: InferenceWarning[] | undefined,
): InferenceWarning[] {
  return selectRestingStripEntries(warnings)
}

export function InferenceWarningStrip({ warnings, className = '' }: InferenceWarningStripProps) {
  const visible = selectRestingEntries(warnings)
  const heldBack = heldBackStripCount(warnings)
  if (visible.length === 0) return null

  return (
    <div
      data-testid="inference-warning-strip"
      className={`flex flex-col gap-1 ${className}`.trim()}
      aria-label="Analysis caveats"
    >
      {visible.map((w, i) => (
        <StripEntry key={`${w.code}-${i}`} warning={w} />
      ))}
      {/* ⚠ THE CAP IS A DISCLOSURE, NEVER A SILENT TRUNCATION. The held-back
          entries render in "How this was worked out", in producer order, and
          this line says how many and where — so a reader is told what is behind
          the tap rather than discovering it. Naming the destination by the
          heading it carries is the estate's existing rule for a section that
          points at another one. */}
      {heldBack > 0 ? (
        <p
          data-testid="inference-warning-strip-held-back"
          className={`${typography.panelMeta} text-text-light`}
        >
          {heldBack === 1
            ? 'One more limitation is listed under How this was worked out.'
            : `${heldBack} more limitations are listed under How this was worked out.`}
        </p>
      ) : null}
    </div>
  )
}

export default InferenceWarningStrip
