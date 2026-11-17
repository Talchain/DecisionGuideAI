import { useEffect } from 'react'
import { HELP_EVENTS } from '../../components/layout/TopBar'
import { KeyboardLegend, useKeyboardLegend } from '../../canvas/help/KeyboardLegend'
import { InfluenceExplainer, useInfluenceExplainer } from '../../components/assistants/InfluenceExplainer'

/**
 * The three-dot menu's Help on the V12 canvas (Paul's audit, 17 Nov: "Keyboard shortcuts" and "How influence works" did nothing there).
 * The top bar sends the same two events it always has; the previous canvas answered them and this one now does too, with the same two
 * panels: the legend lists only the keys that work on this canvas (KeyboardLegend's lane sections), and the explainer is the product's own.
 */
export function LaneHelp(): JSX.Element {
  const legend = useKeyboardLegend()
  const influence = useInfluenceExplainer()
  const { open } = legend, { show } = influence
  useEffect(() => {
    const keys = () => open(), how = () => show()
    window.addEventListener(HELP_EVENTS.SHOW_KEYBOARD_LEGEND, keys)
    window.addEventListener(HELP_EVENTS.SHOW_INFLUENCE_EXPLAINER, how)
    return () => {
      window.removeEventListener(HELP_EVENTS.SHOW_KEYBOARD_LEGEND, keys)
      window.removeEventListener(HELP_EVENTS.SHOW_INFLUENCE_EXPLAINER, how)
    }
  }, [open, show])
  return (
    <>
      {influence.shouldShow ? (
        <div className="absolute z-[1200] flex flex-col items-end gap-3" style={{ top: 'calc(var(--topbar-h, 0px) + 1rem)', right: '1rem' }} data-testid="lane-influence-explainer">
          <InfluenceExplainer forceShow={influence.forceShow} onDismiss={influence.hide} compact />
        </div>
      ) : null}
      <KeyboardLegend isOpen={legend.isOpen} onClose={legend.close} />
    </>
  )
}
