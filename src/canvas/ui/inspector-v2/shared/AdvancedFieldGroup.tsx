/**
 * AdvancedFieldGroup — section divider with label for technical detail editor.
 * Renders a thin hr + uppercase label + children.
 */

interface AdvancedFieldGroupProps {
  title: string
  children: React.ReactNode
}

export function AdvancedFieldGroup({ title, children }: AdvancedFieldGroupProps) {
  return (
    <div className="mb-2 first:mt-0 mt-2 bg-panel border border-panel-border rounded-lg p-3">
      <div
        className="text-[10px] font-semibold text-text-light uppercase mb-2 pb-1.5 border-b border-panel-border"
        style={{ letterSpacing: '0.6px' }}
      >
        {title}
      </div>
      <div className="space-y-2">
        {children}
      </div>
    </div>
  )
}
