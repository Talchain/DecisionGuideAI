import { CANVAS_LAYER_CLASS } from '../../canvas/layers'
import { BelowCue } from '../BelowCue'
import { ViewPreMortemKey } from '../ViewPreMortemKey'
import { ViewTradeOffsKey } from '../ViewTradeOffsKey'
import { ViewWhatIfKey } from '../ViewWhatIfKey'
import { ViewZoomNotice } from '../ViewZoomNotice'
import { useFootLayout } from './footLayout'

export function FootRow({ onPress, onZoom, edge }: { onPress: () => void; onZoom: () => void; edge: boolean }) {
  const { footRef, rowRef, compact } = useFootLayout()
  return (
    <div ref={footRef} data-testid="view-foot-row"
      className={`pointer-events-none fixed bottom-[var(--foot-bottom)] left-[var(--foot-left)] flex max-h-[var(--foot-height)] w-[var(--foot-width)] flex-col-reverse items-center gap-2 ${CANVAS_LAYER_CLASS.chromeMenu}`}>
      <div ref={rowRef} className="group/foot flex w-full flex-none flex-wrap items-end gap-2 empty:hidden">
        <BelowCue onPress={onPress} edge={edge} />
        <ViewZoomNotice onZoom={onZoom} compact={compact} />
      </div>
      <ViewWhatIfKey />
      <ViewTradeOffsKey />
      <ViewPreMortemKey />
    </div>
  )
}
