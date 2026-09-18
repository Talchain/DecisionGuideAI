/**
 * ⛔⛔ THIS SPEC HAS NEVER BEEN RUN. DECLARED, NOT IMPLIED.
 *
 * The lane that wrote it was under a hard no-execution constraint from the
 * founder: no installs, no vitest, no playwright, no `tsc`, no product API
 * calls. Every assertion below was reasoned line by line against the bytes of
 * the files it reads, on staging `4b9a8fb548d3526706e1268753e9188202ea99c9`.
 * **Not one of them has been executed.** The first session with a budget to
 * run it should run it FIRST, before trusting a word of this header — and
 * should treat a red as information about this spec at least as readily as
 * information about the product.
 *
 * It is written at SOURCE level rather than as a render test, and that is a
 * deliberate consequence of the same constraint: a jsdom render of these cards
 * depends on store mocks, `getByText` resolution and portal behaviour that this
 * lane could not observe. Reading files from disk and asserting over their text
 * is the largest claim this lane could make and still stand behind. The
 * precedent is `utils/__tests__/rowLabelBudgetDerived.spec.ts`, which reads its
 * own source the same way and for the same reason.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT IT GUARDS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `usePopoverHover`'s header has always said: *"Touch (hover: none): tap node
 * to toggle popover open/closed."* It implements that as
 * `nodeHandlers.onClick`. Measured at the commit above, with a contrast control
 * in the same sweep of the same tree:
 *
 *     rg -a 'nodeHandlers\.onClick'      ->  0 hits, 0 files     (target)
 *     rg -a 'nodeHandlers\.onMouseEnter' ->  6 hits, 6 files     (contrast)
 *
 * **Six node types wired the two mouse handlers and none wired the touch one.**
 * The capability was built, documented in its own header, and connected to
 * nothing — so on a touch device the node preview could not be opened at all.
 *
 * That is not a cosmetic gap. The preview is this canvas's declared RECOVERY
 * SURFACE for text the product shortens in JavaScript: `OptionNode.tsx` says so
 * in as many words ("This popover is the recovery surface for the card's
 * compaction"). Of the 34 distinct factor labels in the five committed starter
 * captures, **23 (68%) are shortened before they are rendered** — so a finger
 * met a truncated claim on the ordinary card, not an unusual one, and had
 * nowhere to go for the rest of it.
 *
 * `NodeQuickActions.tsx` quotes the ruling this violated, from this estate:
 * *"Every hover action has a click/tap/keyboard equivalent."*
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY IT IS DERIVED AND NOT A LIST
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A hand-written list of six node components is the hand-maintained mirror this
 * estate pays for most often: the seventh node type would be added to the
 * product and not to the list, and the drift would read as green. The subject
 * list is therefore DERIVED — every `src/canvas/nodes/*.tsx` that calls
 * `usePopoverHover()` is, by construction, a component with a preview to open.
 *
 * ⛔ AND DERIVATION ALONE CANNOT PROVE THE LIST IS RIGHT (CLAUDE.md trap 12d):
 * a glob that silently matched nothing would iterate zero subjects and pass
 * every assertion by testing nothing. So the derived set is pinned two ways —
 * a floor on its size, and an IDENTITY binding to a member that must be in it.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

const NODES_DIR = path.resolve(__dirname, '..')
const HOOK_SRC = path.resolve(__dirname, '../../hooks/usePopoverHover.ts')

/**
 * Every node component that mounts a preview, derived from the fact that makes
 * it one: it calls the hook that owns the preview's open/close state.
 *
 * `readdirSync` is scoped to the directory's own `.tsx` files — `__tests__`
 * is a subdirectory and is not recursed into, so a spec that mentions the hook
 * cannot enter the subject list and score itself.
 */
const previewNodes: { file: string; src: string }[] = readdirSync(NODES_DIR)
  .filter(f => f.endsWith('.tsx'))
  .map(f => ({ file: f, src: readFileSync(path.join(NODES_DIR, f), 'utf8') }))
  .filter(n => n.src.includes('usePopoverHover()'))

describe('every node preview can be opened without a mouse', () => {
  /**
   * ⭐ THE POSITIVE CONTROL, FIRST. An absence/presence probe with no control
   * is vacuous (CLAUDE.md trap 13), and the specific way THIS one could go
   * vacuous is a glob that resolves to an empty set: `previewNodes` would be
   * `[]`, every `for` below would iterate nothing, and the suite would be green
   * about a product it never looked at.
   *
   * The floor is deliberately loose (`>= 5`) because the exact count is a
   * property of the product that is allowed to change; what may not change is
   * that the probe SEES something. The identity binding is the half that
   * cannot be satisfied by an accident: `OptionNode.tsx` is the card this whole
   * change exists for, and if it is not in the derived set the derivation is
   * wrong whatever its size.
   */
  it('the derived subject list is non-empty and contains the card under repair', () => {
    expect(previewNodes.length).toBeGreaterThanOrEqual(5)
    expect(previewNodes.map(n => n.file)).toContain('OptionNode.tsx')
  })

  /**
   * ⭐ THE CONTRAST CONTROL. "Target reads zero" is worthless on its own — it
   * is equally consistent with a correct product and a blind probe. So the
   * same sweep, over the same files, looks for a same-family symbol that must
   * be PRESENT. If the mouse handler also read absent, this spec is measuring
   * nothing and its other results must be discarded rather than believed.
   */
  it('CONTRAST: the same sweep finds the mouse handler it expects to find', () => {
    for (const { file, src } of previewNodes) {
      expect(src, `${file} does not wire nodeHandlers.onMouseEnter — this sweep is blind, not clean`)
        .toContain('nodeHandlers.onMouseEnter')
    }
  })

  /**
   * ⭐⭐ THE DEFECT ITSELF. RED-first against the merge-base: at
   * `4b9a8fb548d3526706e1268753e9188202ea99c9` this fails on all six files, and
   * the failure message names each one.
   *
   * ⚠ IT ASSERTS THE WIRING, NOT THE BEHAVIOUR, AND SAYS SO. A source-level
   * check cannot prove a tap opens a popover in a browser; it proves the
   * handler the hook exposes is CONNECTED to the element a finger lands on.
   * That is precisely the fact that was false — the behaviour was already
   * written and correct, and nothing called it.
   */
  it('every node with a preview wires the TAP path', () => {
    for (const { file, src } of previewNodes) {
      expect(src, `${file} mounts a node preview that a touch user cannot open: it wires the mouse handlers but not nodeHandlers.onClick`)
        .toContain('nodeHandlers.onClick')
    }
  })

  /**
   * ⛔ THE TAP MUST STAY ADDITIVE. This is the assertion that stops the fix
   * becoming a regression, and it is not hypothetical: `onClick` originally
   * called `e.stopPropagation()`, and wiring THAT version would have made the
   * first tap on a card open the preview INSTEAD OF selecting the node —
   * trading one thing a touch user cannot do for another they can do today.
   *
   * The assertion is scoped to the `onClick` callback's own body rather than
   * to the whole file, because `stopPropagation` is legitimate elsewhere in
   * this estate and a file-wide match would be a guard that fires on the wrong
   * thing.
   */
  it('the tap path does not swallow the event that selects the node', () => {
    const hook = readFileSync(HOOK_SRC, 'utf8')
    const marker = 'onClick: useCallback('
    const start = hook.indexOf(marker)
    // Precondition pinned IN-TEST: if the callback is renamed or restructured,
    // `indexOf` returns -1 and `slice(-1)` would silently read the whole file
    // from its last character — an assertion that passes by looking at nothing.
    expect(start, 'usePopoverHover no longer declares `onClick: useCallback(` — this test is reading the wrong bytes').toBeGreaterThan(-1)
    const body = hook.slice(start, hook.indexOf('}, []),', start))
    expect(body).toContain('setShowPopover')
    expect(body, 'the tap path calls stopPropagation, so a tap would open the preview INSTEAD OF selecting the node')
      .not.toContain('stopPropagation')
  })

  /**
   * ⭐⭐ THE KEYBOARD PATH, AND WHY IT IS BOUND TO `.react-flow__node`.
   *
   * React Flow owns the focusable element; the wrapper each node component
   * renders sits INSIDE it. `focusin` bubbles upward, so a listener on the
   * wrapper can only ever observe a DESCENDANT taking focus and is
   * structurally incapable of seeing the node's own focus ring. A keyboard
   * opener attached to the wrapper would therefore be a control that looks
   * correct in review and never fires — which is the same class of defect as
   * the unwired tap handler above, and worth a guard for that reason.
   *
   * ⚠ WHAT THIS DOES NOT CLAIM: that Tab reaches the node at all. That depends
   * on React Flow's `nodesFocusable`, which this repo sets nowhere (derived at
   * `ReactFlowGraph.tsx`, which passes neither `nodesFocusable` nor
   * `disableKeyboardA11y`, so the library default applies). A library default
   * is not a thing this spec can pin, and pretending otherwise would be an
   * assertion about a dependency wearing the clothes of an assertion about us.
   */
  it('the keyboard path listens on the element React Flow actually focuses', () => {
    const hook = readFileSync(HOOK_SRC, 'utf8')
    expect(hook).toContain(".closest('.react-flow__node')")
    expect(hook).toContain("addEventListener('focusin'")
    // `:focus-visible` is what separates a deliberate Tab from the focus a
    // mouse click also produces. Without it this path would fire on every
    // click and change a behaviour nobody asked to change.
    expect(hook).toContain(':focus-visible')
  })
})

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⛔ WHAT THIS SPEC DOES NOT COVER — stated here rather than discovered later
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * · It does not drive a TAP or a Tab in a real browser and watch the preview
 *   open. That needs touch emulation and a driven gesture in the Playwright
 *   harness, and it is the assertion that would actually close this class.
 *   ROWED, not attempted.
 * · It does not assert the popover CONTENT — that `OptionNode`'s recovery line
 *   carries the full differentiator sentence. That is a render test, and this
 *   lane could not run render tests.
 * · It says nothing about `BaseNode`'s `line-clamp-2` title, which is a
 *   VERTICAL clip and recoverable only by hover. Measured on the five
 *   committed starters: the longest label of any kind is 56 characters against
 *   a derived two-line capacity of ~52 at `MAX_LABEL_COUNTER_SCALE`, so 3 of
 *   87 node labels sit at or over the bound — PLAUSIBLE, not confirmed, and
 *   not the 68% case this change was dispatched against. Deliberately not
 *   fixed: scaling a repair to a measurement is the point of taking one.
 */
