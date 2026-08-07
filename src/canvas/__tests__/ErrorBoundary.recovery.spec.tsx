/**
 * Canvas error boundary — crash-moment persistence + reload recovery.
 *
 * WHY THIS FILE EXISTS: the 2026-07-20 dress rehearsal hit a mid-session
 * deploy, the Analysis tab's lazy chunk 404'd, the boundary rendered
 * "Reload editor — Your work is auto-saved. Reloading will restore the last
 * snapshot", and the reload came back to an EMPTY canvas. The promise was
 * wired to two dead localStorage keys: `canvas-snapshot-*` (written only by
 * the manual ⌘S snapshot feature) copied into `canvas-state-v1` (read by
 * nothing on boot). The real restore mechanism — `olumi-canvas-autosave`,
 * which ReactFlowGraph's production init effect hydrates — was only written
 * by a 30-second interval that a crash outraces.
 *
 * These tests pin the fix:
 *  1. componentDidCatch flushes the CURRENT store graph into the autosave
 *     slot the boot path reads (crash-moment flush, no interval race);
 *  2. the "Reload editor" click flushes again and pins the route hash so the
 *     reload reconnects to the same scenario;
 *  3. an EMPTY store never clobbers an existing good autosave;
 *  4. a stale-chunk error triggers ONE guarded automatic reload;
 *  5. isChunkLoadError recognises the browser message shapes.
 *
 * What jsdom proves here: the flush/guard logic and the localStorage writes.
 * What it CANNOT prove: that a real browser reload then rehydrates the graph
 * — that is ReactFlowGraph's PROD-only init effect, verified by the real
 * browser check recorded in the PR (production build via vite preview).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import * as ErrorBoundaryModule from '../ErrorBoundary'
import { useCanvasStore } from '../store'

const { CanvasErrorBoundary } = ErrorBoundaryModule
// Namespace access (not a named import) so the RED run against the pre-fix
// module resolves to undefined instead of failing collection outright.
const isChunkLoadError = (ErrorBoundaryModule as any).isChunkLoadError as
  | ((e: Error | null) => boolean)
  | undefined

const AUTOSAVE_KEY = 'olumi-canvas-autosave'
const CHUNK_GUARD_KEY = 'olumi-chunk-reload-at'

function Bomb({ message }: { message: string }): never {
  throw new Error(message)
}

function nodesFixture() {
  return [
    { id: 'n1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Goal' } },
    { id: 'n2', type: 'option', position: { x: 100, y: 0 }, data: { label: 'Option A' } },
  ] as any[]
}

function edgesFixture() {
  return [{ id: 'e1', source: 'n2', target: 'n1', data: { weight: 0.5 } }] as any[]
}

describe('CanvasErrorBoundary — crash recovery persistence', () => {
  const reloadSpy = vi.fn()
  let originalLocation: Location
  let consoleErrorSpy: { mockRestore: () => void }

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    reloadSpy.mockClear()

    // jsdom's location.reload logs "Not implemented" — replace the whole
    // location object (canonical jsdom workaround) and restore after.
    originalLocation = window.location
    // @ts-expect-error jsdom allows deleting the window accessor
    delete window.location
    ;(window as any).location = {
      ...originalLocation,
      hash: '#/canvas',
      reload: reloadSpy,
      assign: vi.fn(),
      replace: vi.fn(),
    }

    // Throwing children spam console.error via React — keep output readable.
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    useCanvasStore.setState({
      nodes: nodesFixture(),
      edges: edgesFixture(),
      currentScenarioId: '0985abff-d168-4309-83a5-ce5042000001',
    } as any)
  })

  afterEach(() => {
    cleanup()
    ;(window as any).location = originalLocation
    consoleErrorSpy.mockRestore()
  })

  it('1. crash flushes the current graph into the autosave slot the boot path reads (componentDidCatch)', () => {
    expect(localStorage.getItem(AUTOSAVE_KEY)).toBeNull()

    render(
      <CanvasErrorBoundary>
        <Bomb message="Cannot read properties of undefined (reading 'label')" />
      </CanvasErrorBoundary>
    )

    const raw = localStorage.getItem(AUTOSAVE_KEY)
    expect(raw).not.toBeNull()
    const autosave = JSON.parse(raw!)
    expect(autosave.nodes).toHaveLength(2)
    expect(autosave.edges).toHaveLength(1)
    expect(autosave.nodes.map((n: any) => n.id)).toEqual(['n1', 'n2'])
    expect(autosave.scenarioId).toBe('0985abff-d168-4309-83a5-ce5042000001')
    expect(typeof autosave.timestamp).toBe('number')
  })

  it('2. "Reload editor" flushes work and reloads on the same route', () => {
    render(
      <CanvasErrorBoundary>
        <Bomb message="plain render crash" />
      </CanvasErrorBoundary>
    )

    // Simulate post-crash state divergence: the user's newest work exists only
    // in the store. The click must persist THAT, not a stale interval write.
    localStorage.removeItem(AUTOSAVE_KEY)
    // Simulate the recorded HashRouter replaceState-desync: hash lost.
    ;(window as any).location.hash = ''

    fireEvent.click(screen.getByRole('button', { name: /reload editor/i }))

    const raw = localStorage.getItem(AUTOSAVE_KEY)
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw!).nodes).toHaveLength(2)
    expect((window as any).location.hash).toBe('#/canvas')
    expect(reloadSpy).toHaveBeenCalledTimes(1)
  })

  it('3. an EMPTY store never clobbers an existing good autosave', () => {
    const goodAutosave = JSON.stringify({
      timestamp: Date.now() - 60_000,
      nodes: nodesFixture(),
      edges: edgesFixture(),
      scenarioId: 'keep-me',
    })
    localStorage.setItem(AUTOSAVE_KEY, goodAutosave)
    useCanvasStore.setState({ nodes: [], edges: [] } as any)

    render(
      <CanvasErrorBoundary>
        <Bomb message="crash with an already-emptied store" />
      </CanvasErrorBoundary>
    )
    fireEvent.click(screen.getByRole('button', { name: /reload editor/i }))

    expect(localStorage.getItem(AUTOSAVE_KEY)).toBe(goodAutosave)
    expect(reloadSpy).toHaveBeenCalledTimes(1)
  })

  it('4a. stale-chunk error → ONE automatic guarded reload, work flushed first', async () => {
    render(
      <CanvasErrorBoundary>
        <Bomb message="Failed to fetch dynamically imported module: https://staging--olumi.netlify.app/assets/index-Dwqco2rO.js" />
      </CanvasErrorBoundary>
    )

    // Flush happened at catch even before the deferred reload fires.
    expect(localStorage.getItem(AUTOSAVE_KEY)).not.toBeNull()
    // Guard stamped so a broken deploy cannot loop.
    expect(sessionStorage.getItem(CHUNK_GUARD_KEY)).not.toBeNull()

    // The reload is deferred past the commit phase.
    await new Promise((r) => setTimeout(r, 20))
    expect(reloadSpy).toHaveBeenCalledTimes(1)
  })

  it('4b. a second chunk error inside the guard window does NOT auto-reload — the panel shows instead', async () => {
    sessionStorage.setItem(CHUNK_GUARD_KEY, String(Date.now()))

    render(
      <CanvasErrorBoundary>
        <Bomb message="Failed to fetch dynamically imported module: https://staging--olumi.netlify.app/assets/index-Dwqco2rO.js" />
      </CanvasErrorBoundary>
    )

    await new Promise((r) => setTimeout(r, 20))
    expect(reloadSpy).not.toHaveBeenCalled()
    // Manual recovery stays available.
    expect(screen.getByRole('button', { name: /reload editor/i })).toBeTruthy()
  })

  it('6. a structurally broken node is dropped from the flush; valid work and non-dangling edges survive', () => {
    // A malformed node is the classic cause of a render crash — persisting it
    // verbatim would rehydrate the poison and crash-loop on every reload.
    useCanvasStore.setState({
      nodes: [...nodesFixture(), { id: 'poison' } as any],
      edges: [
        ...edgesFixture(),
        { id: 'e-dangling', source: 'poison', target: 'n1', data: {} } as any,
      ],
    } as any)

    render(
      <CanvasErrorBoundary>
        <Bomb message="Cannot read properties of undefined (reading 'x')" />
      </CanvasErrorBoundary>
    )

    const raw = localStorage.getItem(AUTOSAVE_KEY)
    expect(raw).not.toBeNull()
    const autosave = JSON.parse(raw!)
    expect(autosave.nodes.map((n: any) => n.id)).toEqual(['n1', 'n2'])
    expect(autosave.edges.map((e: any) => e.id)).toEqual(['e1'])
  })

  it('5. isChunkLoadError recognises real browser message shapes and rejects ordinary errors', () => {
    expect(isChunkLoadError).toBeTypeOf('function')
    const yes = [
      'Failed to fetch dynamically imported module: https://x/assets/index-abc.js',
      'error loading dynamically imported module',
      'Importing a module script failed.',
      'Failed to load module script: Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of "text/html".',
      'Loading chunk 42 failed',
    ]
    const no = [
      "Cannot read properties of undefined (reading 'label')",
      'Maximum update depth exceeded',
      'Network request failed',
    ]
    for (const m of yes) expect(isChunkLoadError!(new Error(m)), m).toBe(true)
    for (const m of no) expect(isChunkLoadError!(new Error(m)), m).toBe(false)
    expect(isChunkLoadError!(null)).toBe(false)
  })
})
