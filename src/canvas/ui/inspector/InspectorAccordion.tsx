/**
 * InspectorAccordion — manages exclusive section toggling
 *
 * Summary section is always visible and not collapsible.
 * Only one non-Summary section can be open at a time.
 * Reuses existing Accordion component in controlled mode.
 */

import { useState, useCallback, type ReactNode } from 'react'
import { Accordion } from '../../components/pre-analysis/primitives/Accordion'

/** Section IDs for inspector panels */
export type InspectorSectionId = 'assumptions' | 'appearance' | 'advanced'

interface InspectorAccordionProps {
  /** Summary content — always visible, not collapsible */
  summary: ReactNode
  /** Assumptions section content */
  assumptions?: ReactNode
  /** Appearance section content */
  appearance?: ReactNode
  /** Advanced section content */
  advanced?: ReactNode
  /** Which section starts expanded (default: none) */
  defaultOpen?: InspectorSectionId
  /** Test ID prefix */
  testId?: string
}

/** Section header style: 11px, uppercase, text-text-light, 1px letter-spacing */
const SECTION_TITLE_CLASS = 'text-[11px] font-semibold uppercase tracking-[1px] text-text-light'

export function InspectorAccordion({
  summary,
  assumptions,
  appearance,
  advanced,
  defaultOpen,
  testId = 'inspector',
}: InspectorAccordionProps) {
  const [openSection, setOpenSection] = useState<InspectorSectionId | null>(defaultOpen ?? null)

  const handleToggle = useCallback((sectionId: InspectorSectionId) => {
    setOpenSection(prev => prev === sectionId ? null : sectionId)
  }, [])

  return (
    <div className="space-y-2" data-testid={testId}>
      {/* SUMMARY — always visible, not collapsible */}
      <div data-testid={`${testId}-summary`}>
        {summary}
      </div>

      {/* ASSUMPTIONS */}
      {assumptions && (
        <Accordion
          title="ASSUMPTIONS"
          isExpanded={openSection === 'assumptions'}
          onExpandChange={() => handleToggle('assumptions')}
          testId={`${testId}-assumptions`}
          titleClassName={SECTION_TITLE_CLASS}
        >
          {assumptions}
        </Accordion>
      )}

      {/* APPEARANCE */}
      {appearance && (
        <Accordion
          title="APPEARANCE"
          isExpanded={openSection === 'appearance'}
          onExpandChange={() => handleToggle('appearance')}
          testId={`${testId}-appearance`}
          titleClassName={SECTION_TITLE_CLASS}
        >
          {appearance}
        </Accordion>
      )}

      {/* ADVANCED */}
      {advanced && (
        <Accordion
          title="ADVANCED"
          isExpanded={openSection === 'advanced'}
          onExpandChange={() => handleToggle('advanced')}
          testId={`${testId}-advanced`}
          titleClassName={SECTION_TITLE_CLASS}
        >
          {advanced}
        </Accordion>
      )}
    </div>
  )
}
