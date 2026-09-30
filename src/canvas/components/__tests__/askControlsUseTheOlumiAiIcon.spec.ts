/**
 * ⭐ Paul's ruling (30 Sep 2026, via Canvas): the Olumi AI icon is THE icon for Olumi's AI. Every
 * control that starts an AI interaction, and Olumi's own voice/avatar, uses `OlumiAiIcon` with the
 * `olumi-glyph-ai` class. Sparkles is kept ONLY for provenance ("Drafted by Olumi").
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { render } from '@testing-library/react'
import { ACTION_ICON } from '../../../components/results/analysis-hero/actOnIt/tokens'

const src = (p: string) => readFileSync(join(process.cwd(), 'src', p), 'utf8')

const ASK_OR_VOICE = [
  'canvas/components/pre-analysis/DiscussWithAiButton.tsx',
  'canvas/components/CoachingCard.tsx',
  'canvas/components/DraftChat.tsx',
  'canvas/components/coaching-panel/CoachingMoment.tsx',
  'canvas/components/AssistantFocusChip.tsx',
  // Panel, 30 Sep 2026: the Analysis tab's "Work through" ask (served funding brief, Strengthen card).
  'components/results/strengthen/StrengthenPanel.tsx',
]

describe('an ask uses the Olumi AI icon; provenance keeps Sparkles', () => {
  it.each(ASK_OR_VOICE)('%s renders OlumiAiIcon with olumi-glyph-ai, and no Sparkles', (file) => {
    const code = src(file)
    expect(code).toMatch(/<OlumiAiIcon\b[^>]*olumi-glyph-ai/)
    expect(code).not.toMatch(/<Sparkles\b/)
  })

  it('the Analysis tab\'s act-on-it "Work through with AI" icon is the Olumi glyph (Panel, 30 Sep 2026)', () => {
    const { container } = render(createElement(ACTION_ICON.ai.Icon, { className: 'h-4 w-4' }))
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('data-icon')).toBe('olumi-ai')
    expect(svg.getAttribute('class')).toContain('olumi-glyph-ai')
    expect(svg.getAttribute('class'), 'the caller\'s classes are kept').toContain('h-4')
  })

  it('CONTROL: the provenance note ("Drafted by Olumi") keeps Sparkles', () => {
    expect(src('canvas/ui/inspector-v2/panels/OptionPanel.tsx')).toMatch(/<Sparkles\b/)
  })
})
