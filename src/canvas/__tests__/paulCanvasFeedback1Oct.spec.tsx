/**
 * ⭐ PAUL'S 1 OCT 2026 CANVAS FEEDBACK, PINNED (his manual test, items quoted in each block).
 * Each row binds by identity (a testid, an exported constant, an exact source string) and carries a control.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react'
import { nodeColors, NODE_SELECTED_CLASSES } from '../nodes/colors'
import { ROW_PROMPT_W, ROW_PROMPT_H } from '../utils/nodeLayoutConstants'
import { NOT_RANKED_MARKER } from '../state/winShareGate'
import { COACHING_ICON_GLYPH, OLUMI_CARD_MARK_SRC } from '../nodes/shared/NodeCoachingIcon'
import { nodeTypeNumber, NODE_NUMBER_PREFIX } from '../nodes/shared/nodeTypeOrdinal'
import {
  briefPromptFor,
  BRIEF_PROMPTS,
  BRIEF_PROMPT_WHY_MAX,
  takeQueuedBriefCoachingPrefill,
} from '../components/briefCoaching'
import { BriefReadingCard } from '../components/BriefReadingCard'

const ROOT = join(__dirname, '..', '..', '..')
const src = (p: string) => readFileSync(join(ROOT, p), 'utf8')

describe('"remove all of the blue highlighted borders when anything is clicked on"', () => {
  it('⭐ a selected card of EVERY family lifts on the neutral shadow — no ring, no info colour', () => {
    for (const [kind, c] of Object.entries(nodeColors)) {
      expect(c.selected, kind).toBe(NODE_SELECTED_CLASSES)
    }
    expect(NODE_SELECTED_CLASSES).not.toMatch(/ring|info|primary|blue/)
  })

  it('the selected / hovered port re-lights in the body ink, not info blue', () => {
    const css = src('src/index.css')
    const rule = css.slice(css.indexOf('.react-flow__node.selected .react-flow__handle.olumi-node-port'))
    expect(rule.slice(0, 200)).toContain('background: var(--text-body)')
    expect(rule.slice(0, 200)).not.toContain('var(--info)')
  })

  it('the pressed strength, direction and "What else" chips use the neutral ink', () => {
    expect(src('src/canvas/ui/inspector-v2/shared/StrengthBandButtons.tsx')).toContain("? 'border-text-body text-text-body bg-panel-hover'")
    expect(src('src/canvas/ui/inspector-v2/shared/StrengthBandButtons.tsx')).not.toContain("'border-primary text-primary'")
    // (The link mini-editor's own chip row was retired with the mini-editor, Paul 4 Oct 2026: one click opens the
    // full link inspector, whose strength chips are `StrengthBandButtons`, pinned above.)
    expect(src('src/canvas/components/WhatElseChooser.tsx')).toContain("open.doorKind === c.kind ? 'border-text-body text-text-body'")
  })

  it('the inspector frame is the neutral border, not the info-at-30% frame', () => {
    const s = src('src/canvas/ui/inspector-v2/inspectorStyle.ts')
    expect(s).toContain("border: '1px solid var(--border-default)'")
    expect(s).not.toContain('rgb(var(--info-rgb) / 0.3)')
  })
})

describe('"Make the plus buttons on the right smaller … They should be 50% smaller."', () => {
  it('⭐ the row-end button is 32 flow units square (half the 30 Sep ruling of 64), with a 12px glyph', () => {
    expect(ROW_PROMPT_W).toBe(64 / 2)
    expect(ROW_PROMPT_H).toBe(ROW_PROMPT_W)
    const icon = src('src/canvas/nodes/shared/RowEndPromptIcon.tsx')
    expect(icon).toContain('<Plus size={12} className={CANVAS_GLYPH_SIZE_CLASSES[12]}')
    expect(icon).not.toContain('<Plus size={24}')
  })
})

describe('"You haven\'t implemented the actual Olumi brand icon"', () => {
  it('⭐ the card glyph draws the full-colour brand mark file, not the single-colour outline', () => {
    const { container } = render(<COACHING_ICON_GLYPH.Icon size={15} aria-hidden="true" />)
    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(img!.getAttribute('src')).toBe(OLUMI_CARD_MARK_SRC)
    expect(img!.getAttribute('data-icon')).toBe('olumi-brand-mark')
    // CONTROL: the old outline glyph was an <svg data-icon="olumi-ai">.
    expect(container.querySelector('svg[data-icon="olumi-ai"]')).toBeNull()
  })

  it('the mark file is the brand mark in its own colours, with no OS dark-mode rule', () => {
    const svg = src('public/olumi-mark-card.svg')
    for (const hex of ['#EA7B4B', '#5C9BB8', '#62B28F', '#252525']) expect(svg).toContain(hex)
    expect(svg).not.toContain('prefers-color-scheme')
    // CONTROL: the source file it was taken from DOES carry the rule.
    expect(src('public/olumi-mark.svg')).toContain('prefers-color-scheme')
  })
})

describe('"It says \'not ranked\' on the options. I don\'t think that\'s the right terminology."', () => {
  it('⭐ the option marker says the option WAS compared and only its share is withheld — never a verdict on it', () => {
    expect(NOT_RANKED_MARKER).toBe('Compared · share not shown')
    expect(NOT_RANKED_MARKER).not.toMatch(/rank/i)
    // R3 F5 (#85 5930578606): the marker shows only for an option the Run took part in, beside a panel that says the
    // options were compared — so it must never say they were not.
    expect(NOT_RANKED_MARKER).not.toMatch(/not compared/i)
  })
})

describe('"each node having a number relating to the node type"', () => {
  const n = (id: string, type: string, x: number, y = 0) => ({ id, type, position: { x, y } })
  const nodes = [
    n('q', 'decision', 500), n('o1', 'option', 0, 200), n('o2', 'option', 300, 200), n('o3', 'option', 600, 200),
    n('f1', 'factor', 0, 450), n('f2', 'factor', 300, 450), n('g', 'goal', 500, 900),
  ]

  it('⭐ the prefixes are the contract ref alphabet, so a number reads as an identifier, not a rank', () => {
    expect(NODE_NUMBER_PREFIX).toEqual({ option: 'O', factor: 'F', outcome: 'OC', risk: 'R' })
  })

  it('every repeated card gets its number in reading order; the anchors none', () => {
    expect(['o1', 'o2', 'o3'].map((id) => nodeTypeNumber('option', id, nodes))).toEqual([1, 2, 3])
    expect(['f1', 'f2'].map((id) => nodeTypeNumber('factor', id, nodes))).toEqual([1, 2])
    expect(nodeTypeNumber('decision', 'q', nodes)).toBeUndefined()
    expect(nodeTypeNumber('goal', 'g', nodes)).toBeUndefined()
  })

  it('⭐ an option shows the SAME number as the Analysis panel\'s "Option N" (the registered numbering)', () => {
    const registered = { o1: 2, o2: 1, o3: 3 } // the registry's order, deliberately not the reading order
    expect(['o1', 'o2', 'o3'].map((id) => nodeTypeNumber('option', id, nodes, registered))).toEqual([2, 1, 3])
  })

  it('an option added after registration continues after the highest number ever issued, never reusing one', () => {
    const registered = { o1: 1, gone: 4 } // `gone` was deleted; its 4 is never reissued
    const withNew = [...nodes.filter((x) => x.id !== 'o2' && x.id !== 'o3'), n('new', 'option', 300, 200)]
    expect(nodeTypeNumber('option', 'new', withNew, registered)).toBe(5)
  })

  it('the card draws the number as the title\'s generated ::before — never title text — and names it after GAP-36\'s name', () => {
    const base = src('src/canvas/nodes/BaseNode.tsx')
    expect(base).toContain('[NODE_TYPE_ORDINAL_ATTR]: `${NODE_NUMBER_PREFIX[nodeType as NumberedNodeKind]}${typeOrdinal}`')
    expect(base).not.toContain('data-testid="node-type-ordinal"')
    expect(base).toContain('`${NODE_REGISTRY[nodeType].label}: ${cardTitle}. Open details.${typeOrdinalSentence}`')
    const css = src('src/index.css')
    const rule = css.slice(css.indexOf('[data-type-ordinal]::before'))
    expect(rule.slice(0, 120)).toContain('content: attr(data-type-ordinal)')
  })
})

describe('"design that panel so it looks good … science-grounded, concise, easy-to-understand, action-oriented coaching"', () => {
  beforeEach(() => { takeQueuedBriefCoachingPrefill() })

  // Paul 21 Oct 2026, of the three habit cards: "a lot of text and not a lot of useful functionality". ONE question
  // about this brief, answered in place.
  it('⭐ the first gap is asked (goal → limits → options); with no gap, a pre-mortem', () => {
    expect(briefPromptFor({ hasGoal: false, hasLimits: false, optionCount: 1 }).id).toBe('goal')
    expect(briefPromptFor({ hasGoal: true, hasLimits: false, optionCount: 1 }).id).toBe('limits')
    expect(briefPromptFor({ hasGoal: true, hasLimits: true, optionCount: 1 }).id).toBe('options')
    // CONTROL: a brief with no gap still gets a question it can answer.
    expect(briefPromptFor({ hasGoal: true, hasLimits: true, optionCount: 4 }).id).toBe('pre_mortem')
  })

  it('every question has one plain line of why, and no citation on screen', () => {
    for (const p of Object.values(BRIEF_PROMPTS)) {
      expect(p.why.length, p.id).toBeLessThanOrEqual(BRIEF_PROMPT_WHY_MAX)
      expect(p.why.split(/(?<=[.!?])\s+/).filter(Boolean), p.id).toHaveLength(1)
      expect(`${p.question} ${p.why}`, p.id).not.toMatch(/\(|\bdecision/i)
    }
  })

  it('⭐ typing an answer QUEUES a pre-fill in the user\'s words — it sends nothing — and "Add" confirms it', () => {
    render(<BriefReadingCard reading={{ goal: 'reach £200k MRR', options: ['build the module', 'fix the bug'], limits: [] }} />)
    const card = screen.getByTestId('brief-reading')
    expect(within(card).getByText('Your brief')).toBeTruthy()
    expect(within(screen.getByTestId('brief-reading-considerations')).getByText('Not stated yet')).toBeTruthy()
    const prompt = screen.getByTestId('brief-prompt')
    expect(prompt.getAttribute('data-prompt')).toBe('limits')
    expect(within(prompt).getByLabelText(BRIEF_PROMPTS.limits.question)).toBe(screen.getByTestId('brief-prompt-input'))
    expect(takeQueuedBriefCoachingPrefill()).toBeNull()
    // CONTROL: an empty answer cannot be added.
    expect((screen.getByTestId('brief-prompt-submit') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByTestId('brief-prompt-input'), { target: { value: 'under £40k' } })
    fireEvent.click(screen.getByTestId('brief-prompt-submit'))
    expect(screen.getByTestId('brief-prompt-added').textContent).toContain('Added')
    expect(takeQueuedBriefCoachingPrefill()).toBe('My limits are: under £40k')
    // CONTROL: taking it clears it — one answer, handed over once.
    expect(takeQueuedBriefCoachingPrefill()).toBeNull()
    expect(card.textContent, 'the reading never speaks of a model').not.toMatch(/\bmodel\b/i)
  })

  it('⭐ the user\'s own Options field is ONE free-text box: never numbered, never counted, never asked for "another option"', () => {
    // Paul's 1 Oct preview: "promise … by next month; fix that now" read as option "1", and the card coached "Add a real
    // alternative" to someone who had written two. The card parses no language, so the count is unknown, not one.
    const fields = { context: 'Our biggest customer asked for an AI reporting module.', goal: 'keep the account', options: 'promise an AI reporting module by next month; fix that now', considerations: 'by March' }
    render(<BriefReadingCard reading={null} userFields={fields} />)
    const options = screen.getByTestId('brief-reading-options')
    expect(options.textContent).toBe('Options“promise an AI reporting module by next month; fix that now”')
    expect(options.querySelector('ol')).toBeNull()
    expect(screen.getByTestId('brief-prompt').getAttribute('data-prompt')).toBe('pre_mortem')
    cleanup()
    // CONTROL: an EMPTY Options field is a known zero, and is asked.
    render(<BriefReadingCard reading={null} userFields={{ ...fields, options: '' }} />)
    expect(screen.getByTestId('brief-prompt').getAttribute('data-prompt')).toBe('options')
    cleanup()
    // CONTROL: CEE's spans are one per option, so a single span still counts as one and is asked.
    render(<BriefReadingCard reading={{ goal: 'reach £200k MRR', options: ['build the module'], limits: ['by March'] }} />)
    expect(screen.getByTestId('brief-reading-options').querySelector('ol')).not.toBeNull()
    expect(screen.getByTestId('brief-prompt').getAttribute('data-prompt')).toBe('options')
  })

  it('DS v5: outlined option pills, no tinted containers, no decorative icon tiles', () => {
    const s = src('src/canvas/components/BriefReadingCard.tsx')
    expect(s).not.toMatch(/bg-[a-z]+-light|bg-panel-hover\//)
    expect(s).toContain('rounded-pill border border-option/30 bg-transparent')
    // CONTROL: the probe reads the real file.
    expect(s).toContain('data-testid="brief-prompt"')
  })

  it('one type size across the card: every text class is a 14px token (Paul 30 Sep: "Multiple different font sizes")', () => {
    const s = src('src/canvas/components/BriefReadingCard.tsx')
    const body = s.slice(s.indexOf('export const BriefReadingCard'))
    expect(body).not.toMatch(/typo\('(caption|labelSmall|h3|h4|body)'/)
  })
})
