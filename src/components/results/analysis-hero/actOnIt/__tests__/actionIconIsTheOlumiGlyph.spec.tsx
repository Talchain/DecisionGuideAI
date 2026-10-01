/**
 * ⭐ Paul's ruling (30 Sep 2026): every control that starts an AI interaction uses the Olumi AI glyph.
 * The Analysis tab's act-on-it "Work through with AI" icon is that glyph (Panel #2372). Pinned here, inside
 * the analysis-hero module, because only its authorised mount may import it (`inertness.spec.ts`).
 */
import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { render } from '@testing-library/react'
import { ACTION_ICON } from '../tokens'

describe('act-on-it AI icon', () => {
  it('"Work through with AI" renders the Olumi glyph and keeps the caller\'s classes', () => {
    const { container } = render(createElement(ACTION_ICON.ai.Icon, { className: 'h-4 w-4' }))
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('data-icon')).toBe('olumi-ai')
    expect(svg.getAttribute('class')).toContain('olumi-glyph-ai')
    expect(svg.getAttribute('class')).toContain('h-4')
  })
})
