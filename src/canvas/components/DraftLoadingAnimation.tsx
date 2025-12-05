/**
 * DraftLoadingAnimation
 *
 * An on-brand, engaging loading animation for AI draft generation.
 * Shows animated nodes being "constructed" with connecting edges,
 * using the Olumi brand colors (sky, mint, lilac, sun).
 */

import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { typography } from '../../styles/typography'

const THINKING_PHRASES = [
  'Analyzing your decision...',
  'Identifying key factors...',
  'Mapping relationships...',
  'Building decision structure...',
  'Evaluating options...',
  'Connecting the dots...',
]

// Brand colors for SVG (inline styles for reliability)
const COLORS = {
  skyLight: '#BFE3F4',    // sky-200
  sky: '#63ADCF',         // sky-500
  skyDark: '#5C9BB8',     // sky-600
  mintLight: '#E0F5EC',   // mint-100 (derived)
  mint: '#67C89E',        // mint-500
  mintMid: '#62B28F',     // mint-400
  lilacLight: '#E8E7FB',  // lilac-100 (derived)
  lilac: '#9E9AF1',       // lilac-400
  sun: '#F5C433',         // sun-500
}

export function DraftLoadingAnimation() {
  const [phraseIndex, setPhraseIndex] = useState(0)
  const [dots, setDots] = useState('')

  // Cycle through thinking phrases
  useEffect(() => {
    const interval = setInterval(() => {
      setPhraseIndex(prev => (prev + 1) % THINKING_PHRASES.length)
    }, 2500)
    return () => clearInterval(interval)
  }, [])

  // Animate dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => (prev.length >= 3 ? '' : prev + '.'))
    }, 400)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex flex-col items-center justify-center py-8 px-4">
      {/* Animated Graph Visualization */}
      <div className="relative w-64 h-48 mb-6">
        {/* Background glow */}
        <div
          className="absolute inset-0 rounded-2xl blur-xl"
          style={{
            background: `linear-gradient(135deg, ${COLORS.skyLight}50 0%, ${COLORS.lilacLight}30 50%, ${COLORS.mintLight}50 100%)`
          }}
        />

        {/* SVG Animation Container */}
        <svg
          viewBox="0 0 200 140"
          className="relative w-full h-full"
          aria-hidden="true"
        >
          {/* Animated connecting lines (draw in sequence) */}
          <g>
            {/* Goal to Decision */}
            <line
              x1="100" y1="25" x2="60" y2="70"
              stroke={COLORS.skyLight}
              strokeWidth="2"
              strokeLinecap="round"
              className="animate-draw-line-1"
            />
            <line
              x1="100" y1="25" x2="140" y2="70"
              stroke={COLORS.skyLight}
              strokeWidth="2"
              strokeLinecap="round"
              className="animate-draw-line-2"
            />
            {/* Decision to Outcomes */}
            <line
              x1="60" y1="70" x2="35" y2="115"
              stroke={COLORS.mintMid}
              strokeWidth="2"
              strokeLinecap="round"
              className="animate-draw-line-3"
            />
            <line
              x1="60" y1="70" x2="85" y2="115"
              stroke={COLORS.mintMid}
              strokeWidth="2"
              strokeLinecap="round"
              className="animate-draw-line-4"
            />
            <line
              x1="140" y1="70" x2="115" y2="115"
              stroke={COLORS.mintMid}
              strokeWidth="2"
              strokeLinecap="round"
              className="animate-draw-line-5"
            />
            <line
              x1="140" y1="70" x2="165" y2="115"
              stroke={COLORS.mintMid}
              strokeWidth="2"
              strokeLinecap="round"
              className="animate-draw-line-6"
            />
          </g>

          {/* Animated nodes (pop in sequence) */}
          {/* Goal node - purple/lilac */}
          <g className="animate-pop-node-1">
            <circle cx="100" cy="25" r="14" fill={`${COLORS.lilac}33`} stroke={COLORS.lilac} strokeWidth="2" />
            <circle cx="100" cy="25" r="6" fill={COLORS.lilac} className="animate-pulse-glow" />
          </g>

          {/* Decision nodes - sky blue */}
          <g className="animate-pop-node-2">
            <rect x="45" y="55" width="30" height="30" rx="6" fill={COLORS.skyLight} stroke={COLORS.sky} strokeWidth="2" />
            <rect x="52" y="65" width="16" height="3" rx="1" fill={COLORS.sky} />
            <rect x="52" y="72" width="10" height="3" rx="1" fill={COLORS.skyDark} />
          </g>
          <g className="animate-pop-node-3">
            <rect x="125" y="55" width="30" height="30" rx="6" fill={COLORS.skyLight} stroke={COLORS.sky} strokeWidth="2" />
            <rect x="132" y="65" width="16" height="3" rx="1" fill={COLORS.sky} />
            <rect x="132" y="72" width="10" height="3" rx="1" fill={COLORS.skyDark} />
          </g>

          {/* Outcome nodes - mint/green */}
          <g className="animate-pop-node-4">
            <circle cx="35" cy="115" r="10" fill={COLORS.mintLight} stroke={COLORS.mint} strokeWidth="2" />
          </g>
          <g className="animate-pop-node-5">
            <circle cx="85" cy="115" r="10" fill={COLORS.mintLight} stroke={COLORS.mint} strokeWidth="2" />
          </g>
          <g className="animate-pop-node-6">
            <circle cx="115" cy="115" r="10" fill={COLORS.mintLight} stroke={COLORS.mint} strokeWidth="2" />
          </g>
          <g className="animate-pop-node-7">
            <circle cx="165" cy="115" r="10" fill={COLORS.mintLight} stroke={COLORS.mint} strokeWidth="2" />
          </g>

          {/* Sparkle particles */}
          <g>
            <circle cx="30" cy="40" r="2" fill={COLORS.sun} className="animate-twinkle-1" />
            <circle cx="170" cy="45" r="1.5" fill={COLORS.sun} className="animate-twinkle-2" />
            <circle cx="100" cy="90" r="2" fill={COLORS.sun} className="animate-twinkle-3" />
            <circle cx="50" cy="100" r="1.5" fill={COLORS.sun} className="animate-twinkle-4" />
            <circle cx="150" cy="95" r="2" fill={COLORS.sun} className="animate-twinkle-5" />
          </g>
        </svg>
      </div>

      {/* AI Icon with animation */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative">
          <div
            className="absolute inset-0 rounded-lg blur-md opacity-50 animate-pulse"
            style={{ background: `linear-gradient(to right, ${COLORS.sky}, ${COLORS.lilac})` }}
          />
          <div
            className="relative w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${COLORS.sky}, ${COLORS.lilac})` }}
          >
            <Sparkles className="w-4 h-4 text-white animate-sparkle-icon" />
          </div>
        </div>
        <span className={`${typography.label} text-ink-900 font-semibold`}>
          AI Drafting
        </span>
      </div>

      {/* Dynamic status text */}
      <div className="text-center min-h-[48px]">
        <p className={`${typography.body} text-ink-900/80 transition-opacity duration-300`}>
          {THINKING_PHRASES[phraseIndex]}{dots}
        </p>
        <p className={`${typography.caption} text-ink-900/50 mt-1`}>
          This usually takes 5-10 seconds
        </p>
      </div>

      {/* Progress bar */}
      <div className="w-48 h-1.5 bg-sand-200 rounded-full mt-4 overflow-hidden">
        <div
          className="h-full rounded-full animate-progress-sweep"
          style={{ background: `linear-gradient(to right, ${COLORS.sky}, ${COLORS.lilac}, ${COLORS.mint})` }}
        />
      </div>
    </div>
  )
}
