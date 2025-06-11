import React from 'react';
import { X, Sparkles, Zap, Brain, Target } from 'lucide-react';

interface AIGenerationModalProps {
  onClose: () => void;
}

export default function AIGenerationModal({ onClose }: AIGenerationModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            <h2 className="text-xl font-semibold text-gray-900">AI Template Generation</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-full"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Sparkles className="h-10 w-10 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Coming Soon: AI-Powered Template Generation
            </h3>
            <p className="text-gray-600">
              We're building an intelligent system that will generate custom criteria templates 
              based on your decision type and requirements.
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">What to expect:</h4>
            
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Brain className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <h5 className="font-medium text-gray-900">Smart Suggestions</h5>
                  <p className="text-sm text-gray-600">
                    AI will suggest relevant criteria based on decision science best practices
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Target className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <h5 className="font-medium text-gray-900">Contextual Weights</h5>
                  <p className="text-sm text-gray-600">
                    Automatically assign appropriate weights based on your decision context
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Zap className="h-4 w-4 text-purple-600" />
                </div>
                <div>
                  <h5 className="font-medium text-gray-900">Instant Creation</h5>
                  <p className="text-sm text-gray-600">
                    Generate complete templates in seconds with natural language descriptions
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-4">
            <p className="text-sm text-gray-700">
              <strong>Want early access?</strong> We'll notify you as soon as AI template 
              generation becomes available. This feature will help you create better templates 
              faster than ever before.
            </p>
          </div>
        </div>

        <div className="flex justify-end p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}