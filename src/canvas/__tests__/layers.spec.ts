/**
 * Slice D-3 (#70 5855068711): ONE stacking order for canvas overlays.
 * Pins the order that failed on Paul's MRR screenshots (27 Sep 2026): a card's
 * "…" menu opened UNDER its own inspector (951 < 5000).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { CANVAS_LAYER, CANVAS_LAYER_CLASS } from '../layers'

const n = (cls: string): number => {
  const m = cls.match(/^z-\[(\d+)\]$/)
  if (!m) throw new Error(`not a z-[N] class: ${cls}`)
  return Number(m[1])
}

describe('canvas stacking order', () => {
  it('every layer class is the literal of its number (Tailwind sees literals only)', () => {
    for (const [k, cls] of Object.entries(CANVAS_LAYER_CLASS)) {
      expect(n(cls), k).toBe(CANVAS_LAYER[k as keyof typeof CANVAS_LAYER])
    }
  })

  it('the order: the box < dock < band < chrome menu < edge popover < inspector < menu < submenu < menu tooltip < hover preview', () => {
    const L = CANVAS_LAYER
    const chain = [L.sheet, L.dock, L.overlayBand, L.chromeMenu, L.edgeEditPopover, L.inspector, L.contextMenu, L.submenu, L.menuTooltip, L.hoverPreview]
    for (let i = 1; i < chain.length; i++) expect(chain[i]).toBeGreaterThan(chain[i - 1]!)
    expect(L.setValuePopover).toBeGreaterThan(L.submenu)
  })

  it('a modal dialog sits above every canvas overlay (the box, the inspector and the whole menu family), below the hover preview', () => {
    const L = CANVAS_LAYER
    for (const k of ['sheet', 'overlayBand', 'chromeMenu', 'edgeEditPopover', 'inspector', 'contextMenu', 'submenu', 'menuTooltip', 'setValuePopover'] as const) {
      expect(L.modalBackdrop, k).toBeGreaterThan(L[k])
    }
    expect(L.hoverPreview).toBeGreaterThan(L.modalBackdrop)
  })

  it('the dock mirror equals the dock\'s own literal (OutputsDock is Panel-owned; read, not edited)', () => {
    const src = readFileSync(resolve(__dirname, '../components/OutputsDock.tsx'), 'utf8')
    expect(src).toMatch(new RegExp(`zIndex:\\s*${CANVAS_LAYER.dock}\\b`))
  })

  it('RATCHET: the migrated overlay files carry no literal z-index of their own', () => {
    const files = [
      '../olumiView/look/Menu.tsx', 'contextMenu/MenuTooltip.tsx', 'contextMenu/SetValuePopover.tsx',
      // Surfaces step B: the one Tip, the lane's one box and the left rail's Lenses menu are on this scale too.
      '../olumiView/look/Tip.tsx', '../olumiView/v12/edit/LaneInspector.tsx', '../olumiView/v12/lenses/LensesMenu.tsx',
      'components/InspectorModal.tsx', 'components/ConfirmDialog.tsx', 'edges/EdgeEditPopover.tsx',
      // The chat's Add option dialog (AI Conversation, D-3 chat half).
      'conversation/AddOptionPanel.tsx',
    ]
    for (const f of files) {
      const code = readFileSync(resolve(__dirname, '..', f), 'utf8')
        .split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')
      expect(code.match(/\bz-\[\d+\]|zIndex:\s*\d+/g) ?? [], f).toEqual([])
      expect(code, f).toContain('CANVAS_LAYER_CLASS.')
    }
  })
})
