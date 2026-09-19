/**
 * ⭐⭐ THE BOARD MUST OPEN IN A MODE WHERE A HUMAN CAN MOVE A CARD.
 *
 * Olumi's purpose is that the shared visual model is the team's reasoning and
 * that HUMANS REMAIN THE AUTHORS. A board that cannot be rearranged on arrival
 * is a viewer of the AI's model, not a surface to think on.
 *
 * It booted in hand mode, and `nodesDraggable={effectiveMode === 'select'}`, so
 * no card could be moved until the user found the V/H toolbar toggle. The
 * founder reported it as a defect rather than as a mode (19 Sep: "you can't move
 * the nodes around at the moment"), which is the evidence that the mode was
 * never discoverable.
 *
 * ⚠ SOURCE-SCANNED, and the reason is honest rather than lazy: the default is a
 * `useState` initialiser inside a ~2,800-line component that mounts React Flow,
 * and the repo's existing binding guard (`canvasToolbarModeBinding.spec.ts`)
 * already establishes source-scanning as the idiom for exactly these lines. A
 * render test would need the whole canvas to mount to assert one initial value.
 *
 * ⚠⚠ THE STRIPPER IS LOAD-BEARING. This file's prose names `'select'` and the
 * component's own docblock discusses both modes at length, so an assertion over
 * raw source would be satisfied by commentary while the code said `'hand'`. A
 * guard of exactly that shape shipped in this repo earlier today because its
 * stripper missed TRAILING line comments. This one handles block, whole-line and
 * trailing comments, and proves each case before asserting anything.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const GRAPH = join(ROOT, 'src', 'canvas', 'ReactFlowGraph.tsx')
const CSS = join(ROOT, 'src', 'index.css')

function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map(line => line.replace(/(^|[^:])\/\/.*$/, '$1'))
    .filter(line => line.trim().length > 0)
    .join('\n')
}

const graph = readFileSync(GRAPH, 'utf8')
const css = readFileSync(CSS, 'utf8')

describe('the stripper this guard rests on', () => {
  it('POSITIVE CONTROL: removes block, whole-line and trailing comments', () => {
    expect(codeOnly("/* 'select' */\nconst a = 1\n").includes("'select'")).toBe(false)
    expect(codeOnly("// 'select'\nconst a = 1\n").includes("'select'")).toBe(false)
    expect(codeOnly("const a = 1 // 'select'\n").includes("'select'")).toBe(false)
    expect(codeOnly("const m = 'select'\n")).toContain("'select'")
  })

  it('POSITIVE CONTROL: both files were read and are substantive', () => {
    expect(graph.length, 'ReactFlowGraph.tsx read as empty').toBeGreaterThan(10_000)
    expect(css.length, 'index.css read as empty').toBeGreaterThan(1_000)
  })
})

describe('the board opens authorable', () => {
  it("⭐ the interaction mode initialises to 'select', in CODE", () => {
    const code = codeOnly(graph)
    expect(
      code,
      "the canvas no longer boots in select mode. With `nodesDraggable={effectiveMode === 'select'}`, booting in 'hand' means NO card can be moved until the user finds the V/H toggle — the board arrives unauthorable.",
    ).toMatch(/useState<'select'\s*\|\s*'hand'>\('select'\)/)
  })

  it('the draggability binding it depends on is still in place', () => {
    // The default only matters because of this line. If the binding moved, the
    // assertion above would be pinning a value that no longer governs anything —
    // a guard agreeing with itself.
    expect(codeOnly(graph)).toContain("nodesDraggable={effectiveMode === 'select'}")
  })

  it('a card may not advertise a drag the mode refuses', () => {
    // In hand mode React Flow never adds `.draggable`, so the two bare selectors
    // that used to be here painted `grab` on cards that could not move.
    const code = codeOnly(css)
    expect(code).toContain('.canvas-mode-hand .react-flow__node.draggable')
    expect(
      code,
      'a bare `.canvas-mode-hand .react-flow__node` cursor rule is back — it matches undraggable cards and promises a gesture the mode refuses',
    ).not.toMatch(/\.canvas-mode-hand \.react-flow__node(?![.\w-])\s*,/)
  })
})
