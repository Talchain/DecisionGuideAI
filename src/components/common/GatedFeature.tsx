import React from 'react'

export const GatedFeature: React.FC<{ title: string; flagName: string }> = ({ title, flagName }) => (
  <div className="min-h-[40vh] w-full flex items-center justify-center p-8">
    <div className="max-w-md text-center">
      <h2 className="text-lg font-semibold mb-2">{title}</h2>
      <p className="text-sm text-gray-600">This feature is disabled. Enable the <code className="px-1 py-0.5 rounded bg-gray-100">{flagName}</code> flag in your environment to access it.</p>
    </div>
  </div>
)
export default GatedFeature
