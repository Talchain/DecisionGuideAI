/**
 * RiskProfileSelector - Select risk tolerance via presets or questionnaire
 *
 * Features:
 * - Quick-select presets: Risk Averse 🛡️, Neutral ⚖️, Risk Seeking 🎲
 * - "Take questionnaire" button for personalized assessment
 * - Step-through questions with progress bar
 * - Display resulting profile with confidence and reasoning
 */

import { useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  Sparkles,
} from 'lucide-react'
import { useRiskProfile, RISK_PRESETS } from '../hooks/useRiskProfile'
import { typography } from '../../styles/typography'
import type { RiskProfilePreset, RiskProfile } from '../../adapters/plot/types'

interface RiskProfileSelectorProps {
  /** Initial profile (if previously set) */
  initialProfile?: RiskProfile | null
  /** Context for better calibration */
  context?: {
    decision_domain?: string
    time_horizon?: 'short' | 'medium' | 'long'
  }
  /** Called when profile changes */
  onProfileChange?: (profile: RiskProfile) => void
  /** Whether component is disabled */
  disabled?: boolean
}

export function RiskProfileSelector({
  initialProfile,
  context,
  onProfileChange,
  disabled = false,
}: RiskProfileSelectorProps) {
  const {
    profile,
    loading,
    error,
    questions,
    currentQuestionIndex,
    answers,
    progress,
    isQuestionnaireActive,
    selectPreset,
    startQuestionnaire,
    answerQuestion,
    previousQuestion,
    submitQuestionnaire,
    cancelQuestionnaire,
    clearProfile,
  } = useRiskProfile({
    initialProfile,
    context,
    onProfileChange,
  })

  const currentQuestion = questions[currentQuestionIndex]
  const currentAnswer = answers.find(a => a.question_id === currentQuestion?.id)?.answer
  const canSubmit = answers.length >= questions.length
  const isLastQuestion = currentQuestionIndex === questions.length - 1

  // Confidence badge colors
  const confidenceConfig = {
    high: { bg: 'bg-mint-100', text: 'text-mint-700', label: 'High confidence' },
    medium: { bg: 'bg-banana-100', text: 'text-banana-700', label: 'Medium confidence' },
    low: { bg: 'bg-sand-100', text: 'text-sand-600', label: 'Low confidence' },
  }

  // If questionnaire is active, show questionnaire UI
  if (isQuestionnaireActive && questions.length > 0) {
    return (
      <div
        className="space-y-4"
        data-testid="risk-questionnaire"
        role="region"
        aria-label="Risk tolerance questionnaire"
      >
        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className={`${typography.caption} text-ink-500`}>
              Question {currentQuestionIndex + 1} of {questions.length}
            </span>
            <span className={`${typography.caption} text-ink-500`}>
              {progress}%
            </span>
          </div>
          <div className="h-2 bg-sand-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-sky-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>

        {/* Question */}
        {currentQuestion && (
          <div className="space-y-3">
            <p className={`${typography.body} text-ink-800`}>
              {currentQuestion.text}
            </p>

            {/* Scale question */}
            {currentQuestion.type === 'scale' && currentQuestion.scale && (
              <div className="space-y-2">
                <input
                  type="range"
                  min={currentQuestion.scale.min}
                  max={currentQuestion.scale.max}
                  value={typeof currentAnswer === 'number' ? currentAnswer : (currentQuestion.scale.min + currentQuestion.scale.max) / 2}
                  onChange={(e) => answerQuestion(parseInt(e.target.value, 10))}
                  disabled={disabled || loading}
                  className="w-full h-2 bg-sand-200 rounded-lg appearance-none cursor-pointer
                    [&::-webkit-slider-thumb]:appearance-none
                    [&::-webkit-slider-thumb]:w-5
                    [&::-webkit-slider-thumb]:h-5
                    [&::-webkit-slider-thumb]:rounded-full
                    [&::-webkit-slider-thumb]:bg-sky-500
                    [&::-webkit-slider-thumb]:cursor-pointer
                    disabled:opacity-50"
                  aria-label={currentQuestion.text}
                />
                <div className="flex justify-between">
                  <span className={`${typography.caption} text-ink-400`}>
                    {currentQuestion.scale.min_label}
                  </span>
                  <span className={`${typography.caption} text-ink-600 font-medium`}>
                    {typeof currentAnswer === 'number' ? currentAnswer : '—'}
                  </span>
                  <span className={`${typography.caption} text-ink-400`}>
                    {currentQuestion.scale.max_label}
                  </span>
                </div>
              </div>
            )}

            {/* Choice question */}
            {currentQuestion.type === 'choice' && currentQuestion.choices && (
              <div className="space-y-2">
                {currentQuestion.choices.map((choice) => (
                  <button
                    key={String(choice.value)}
                    type="button"
                    onClick={() => answerQuestion(choice.value)}
                    disabled={disabled || loading}
                    className={`w-full px-4 py-3 rounded-lg border text-left transition-colors
                      ${currentAnswer === choice.value
                        ? 'bg-sky-50 border-sky-500 text-sky-900'
                        : 'bg-white border-sand-300 text-ink-700 hover:bg-sand-50'
                      }
                      disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <span className={typography.body}>{choice.label}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Numeric question */}
            {currentQuestion.type === 'numeric' && (
              <input
                type="number"
                value={typeof currentAnswer === 'number' ? currentAnswer : ''}
                onChange={(e) => answerQuestion(parseFloat(e.target.value) || 0)}
                min={currentQuestion.range?.min}
                max={currentQuestion.range?.max}
                step={currentQuestion.range?.step || 1}
                disabled={disabled || loading}
                className="w-full px-4 py-3 rounded-lg border border-sand-300 text-ink-800
                  focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent
                  disabled:opacity-50"
                aria-label={currentQuestion.text}
              />
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={currentQuestionIndex === 0 ? cancelQuestionnaire : previousQuestion}
            disabled={loading}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors
              ${currentQuestionIndex === 0
                ? 'text-ink-500 hover:text-ink-700'
                : 'text-ink-600 hover:text-ink-800'
              }`}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            {currentQuestionIndex === 0 ? 'Cancel' : 'Back'}
          </button>

          {isLastQuestion && canSubmit ? (
            <button
              type="button"
              onClick={submitQuestionnaire}
              disabled={disabled || loading}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium
                bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <CheckCircle className="h-4 w-4" aria-hidden="true" />
              )}
              {loading ? 'Analyzing...' : 'Get my profile'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (currentAnswer !== undefined && !isLastQuestion) {
                  // Auto-advance if already answered
                } else if (isLastQuestion && !canSubmit) {
                  // Show hint that answer is required
                }
              }}
              disabled={currentAnswer === undefined || isLastQuestion}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors
                ${currentAnswer !== undefined
                  ? 'text-sky-600 hover:text-sky-700'
                  : 'text-ink-400 cursor-not-allowed'
                }`}
            >
              Next
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    )
  }

  // If profile is set, show profile display
  if (profile) {
    const conf = confidenceConfig[profile.confidence]

    return (
      <div
        className="space-y-3"
        data-testid="risk-profile-display"
        role="region"
        aria-label="Risk profile"
      >
        {/* Profile card */}
        <div className="p-4 rounded-lg bg-white border border-sand-200">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{RISK_PRESETS[profile.profile]?.icon || '🎯'}</span>
              <div>
                <h4 className={`${typography.label} text-ink-800`}>{profile.label}</h4>
                <span className={`${typography.caption} px-2 py-0.5 rounded-full ${conf.bg} ${conf.text}`}>
                  {conf.label}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={clearProfile}
              disabled={disabled}
              className="text-ink-400 hover:text-ink-600 text-sm underline"
            >
              Change
            </button>
          </div>

          {/* Score bar */}
          <div className="mt-3 space-y-1">
            <div className="flex justify-between">
              <span className={`${typography.caption} text-ink-400`}>Risk Averse</span>
              <span className={`${typography.caption} text-ink-400`}>Risk Seeking</span>
            </div>
            <div className="h-2 bg-sand-200 rounded-full relative">
              <div
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-sky-500 rounded-full border-2 border-white shadow"
                style={{ left: `${Math.max(0, Math.min(100, profile.score * 100))}%`, marginLeft: '-8px' }}
              />
            </div>
          </div>

          {/* Reasoning */}
          {profile.reasoning && (
            <p className={`${typography.caption} text-ink-500 mt-3`}>
              {profile.reasoning}
            </p>
          )}

          {/* Capacity note */}
          {profile.capacity_note && (
            <div className="mt-3 flex items-start gap-2 p-2 rounded bg-banana-50">
              <AlertTriangle className="h-4 w-4 text-banana-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <span className={`${typography.caption} text-banana-800`}>
                {profile.capacity_note}
              </span>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Default: show preset selection
  return (
    <div
      className="space-y-4"
      data-testid="risk-profile-selector"
      role="region"
      aria-label="Risk tolerance selection"
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className={`${typography.label} text-ink-800`}>
          Risk Tolerance
        </span>
        <button
          type="button"
          onClick={startQuestionnaire}
          disabled={disabled || loading}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm
            text-violet-700 bg-violet-50 hover:bg-violet-100 transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <HelpCircle className="h-4 w-4" aria-hidden="true" />
          )}
          Take questionnaire
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-carrot-50 border border-carrot-200">
          <AlertTriangle className="h-4 w-4 text-carrot-600 flex-shrink-0" aria-hidden="true" />
          <span className={`${typography.caption} text-carrot-800`}>{error}</span>
        </div>
      )}

      {/* Preset buttons */}
      <div className="grid grid-cols-3 gap-2">
        {(Object.entries(RISK_PRESETS) as [RiskProfilePreset, typeof RISK_PRESETS['neutral']][]).map(
          ([preset, config]) => (
            <button
              key={preset}
              type="button"
              onClick={() => selectPreset(preset)}
              disabled={disabled || loading}
              className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-colors
                bg-white border-sand-300 text-ink-700 hover:bg-sand-50 hover:border-sand-400
                disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <span className="text-2xl">{config.icon}</span>
              <span className={`${typography.caption} font-medium text-center`}>
                {config.label}
              </span>
            </button>
          )
        )}
      </div>

      {/* Helper text */}
      <p className={`${typography.caption} text-ink-400 text-center`}>
        Select a preset or take the questionnaire for a personalized assessment
      </p>
    </div>
  )
}
