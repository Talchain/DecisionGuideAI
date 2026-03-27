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
    <div className="mt-3 first:mt-0">
      <div className="flex items-center gap-2 mb-2">
        <hr className="flex-1 border-panel-border" />
        <span
          className="text-[10px] font-semibold text-text-light uppercase flex-shrink-0"
          style={{ letterSpacing: '0.6px' }}
        >
          {title}
        </span>
        <hr className="flex-1 border-panel-border" />
      </div>
      <div className="space-y-1">
        {children}
      </div>
    </div>
  )
}
