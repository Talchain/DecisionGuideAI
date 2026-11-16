/**
 * V12: the Simple | Detailed switch, a small floating pill (the canvas places it at the bottom centre; never a strip across the top). Simple
 * draws each card as visuals; Detailed draws today's full faces. Both draw the whole model. Chrome words only.
 */
import { typography } from '../../styles/typography'
import { HIT_44 } from '../../styles/hitArea'
import { showSimple, showWholeModel, useLevel } from './simpleStore'

export const SIMPLE_SWITCH_TESTID = 'view-simple-switch'

export function SimpleSwitch(): JSX.Element {
  const level = useLevel()
  const seg = (on: boolean) => `${typography.viewPanelMeta} inline-flex h-7 cursor-pointer items-center rounded-full px-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-text-header ${on ? 'bg-panel-hover font-medium text-text-header' : 'text-text-light hover:text-text-header'}`
  return (
    <div role="group" aria-label="Level of detail" data-testid={SIMPLE_SWITCH_TESTID} data-level={level}
      className={`pointer-events-auto inline-flex items-center gap-0.5 rounded-full border border-panel-border bg-panel p-0.5 shadow-1 ${HIT_44}`}>
      <button type="button" aria-pressed={level === 'simple'} onClick={() => showSimple()} data-testid="view-level-simple" title="Visuals first: the whole model, with the words behind hover" className={seg(level === 'simple')}>Simple</button>
      <button type="button" aria-pressed={level === 'working'} onClick={() => showWholeModel()} data-testid="view-level-detailed" title="The whole model with each card's words" className={seg(level === 'working')}>Detailed</button>
    </div>
  )
}
