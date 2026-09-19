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
  /**
   * ⚠ COUNT-PINNED AND ANCHORED, because the first version of this guard was
   * one-directional. A reviewer's mutant kit showed four arms passing it: a
   * decoy `useState<'select'|'hand'>('select')` elsewhere in the file, plus
   * whitespace reformattings. A `toMatch` that only asks "does this string
   * appear SOMEWHERE" tests presence, never binding (trap 19), and a mutant set
   * that only ever REMOVES the token cannot see one that MOVES or DUPLICATES it
   * (trap 22b — a corpus that tests one direction).
   */
  it("⭐ the interaction mode initialises to 'select', exactly once, on the real declaration", () => {
    const code = codeOnly(graph)
    // Whitespace-tolerant so an ordinary reformat cannot red it, but still
    // ANCHORED to the real declaration and COUNT-PINNED so a decoy cannot green it.
    const decl = /const\s*\[\s*interactionMode\s*,\s*setInteractionMode\s*\]\s*=\s*useState\s*<\s*'select'\s*\|\s*'hand'\s*>\s*\(\s*'(select|hand)'\s*\)/g
    const found = [...code.matchAll(decl)]
    expect(
      found.length,
      `expected exactly ONE interactionMode declaration, found ${found.length} — a second one means this guard may be binding to a decoy rather than to the mode the canvas actually boots with`,
    ).toBe(1)
    expect(
      found[0]![1],
      "the canvas no longer boots in select mode. With `nodesDraggable={effectiveMode === 'select'}`, booting in 'hand' means NO card can be moved until the user finds the V/H toggle — the board arrives unauthorable.",
    ).toBe('select')
  })

  it('the draggability binding it depends on is still in place', () => {
    // The default only matters because of this line. If the binding moved, the
    // assertion above would be pinning a value that no longer governs anything —
    // a guard agreeing with itself.
    expect(codeOnly(graph)).toContain("nodesDraggable={effectiveMode === 'select'}")
  })

  /**
   * ⛔ THE CSS ASSERTIONS THAT STOOD HERE ARE DELETED, AND THE PREMISE WAS WRONG.
   *
   * This PR originally narrowed `.canvas-mode-hand .react-flow__node` to
   * `.draggable`, on the claim that hand mode painted `cursor: grab` on a card
   * that could not be dragged — "a promise the product refuses".
   *
   * ⭐ THE CURSOR WAS TELLING THE TRUTH. In @xyflow/react 12.10.2 the node
   * wrapper applies `nopan` ONLY when the node is draggable, so in hand mode a
   * left-drag starting ON a card reaches d3-zoom and PANS. `grab` meant "grab
   * the canvas", not "grab this card". `e2e/select-grab.spec.ts` already proved
   * it: cursor `grab` over a card in hand mode, then a drag moves the VIEWPORT
   * by (80,40) with every node position unchanged.
   *
   * And the narrowing could never have worked: `.canvas-mode-hand` is applied
   * exactly when `nodesDraggable` is false, so `.canvas-mode-hand` and
   * `.draggable` are mutually exclusive BY CONSTRUCTION. The rule would have
   * matched nothing and hand mode would have lost its grab cursor entirely —
   * making the surface worse while claiming to fix an honesty defect.
   *
   * The CSS hunk is reverted. The one-word default change fixes the reported
   * defect on its own, and nothing here should pin a CSS shape again.
   */

})
