import React, { useState } from 'react';
import {
  Plus,
  Image,
  FileText,
  Eye,
  Wrench,
  Mic,
  MessageSquare,
  Info
} from 'lucide-react';

export default function ChatBox() {
  const [showTooltip, setShowTooltip] = useState(false);

  const handleClick = () => {
    setShowTooltip(true);
    setTimeout(() => setShowTooltip(false), 2000);
  };

  return (
    <div className="relative w-full max-w-2xl mx-auto" onClick={handleClick}>
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-700 text-white text-sm rounded-lg whitespace-nowrap">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4" />
            Coming soon!
          </div>
        </div>
      )}
      
      <div className="border border-gray-200 rounded-xl bg-white shadow-sm">
        <div className="flex items-end p-4">
          <div className="flex items-center gap-2 text-gray-500">
            <button className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
              <Plus className="h-5 w-5" />
            </button>
            <button className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
              <Image className="h-5 w-5" />
            </button>
            <button className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
              <FileText className="h-5 w-5" />
            </button>
            <button className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
              <Eye className="h-5 w-5" />
            </button>
            <button className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
              <Wrench className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 mx-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Message DecisionGuide.AI..."
                className="w-full px-4 py-3 bg-gray-100 hover:bg-gray-200 focus:bg-white border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                readOnly
              />
              <MessageSquare className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            </div>
          </div>

          <button className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
            <Mic className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}