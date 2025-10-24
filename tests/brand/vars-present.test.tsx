import { describe, it, expect, beforeEach } from 'vitest'

describe('Brand Tokens', () => {
  let root: HTMLElement

  beforeEach(() => {
    root = document.documentElement
  })

  it('has core Olumi colors', () => {
    const style = getComputedStyle(root)
    
    expect(style.getPropertyValue('--olumi-primary')).toBeTruthy()
    expect(style.getPropertyValue('--olumi-surface')).toBeTruthy()
    expect(style.getPropertyValue('--olumi-text')).toBeTruthy()
    expect(style.getPropertyValue('--olumi-border')).toBeTruthy()
  })

  it('has node palette colors', () => {
    const style = getComputedStyle(root)
    
    const nodeKinds = ['goal', 'decision', 'option', 'risk', 'outcome']
    nodeKinds.forEach(kind => {
      const bg = style.getPropertyValue(`--node-${kind}-bg`)
      const border = style.getPropertyValue(`--node-${kind}-border`)
      
      expect(bg).toBeTruthy()
      expect(border).toBeTruthy()
    })
  })

  it('has edge colors', () => {
    const style = getComputedStyle(root)
    
    expect(style.getPropertyValue('--edge-stroke')).toBeTruthy()
    expect(style.getPropertyValue('--edge-label-bg')).toBeTruthy()
    expect(style.getPropertyValue('--edge-label-text')).toBeTruthy()
  })

  it('has semantic colors', () => {
    const style = getComputedStyle(root)
    
    expect(style.getPropertyValue('--olumi-success')).toBeTruthy()
    expect(style.getPropertyValue('--olumi-warning')).toBeTruthy()
    expect(style.getPropertyValue('--olumi-danger')).toBeTruthy()
    expect(style.getPropertyValue('--olumi-info')).toBeTruthy()
  })
})
