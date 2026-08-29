/**
 * "Your input" must be a CLAIM ABOUT PROVENANCE, not a static header.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE DEFECT THIS PINS
 * ─────────────────────────────────────────────────────────────────────────────
 * `GROUP_LABELS.input` was passed UNCONDITIONALLY — `label={GROUP_LABELS.input}`
 * at all seven panel sites, with no predicate — so every factor, goal and risk
 * panel headed a group "Your input" over whatever was inside it, INCLUDING
 * Olumi's own estimates. Measured on the deployed product: **"Your input: 140"**
 * on a value the user never supplied, in a panel that simultaneously said
 * "Estimated by Olumi" twice.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * BOTH DIRECTIONS ARE TESTED, BECAUSE BOTH ARE REAL HARMS (standing brief §3)
 * ─────────────────────────────────────────────────────────────────────────────
 *   · INVENTED AUTHORSHIP — the reported defect: the header credits the user
 *     with a number they never gave.
 *   · STRIPPED AUTHORSHIP — the twin: an Olumi attribution over a number the
 *     user DID supply. `observedStateHelpers.ts` records this estate getting
 *     exactly this backwards once already and rules it the WORSE harm.
 *
 * Every user-owned kind therefore gets an explicit case, not just one sample —
 * a corpus with a single member cannot see a register that has been narrowed.
 * The kind list is DERIVED from the module's own `VALUE_PROVENANCE_SOURCES`
 * rather than retyped, so a literal added there without a header decision fails
 * here instead of silently defaulting (CLAUDE.md trap 12).
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { getInputGroupLabel, GROUP_LABELS } from '../inspectorStrings'
import {
  VALUE_PROVENANCE_SOURCES,
  classifyValueProvenance,
} from '../../../domain/valueProvenance'
import { FactorObservablePanel } from '../panels/FactorObservablePanel'

describe('getInputGroupLabel — positive evidence, in both directions', () => {
  it('INVENTED-direction: an Olumi estimate is NEVER headed "Your input"', () => {
    // The three literals the estate's ONE classifier calls `ai`.
    for (const source of ['cee_inference', 'inferred', 'cee_repair']) {
      expect(getInputGroupLabel(source, true)).toBe(GROUP_LABELS.inputUnattributed)
      expect(getInputGroupLabel(source, true)).not.toBe(GROUP_LABELS.input)
    }
  })

  it('STRIPPED-direction TWIN: a value the user DID supply is still headed "Your input"', () => {
    // Every user-owned literal, derived from the classifier rather than retyped.
    const userOwned = VALUE_PROVENANCE_SOURCES.filter(
      s => classifyValueProvenance(s)?.userOwned === true
    )
    // Magnitude check — a filter that silently stopped discriminating would
    // return an empty list and this suite would vacuously pass (trap 13).
    expect(userOwned.length).toBeGreaterThanOrEqual(5)
    expect(userOwned).toContain('user_confirmed')
    expect(userOwned).toContain('user_override')
    for (const source of userOwned) {
      expect(getInputGroupLabel(source, true)).toBe(GROUP_LABELS.input)
    }
  })

  it('a brief-extracted value is not claimed as the user\'s own input', () => {
    // The user wrote the brief; the model read the NUMBER out of their prose.
    // `brief` is deliberately absent from USER_OWNED_KINDS for that reason.
    for (const source of ['brief_extraction', 'explicit']) {
      expect(getInputGroupLabel(source, true)).toBe(GROUP_LABELS.inputUnattributed)
      expect(getInputGroupLabel(source, true)).not.toBe(GROUP_LABELS.input)
    }
  })

  it("a named colleague's panel answer is never collapsed into first-person copy", () => {
    expect(getInputGroupLabel('panel_elicited', true)).toBe(GROUP_LABELS.inputUnattributed)
    expect(getInputGroupLabel('panel_elicited', true)).not.toBe(GROUP_LABELS.input)
  })

  it('THE HEADER NEVER RE-ATTRIBUTES — it must not restate any pill sentence', () => {
    // The first version of this fix answered each non-user-owned kind with that
    // kind's own attribution, creating a SECOND attribution authority beside
    // the pill inside the same group. Two existing guards REDed on it:
    // Brief3Panels ("Found multiple elements with the text: From your brief")
    // and panelAttributionNaming (the unnamed "From your panel" leaking while
    // the pill had resolved the author's name). Pinned so it cannot come back.
    const pillSentences = [
      'From your brief',
      'From your panel',
      'Estimated by Olumi',
      'Confirmed by you',
      'Set by you',
      'Your assumption',
      'Generated from your brief',
    ]
    for (const source of VALUE_PROVENANCE_SOURCES) {
      expect(pillSentences).not.toContain(getInputGroupLabel(source, true))
    }
  })

  it('NO EVIDENCE + a value on screen: the header claims nothing in either direction', () => {
    for (const source of [undefined, null, '', 'some_literal_nobody_declared']) {
      const label = getInputGroupLabel(source, true)
      expect(label).toBe(GROUP_LABELS.inputUnattributed)
      expect(label).not.toBe(GROUP_LABELS.input)
    }
  })

  it('NO EVIDENCE + an EMPTY group: "Your input" is a prompt, and stays', () => {
    // Nothing is on screen to misattribute, and this is the ordinary
    // needs-input state ("No value set. Click to enter.").
    for (const source of [undefined, null, 'some_literal_nobody_declared']) {
      expect(getInputGroupLabel(source, false)).toBe(GROUP_LABELS.input)
    }
  })

  it('every classified literal resolves to one of the two headers — the register is TOTAL', () => {
    // Derived completeness: a literal added to SOURCE_CLASSES without a header
    // decision REDs here rather than falling through to a default. The
    // discrimination is that BOTH headers are actually produced — a register
    // that silently collapsed to one answer would satisfy a length check.
    expect(VALUE_PROVENANCE_SOURCES.length).toBeGreaterThanOrEqual(12)
    const produced = new Set(
      VALUE_PROVENANCE_SOURCES.map(s => getInputGroupLabel(s, true))
    )
    expect([...produced].sort()).toEqual(
      [GROUP_LABELS.input, GROUP_LABELS.inputUnattributed].sort()
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// The wiring. A correct helper nothing calls is the estate's commonest defect
// class, so the panel is rendered and the header read off the DOM.
// ─────────────────────────────────────────────────────────────────────────────

vi.mock('../../../store', () => ({
  useCanvasStore: vi.fn((selector?: (s: unknown) => unknown) => {
    const state = {
      nodes: [
        {
          id: 'factor-1',
          type: 'factor',
          data: {
            kind: 'factor',
            label: 'Weekly active users',
            category: 'observable',
            observedState: { value: 140, source: 'cee_inference' },
          },
        },
      ],
      edges: [],
      results: { status: 'idle', report: null },
      ceeAnalysisReady: null,
      lastConfirmed: null,
      updateNodeData: vi.fn(),
      setNodes: vi.fn(),
    }
    return selector ? selector(state) : state
  }),
}))

describe('FactorObservablePanel wires the honest header', () => {
  const props = {
    nodeId: 'factor-1',
    onNavigate: vi.fn(),
    onClose: vi.fn(),
  } as unknown as React.ComponentProps<typeof FactorObservablePanel>

  it('a cee_inference value does NOT render "Your input" over itself', () => {
    const { container } = render(<FactorObservablePanel {...props} />)
    const group = container.querySelector('[data-panel-group="input"]')
    expect(group).not.toBeNull()
    // Bind to the group's own HEADER, not to the whole panel's text: "Your
    // input" appearing anywhere else must not satisfy or break this.
    const header = group!.firstElementChild
    expect(header?.textContent).toBe(GROUP_LABELS.inputUnattributed)
    expect(header?.textContent).not.toBe(GROUP_LABELS.input)
  })
})
