import React, { useState, useRef } from 'react';
import { Plus, FileText, EyeOff, Wrench, Mic, MessageSquare, Info, AudioWaveform as Waveform, Globe, Sparkles } from 'lucide-react';

export default function ChatBox() {
  const [showTooltip, setShowTooltip] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    setShowTooltip(true);
    setTimeout(() => setShowTooltip(false), 2000);
  };

  const handleFocus = () => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div className="relative w-full max-w-4xl mx-auto" onClick={handleClick}>
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-800 text-white text-sm rounded-lg whitespace-nowrap shadow-lg">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4" />
            Coming soon!
          </div>
        </div>
      )}
      
      <div className="border border-gray-200 rounded-2xl bg-white shadow-lg backdrop-blur-sm bg-opacity-90">
        <div className="flex items-end p-3">
          <div className="flex items-center gap-1.5 text-gray-500">
            <div className="flex -space-x-1 items-center mr-2">
              <button className="p-2 hover:bg-gray-100 rounded-full transition-all duration-200 relative z-30">
                <Globe className="h-4 w-4" />
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-full transition-all duration-200 relative z-20">
                <Sparkles className="h-4 w-4" />
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-full transition-all duration-200 relative z-10">
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <div className="h-6 w-px bg-gray-200 mx-2" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="relative" onClick={handleFocus}>
              <input
                type="text"
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask DecisionGuide.AI anything"
                className="w-full px-4 py-2.5 bg-gray-50 hover:bg-gray-100 focus:bg-white border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-200"
              />
              <MessageSquare className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            </div>
          </div>

          <div className="flex items-center gap-1.5 ml-2">
            <div className="h-6 w-px bg-gray-200 mx-2" />
            <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-all duration-200">
              <Mic className="h-4 w-4" />
            </button>
            <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-all duration-200">
              <Waveform className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}