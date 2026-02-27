import {
  BRIEF_MIN_CHARS,
  BRIEF_MIN_WORDS,
  BRIEF_NON_ALPHA_WARN_RATIO,
} from '../../constants/validation'

export interface BriefValidationResult {
  /** Whether the brief passes all hard gates and can be submitted. */
  isValid: boolean
  /** Whether the brief triggers a soft warning (non-blocking). */
  hasSoftWarning: boolean
  /** Soft warning text, or null if no warning. */
  warningText: string | null
}

/**
 * Validate a decision brief for submission.
 *
 * Hard gates (block submit):
 * - brief.trim().length < BRIEF_MIN_CHARS
 * - brief.trim().split(/\s+/).length < BRIEF_MIN_WORDS
 *
 * Soft warning (does not block):
 * - >60% non-alphabetic characters after trim
 */
export function validateBrief(raw: string): BriefValidationResult {
  const trimmed = raw.trim()

  // Hard gate: minimum character count
  if (trimmed.length < BRIEF_MIN_CHARS) {
    return { isValid: false, hasSoftWarning: false, warningText: null }
  }

  // Hard gate: minimum word count
  if (trimmed.split(/\s+/).length < BRIEF_MIN_WORDS) {
    return { isValid: false, hasSoftWarning: false, warningText: null }
  }

  // Soft warning: high ratio of non-alphabetic characters
  if (trimmed.length > 0) {
    const alphaCount = (trimmed.match(/[a-zA-Z]/g) || []).length
    const nonAlphaRatio = 1 - alphaCount / trimmed.length
    if (nonAlphaRatio > BRIEF_NON_ALPHA_WARN_RATIO) {
      return {
        isValid: true,
        hasSoftWarning: true,
        warningText:
          'Your brief contains a lot of numbers or symbols. Adding more descriptive text usually gives better results.',
      }
    }
  }

  return { isValid: true, hasSoftWarning: false, warningText: null }
}
