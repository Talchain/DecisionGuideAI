import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const readCss = (relativePath: string): string => {
  const url = new URL(relativePath, import.meta.url)
  return readFileSync(url, 'utf-8')
}

const brandCss = readCss('../../src/styles/brand.css')
const indexCss = readCss('../../src/index.css')

describe('Brand Tokens', () => {
  it('has core Olumi colors', () => {
    // Core semantic brand tokens and surfaces
    expect(brandCss).toContain('--semantic-primary')
    expect(brandCss).toContain('--surface-app')
    expect(brandCss).toContain('--surface-card')
    expect(brandCss).toContain('--text-primary')
    expect(brandCss).toContain('--surface-border')
  })

  it('has node palette colors', () => {
    // Legacy node palette tokens kept in index.css
    const nodeKinds = ['goal', 'decision', 'option', 'risk', 'outcome']
    nodeKinds.forEach((kind) => {
      expect(indexCss).toContain(`--node-${kind}-bg`)
      expect(indexCss).toContain(`--node-${kind}-border`)
    })
  })

  it('has edge colors', () => {
    expect(indexCss).toContain('--edge-stroke')
    expect(indexCss).toContain('--edge-label-bg')
    expect(indexCss).toContain('--edge-label-text')
  })

  it('has semantic colors', () => {
    expect(brandCss).toContain('--semantic-success')
    expect(brandCss).toContain('--semantic-warning')
    expect(brandCss).toContain('--semantic-danger')
    expect(brandCss).toContain('--semantic-info')
  })
})
