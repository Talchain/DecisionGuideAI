/**
 * B4 — NO RAW IDENTIFIER REACHES THE USER FROM AN INSPECTOR PANEL.
 *
 * The defect, measured at `dd089a50`: fourteen call sites across nine panels
 * resolved a missing element name to the element's **id**
 * (`String(n.data?.label ?? n.id)`), unconditionally — not behind technical
 * mode. The panel HEADER, three lines above, already resolved the same absent
 * label to `'Untitled'` (`InspectorRouter.tsx:229`). So one unlabelled node was
 * shown under two different names on one screen, and one of them was a database
 * key the user cannot act on.
 *
 * TWO ASSERTIONS, DELIBERATELY OF DIFFERENT KINDS, because neither alone is
 * enough:
 *
 *   1. A RENDER assertion through the MOUNTED consumer (P2). It proves the
 *      user-visible outcome on a real panel, and it is bound BY IDENTITY: the
 *      unlabelled node's id is a unique string that appears nowhere else in the
 *      fixture, so `queryByText(THAT id)` cannot be satisfied by another
 *      element (trap 19). It covers exactly one panel.
 *
 *   2. A SOURCE SCAN, derived by walking the panel directory, which covers all
 *      of them and keeps covering a panel added tomorrow. A render test per
 *      panel would be a hand-maintained mirror of the panel list (trap 12) and
 *      would go quietly short the moment someone adds the tenth panel.
 *
 * The scan carries a POSITIVE control (it detects the real defect form) and a
 * CONTRAST control (it does NOT flag the sanctioned quoted fallback) — an
 * absence assertion whose matcher is broken reports a clean sweep by testing
 * nothing (trap 13).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { readdirSync, readFileSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

import { stripComments } from '../../../../../tests/helpers/stripSourceComments'
import { resolveElementLabel, UNNAMED_ELEMENT_LABEL } from '../../../domain/elementLabel'

// ── The mounted-consumer assertion ───────────────────────────────────────────

/**
 * A string that could only ever be an id. It is deliberately unlike any label
 * in the fixture, so an assertion naming it is bound to THIS element and cannot
 * pass because some other node happens to share a value (trap 19).
 */
const UNLABELLED_NODE_ID = 'fac_7c21e0_unlabelled_probe'
const SUBJECT_ID = 'node_subject'

const graph: { nodes: unknown[]; edges: unknown[] } = { nodes: [], edges: [] }

function state() {
  return {
    nodes: graph.nodes,
    edges: graph.edges,
    updateNode: vi.fn(),
    updateEdge: vi.fn(),
    nodeRationales: {},
  }
}

vi.mock('../../../store', () => ({
  useCanvasStore: Object.assign(
    vi.fn((selector: (s: unknown) => unknown) => selector(state())),
    { getState: state },
  ),
}))

import { GenericNodePanel } from '../panels/GenericNodePanel'

beforeEach(() => {
  vi.clearAllMocks()
  graph.nodes = [
    { id: SUBJECT_ID, type: 'action', position: { x: 0, y: 0 }, data: { label: 'Run the pilot' } },
    // The element under test: present in the graph, connected, and NAMELESS.
    { id: UNLABELLED_NODE_ID, type: 'factor', position: { x: 0, y: 0 }, data: {} },
  ]
  graph.edges = [{ id: 'e1', source: UNLABELLED_NODE_ID, target: SUBJECT_ID, data: {} }]
})

describe('B4 · an inspector panel never shows the user a raw element id', () => {
  it('renders the honest no-name fallback for a connected element that has no label', () => {
    render(<GenericNodePanel nodeId={SUBJECT_ID} techMode={false} onClose={vi.fn()} onNavigate={vi.fn()} />)

    const panel = screen.getByTestId('inspector-generic-panel')
    expect(within(panel).getByText(UNNAMED_ELEMENT_LABEL)).toBeInTheDocument()
  })

  it('does NOT print that element’s id anywhere in the panel', () => {
    render(<GenericNodePanel nodeId={SUBJECT_ID} techMode={false} onClose={vi.fn()} onNavigate={vi.fn()} />)

    const panel = screen.getByTestId('inspector-generic-panel')
    // Bound by identity: this exact id, which belongs to exactly one element.
    expect(within(panel).queryByText(UNLABELLED_NODE_ID)).toBeNull()
    expect(panel.textContent).not.toContain(UNLABELLED_NODE_ID)
  })

  it('CONTRAST: a named element still shows its own name, not the fallback', () => {
    graph.nodes = [
      { id: SUBJECT_ID, type: 'action', position: { x: 0, y: 0 }, data: { label: 'Run the pilot' } },
      { id: UNLABELLED_NODE_ID, type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Budget headroom' } },
    ]
    render(<GenericNodePanel nodeId={SUBJECT_ID} techMode={false} onClose={vi.fn()} onNavigate={vi.fn()} />)

    const panel = screen.getByTestId('inspector-generic-panel')
    expect(within(panel).getByText('Budget headroom')).toBeInTheDocument()
    // Proves the first two assertions are discriminating rather than always-true:
    // the fallback must be ABSENT when a real name exists.
    expect(within(panel).queryByText(UNNAMED_ELEMENT_LABEL)).toBeNull()
  })
})

// ── The resolver itself ──────────────────────────────────────────────────────

describe('B4 · resolveElementLabel states absence, it never invents a name', () => {
  it('returns the label when one is stated', () => {
    expect(resolveElementLabel({ label: 'Budget headroom' })).toBe('Budget headroom')
  })

  it('returns the no-name fallback when the label is absent, empty or blank', () => {
    expect(resolveElementLabel({})).toBe(UNNAMED_ELEMENT_LABEL)
    expect(resolveElementLabel({ label: '' })).toBe(UNNAMED_ELEMENT_LABEL)
    // Whitespace-only is indistinguishable from no label ON SCREEN; treating it
    // as present renders a nameless row with no fallback at all.
    expect(resolveElementLabel({ label: '   ' })).toBe(UNNAMED_ELEMENT_LABEL)
    expect(resolveElementLabel(undefined)).toBe(UNNAMED_ELEMENT_LABEL)
    expect(resolveElementLabel(null)).toBe(UNNAMED_ELEMENT_LABEL)
  })

  it('never returns an id: it is not given one', () => {
    // The signature takes the DATA BAG, so there is no id in scope to leak.
    // This is the structural half of the guarantee — the scan below is the
    // behavioural half.
    expect(resolveElementLabel({ id: UNLABELLED_NODE_ID })).toBe(UNNAMED_ELEMENT_LABEL)
  })
})

// ── The source scan, derived by walking the directory ────────────────────────

/**
 * The defect form: a label read whose fallback is an EXPRESSION rather than a
 * quoted string. `?? n.id`, `?? e.source`, `?? otherId` all match; the
 * sanctioned `?? 'Untitled'` and `?? ''` do not.
 *
 * Matching the FALLBACK SHAPE rather than a list of id variable names is
 * deliberate: a scan keyed on `\.id\b` would miss `?? otherId` and `?? e.source`,
 * which are two of the real call sites.
 *
 * ⚠ THIS MATCHER WAS WRONG ON ITS FIRST WRITING AND THE CONTRAST CONTROL BELOW
 * IS THE ONLY REASON IT DID NOT SHIP. It was `\?\?\s*(?!['"`])` — a negative
 * lookahead after a greedy-but-optional `\s*`. The regex simply backtracks
 * `\s*` to zero width and evaluates the lookahead against the SPACE, which is
 * not a quote, so the sanctioned `?? 'Untitled'` matched too: the guard flagged
 * all 36 sites including the five already correct. Consuming a CONCRETE
 * non-quote, non-space character cannot backtrack into that. The general
 * lesson: `\s*` followed by a negative lookahead asserts nothing, because the
 * quantifier can always yield the position the lookahead wants.
 */
const ID_FALLBACK_LABEL = /\.data\?\.label\s*\?\?\s*[^\s'"`]/g

function idFallbacksIn(src: string, file: string): number {
  return [...stripComments(src, file).matchAll(ID_FALLBACK_LABEL)].length
}

const INSPECTOR_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')

function sourceFilesIn(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__') out.push(...sourceFilesIn(full))
      continue
    }
    if (!/\.tsx?$/.test(entry.name)) continue
    if (/\.(spec|test|stories)\.tsx?$/.test(entry.name)) continue
    out.push(full)
  }
  return out
}

describe('B4 · no inspector-v2 source falls back to an id for a display label', () => {
  const files = sourceFilesIn(INSPECTOR_DIR)

  it('POSITIVE CONTROL: the sweep reaches the panels it claims to cover', () => {
    // A magnitude check, not a bare non-zero: a walker returning three files
    // would also "find nothing" below, and that clean result would be an
    // instrument failure rather than a fact.
    const names = files.map(f => basename(f))
    expect(files.length).toBeGreaterThan(40)
    for (const required of [
      'GoalPanel.tsx', 'OptionPanel.tsx', 'DecisionPanel.tsx', 'EdgePanel.tsx',
      'OutcomePanel.tsx', 'RiskPanel.tsx', 'GenericNodePanel.tsx',
      'FactorControllablePanel.tsx', 'FactorObservablePanel.tsx', 'FactorExternalPanel.tsx',
      'InspectorRouter.tsx',
    ]) {
      expect(names).toContain(required)
    }
  })

  it('POSITIVE CONTROL: the matcher detects the real defect form, through the same pipeline', () => {
    expect(idFallbacksIn('const l = String(n.data?.label ?? n.id)', 'x.tsx')).toBe(1)
    expect(idFallbacksIn('label: String(other.data?.label ?? otherId),', 'x.tsx')).toBe(1)
    expect(idFallbacksIn('label: String(src?.data?.label ?? e.source),', 'x.tsx')).toBe(1)
  })

  it('CONTRAST CONTROL: the matcher does NOT flag a sanctioned quoted fallback', () => {
    // Without this, a matcher that flagged everything would pass the claim
    // below by making it unsatisfiable, and a matcher that flagged nothing
    // would pass it by testing nothing. Both are excluded only by having the
    // two controls point in opposite directions.
    expect(idFallbacksIn("const l = String(n.data?.label ?? 'Untitled')", 'x.tsx')).toBe(0)
    expect(idFallbacksIn("labelContext={{ label: String(node.data?.label ?? '') }}", 'x.tsx')).toBe(0)
  })

  it('CONTRAST CONTROL: the defect form inside a COMMENT is not counted', () => {
    expect(idFallbacksIn('// String(n.data?.label ?? n.id)\nconst x = 1', 'x.tsx')).toBe(0)
  })

  it('no panel, editor or shared component resolves a label to an id', () => {
    const offenders: string[] = []
    for (const file of files) {
      const n = idFallbacksIn(readFileSync(file, 'utf8'), file)
      if (n > 0) offenders.push(`${basename(file)}: ${n}`)
    }
    expect(offenders).toEqual([])
  })
})
