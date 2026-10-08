import { useContext } from 'react'
import { CanvasOptionChanceContext } from './OptionChanceCellProvider'

/** Read the canvas's Results cell; isolated mounts receive RunView's no-source cell. */
export function useOptionChanceCell(optionId: string) {
  return useContext(CanvasOptionChanceContext)(optionId)
}
