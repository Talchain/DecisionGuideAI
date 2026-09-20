/**
 * SignedStrengthSlider — bidirectional slider for edge effect strength
 *
 * B.I.6: Range -1 to +1, step 0.01
 * Writes: weight = Math.abs(value), direction = value >= 0 ? 'positive' : 'negative'
 * Adapter's computeSignedMean() reconstructs signed strength from weight + direction.
 *
 * Track fill: var(--success) for positive, var(--danger) for negative
 * Endpoints: "Strong negative" (left), "Strong positive" (right), "No effect" at centre
 *
 * ⚠ THE ENDPOINT WORDS ARE NOT BAND LABELS AND ARE DELIBERATELY NOT DERIVED
 * FROM `CANVAS_STRENGTH_BANDS` (named apart 18 Sep 2026, CLAUDE.md trap 21). They
 * answer *"which end of this track is which direction?"* — a fixed pair of
 * anchors either side of "No effect" — not *"what word is this value entitled
 * to?"*, which is what the coaching line below the track and the band pills
 * above it answer, both now from the one canonical table. Deriving the anchors
 * would re-label the left end "Very strong negative" for no reason a user cares
 * about and would tie a directional caption to a magnitude-only table. If you
 * are here to unify a strength vocabulary, `getEffectSizeCoaching` is the one
 * that was genuinely answering the same question — and it already is.
 *
 * ── ⛔⛔ `aria-valuetext` KEEPS ITS FIGURE. DO NOT BAND IT. (19 Sep 2026) ───
 * A raw-float census shortlisted `aria-valuetext` below as a progressive-
 * disclosure defect (*"a screen-reader user hears 'zero point three five'"*).
 * It is not one, for two reasons that were measured rather than argued:
 *
 * 1. THIS IS AN INTERACTIVE CONTROL, NOT A READ-OUT. The user drags this input
 *    to SET the value (`step={0.01}`). A screen-reader user aiming for 0.35
 *    cannot get there from the word "Moderate", which spans 0.20–0.40 on the
 *    canonical table — 0.21 and 0.39 would announce identically. Banding a
 *    draggable control's accessible value is an accessibility REGRESSION
 *    wearing a progressive-disclosure costume. Compare the genuinely read-only
 *    case: `NodeInspector`'s `role="meter"` utility bar, where the same change
 *    would be fine — and which is dark anyway (see that file's header).
 *
 * 2. A BAND WORD HERE WOULD LIGHT A MEASURED COLLISION. This component is
 *    SHARED with `components/model-tab/ContestedEdgeCard.tsx:396`, which labels
 *    the same number via `model-tab/strengthBands.getDirectionalStrengthLabel`
 *    on cuts of 0.6 / 0.25 / 0.05, against `CANVAS_STRENGTH_BANDS`' 0.70 / 0.40
 *    / 0.20. At |0.5| the card says "Moderate positive effect" while the
 *    canonical table says "Strong" — ONE number, TWO words, on ONE card.
 *    `inspector/coachingText.ts` records that collision as LATENT; putting a
 *    canonical band word in this attribute is one of the ways to light it.
 *
 * The parity the founder's complaint actually asks for is satisfied the other
 * way round: the plain-language captions are now ON by default (see `techMode`),
 * so the sighted user gets words AND the screen-reader user keeps the precision
 * the control needs. `__tests__/sliderPlainLanguageIsTheDefault.spec.tsx` pins
 * both halves and REDs if either is "tidied".
 *
 * ⚠ RUNG: this paragraph is CODE-DERIVED. Nothing here is a render or journey
 * witness, and no claim is made that any caption is legible or on screen.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { typography } from '../../../styles/typography'
import { getEffectSizeCoaching } from './coachingText'

interface SignedStrengthSliderProps {
  /** Current signed value (-1 to +1) */
  value: number
  /** Callback with new signed value, debounced internally */
  onChange: (signedValue: number) => void
  /** Debounce delay in ms (default 120) */
  debounceMs?: number
  /** Disabled state */
  disabled?: boolean
  /** C1: Standard deviation for uncertainty band overlay */
  std?: number
  /** Graph Editing Experience Task 5: Called on slider release/blur to clear impact preview */
  onBlur?: () => void
  /**
   * SUPPRESS this component's own plain-language endpoint captions, because the
   * HOST panel already renders its own scale. Default `false` — a standalone
   * slider labels its own track.
   *
   * ⚠⚠ THE PREVIOUS DOC ON THIS LINE WAS STALE AND IT MISLED A CENSUS.
   * It read *"Show decimal values alongside the label (default true for
   * backwards compat)"*. This component renders **no decimal value in the
   * visible DOM at all** — that readout was removed (see the comment at the end
   * of the JSX), so the sentence described behaviour that no longer existed.
   * `techMode`'s ONLY consumer is the `{!techMode && …}` caption block below.
   *
   * ⛔ SO THE NAME IS BACKWARDS AND THE DOC IS THE ONLY THING HOLDING IT
   * TOGETHER. `techMode` here does not reveal technical detail; it HIDES plain
   * language. A 2026-09-19 raw-float census read the old `= true` default as
   * *"v1 defaults technical detail ON"* and proposed flipping it to help
   * onboarding users — right conclusion, inverted reason: `true` was
   * suppressing the words, not showing the numbers.
   *
   * The honest rename is `hostRendersItsOwnScale`, which cannot be done from
   * this file alone — `inspector-v2/panels/EdgePanel.tsx:893` is the one caller
   * that passes it, and that file is owned elsewhere. Renaming is left to its
   * owner; this doc states the true meaning in the meantime.
   */
  techMode?: boolean
}

export function SignedStrengthSlider({
  value,
  onChange,
  debounceMs = 120,
  disabled = false,
  std,
  onBlur,
  techMode = false,
}: SignedStrengthSliderProps) {
  const [localValue, setLocalValue] = useState(value)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  // Sync local state when prop changes
  useEffect(() => {
    setLocalValue(value)
  }, [value])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value)
    setLocalValue(newValue)

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      onChange(newValue)
    }, debounceMs)
  }, [onChange, debounceMs])

  const isNegative = localValue < 0
  const absValue = Math.abs(localValue)
  const displayColor = isNegative ? 'text-danger' : localValue > 0 ? 'text-success' : 'text-text-light'
  const directionLabel = isNegative ? 'Negative' : localValue > 0 ? 'Positive' : 'No effect'

  // D.2: Effect size coaching nudge from local state for instant feedback
  const effectCoaching = getEffectSizeCoaching(absValue)

  // Calculate fill gradient position (centre-out)
  const fillPercent = absValue * 50 // 0-50% from centre
  const fillLeft = isNegative ? `${50 - fillPercent}%` : '50%'
  const fillWidth = `${fillPercent}%`
  const fillColor = isNegative ? 'var(--danger)' : 'var(--success)'

  return (
    <div>
      {/* Endpoint labels — hidden in tech mode (numeric scale shown by EdgePanel instead) */}
      {!techMode && (
        <div className="flex items-center justify-between mb-1">
          <span className={`${typography.panelMeta} text-danger`}>Strong negative</span>
          <span className={`${typography.panelMeta} text-text-light`}>No effect</span>
          <span className={`${typography.panelMeta} text-success`}>Strong positive</span>
        </div>
      )}

      {/* Slider with custom track fill */}
      <div className="relative h-6 flex items-center">
        {/* Background track */}
        <div className="absolute inset-x-0 h-1.5 bg-panel-border rounded-full" />
        {/* C1: Uncertainty band — shows +/- std around current value */}
        {std != null && std > 0 && (() => {
          const bandLow = Math.max(-1, localValue - std)
          const bandHigh = Math.min(1, localValue + std)
          // Map from [-1, 1] to [0%, 100%]
          const bandLeftPct = ((bandLow + 1) / 2) * 100
          const bandWidthPct = ((bandHigh - bandLow) / 2) * 100
          return (
            <div
              className="absolute h-3 rounded-full bg-info/20"
              style={{
                left: `${bandLeftPct}%`,
                width: `${bandWidthPct}%`,
              }}
              aria-hidden="true"
              data-testid="uncertainty-band"
            />
          )
        })()}
        {/* Centre marker */}
        <div className="absolute left-1/2 -translate-x-px w-0.5 h-3 bg-text-light rounded-full" />
        {/* Fill from centre */}
        <div
          className="absolute h-1.5 rounded-full transition-all duration-100"
          style={{
            left: fillLeft,
            width: fillWidth,
            backgroundColor: fillColor,
          }}
        />
        {/* Native range input */}
        <input
          type="range"
          min={-1}
          max={1}
          step={0.01}
          value={localValue}
          onChange={handleChange}
          onBlur={onBlur}
          onMouseUp={onBlur}
          onTouchEnd={onBlur}
          disabled={disabled}
          className="relative w-full h-6 appearance-none bg-transparent cursor-pointer z-10
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2
            [&::-webkit-slider-thumb]:border-text-light [&::-webkit-slider-thumb]:shadow-sm
            [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-text-light
            [&::-moz-range-track]:bg-transparent [&::-webkit-slider-runnable-track]:bg-transparent"
          aria-valuemin={-1}
          aria-valuemax={1}
          aria-valuenow={localValue}
          aria-valuetext={`${directionLabel}: ${localValue.toFixed(2)}`}
          aria-label="Effect on target"
        />
      </div>

      {/* Value display and coaching nudge removed — EdgePanel renders the strength pill instead */}
    </div>
  )
}
