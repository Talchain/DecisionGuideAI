// src/poc/components/SandboxHeader.tsx

export type SandboxMode = 'draw' | 'connect' | 'inspect'

export function SandboxHeader({
  mode,
  onModeChange,
  onHelp,
  onUndo,
  onRedo,
  onExport,
  exporting = false,
  onClear,
  canUndo = false,
  canRedo = false,
}: {
  mode: SandboxMode
  onModeChange: (m: SandboxMode) => void
  onHelp?: () => void
  onUndo?: () => void
  onRedo?: () => void
  onExport?: () => void
  exporting?: boolean
  onClear?: () => void
  canUndo?: boolean
  canRedo?: boolean
}) {
  const btn = (label: string, value: SandboxMode) => (
    <button
      type="button"
      onClick={() => onModeChange(value)}
      aria-pressed={mode === value}
      className={`px-2 py-1 text-xs rounded border ${
        mode === value ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-300'
      }`}
      data-testid={`mode-${value}`}
    >
      {label}
    </button>
  )

  return (
    <div
      className="w-full bg-white border-b border-gray-200 px-3 py-2 flex items-center gap-3"
      role="toolbar"
      aria-label="Scenario Sandbox toolbar"
      data-testid="sandbox-header"
    >
      <div className="text-xs font-semibold text-gray-800">Sam Scenario Sandbox (POC)</div>
      <div className="flex items-center gap-1" data-testid="mode-switch">
        {btn('Draw', 'draw')}
        {btn('Connect', 'connect')}
        {btn('Inspect', 'inspect')}
      </div>
      <div className="flex items-center gap-1 ml-2">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          aria-label="Undo"
          data-testid="undo-btn"
          className={`px-2 py-1 text-xs rounded border ${
            canUndo ? 'bg-white text-gray-700 border-gray-300' : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
          }`}
        >
          ↶ Undo
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          aria-label="Redo"
          data-testid="redo-btn"
          className={`px-2 py-1 text-xs rounded border ${
            canRedo ? 'bg-white text-gray-700 border-gray-300' : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
          }`}
        >
          ↷ Redo
        </button>
      </div>
      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={onClear}
          className="px-2 py-1 text-xs rounded border bg-white text-red-600 border-red-300"
          aria-label="Clear sandbox"
          data-testid="clear-btn"
          title="Clear sandbox (local)"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={onExport}
          disabled={!!exporting}
          className={`px-2 py-1 text-xs rounded border ${
            exporting ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : 'bg-white text-gray-700 border-gray-300'
          }`}
          aria-label="Export PNG"
          data-testid="export-png-btn"
          title="Export PNG"
        >
          {exporting ? 'Exporting…' : 'Export PNG'}
        </button>
        <button
          type="button"
          onClick={onHelp}
          className="px-2 py-1 text-xs rounded border bg-white text-gray-700 border-gray-300"
          aria-label="Help"
          title="Help (?)"
          data-testid="sandbox-help"
        >
          ?
        </button>
      </div>
    </div>
  )
}

export default SandboxHeader
