// src/modules/critique/CritiquePanel.tsx
import { useState } from 'react'
import type { CritiqueItem } from './types'

type Tab = 'blockers' | 'improvements' | 'observations'

export function CritiquePanel({ blockers, improvements, observations, onFix }: any) {
  const [activeTab, setActiveTab] = useState<Tab>('blockers')
  const items = activeTab === 'blockers' ? blockers : activeTab === 'improvements' ? improvements : observations

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-4 py-3 border-b"><h3 className="font-semibold">Critique</h3></div>
      <div className="flex border-b">
        {(['blockers', 'improvements', 'observations'] as Tab[]).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} 
            className={`flex-1 px-4 py-2 text-sm ${activeTab === tab ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600'}`}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>
      <div className="p-4 max-h-96 overflow-y-auto">
        {items.length === 0 ? <p className="text-sm text-gray-500 text-center py-8">✅ All clear</p> : (
          <div className="space-y-3">
            {items.map((item: CritiqueItem) => (
              <div key={item.id} className="rounded-lg border p-3 bg-gray-50">
                <div className="text-sm font-medium">{item.title}</div>
                <div className="text-xs text-gray-600">{item.rationale}</div>
                {item.fixAction && onFix && (
                  <button onClick={() => onFix(item)} className="mt-2 px-2 py-1 text-xs bg-indigo-600 text-white rounded">Fix</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
