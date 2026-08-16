/**
 * The panel's VOCABULARY, its HONEST EMPTY STATE, and its VISIBLE AUTO-CAPTURES.
 *
 * Three ledger items, one surface:
 *   - vocabulary: "version" (a snapshot the USER authored) and "analysis run"
 *     (a computation the ENGINE performed) are different objects, and two
 *     surfaces both said "What changed" about them (trap 21);
 *   - L-11: with one capture the panel must not offer a comparison that cannot
 *     exist — the honest empty state is the only voice;
 *   - auto-captures: `origin: 'pre-ingest'` was stored and never rendered, so
 *     rows the product created appeared as rows the user could not account for.
 *
 * ⚠ SCOPE (trap 16): jsdom proves presence and text, never visibility.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import type { Node } from '@xyflow/react'
import { WhatChangedPanel } from '../WhatChangedPanel'
import { useCanvasStore } from '../../store'
import { captureModelVersion } from '../captureModelVersion'
import { appendVersion } from '../versionStorage'
import { AUTO_CAPTURE_LABEL, VERSION_STORAGE_DISCLOSURE } from '../versionLabels'
import type { VersionOrigin } from '../types'

function rfNode(id: string, label: string, data: Record<string, unknown> = {}): Node {
  return { id, type: 'factor', position: { x: 0, y: 0 }, data: { label, ...data } } as Node
}

function setGraph(nodes: Node[]): void {
  useCanvasStore.setState({ nodes, edges: [] })
}

/**
 * Seed a stored version directly. Deliberately NOT through the panel's save
 * button: the button can only ever produce `origin: 'manual'`, so a test that
 * drove it could not construct the auto-capture case at all — and the case that
 * cannot be constructed is the case that ships broken.
 */
let seedClock = Date.parse('2026-08-16T09:00:00Z')

function seedVersion(id: string, name: string, origin: VersionOrigin, nodes: Node[]): void {
  // Distinct timestamps: the store sorts newest-first, and a tie would make the
  // list order — and therefore which row a lookup resolves — non-deterministic.
  seedClock += 60_000
  const outcome = appendVersion(
    captureModelVersion(nodes, [], { id, name, origin, createdAt: seedClock }),
  )
  // Pin the precondition in-test (trap 13b): a seeding helper that silently
  // failed would leave every assertion below asserting about an empty list.
  expect(outcome.success).toBe(true)
}

function openPanel() {
  return render(<WhatChangedPanel isOpen onClose={() => {}} />)
}

function saveVersionNamed(name: string): void {
  fireEvent.change(screen.getByLabelText('Version name'), { target: { value: name } })
  fireEvent.click(screen.getByRole('button', { name: /save version/i }))
}

beforeEach(() => {
  localStorage.clear()
  setGraph([])
})

afterEach(() => {
  localStorage.clear()
})

describe('vocabulary — a version is not an analysis run', () => {
  it('says what a version is AND what it is not, before asking for one', () => {
    openPanel()

    const disclosure = screen.getByTestId('versions-vocabulary-disclosure')
    expect(disclosure).toHaveTextContent(/snapshot of the model you authored/i)
    expect(disclosure).toHaveTextContent(/not an analysis run/i)
    expect(disclosure).toHaveTextContent(/versions never store results/i)
  })

  it('names itself version history, not the run-comparison phrase', () => {
    openPanel()

    const panel = screen.getByTestId('what-changed-panel')
    expect(within(panel).getByText('Version history')).toBeInTheDocument()
  })

  it('titles the comparison by VERSION, so it cannot be read as a run delta', () => {
    setGraph([rfNode('n1', 'Price')])
    openPanel()
    saveVersionNamed('One')
    setGraph([rfNode('n1', 'Price'), rfNode('n2', 'Volume')])
    saveVersionNamed('Two')

    expect(screen.getByText('Changes between these versions')).toBeInTheDocument()
    // The bare phrase the run-over-run chip owns must not appear as a heading
    // here — that collision is the defect.
    expect(screen.queryByText('What changed')).not.toBeInTheDocument()
  })

  it('keeps the browser-local scope disclosure on screen (L-33)', () => {
    openPanel()

    expect(screen.getByTestId('versions-storage-disclosure')).toHaveTextContent(
      VERSION_STORAGE_DISCLOSURE,
    )
  })
})

describe('L-11 — no comparison offered before one can exist', () => {
  it('offers no comparison controls with ZERO versions', () => {
    openPanel()

    expect(screen.getByTestId('versions-empty')).toBeInTheDocument()
    expect(screen.queryByLabelText('From')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('To')).not.toBeInTheDocument()
    expect(screen.queryByText('Compare two versions')).not.toBeInTheDocument()
  })

  it('offers no comparison controls with ONE version — the empty state is the only voice', () => {
    setGraph([rfNode('n1', 'Price')])
    openPanel()
    saveVersionNamed('Baseline')

    expect(screen.getByTestId('versions-single-capture')).toBeInTheDocument()
    expect(screen.queryByLabelText('From')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('To')).not.toBeInTheDocument()
    expect(screen.queryByText('Compare two versions')).not.toBeInTheDocument()
    expect(screen.queryByText('Changes between these versions')).not.toBeInTheDocument()
  })

  it('DOES offer them with TWO versions — the discriminating twin', () => {
    // Without this case the one above would pass just as well against a panel
    // that never renders comparison controls at all (trap 22b: a corpus that
    // tests one direction is a guard watching one door).
    setGraph([rfNode('n1', 'Price')])
    openPanel()
    saveVersionNamed('Baseline')
    setGraph([rfNode('n1', 'Price'), rfNode('n2', 'Volume')])
    saveVersionNamed('With volume')

    expect(screen.getByLabelText('From')).toBeInTheDocument()
    expect(screen.getByLabelText('To')).toBeInTheDocument()
    expect(screen.getByText('Compare two versions')).toBeInTheDocument()
    expect(screen.queryByTestId('versions-single-capture')).not.toBeInTheDocument()
  })
})

describe('automatic captures are visible in the list', () => {
  it('marks a pre-ingest capture as automatic, on its own row', () => {
    seedVersion('ver_auto_1', 'Before Olumi redrafted the model', 'pre-ingest', [
      rfNode('n1', 'Price'),
    ])
    openPanel()

    // Bound by IDENTITY (the row's own origin attribute), never by "the row
    // whose text happens to mention auto" — trap 19.
    const rows = screen.getAllByTestId('version-row')
    const autoRow = rows.find((row) => row.getAttribute('data-version-origin') === 'pre-ingest')
    expect(autoRow).toBeDefined()
    expect(within(autoRow as HTMLElement).getByTestId('version-origin-badge')).toHaveTextContent(
      AUTO_CAPTURE_LABEL,
    )
  })

  it('leaves a manual save unmarked — the discriminating twin', () => {
    // If the badge rendered on EVERY row, the test above would still pass and
    // the list would still be a mystery. This is the mutant that separates
    // "labels auto captures" from "labels everything".
    seedVersion('ver_manual_1', 'Baseline', 'manual', [rfNode('n1', 'Price')])
    openPanel()

    const rows = screen.getAllByTestId('version-row')
    const manualRow = rows.find((row) => row.getAttribute('data-version-origin') === 'manual')
    expect(manualRow).toBeDefined()
    expect(
      within(manualRow as HTMLElement).queryByTestId('version-origin-badge'),
    ).not.toBeInTheDocument()
  })

  it('carries the same marker into the comparison selects', () => {
    // A select cannot host a badge, so this is the place a second, hand-copied
    // string would appear. Both read from `versionLabels.ts`.
    seedVersion('ver_manual_1', 'Baseline', 'manual', [rfNode('n1', 'Price')])
    seedVersion('ver_auto_1', 'Before Olumi redrafted the model', 'pre-ingest', [
      rfNode('n1', 'Price'),
      rfNode('n2', 'Volume'),
    ])
    openPanel()

    const from = screen.getByLabelText('From') as HTMLSelectElement
    const autoOption = Array.from(from.options).find((o) => o.value === 'ver_auto_1')
    const manualOption = Array.from(from.options).find((o) => o.value === 'ver_manual_1')

    expect(autoOption?.textContent).toContain(AUTO_CAPTURE_LABEL)
    expect(manualOption?.textContent).not.toContain(AUTO_CAPTURE_LABEL)
  })
})
