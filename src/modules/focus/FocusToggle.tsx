// src/modules/focus/FocusToggle.tsx
interface FocusToggleProps {
  isFocusMode: boolean
  onToggle: () => void
}

export function FocusToggle({ isFocusMode, onToggle }: FocusToggleProps) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={isFocusMode}
      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-info ${
        isFocusMode
          ? 'bg-primary text-text-on-color hover:bg-primary-hover'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
      title="Toggle focus mode (F)"
    >
      <span className="flex items-center gap-1.5">
        <span aria-hidden="true">{isFocusMode ? '🎯' : '○'}</span>
        <span>Focus</span>
      </span>
    </button>
  )
}
