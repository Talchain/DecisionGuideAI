/**
 * THE COMPOSER OFFERS NO PERMANENTLY-DEAD CONTROLS (29 Aug 2026).
 *
 * Unattended team testing. Somebody clicks every control on the first screen.
 * Two of them could never do anything, in any posture:
 *
 * 1. THE "SETTINGS" COG (`AIInputBar`) opened a menu headed "Assistant
 *    options" whose every item was permanently disabled — Attach, Voice mode,
 *    Decision depth, each with a "Coming soon" badge.
 *
 *    ⚠ AND IT WAS NOT MERELY UNWIRED TODAY — IT WAS UNWIRABLE. `CogPopover`
 *    took `onAttachEvidence` and `onChooseDevModel`, and those are what turn
 *    an item functional. NEITHER MOUNT SITE PASSED EITHER ONE:
 *      · `ReactFlowGraph.tsx:2658`  <CogPopover isOpen anchorEl onClose />
 *      · `OutputsDock.tsx:3628`     <CogPopover isOpen anchorEl onClose />
 *    so the "when a host wires it, flip to functional" escape hatch in that
 *    file's header had no host, and even the debug-only dev-model item could
 *    not appear. Three disabled rows was the ONLY reachable state.
 *
 * 2. THE VOICE BUTTON (`ChatComposer`) — `disabled`, with a hard-coded
 *    "Voice input (coming soon)" label. No flag, no host wiring, no path to
 *    enabled.
 *
 * ── WHY THIS TEST READS SOURCE ─────────────────────────────────────────────
 * Same reasoning as `collabParticipantRouteIsPublic.spec.tsx`. Both components
 * require a `ConversationProvider` and a live conversation to render at all, so
 * a standalone render here would prove nothing about the deployed surface and
 * would fail for reasons unrelated to the property. The property is simply that
 * these controls are NOT DECLARED, which is a fact about the source.
 *
 * Every assertion carries a CONTRAST CONTROL in the same test: a same-family
 * marker in the SAME file that must read present. An absence probe over a file
 * that failed to load, or over the wrong file, would otherwise pass silently
 * (trap 13). Render-level coverage of these components continues to come from
 * their own existing suites, which mount them with real providers.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')

describe('the composer ships no permanently-dead controls', () => {
  it('the CogPopover module and its spec are gone from the tree', () => {
    expect(existsSync(resolve(process.cwd(), 'src/canvas/components/CogPopover.tsx'))).toBe(false)
    expect(
      existsSync(resolve(process.cwd(), 'src/canvas/components/__tests__/CogPopover.spec.tsx')),
    ).toBe(false)
    // CONTRAST CONTROL: `existsSync` is genuinely discriminating here — a
    // neighbouring component in the same directory must read true, or the two
    // assertions above are just a broken path.
    expect(existsSync(resolve(process.cwd(), 'src/canvas/components/AIInputBar.tsx'))).toBe(true)
  })

  it('nothing imports or mounts CogPopover any more', () => {
    for (const p of [
      'src/canvas/ReactFlowGraph.tsx',
      'src/canvas/components/OutputsDock.tsx',
    ]) {
      const src = read(p)
      expect(src, `${p} still references CogPopover`).not.toContain('CogPopover')
      // CONTRAST: the file loaded and is the one we mean.
      expect(src.length).toBeGreaterThan(1000)
      expect(src).toContain('import')
    }
  })

  it('AIInputBar declares no Settings cog', () => {
    const src = read('src/canvas/components/AIInputBar.tsx')
    expect(src).not.toContain('onCogClick')
    expect(src).not.toContain('aria-label="Settings"')
    // CONTRAST CONTROL: the bar's REAL controls are still declared in this
    // same file, so the absences above are about the cog and not about a file
    // that failed to load or was emptied.
    expect(src).toContain('aria-label')
    expect(src).toContain('textarea')
  })

  it('no surface still passes an onCogClick prop', () => {
    for (const p of [
      'src/canvas/ReactFlowGraph.tsx',
      'src/canvas/components/OutputsDock.tsx',
      'src/canvas/components/FloatingOlumiPanel.tsx',
      'src/canvas/components/FirstUseComposer.tsx',
      'src/canvas/components/PersistentInputStrip.tsx',
    ]) {
      const src = read(p)
      expect(src, `${p} still threads onCogClick`).not.toContain('onCogClick')
      expect(src.length).toBeGreaterThan(500)
    }
  })

  it('ChatComposer declares no voice-input button', () => {
    const src = read('src/canvas/conversation/zones/ChatComposer.tsx')
    expect(src).not.toContain('composer-voice-button')
    expect(src).not.toMatch(/voice input/i)
    // CONTRAST CONTROL: its NEIGHBOUR in the same button row is still declared.
    // If this file were empty or mis-pathed, this would fail first.
    expect(src).toContain('composer-attach-button')
  })
})
