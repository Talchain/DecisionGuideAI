/**
 * DraftLoadingAnimation
 *
 * A simple loading indicator for AI draft generation.
 * Shows cycling status text and a progress bar.
 */

import { useEffect, useState } from 'react'
import { typography } from '../../styles/typography'

const THINKING_PHRASES = [
  'Analyzing your decision...',
  'Identifying key factors...',
  'Mapping relationships...',
  'Building decision structure...',
  'Evaluating options...',
  'Connecting the dots...',
]

export function DraftLoadingAnimation() {
  const [phraseIndex, setPhraseIndex] = useState(0)

  // Cycle through thinking phrases
  useEffect(() => {
    const interval = setInterval(() => {
      setPhraseIndex(prev => (prev + 1) % THINKING_PHRASES.length)
    }, 2500)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex flex-col items-center justify-center py-6 px-4">
      {/* Status text */}
      <div className="text-center min-h-[48px]">
        <p className={`${typography.body} text-ink-900/80 transition-opacity duration-300`}>
          {THINKING_PHRASES[phraseIndex]}
        </p>
        <p className={`${typography.caption} text-ink-900/50 mt-1`}>
          This may take up to 60 seconds
        </p>
      </div>

      {/* Progress bar */}
      <div className="w-48 h-1.5 bg-sand-200 rounded-full mt-4 overflow-hidden">
        <div
          className="h-full rounded-full animate-progress-sweep bg-sun-500"
        />
      </div>
    </div>
  )
}
