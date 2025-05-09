import React from 'react';
import { Brain, AlertTriangle, Lightbulb } from 'lucide-react';
import Tooltip from '../Tooltip';

interface BiasCardProps {
  name: string;
  definition: string;
  mitigationTip: string;
}

export default function BiasCard({ name, definition, mitigationTip }: BiasCardProps) {
  return (
    <div className="flex-shrink-0 w-96 h-[400px] bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6 flex flex-col h-full">
        {/* Header */}
        <div className="flex items-start gap-3 mb-6">
          <div className="flex-shrink-0">
            <div className="p-2 bg-indigo-50 rounded-lg">
              <Brain className="h-5 w-5 text-indigo-600" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <Tooltip content="This cognitive bias may affect your decision">
              <h3 className="text-lg font-medium text-gray-900">{name}</h3>
            </Tooltip>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col justify-between space-y-6">
          <div className="space-y-6">
            {/* Definition */}
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-amber-500 mt-1 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Definition</h4>
                <p className="text-sm text-gray-600">{definition}</p>
              </div>
            </div>

            {/* Mitigation Tip */}
            <div className="flex items-start gap-3">
              <Lightbulb className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="text-sm font-medium text-gray-700 mb-2">How to Mitigate</h4>
                <p className="text-sm text-gray-700">{mitigationTip}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}