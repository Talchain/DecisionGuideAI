/**
 * ResultsLink — navigation link from inspector impact sections to results panel.
 * panelMeta, text-primary, underline on hover, ArrowRight icon.
 */

import { useCallback } from 'react'
import { ArrowRight } from 'lucide-react'
import { typography } from '../../../../styles/typography'
import { useUIStore, type OutputTab } from '../../../../stores/uiStore'

interface ResultsLinkProps {
  label: string
  tab: OutputTab
}

export function ResultsLink({ label, tab }: ResultsLinkProps) {
  const handleClick = useCallback(() => {
    useUIStore.getState().setActiveOutputTab(tab)
  }, [tab])

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`${typography.panelMeta} text-primary hover:underline inline-flex items-center gap-1 bg-transparent border-none cursor-pointer p-0`}
    >
      {label}
      <ArrowRight size={10} className="text-primary" aria-hidden="true" />
    </button>
  )
}
