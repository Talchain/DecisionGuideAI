/**
 * ⭐ Paul's ruling (30 Sep 2026, via Canvas): the Olumi AI icon is THE icon for Olumi's AI. Every
 * control that starts an AI interaction, and Olumi's own voice/avatar, uses `OlumiAiIcon` with the
 * `olumi-glyph-ai` class. Sparkles is kept ONLY for provenance ("Drafted by Olumi").
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

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

  // The Analysis tab's act-on-it "Work through with AI" icon is pinned inside the analysis-hero module
  // (`actOnIt/__tests__/actionIconIsTheOlumiGlyph.spec.tsx`): only its own mount may import that module.

  it('CONTROL: the provenance note ("Drafted by Olumi") keeps Sparkles', () => {
    expect(src('canvas/ui/inspector-v2/panels/OptionPanel.tsx')).toMatch(/<Sparkles\b/)
  })
})
