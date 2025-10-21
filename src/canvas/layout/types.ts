/**
 * Layout engine types and options
 */

export type LayoutPreset = 'grid' | 'hierarchy' | 'flow'

export type LayoutSpacing = 'small' | 'medium' | 'large'

export interface LayoutOptions {
  preset: LayoutPreset
  spacing: LayoutSpacing
  preserveSelection: boolean
  minimizeCrossings: boolean
}

export interface LayoutNode {
  id: string
  width: number
  height: number
  locked?: boolean
}

export interface LayoutEdge {
  id: string
  source: string
  target: string
}

export interface LayoutResult {
  positions: Record<string, { x: number; y: number }>
  duration: number
}

export const SPACING_VALUES: Record<LayoutSpacing, number> = {
  small: 50,
  medium: 100,
  large: 150,
}

export const DEFAULT_LAYOUT_OPTIONS: LayoutOptions = {
  preset: 'grid',
  spacing: 'medium',
  preserveSelection: false,
  minimizeCrossings: true,
}
