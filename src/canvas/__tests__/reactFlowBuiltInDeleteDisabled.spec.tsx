/**
 * ⛔ REACT FLOW'S OWN DELETE KEY MUST NOT BE ABLE TO GO ROUND THE GUARD.
 *
 * `<ReactFlow>` ships a delete of its own: with no `deleteKeyCode` prop it binds
 * Backspace, and on a keypress it removes the selected nodes and edges through
 * `onNodesChange` / `onEdgesChange` — never through `deleteAction`, so never
 * through the impact check, the confirm dialog or the last-goal refusal. The
 * app's own Delete/Backspace is now guarded (`keyboardDeleteGuard.spec.ts`);
 * that is worth nothing while a second listener on the same key deletes first.
 *
 * Two halves, because either alone is vacuous:
 *   1. SOURCE — every `<ReactFlow>` in `src/` that is wired to the store's
 *      change handlers (today: one, in `ReactFlowGraph.tsx`) passes
 *      `deleteKeyCode={REACT_FLOW_DELETE_KEY_CODE}`, with a positive control on
 *      the scan's own reach;
 *   2. WIRE — at the installed @xyflow/react, that value really does switch the
 *      built-in delete off. The contrast control is mounted IN THE SAME RUN and
 *      receives the SAME keypress: a default `<ReactFlow>` that DOES emit its
 *      remove change. Without it, "no remove change" could just mean jsdom never
 *      delivered the key.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { render, waitFor } from '@testing-library/react'
import { ReactFlow, ReactFlowProvider, type Node, type NodeChange } from '@xyflow/react'

import { REACT_FLOW_DELETE_KEY_CODE } from '../useKeyboardShortcuts'

const ROOT = join(__dirname, '..', '..', '..')
const SRC = join(ROOT, 'src')

/**
 * Remove block and whole-line comments before scanning. LOAD-BEARING: the
 * canvas files EXPLAIN `<ReactFlow>` in prose (`TierLanes`, `LodSync`, the
 * graph's own headers), and a scan over raw bytes counts those as mounts.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

/** Every non-test `.tsx` under `src/`, comments stripped. */
const SOURCES: Array<{ file: string; code: string }> = (
  readdirSync(SRC, { recursive: true }) as string[]
)
  .filter((f) => f.endsWith('.tsx') && !/(__tests__|\.spec\.|\.test\.)/.test(f))
  .map((f) => ({ file: f, code: stripComments(readFileSync(join(SRC, f), 'utf8')) }))

const GRAPH_FILE = join('canvas', 'ReactFlowGraph.tsx')
const GRAPH = SOURCES.find((s) => s.file === GRAPH_FILE)?.code ?? ''

/** Every `<ReactFlow …>` opening element in the file, props included. */
function reactFlowElements(src: string): string[] {
  const out: string[] = []
  const re = /<ReactFlow\b/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) {
    // The opening tag ends at the first `>` that is not part of `=>` and sits
    // outside any `{…}` expression.
    let depth = 0
    let i = m.index + '<ReactFlow'.length
    for (; i < src.length; i++) {
      const ch = src[i]
      if (ch === '{') depth++
      else if (ch === '}') depth--
      else if (ch === '>' && depth === 0 && src[i - 1] !== '=') break
    }
    out.push(src.slice(m.index, i + 1))
  }
  return out
}

/** The mounts that can reach the store: the ones wired to its change handlers. */
const storeWired = (src: string) =>
  reactFlowElements(src).filter((el) => /\bonNodesChange=\{/.test(el) || /\bonEdgesChange=\{/.test(el))

/** Every store-wired mount in `src/`, with the file it lives in. */
const allStoreWired = () =>
  SOURCES.flatMap(({ file, code }) => storeWired(code).map((el) => ({ file, el })))

describe('SOURCE: every store-wired canvas switches React Flow\'s delete key off', () => {
  it('POSITIVE CONTROL: the scan reaches the graph\'s nine mounts, and finds exactly one store-wired mount in src/', () => {
    // Nine at 64a3b385: the live canvas plus eight debug/isolation modes that
    // pass no change handlers (a built-in delete there cannot reach the store).
    expect(SOURCES.length).toBeGreaterThan(100)
    expect(reactFlowElements(GRAPH)).toHaveLength(9)
    const wired = allStoreWired()
    expect(wired.map((w) => w.file)).toEqual([GRAPH_FILE])
    expect(wired[0].el).toContain('onNodesChange={handleNodesChange}')
    expect(wired[0].el).toContain('onEdgesChange={handleEdgesChange}')
  })

  it('⛔ each of them passes deleteKeyCode={REACT_FLOW_DELETE_KEY_CODE}', () => {
    const wired = allStoreWired()
    expect(wired.length).toBeGreaterThan(0)
    for (const { el } of wired) {
      expect(el).toMatch(/\bdeleteKeyCode=\{REACT_FLOW_DELETE_KEY_CODE\}/)
    }
  })

  it('and the value it passes is null — the one value React Flow reads as "no key"', () => {
    expect(REACT_FLOW_DELETE_KEY_CODE).toBeNull()
  })
})

describe('WIRE: at the installed @xyflow/react, that value disables the built-in delete', () => {
  it('Backspace: the default mount removes its selected node; the guarded mount emits no remove at all', async () => {
    const defaultChanges = vi.fn()
    const guardedChanges = vi.fn()
    const selected = (id: string): Node[] => [
      { id, position: { x: 0, y: 0 }, data: { label: id }, selected: true },
    ]

    render(
      createElement(
        'div',
        null,
        createElement(
          ReactFlowProvider,
          null,
          createElement(ReactFlow, {
            nodes: selected('default-node'),
            edges: [],
            onNodesChange: defaultChanges,
          }),
        ),
        createElement(
          ReactFlowProvider,
          null,
          createElement(ReactFlow, {
            nodes: selected('guarded-node'),
            edges: [],
            onNodesChange: guardedChanges,
            deleteKeyCode: REACT_FLOW_DELETE_KEY_CODE,
          }),
        ),
      ),
    )

    const removes = (spy: typeof defaultChanges): string[] =>
      (spy.mock.calls.flat(2) as NodeChange[])
        .filter((c) => c.type === 'remove')
        .map((c) => (c as { id: string }).id)

    // ONE keypress, delivered where React Flow listens (the document). The key
    // is held until the contrast has answered: React Flow acts on the pressed
    // STATE, and a keyup in the same tick can batch it away.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', code: 'Backspace', bubbles: true }))
    try {
      // CONTRAST: the keypress reached React Flow and its built-in delete ran.
      await waitFor(() => expect(removes(defaultChanges)).toEqual(['default-node']))
      // …and in that same window the guarded mount produced nothing to remove.
      expect(removes(guardedChanges)).toEqual([])
    } finally {
      document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Backspace', code: 'Backspace', bubbles: true }))
    }
  })
})
