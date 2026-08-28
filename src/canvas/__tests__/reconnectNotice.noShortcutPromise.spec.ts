/**
 * The edge-reconnect notice in `ReactFlowGraph` must not promise a shortcut.
 *
 * ── WHAT THIS PINS ──────────────────────────────────────────────────────────
 * `handleNodeClick`'s `reconnecting` branch announced
 * "Connector updated — press ⌘Z to undo." ⌘Z does not undo: the undo and redo
 * branches of `useKeyboardShortcuts` are gated on `hasServerGraphAuthority(
 * CANONICAL_EDIT_AUTHORITY.canvasSemanticMutations)`, an authority fixed at
 * `'disabled'`, and no other surface redeems the promise.
 *
 * ⚠ THIS IS A SOURCE-TEXT PIN, WHICH IS WEAKER THAN A BEHAVIOURAL ONE, AND THE
 * REASON IS RECORDED RATHER THAN GLOSSED. `ReactFlowGraph` is a ~2,600-line
 * component that NO spec in this repo renders; the notice is raised inside a
 * `useCallback` in that component, not in the store, so there is no seam a unit
 * test can drive without standing the whole canvas up. Asserting on the source
 * is the proportionate guard available today. If a render harness for
 * `ReactFlowGraph` ever exists, replace this with a behavioural pin.
 *
 * ⭐ WHY A PIN EXISTS HERE AT ALL: this string and its twin in
 * `ui/EdgeInspector.tsx` were MISSED by the first pass of this work, which
 * swept the components it was already editing rather than sweeping the literal
 * across the tree. Both were live. The pin is the sweep, made to fail loud.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SOURCE = resolve(__dirname, '../ReactFlowGraph.tsx')

/**
 * The user-facing message the reconnect branch passes to `showToast`.
 *
 * ⚠ EXTRACTS THE STRING LITERAL, NOT A WINDOW OF SOURCE. A first version
 * asserted over the 600 characters following the anchor and went RED on the
 * explanatory COMMENT beside the fix, which quotes "⌘Z" to say it is dead. A
 * guard that cannot tell user copy from prose about user copy would force every
 * future author to avoid naming the defect in a comment — so it reads the
 * literal, which is the only thing a user ever sees.
 *
 * Bound to the call that defines the branch (`completeReconnect(node.id)`)
 * rather than to a line number, so a shifted file does not silently stop
 * testing anything.
 */
function reconnectNotice(): string | null {
  const src = readFileSync(SOURCE, 'utf8')
  const anchor = src.indexOf('completeReconnect(node.id)')
  if (anchor === -1) return null
  const window = src.slice(anchor, anchor + 900)
  const match = window.match(/showToast\(\s*'((?:[^'\\]|\\.)*)'/)
  return match === null ? null : match[1]
}

describe('edge-reconnect notice names no keyboard shortcut', () => {
  /**
   * PRECONDITION FIRST. If the anchor ever disappears this pin would otherwise
   * pass on an empty string — an absence assertion with nothing to look at.
   */
  it('PRECONDITION: the reconnect branch still raises a notice naming the event', () => {
    const notice = reconnectNotice()

    expect(notice).not.toBeNull()
    expect(notice).toMatch(/Connector updated/)
  })

  it('does not tell the user to press a key to undo', () => {
    const notice = reconnectNotice()

    expect(String(notice)).not.toMatch(/⌘|Ctrl\+Z|Cmd\+Z|press .{0,20} to undo/i)
  })
})
