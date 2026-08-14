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
  strokeSelected: 'var(--semantic-info)', // Olumi v1.2: sky-500
  label: '#1E293B', // Slate 800
  labelBackground: '#FFFFFF',
  confidence: {
    high: 'var(--semantic-success)', // Olumi v1.2: mint-500
    medium: 'var(--semantic-warning)', // Olumi v1.2: sun-500
    low: 'var(--semantic-danger)', // Olumi v1.2: carrot-500
  },
}

/**
 * Dark theme edge colours - Using Olumi brand palette
 * CSS Variables: --edge-stroke, --edge-label-bg, --edge-label-text from index.css
 */
const DARK_THEME: EdgeThemeTokens = {
  stroke: 'var(--edge-stroke, #5B6CFF)',
  strokeSelected: 'var(--semantic-info)', // Olumi v1.2: sky-500
  label: 'var(--edge-label-text, #E8ECF5)',
  labelBackground: 'var(--edge-label-bg, #0E1116)',
  confidence: {
    high: 'var(--semantic-success)', // Olumi v1.2: mint-500
    medium: 'var(--semantic-warning)', // Olumi v1.2: sun-500
    low: 'var(--semantic-danger)', // Olumi v1.2: carrot-500
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

/**
 * ⚠ There is deliberately NO hover branch here, and no `strokeHover` token.
 *
 * One existed until 14 Aug 2026 and was unreachable: the sole call site
 * (StyledEdge) passed `isHovered` as a hardcoded `false`, so the token could
 * never be applied.
 *
 * It was DELETED rather than wired up, and that was the considered choice.
 * Wiring it would not have worked: StyledEdge resolves its stroke as
 * `isHighlightedEdge ? info : (directionStroke ?? visualProps.stroke)`, so an
 * edge carrying direction POLARITY (green/red) never reaches `visualProps.stroke`
 * at all. A hover colour would therefore be invisible on exactly the edges that
 * matter, and where it did apply it would OVERWRITE polarity — a semantic
 * change, not a visual one.
 *
 * Hover and selection emphasis are delivered instead as a composable
 * `filter: drop-shadow` in StyledEdge, which is a separate CSS channel and so
 * coexists with polarity colour. That is the pattern this file's neighbours
 * already use for the fragile halo and the sensitivity glow.
 *
 * If you are adding hover styling: add it to that filter chain, not here.
 */
export function applyEdgeVisualProps(
  weight: number,
  style: EdgeStyle,
  curvature: number,
  isSelected: boolean,
  isDark = false
): EdgeVisualProps {
  const theme = getEdgeTheme(isDark)

  const stroke = isSelected ? theme.strokeSelected : theme.stroke

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
