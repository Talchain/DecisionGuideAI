/**
 * ⭐ AN EMPTY VALUE AT REST (Paul, 20 Oct 2026, canvas option 3): the icon system's own `needs-input` glyph, then a
 * blank slot with the unit beside it. No pill and no sentence on the card; the words are the glyph's tooltip and
 * accessible name. Drawn inline (not through `CardMark`, which portals into the card's bottom band) because it is the
 * resting face of the field the user types into.
 */
import Tooltip from '../../../components/Tooltip'
import { classifyUnit, moneyFigureParts } from '../../../utils/unitClassifier'
import { cardMark } from './cardMarks'
import { SOURCE_MARK_GLYPH_CLASSES } from './EstimateMarker'
import { NODE_TOOLTIP_DELAY_MS } from './nodeTooltip'

export function NeedsInputSlot({ words, description, unit = {}, testId }: {
  words: string
  description: string
  unit?: { prefix?: string; suffix?: string }
  testId?: string
}) {
  const { Icon } = cardMark('needs-input')
  return (
    <span className="inline-flex items-center gap-1 text-text-light" data-testid={testId}>
      <Tooltip asChild delay={NODE_TOOLTIP_DELAY_MS} content={`${words} · ${description}`}>
        <span role="img" aria-label={words} aria-description={description} className="inline-flex" data-card-mark="needs-input">
          <Icon aria-hidden="true" strokeWidth={1.8} className={SOURCE_MARK_GLYPH_CLASSES} />
        </span>
      </Tooltip>
      {unit.prefix && <span>{unit.prefix}</span>}
      <span aria-hidden="true" className="inline-block rounded border border-dashed border-text-light px-2">—</span>
      {unit.suffix && <span>{unit.suffix}</span>}
    </span>
  )
}

/**
 * Where an empty value's unit sits: a currency's glyph before the field (`£`, via the one money rule), any other unit
 * after it, no unit for none.
 */
export function emptyValueUnit(unit: string | null | undefined): { prefix?: string; suffix?: string } {
  const { kind, canonical } = classifyUnit(unit)
  if (kind === 'none' || kind === 'placeholder') return {}
  if (kind !== 'symbol' && kind !== 'iso') return { suffix: canonical }
  const glyph = moneyFigureParts(0, canonical)?.figure.replace(/[-\d.,\s]/g, '')
  return { prefix: glyph || canonical }
}
