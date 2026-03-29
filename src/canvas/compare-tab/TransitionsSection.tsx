import { useState } from 'react'
import { FileText, ChevronDown, ChevronRight } from 'lucide-react'
import { typography } from '../../styles/typography'
import { TransitionCard } from './TransitionCard'
import type { Transition } from './types'

interface TransitionsSectionProps {
  transitions: Transition[]
  showExpert: boolean
  registerCardRef?: (key: string, el: HTMLDivElement | null) => void
}

export function TransitionsSection({ transitions, showExpert, registerCardRef }: TransitionsSectionProps) {
  const [open, setOpen] = useState(true)
  const allDeltas = transitions.map(t => t.winnerProbDelta)

  return (
    <div className="border-b border-panel-border">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-1.5 px-4 py-2 bg-transparent border-none cursor-pointer"
      >
        {open ? <ChevronDown size={11} className="text-text-light" /> : <ChevronRight size={11} className="text-text-light" />}
        <FileText size={13} className="text-text-light" />
        <span className={typography.panelHeader}>What changed and why</span>
        <span className={`${typography.panelMeta} inline-flex items-center px-2 py-px rounded-full border border-panel-border bg-transparent text-text-body ml-1`}>
          {transitions.length}
        </span>
      </button>
      {open && (
        <div className="px-4 pb-2.5">
          {transitions.map((tr, i) => (
            <TransitionCard
              key={`${tr.fromRunNumber}-${tr.toRunNumber}`}
              transition={tr}
              startOpen={i === 0}
              showExpert={showExpert}
              allDeltas={allDeltas}
              registerRef={registerCardRef}
            />
          ))}
        </div>
      )}
    </div>
  )
}
