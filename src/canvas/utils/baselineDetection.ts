// ============================================================================
// BASELINE DETECTION & COMPARISON UTILITIES
// ============================================================================
//
// PURPOSE: Canonical source for all baseline-related logic:
//   - Detecting baseline/status quo options by label or value
//   - Formatting "vs." comparison text (always use formatBaselineComparison)
//   - Baseline badge styling (use getBaselineBadgeProps)
//   - Analysing options relative to baseline
//
// USAGE:
//   import { detectBaseline, formatBaselineComparison } from '@/canvas/utils/baselineDetection'
//
//   const { isBaseline } = detectBaseline(optionLabel)
//   const comparisonText = formatBaselineComparison(baselineLabel, isBaseline)
//   // → "vs. your baseline" or "vs. keeping current approach"
//
// For numeric formatting (percentages, currency), use @/lib/format instead.
// ============================================================================

/**
 * Task 1.7: Identifies baseline/status quo options and provides
 * proper labeling and comparison handling.
 */

/**
 * ⭐ THE ONE USER-FACING NAME FOR THE DO-NOTHING OPTION (Paul, 18 Aug 2026).
 *
 * This module already owned DETECTION — 14 call sites, every one of them
 * reading `.isBaseline`. It did not own the NAME, and nothing did: three
 * would-be authorities in this file and in `inspectorStrings.ts` had zero
 * non-test consumers, so every visible string was hand-written at its render
 * site. The canvas then said three things about one object — the panels badged
 * it "Baseline" while `useAddBaseline` minted a node whose visible TITLE was
 * "Status Quo" and its own chips asked about "the status quo" and "doing
 * nothing". A hand-written string in N places is the drift mechanism
 * (CLAUDE.md trap 12), so the name lives here exactly once.
 *
 * ⚠ NOT to be confused with `status_quo_bias`, a named cognitive bias carried
 * on the wire and rendered from `shared/biasSignalTitles.ts`. That is a
 * different concept and keeps its name — "Baseline bias" is not a thing.
 *
 * ⚠ The value must remain something `detectBaseline` itself recognises, or the
 * product would mint a node its own detector reads as an ordinary option.
 * `baselineVocabulary.canvas.spec.ts` pins exactly that.
 */
export const BASELINE_OPTION_LABEL = 'Baseline'

// Keywords that indicate a baseline/status quo option
const BASELINE_KEYWORDS = [
  'keep',
  'maintain',
  'do nothing',
  'status quo',
  'current',
  'existing',
  'no change',
  'stay',
  'continue',
  'as is',
  'as-is',
  'baseline',
  'default',
]

export interface BaselineDetectionResult {
  isBaseline: boolean
  /** Which keyword(s) triggered the detection */
  matchedKeywords: string[]
  /** Suggested label for display */
  displayLabel: string
}

export interface RankedOption {
  id: string
  label: string
  expectedValue: number
  rank: number
}

export interface BaselineComparisonResult {
  /** The detected baseline option (if any) */
  baselineOption: RankedOption | null
  /** Options that improve on baseline */
  improvingOptions: RankedOption[]
  /** Options that are worse than baseline */
  worseOptions: RankedOption[]
  /** True if ALL non-baseline options are worse */
  allWorseThanBaseline: boolean
  /** Message to display when all options are worse */
  warningMessage: string | null
}

/**
 * Detect if a label indicates a baseline/status quo option
 */
export function detectBaseline(label: string): BaselineDetectionResult {
  const normalizedLabel = label.toLowerCase().trim()
  const matchedKeywords: string[] = []

  for (const keyword of BASELINE_KEYWORDS) {
    if (normalizedLabel.includes(keyword.toLowerCase())) {
      matchedKeywords.push(keyword)
    }
  }

  const isBaseline = matchedKeywords.length > 0

  return {
    isBaseline,
    matchedKeywords,
    displayLabel: isBaseline ? 'Your baseline' : label,
  }
}

/**
 * Detect baseline by comparing expected values
 * An option is considered baseline if its expected_value is within 1% of baseline_value
 */
export function detectBaselineByValue(
  optionValue: number,
  baselineValue: number,
  tolerance: number = 0.01
): boolean {
  if (baselineValue === 0) {
    return Math.abs(optionValue) < tolerance
  }
  const percentDiff = Math.abs((optionValue - baselineValue) / baselineValue)
  return percentDiff < tolerance
}

/**
 * Analyse ranked options to find baseline and compare
 */
export function analyzeBaselineComparison(
  rankedOptions: RankedOption[],
  baselineValue?: number
): BaselineComparisonResult {
  if (rankedOptions.length === 0) {
    return {
      baselineOption: null,
      improvingOptions: [],
      worseOptions: [],
      allWorseThanBaseline: false,
      warningMessage: null,
    }
  }

  // Find baseline option by label first
  let baselineOption = rankedOptions.find(opt => detectBaseline(opt.label).isBaseline)

  // If not found by label and we have a baseline value, find by value
  if (!baselineOption && baselineValue !== undefined) {
    baselineOption = rankedOptions.find(opt =>
      detectBaselineByValue(opt.expectedValue, baselineValue)
    )
  }

  // If still no baseline, use the lowest-ranked option as implicit baseline
  if (!baselineOption && rankedOptions.length > 1) {
    const sorted = [...rankedOptions].sort((a, b) => a.expectedValue - b.expectedValue)
    baselineOption = sorted[0]
  }

  if (!baselineOption) {
    return {
      baselineOption: null,
      improvingOptions: rankedOptions,
      worseOptions: [],
      allWorseThanBaseline: false,
      warningMessage: null,
    }
  }

  const baselineExpectedValue = baselineOption.expectedValue
  const otherOptions = rankedOptions.filter(opt => opt.id !== baselineOption!.id)

  const improvingOptions = otherOptions.filter(opt => opt.expectedValue > baselineExpectedValue)
  const worseOptions = otherOptions.filter(opt => opt.expectedValue <= baselineExpectedValue)

  const allWorseThanBaseline = otherOptions.length > 0 && improvingOptions.length === 0

  return {
    baselineOption,
    improvingOptions,
    worseOptions,
    allWorseThanBaseline,
    warningMessage: allWorseThanBaseline
      ? 'No option improves on your current approach. Consider whether the alternatives offer other benefits not captured in this analysis.'
      : null,
  }
}

/**
 * Format comparison text relative to baseline
 * Returns "vs. your baseline" instead of "vs. do nothing"
 */
export function formatBaselineComparison(
  baselineLabel: string,
  isDetectedBaseline: boolean
): string {
  if (isDetectedBaseline) {
    return 'vs. your baseline'
  }
  // Clean up common baseline labels
  const cleaned = baselineLabel
    .replace(/^do nothing$/i, 'taking no action')
    .replace(/^status quo$/i, 'your current approach')
    .replace(/^keep$/i, 'keeping current approach')
    .replace(/^maintain$/i, 'maintaining current state')

  return `vs. ${cleaned}`
}

/**
 * Get badge props for baseline option display
 */
export function getBaselineBadgeProps(isBaseline: boolean): {
  label: string
  className: string
} | null {
  if (!isBaseline) return null

  return {
    label: 'Your baseline',
    className: 'bg-sky-100 text-sky-700 border border-sky-200',
  }
}

/**
 * ⭐ IS THIS OPTION THE BASELINE? — the ONE resolver, typed sources first.
 *
 *   1. the option node's own `is_baseline` (the user's or a receipt's stamp);
 *   2. CEE's typed `analysis_ready.options[].is_baseline` for the same id;
 *   3. only when NEITHER states it, the label heuristic (`detectBaseline`).
 *
 * WHY STEP 2 EXISTS (served BF5, UI `5e984a1d`): an option CEE adds through chat
 * ("Keep £49 and add a paid AI add-on") carries no `is_baseline` on its graph node,
 * while CEE's options entry says `is_baseline: false`. Every surface fell straight
 * to the heuristic, matched "keep", and the card read "Baseline · no changes"
 * beside the real status quo. A typed `false` must suppress the heuristic.
 */
export function resolveOptionIsBaseline(
  data: { is_baseline?: unknown; label?: unknown } | null | undefined,
  ceeOption: object | null | undefined,
  /**
   * ⭐ STEP 3 IS FOR A GRAPH THAT DECLARES NO BASELINE AT ALL (canvas audit
   * paul-models POM-3). Paul's own option "£59 for new Pro customers;
   * grandfather existing customers" matched `existing` and read "Baseline
   * option", with no change row, whenever `analysis_ready` was absent (a second
   * tab, the gate's LANDING state) — beside "Keep current £49 price", which
   * carries `is_baseline: true`. A board has one baseline; once any option
   * declares it (`baselineGuessBarred`), the keyword guess may not mint a
   * second. Narrowing the keyword list instead would be a closed lexicon over
   * open labels. Optional so a caller that cannot see the graph keeps the old
   * behaviour; every canvas caller passes it.
   */
  graphHasDeclaredBaseline = false,
): boolean {
  if (typeof data?.is_baseline === 'boolean') return data.is_baseline
  const typed = (ceeOption as { is_baseline?: unknown } | null | undefined)?.is_baseline
  if (typeof typed === 'boolean') return typed
  if (graphHasDeclaredBaseline) return false
  return detectBaseline(String(data?.label ?? '')).isBaseline
}

type BaselineFlag = { readonly id: string; readonly is_baseline?: boolean | null }

/**
 * CEE's baseline flags from a cold read (`current_read.analysis_ready.options[].is_baseline`, parsed by
 * `scenarioGraph.ts` as `switchAnalysisReady`), kept beside the switch ids. Read-only: never written back to a node.
 */
export function servedBaselineOptionsOf(analysisReady: unknown): readonly BaselineFlag[] {
  const options = (analysisReady as { options?: unknown } | null)?.options
  if (!Array.isArray(options)) return []
  return options.flatMap((o): BaselineFlag[] => {
    const id = (o as { id?: unknown } | null)?.id
    const flag = (o as { is_baseline?: unknown } | null)?.is_baseline
    return typeof id === 'string' && typeof flag === 'boolean' ? [{ id, is_baseline: flag }] : []
  })
}

/**
 * ⭐ CEE'S OPTIONS FOR THE BASELINE QUESTION: the live `analysis_ready` when a turn has brought one, else the cold
 * read's flags. On a cold reopen `ceeAnalysisReady` starts null, and the label guess made "£59 for new Pro customers;
 * grandfather existing customers" a second baseline beside "Keep current £49 price" (DL-3, pricing journey, UI
 * 0d4fed07), although the read carried CEE's answer all along.
 */
export function baselineOptionsOf(state: {
  readonly ceeAnalysisReady?: { readonly options?: readonly BaselineFlag[] } | null
  readonly servedBaselineOptions?: readonly BaselineFlag[]
} | null | undefined): readonly BaselineFlag[] | undefined {
  const live = state?.ceeAnalysisReady?.options
  if (live && live.length > 0) return live
  const served = state?.servedBaselineOptions
  return served && served.length > 0 ? served : undefined
}

/**
 * May the label guess (`detectBaseline`) name a baseline on this board? Only when nothing typed speaks:
 *   - CEE has flagged its options (true or false): CEE is the one authority, so never;
 *   - an option node declares `is_baseline: true` (POM-3): never a second;
 *   - otherwise only when EXACTLY ONE option's label matches, so a guess cannot mint two baselines.
 * `true` = the guess is barred. The input to `resolveOptionIsBaseline`'s third argument.
 */
export function baselineGuessBarred(
  nodes: ReadonlyArray<{ type?: string; data?: unknown }> | null | undefined,
  ceeOptions: ReadonlyArray<BaselineFlag> | null | undefined,
): boolean {
  if (ceeOptions?.some((o) => typeof o?.is_baseline === 'boolean')) return true
  const options = (nodes ?? []).filter((n) => {
    const d = n?.data as { type?: unknown; kind?: unknown } | undefined
    return n?.type === 'option' || d?.type === 'option' || d?.kind === 'option'
  })
  if (options.some((n) => (n.data as { is_baseline?: unknown } | undefined)?.is_baseline === true)) return true
  const guessed = options.filter((n) => detectBaseline(String((n.data as { label?: unknown } | undefined)?.label ?? '')).isBaseline)
  return guessed.length !== 1
}
