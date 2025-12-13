/**
 * useRiskProfile - Manage risk tolerance profile via questionnaire or presets
 *
 * Features:
 * - Quick-select presets: Risk Averse, Neutral, Risk Seeking
 * - Questionnaire flow with progress tracking
 * - Submit answers to get personalized profile
 * - Persist selected profile for analysis
 */

import { useState, useCallback, useMemo } from 'react'
import { httpV1Adapter } from '../../adapters/plot/httpV1Adapter'
import type {
  RiskProfilePreset,
  RiskQuestion,
  RiskProfile,
  RiskProfileResponse,
} from '../../adapters/plot/types'

interface Answer {
  question_id: string
  answer: string | number
}

interface UseRiskProfileOptions {
  /** Initial profile (if previously set) */
  initialProfile?: RiskProfile | null
  /** Context for better calibration */
  context?: {
    decision_domain?: string
    time_horizon?: 'short' | 'medium' | 'long'
  }
  /** Called when profile changes */
  onProfileChange?: (profile: RiskProfile) => void
}

interface UseRiskProfileResult {
  /** Current risk profile */
  profile: RiskProfile | null
  /** Loading state */
  loading: boolean
  /** Error message */
  error: string | null
  /** Questionnaire questions (when in questionnaire mode) */
  questions: RiskQuestion[]
  /** Current question index */
  currentQuestionIndex: number
  /** User's answers */
  answers: Answer[]
  /** Progress percentage (0-100) */
  progress: number
  /** Whether questionnaire is active */
  isQuestionnaireActive: boolean
  /** Select a preset profile */
  selectPreset: (preset: RiskProfilePreset) => Promise<void>
  /** Start questionnaire flow */
  startQuestionnaire: () => Promise<void>
  /** Answer current question and advance */
  answerQuestion: (answer: string | number) => void
  /** Go back to previous question */
  previousQuestion: () => void
  /** Submit answers to get profile */
  submitQuestionnaire: () => Promise<void>
  /** Cancel questionnaire */
  cancelQuestionnaire: () => void
  /** Clear current profile */
  clearProfile: () => void
}

/** Preset configurations with display info */
export const RISK_PRESETS: Record<RiskProfilePreset, {
  label: string
  description: string
  icon: string
  score: number // 0=averse, 0.5=neutral, 1=seeking
}> = {
  risk_averse: {
    label: 'Risk Averse',
    description: 'Prefer certainty over higher potential gains',
    icon: '🛡️',
    score: 0.2,
  },
  neutral: {
    label: 'Neutral',
    description: 'Balance risk and reward equally',
    icon: '⚖️',
    score: 0.5,
  },
  risk_seeking: {
    label: 'Risk Seeking',
    description: 'Accept higher risk for greater potential',
    icon: '🎲',
    score: 0.8,
  },
}

export function useRiskProfile({
  initialProfile = null,
  context,
  onProfileChange,
}: UseRiskProfileOptions = {}): UseRiskProfileResult {
  const [profile, setProfile] = useState<RiskProfile | null>(initialProfile)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Questionnaire state
  const [questions, setQuestions] = useState<RiskQuestion[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [isQuestionnaireActive, setIsQuestionnaireActive] = useState(false)

  // Calculate progress
  const progress = useMemo(() => {
    if (questions.length === 0) return 0
    return Math.round((answers.length / questions.length) * 100)
  }, [questions.length, answers.length])

  // Notify parent of profile changes
  const notifyChange = useCallback((newProfile: RiskProfile) => {
    setProfile(newProfile)
    if (onProfileChange) {
      onProfileChange(newProfile)
    }
  }, [onProfileChange])

  // Select a preset profile (quick path)
  const selectPreset = useCallback(async (preset: RiskProfilePreset) => {
    setLoading(true)
    setError(null)
    setIsQuestionnaireActive(false)

    try {
      const response = await httpV1Adapter.getRiskProfileFromPreset(preset, context)
      notifyChange(response.profile)
    } catch (err: any) {
      const errorMessage = err?.error || err?.message || 'Failed to set risk profile'
      setError(errorMessage)

      // Fallback: create local profile from preset config
      const presetConfig = RISK_PRESETS[preset]
      const fallbackProfile: RiskProfile = {
        profile: preset,
        label: presetConfig.label,
        score: presetConfig.score,
        confidence: 'low', // Low confidence because it's from preset, not questionnaire
        reasoning: `Selected "${presetConfig.label}" preset: ${presetConfig.description}`,
      }
      notifyChange(fallbackProfile)

      if (import.meta.env.DEV) {
        console.warn('[useRiskProfile] Using fallback profile:', errorMessage)
      }
    } finally {
      setLoading(false)
    }
  }, [context, notifyChange])

  // Start questionnaire flow
  const startQuestionnaire = useCallback(async () => {
    setLoading(true)
    setError(null)
    setAnswers([])
    setCurrentQuestionIndex(0)

    try {
      const response = await httpV1Adapter.getRiskQuestions(context)
      setQuestions(response.questions)
      setIsQuestionnaireActive(true)
    } catch (err: any) {
      const errorMessage = err?.error || err?.message || 'Failed to load questionnaire'
      setError(errorMessage)

      // Fallback: use default questions
      const fallbackQuestions: RiskQuestion[] = [
        {
          id: 'q1',
          text: 'When making decisions, how do you typically respond to uncertainty?',
          type: 'choice',
          choices: [
            { value: 'avoid', label: 'I try to avoid uncertain situations' },
            { value: 'accept', label: 'I accept uncertainty as part of life' },
            { value: 'embrace', label: 'I see uncertainty as an opportunity' },
          ],
        },
        {
          id: 'q2',
          text: 'On a scale of 1-10, how comfortable are you with outcomes that could vary significantly?',
          type: 'scale',
          scale: {
            min: 1,
            max: 10,
            min_label: 'Very uncomfortable',
            max_label: 'Very comfortable',
          },
        },
        {
          id: 'q3',
          text: 'If you had to choose between a guaranteed outcome and a risky option with higher potential, which would you prefer?',
          type: 'choice',
          choices: [
            { value: 'guaranteed', label: 'Guaranteed outcome, even if lower' },
            { value: 'balanced', label: 'Depends on the specific odds' },
            { value: 'risky', label: 'Higher potential, even with risk' },
          ],
        },
      ]
      setQuestions(fallbackQuestions)
      setIsQuestionnaireActive(true)

      if (import.meta.env.DEV) {
        console.warn('[useRiskProfile] Using fallback questions:', errorMessage)
      }
    } finally {
      setLoading(false)
    }
  }, [context])

  // Answer current question and advance
  const answerQuestion = useCallback((answer: string | number) => {
    const currentQuestion = questions[currentQuestionIndex]
    if (!currentQuestion) return

    setAnswers(prev => {
      // Replace if already answered, otherwise add
      const existingIndex = prev.findIndex(a => a.question_id === currentQuestion.id)
      if (existingIndex >= 0) {
        const updated = [...prev]
        updated[existingIndex] = { question_id: currentQuestion.id, answer }
        return updated
      }
      return [...prev, { question_id: currentQuestion.id, answer }]
    })

    // Advance to next question if not at end
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1)
    }
  }, [questions, currentQuestionIndex])

  // Go back to previous question
  const previousQuestion = useCallback(() => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1)
    }
  }, [currentQuestionIndex])

  // Submit answers to get profile
  const submitQuestionnaire = useCallback(async () => {
    if (answers.length < questions.length) {
      setError('Please answer all questions before submitting')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await httpV1Adapter.submitRiskAnswers(answers, context)
      notifyChange(response.profile)
      setIsQuestionnaireActive(false)
    } catch (err: any) {
      const errorMessage = err?.error || err?.message || 'Failed to determine risk profile'
      setError(errorMessage)

      // Fallback: calculate profile locally from answers
      const score = calculateLocalScore(answers)
      const fallbackProfile = scoreToProfile(score)
      notifyChange(fallbackProfile)
      setIsQuestionnaireActive(false)

      if (import.meta.env.DEV) {
        console.warn('[useRiskProfile] Using locally calculated profile:', errorMessage)
      }
    } finally {
      setLoading(false)
    }
  }, [answers, questions.length, context, notifyChange])

  // Cancel questionnaire
  const cancelQuestionnaire = useCallback(() => {
    setIsQuestionnaireActive(false)
    setQuestions([])
    setAnswers([])
    setCurrentQuestionIndex(0)
    setError(null)
  }, [])

  // Clear current profile
  const clearProfile = useCallback(() => {
    setProfile(null)
    setIsQuestionnaireActive(false)
    setQuestions([])
    setAnswers([])
    setCurrentQuestionIndex(0)
    setError(null)
  }, [])

  return {
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
  }
}

/**
 * Calculate a risk score locally from answers (fallback when API fails)
 */
function calculateLocalScore(answers: Answer[]): number {
  let totalScore = 0
  let count = 0

  for (const answer of answers) {
    // Map common answer patterns to scores
    const value = answer.answer
    if (typeof value === 'number') {
      // Assume scale 1-10, normalize to 0-1
      totalScore += (value - 1) / 9
      count++
    } else if (typeof value === 'string') {
      // Map common choice values
      const lowerValue = value.toLowerCase()
      if (lowerValue.includes('avoid') || lowerValue.includes('guaranteed') || lowerValue.includes('safe')) {
        totalScore += 0.2
        count++
      } else if (lowerValue.includes('accept') || lowerValue.includes('balanced') || lowerValue.includes('depend')) {
        totalScore += 0.5
        count++
      } else if (lowerValue.includes('embrace') || lowerValue.includes('risky') || lowerValue.includes('opportunity')) {
        totalScore += 0.8
        count++
      }
    }
  }

  return count > 0 ? totalScore / count : 0.5
}

/**
 * Convert a risk score to a RiskProfile
 */
function scoreToProfile(score: number): RiskProfile {
  let preset: RiskProfilePreset
  let label: string
  let reasoning: string

  if (score < 0.35) {
    preset = 'risk_averse'
    label = 'Risk Averse'
    reasoning = 'Your answers indicate a preference for certainty and lower-risk options'
  } else if (score > 0.65) {
    preset = 'risk_seeking'
    label = 'Risk Seeking'
    reasoning = 'Your answers indicate comfort with uncertainty and higher-risk options'
  } else {
    preset = 'neutral'
    label = 'Neutral'
    reasoning = 'Your answers indicate a balanced approach to risk and reward'
  }

  return {
    profile: preset,
    label,
    score,
    confidence: 'medium', // Medium because calculated locally
    reasoning,
  }
}
