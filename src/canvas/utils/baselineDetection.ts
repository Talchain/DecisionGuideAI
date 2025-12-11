/**
 * Baseline Detection Utilities
 *
 * Task 1.7: Identifies baseline/status quo options and provides
 * proper labeling and comparison handling.
 */

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
 * Analyze ranked options to find baseline and compare
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
