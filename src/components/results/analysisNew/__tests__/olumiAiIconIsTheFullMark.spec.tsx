/**
 * ⭐ THE "TALK TO OLUMI" ICON IS THE FULL OLUMI MARK (Paul, 28 Sep 2026, brief BRIEF-PANEL-OLUMI-AI-ICON.md):
 * ring arcs in `currentColor`, the orange circle / blue triangle / green square from brand tokens (no raw hex),
 * hidden from assistive tech by default, same props so no call site changes.
 */
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { OlumiAiIcon } from '../OlumiAiIcon'

describe('⭐ OlumiAiIcon draws the full Olumi mark', () => {
  it('three ring arcs follow the text colour; the three shapes use the brand tokens', () => {
    const { container } = render(<OlumiAiIcon size={16} />)
    const svg = container.querySelector('svg[data-icon="olumi-ai"]')!
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).toHaveAttribute('width', '16')
    const ring = svg.querySelector('g[stroke="currentColor"]')!
    expect(ring.querySelectorAll('path')).toHaveLength(3)
    expect(svg.querySelector('circle')).toHaveAttribute('fill', 'var(--olumi-mark-orange)')
    expect(svg.querySelector('path[fill]')).toHaveAttribute('fill', 'var(--olumi-mark-blue)')
    expect(svg.querySelector('rect')).toHaveAttribute('fill', 'var(--olumi-mark-green)')
  })
  it('the tokens exist in brand.css with the logo\'s colours, and the component holds no raw hex', () => {
    const css = readFileSync(join(__dirname, '../../../../styles/brand.css'), 'utf8')
    expect(css).toContain('--olumi-mark-orange: #EA7B4B;')
    expect(css).toContain('--olumi-mark-blue: #5C9BB8;')
    expect(css).toContain('--olumi-mark-green: #62B28F;')
    expect(readFileSync(join(__dirname, '../OlumiAiIcon.tsx'), 'utf8')).not.toMatch(/#[0-9A-Fa-f]{6}\b/)
  })
  it('an aria-label makes it visible to assistive tech', () => {
    const { container } = render(<OlumiAiIcon aria-label="Ask Olumi" />)
    expect(container.querySelector('svg')).not.toHaveAttribute('aria-hidden')
  })
})
