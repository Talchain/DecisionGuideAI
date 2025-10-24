/**
 * Edge theme tokens
 * Semantic colour tokens with 3:1 contrast for UI elements
 * British English: colour, visualisation
 */

import type { EdgeStyle } from '../domain/edges'
import { weightToStrokeWidth, styleToDashArray, clampCurvature } from '../domain/edges'

/**
 * Edge colour tokens
 */
interface EdgeThemeTokens {
  stroke: string
  strokeHover: string
  strokeSelected: string
  label: string
  labelBackground: string
  confidence: {
    high: string
    medium: string
    low: string
  }
}

/**
 * Light theme edge colours
 */
const LIGHT_THEME: EdgeThemeTokens = {
  stroke: '#94A3B8', // Slate 400
  strokeHover: '#64748B', // Slate 500
  strokeSelected: 'var(--olumi-primary, #5B6CFF)',
  label: '#1E293B', // Slate 800
  labelBackground: '#FFFFFF',
  confidence: {
    high: 'var(--olumi-success, #20C997)',
    medium: 'var(--olumi-warning, #F7C948)',
    low: 'var(--olumi-danger, #FF6B6B)',
  },
}

/**
 * Dark theme edge colours - Using Olumi brand palette
 * CSS Variables: --edge-stroke, --edge-label-bg, --edge-label-text from index.css
 */
const DARK_THEME: EdgeThemeTokens = {
  stroke: 'var(--edge-stroke, #5B6CFF)',
  strokeHover: 'var(--olumi-primary-600, #4256F6)',
  strokeSelected: 'var(--olumi-primary, #5B6CFF)',
  label: 'var(--edge-label-text, #E8ECF5)',
  labelBackground: 'var(--edge-label-bg, #0E1116)',
  confidence: {
    high: 'var(--olumi-success, #20C997)',
    medium: 'var(--olumi-warning, #F7C948)',
    low: 'var(--olumi-danger, #FF6B6B)',
  },
}

/**
 * Get edge theme tokens for current theme
 */
export function getEdgeTheme(isDark = false): EdgeThemeTokens {
  return isDark ? DARK_THEME : LIGHT_THEME
}

/**
 * Get confidence colour based on value
 */
export function getConfidenceColour(confidence: number | undefined, isDark = false): string {
  if (confidence === undefined) return getEdgeTheme(isDark).stroke
  
  const theme = getEdgeTheme(isDark)
  if (confidence >= 0.7) return theme.confidence.high
  if (confidence >= 0.4) return theme.confidence.medium
  return theme.confidence.low
}

/**
 * Apply visual properties to edge style
 * Maps domain properties to SVG attributes
 */
export interface EdgeVisualProps {
  strokeWidth: number
  strokeDasharray: string
  curvature: number
  stroke: string
}

export function applyEdgeVisualProps(
  weight: number,
  style: EdgeStyle,
  curvature: number,
  isSelected: boolean,
  isHovered: boolean,
  isDark = false
): EdgeVisualProps {
  const theme = getEdgeTheme(isDark)
  
  let stroke = theme.stroke
  if (isSelected) stroke = theme.strokeSelected
  else if (isHovered) stroke = theme.strokeHover
  
  return {
    strokeWidth: weightToStrokeWidth(weight),
    strokeDasharray: styleToDashArray(style),
    curvature: clampCurvature(curvature),
    stroke,
  }
}

/**
 * Edge animation tokens
 * Respects prefers-reduced-motion
 */
export const EDGE_ANIMATIONS = {
  markerAnimation: 'dash 1s linear infinite',
  fadeIn: 'fadeIn 200ms ease-out',
} as const

/**
 * Edge label styling
 */
export const EDGE_LABEL_STYLES = {
  fontSize: '12px',
  padding: '2px 6px',
  borderRadius: '4px',
  maxWidth: '120px',
} as const
