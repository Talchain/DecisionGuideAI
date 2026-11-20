/**
 * ONE ICON SYSTEM ON THE LANE (Paul, 18 Nov: "same size, same icon library, aligned properly, spaced out properly… the only different icon should
 * be the Olumi icon"). Every icon on the lane's surfaces is drawn by the registry (look/icons.tsx); the Olumi mark is the one exception and it is
 * one component. Surfaces: top bar, left tool rail and zoom column, right-panel tabs and collapsed rail, AI panel, card faces and chips, details
 * panel, context menu, Analysis headings.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { ICONS, OkIcon } from '../icons'
import { OlumiAiIcon } from '../../../components/results/analysisNew/OlumiAiIcon'
import { OlumiMark } from '../../v12/cards/marks'
import { CanvasViewportControls } from '../../../components/layout/CanvasViewportControls'
import { useCanvasStore } from '../../../canvas/store'

const SRC = join(__dirname, '..', '..', '..')
const read = (rel: string): string => readFileSync(join(SRC, rel), 'utf8')

/** Every file that draws icons on those surfaces and is fully registry-drawn. A file listed here may not import lucide-react or the Olumi mark. */
const SURFACE_FILES = [
  'components/layout/TopBar.tsx', 'components/layout/KebabMenu.tsx', 'components/layout/RightPanel.tsx', 'components/layout/LeftSidebar.tsx',
  'components/layout/CanvasViewportControls.tsx', 'canvas/components/ScenarioSwitcher.tsx', 'olumiView/TeamPresence.tsx',
  'canvas/components/workspaceShell/WorkspaceShellTabStrip.tsx', 'olumiView/AddFigure.tsx', 'olumiView/v12/UndoControl.tsx', 'olumiView/v12/lenses/LensesMenu.tsx',
  'olumiView/ViewChat.tsx', 'canvas/components/BriefDocumentUpload.tsx', 'olumiView/v12/chat/MethodChip.tsx', 'olumiView/v12/chat/KeptIdeas.tsx',
  'olumiView/v12/chat/OlumiAsks.tsx', 'olumiView/v12/actionsMenu.tsx', 'olumiView/port/ChatFloat.tsx',
  'olumiView/v12/cards/marks.tsx', 'olumiView/v12/cards/RestsOn.tsx', 'olumiView/v10.tsx', 'olumiView/previous/CoreCard.tsx', 'olumiView/ds/icons.tsx',
  'olumiView/v12/bands/BandNodes.tsx', 'olumiView/v12/bands/BandLayer.tsx', 'olumiView/v12/bands/KeyPill.tsx',
  'olumiView/v12/edit/LaneInspector.tsx', 'olumiView/port/ChanceChart.tsx', 'olumiView/look/FoldChevron.tsx',
  'canvas/contextMenu/CanvasContextMenu.tsx', 'canvas/contextMenu/Submenu.tsx', 'canvas/contextMenu/laneMenu.ts',
  'olumiView/BriefPanel.tsx', 'olumiView/ViewFigureFirst.tsx', 'olumiView/reasoning/parts.tsx', 'olumiView/v12/team/CommitForm.tsx', 'olumiView/v12/chat/IntakeSheet.tsx',
] as const

describe('every icon on the lane comes from the registry', () => {
  it('no surface file imports lucide-react or the Olumi mark directly (contrast: the registry file does import both)', () => {
    const offenders: string[] = []
    for (const f of SURFACE_FILES) {
      const text = read(f)
      expect(text.length, f).toBeGreaterThan(200) // each file is read and non-empty, so a wrong path cannot pass
      if (/from 'lucide-react'/.test(text)) offenders.push(`${f}: lucide-react`)
      if (/OlumiAiIcon/.test(text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''))) offenders.push(`${f}: OlumiAiIcon`)
    }
    expect(offenders).toEqual([])
    const registry = read('olumiView/look/icons.tsx')
    expect(registry).toMatch(/from 'lucide-react'/)
    expect(registry).toMatch(/OlumiAiIcon/)
  })

  it('every icon a surface file draws through the registry is 14 (beside text) or 16 (in a control)', () => {
    const sizes = new Set<string>()
    // The one exception: the brand mark in the top bar draws at 22 (TopBar.module.css's mark is 22 px); no other icon may.
    for (const f of SURFACE_FILES) for (const m of read(f).matchAll(/<OkIcon(?:Button)?\b[^>]*?\bsize=\{(\d+)\}/g)) { if (!(m[1] === '22' && /id="olumi-mark"/.test(m[0]))) sizes.add(m[1]!) }
    expect([...sizes].filter((n) => n !== '14' && n !== '16')).toEqual([])
    expect(sizes.has('14')).toBe(true) // positive control: the scan sees the inline size
  })
})

describe('Olumi\'s mark has one owner', () => {
  it('no non-test file under olumiView, and no top-bar or tab-strip file, imports OlumiAiIcon: the registry\'s olumi-mark is the one way to draw it (contrast: the registry itself does)', () => {
    const walk = (dir: string): string[] => readdirSync(join(SRC, dir), { withFileTypes: true }).flatMap((d) =>
      d.isDirectory() ? (d.name === '__tests__' || d.name === 'fixtures' ? [] : walk(join(dir, d.name))) : /\.tsx?$/.test(d.name) && !/\.(spec|test)\./.test(d.name) ? [join(dir, d.name)] : [])
    const files = [...walk('olumiView'), 'components/layout/TopBar.tsx', 'canvas/components/workspaceShell/WorkspaceShellTabStrip.tsx', 'canvas/components/OutputsDock.tsx']
    expect(files.length).toBeGreaterThan(100) // the walk saw the tree
    const users = files.filter((f) => /import\s*\{[^}]*OlumiAiIcon[^}]*\}\s*from/.test(read(f)))
    // The one named exception: a link's mark is drawn INSIDE the board's SVG edge layer, where a span wrapper cannot go (listed as remaining).
    expect(users).toEqual(['olumiView/look/icons.tsx', 'olumiView/v12/links/LinkEnds.tsx'])
  })
})

describe('what is drawn: one size on a control row', () => {
  beforeEach(() => { useCanvasStore.setState({ viewMode: 'standard' } as never) })

  it('the zoom column draws all its icons at 16, one box size', () => {
    render(<ReactFlowProvider><CanvasViewportControls onZoomIn={vi.fn()} onZoomOut={vi.fn()} onZoomReset={vi.fn()} onFitView={vi.fn()} onAutoArrange={vi.fn()} /></ReactFlowProvider>)
    const svgs = screen.getByRole('navigation', { name: 'Viewport controls' }).querySelectorAll('button svg')
    expect(svgs.length).toBeGreaterThanOrEqual(4)
    expect([...svgs].map((s) => [s.getAttribute('width'), s.getAttribute('height'), s.getAttribute('stroke-width')])).toEqual(svgs.length === 0 ? [] : [...svgs].map(() => ['16', '16', '1.75']))
  })
})

describe('Olumi\'s mark is one component', () => {
  it('the registry\'s mark is the brand mark, and the card mark, the tab mark and the registry mark are the same svg at the one inline size', () => {
    expect(ICONS['olumi-mark'].Icon).toBe(OlumiAiIcon)
    const { container } = render(<><OlumiMark words="Olumi" /><OkIcon id="olumi-mark" size={14} decorative /></>)
    const marks = [...container.querySelectorAll('svg[data-icon="olumi-ai"]')]
    expect(marks.length).toBe(2)
    expect(marks.map((m) => [m.getAttribute('width'), m.getAttribute('height')])).toEqual([['14', '14'], ['14', '14']])
  })
})
