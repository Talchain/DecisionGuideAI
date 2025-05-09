// src/components/ImportanceSelector.tsx

import React, { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { ArrowLeft, Zap, Shield, Clock, Scale } from 'lucide-react'
import { useDecision } from '../contexts/DecisionContext'

interface ImportanceType {
  id: string
  label: string
  icon: React.ElementType
  description: string
  timeframe: string
}

const importanceTypes: ImportanceType[] = [
  {
    id: 'low_priority_quick_assessment',
    label: 'Low Priority',
    icon: Zap,
    description: 'Quick assessment for minimal impact decisions',
    timeframe: '5-minute quick analysis',
  },
  {
    id: 'moderate_priority_thorough_quick',
    label: 'Moderate Priority',
    icon: Shield,
    description: 'Thorough but quick evaluation needed',
    timeframe: '15-minute balanced assessment',
  },
  {
    id: 'high_priority_urgent',
    label: 'High Priority (Urgent)',
    icon: Clock,
    description: 'Important decision needing quick analysis',
    timeframe: '30-minute focused analysis',
  },
  {
    id: 'critical_in_depth_analysis',
    label: 'Critical Priority',
    icon: Scale,
    description: 'Requires comprehensive evaluation',
    timeframe: '45-minute detailed analysis',
  },
]

export default function ImportanceSelector() {
  const navigate = useNavigate()
  const {
    decisionId,
    decisionType,
    decision,
    setImportance
  } = useDecision()
  const [loading, setLoading] = useState(false)

  // Guard: redirect if missing required context
  if (!decisionType || !decision) {
    return <Navigate to="/decision" replace />
  }

  const handleSelect = (id: string) => {
    setLoading(true)
    setImportance(id)
    navigate('/decision/reversibility')
    setLoading(false)
  }

  const handleBack = () => {
    navigate('/decision/details')
  }

  return (
    <div className="space-y-8">
      <button
        onClick={handleBack}
        disabled={loading}
        className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Decision Details
      </button>

      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          How thoroughly should we assess this decision?
        </h2>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Select the appropriate level of analysis based on the decision's importance and urgency.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {importanceTypes.map(({ id, label, icon: Icon, description, timeframe }) => (
          <button
            key={id}
            onClick={() => handleSelect(id)}
            disabled={loading}
            className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 text-left group"
          >
            <div className="flex items-start space-x-4">
              <div className="bg-indigo-50 p-3 rounded-lg group-hover:bg-indigo-100 transition-colors">
                <Icon className="h-6 w-6 text-indigo-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">{label}</h3>
                <p className="text-sm text-gray-500 mb-2">{description}</p>
                <p className="text-xs text-gray-400 italic">{timeframe}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}