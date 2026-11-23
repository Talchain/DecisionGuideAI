/**
 * ONE ICON SYSTEM ON THE LANE (Paul, 18 Nov: "same size, same icon library, aligned properly, spaced out properly… the only different icon should
 * be the Olumi icon"). Every icon on the lane's surfaces is drawn by the registry (look/icons.tsx); the Olumi mark is the one exception and it is
 * one component. Surfaces: top bar, left tool rail and zoom column, right-panel tabs and collapsed rail, AI panel, card faces and chips, details
 * panel, context menu, Analysis headings.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { join, relative } from 'node:path'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { ICONS, OkIcon } from '../icons'
import { OlumiAiIcon } from '../../../components/results/analysisNew/OlumiAiIcon'
import { OlumiMark } from '../../v12/cards/marks'
import { CanvasViewportControls } from '../../../components/layout/CanvasViewportControls'
import { useCanvasStore } from '../../../canvas/store'

const SRC = join(__dirname, '..', '..', '..')
const read = (rel: string): string => readFileSync(join(SRC, rel), 'utf8')

const laneFiles = ts.sys.readDirectory(join(SRC, 'olumiView'), ['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs'],
  ['**/__tests__/**', '**/__fixtures__/**', '**/fixtures/**', '**/*.spec.*', '**/*.test.*'], ['**/*'])
const sharedSurfaces = [
  'components/layout/TopBar.tsx', 'components/layout/KebabMenu.tsx', 'components/layout/RightPanel.tsx', 'components/layout/LeftSidebar.tsx',
  'components/layout/CanvasViewportControls.tsx', 'canvas/components/ScenarioSwitcher.tsx',
  'canvas/components/workspaceShell/WorkspaceShellTabStrip.tsx', 'canvas/components/BriefDocumentUpload.tsx',
  'canvas/contextMenu/CanvasContextMenu.tsx', 'canvas/contextMenu/laneMenu.ts',
]
const surfaceFiles = [...laneFiles.map((f) => relative(SRC, f)), ...sharedSurfaces]
const REGISTRY = 'olumiView/look/icons.tsx'
afterEach(() => vi.unstubAllEnvs())

// Floating-toolbar lane removes these direct imports when it migrates the controls.
const FLOATING_TOOLBAR_LANE_DIRECT_IMPORT_ALLOWLIST = new Set([
  'olumiView/BelowCue.tsx', 'olumiView/ViewLensBar.tsx', 'olumiView/ViewZoomNotice.tsx',
  'olumiView/ViewWhatIfKey.tsx', 'olumiView/ViewTradeOffsKey.tsx', 'olumiView/ViewPreMortemKey.tsx',
])
// The floating-toolbar lane clears the 16px zoom-column pin.
const FLOATING_TOOLBAR_LANE_SIZE_ALLOWLIST = { file: 'components/layout/CanvasViewportControls.tsx', sizes: ['14', '16'] }
// The shared menu uses 14px on this lane and preserves the older 16px branch.
const SHARED_CONTEXT_MENU = 'canvas/contextMenu/CanvasContextMenu.tsx'
const LUCIDE = /(?:from\s*|import\s*(?:\(\s*)?|require\(\s*)['"]lucide-react['"]/

describe('every icon on the lane comes from the registry', () => {
  it('scans the full lane and checks the shared surfaces for direct Lucide imports', () => {
    expect(laneFiles.length).toBeGreaterThan(100)
    expect(surfaceFiles.filter((file) => file !== REGISTRY && !FLOATING_TOOLBAR_LANE_DIRECT_IMPORT_ALLOWLIST.has(file) && LUCIDE.test(read(file)))).toEqual([])
    expect(read(REGISTRY)).toMatch(LUCIDE)
  })

  it('draws registry icons at 14px by default and permits only 14px at lane call sites', () => {
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    const { container } = render(<OkIcon id="brief" decorative />)
    expect(container.querySelector('svg')).toHaveAttribute('width', '14')
    expect(container.querySelector('svg')).toHaveAttribute('height', '14')
    const offenders: string[] = []
    for (const file of surfaceFiles) {
      const content = read(file)
      const source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true)
      function visit(node: ts.Node) {
        if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && /^OkIcon(?:Button)?$/.test(node.tagName.getText(source))) {
          const props = node.attributes.properties.filter(ts.isJsxAttribute)
          const size = props.find((prop) => prop.name.getText(source) === 'size')?.initializer?.getText(source)
          const id = props.find((prop) => prop.name.getText(source) === 'id')?.initializer
          const brandMark = file === 'components/layout/TopBar.tsx' && id?.getText(source) === '"olumi-mark"' && size === '{22}'
          const zoom = file === FLOATING_TOOLBAR_LANE_SIZE_ALLOWLIST.file && size === '{16}'
          const sharedMenu = file === SHARED_CONTEXT_MENU && size === '{iconSize}' && /const iconSize = lane \? 14 : 16\b/.test(content)
          if (size !== undefined && size !== '{14}' && !brandMark && !zoom && !sharedMenu) offenders.push(`${file}: ${size}`)
        }
        ts.forEachChild(node, visit)
      }
      visit(source)
    }
    expect(offenders).toEqual([])
  })
})

describe('Olumi\'s mark has one owner', () => {
  it('no non-test file under olumiView, and no top-bar or tab-strip file, imports OlumiAiIcon: the registry\'s olumi-mark is the one way to draw it (contrast: the registry itself does)', () => {
    const files = [...surfaceFiles, 'canvas/components/OutputsDock.tsx']
    const users = files.filter((f) => /import\s*\{[^}]*OlumiAiIcon[^}]*\}\s*from/.test(read(f)))
    // The one named exception: a link's mark is drawn INSIDE the board's SVG edge layer, where a span wrapper cannot go (listed as remaining).
    expect(users).toEqual(['olumiView/look/icons.tsx', 'olumiView/v12/links/LinkEnds.tsx'])
  })
})

describe('what is drawn: one size on a control row', () => {
  beforeEach(() => { useCanvasStore.setState({ viewMode: 'standard' } as never) })

  it('the zoom column draws one size, with the floating-toolbar lane exception', () => {
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    render(<ReactFlowProvider><CanvasViewportControls onZoomIn={vi.fn()} onZoomOut={vi.fn()} onZoomReset={vi.fn()} onFitView={vi.fn()} onAutoArrange={vi.fn()} /></ReactFlowProvider>)
    const svgs = screen.getByRole('navigation', { name: 'Viewport controls' }).querySelectorAll('button svg')
    expect(svgs.length).toBeGreaterThanOrEqual(4)
    const size = svgs[0]!.getAttribute('width')
    expect(FLOATING_TOOLBAR_LANE_SIZE_ALLOWLIST.sizes).toContain(size)
    expect([...svgs].map((s) => [s.getAttribute('width'), s.getAttribute('height'), s.getAttribute('stroke-width')])).toEqual([...svgs].map(() => [size, size, '1.75']))
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
