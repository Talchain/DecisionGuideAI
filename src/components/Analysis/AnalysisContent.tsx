import React, { useEffect } from 'react';
import { formatAnalysis } from './utils/formatAnalysis';

interface AnalysisContentProps {
  text: string | null | object;
}

export default function AnalysisContent({ text }: AnalysisContentProps) {
  // Add debug logging
  useEffect(() => {
    console.log('AnalysisContent props:', {
      hasText: !!text,
      textType: typeof text,
      textLength: typeof text === 'string' ? text?.length : 'N/A',
      textPreview: typeof text === 'string' ? text ? text.substring(0, 100) + '...' : null : 'Non-string data',
      timestamp: new Date().toISOString()
    });
  }, [text]);

  if (!text) {
    console.log('AnalysisContent: No text provided');
    return null;
  }

  try {
    // Convert non-string text to string before formatting
    const textContent = typeof text === 'string' 
      ? text 
      : JSON.stringify(text, null, 2);
    
    const formattedContent = formatAnalysis(textContent);

    // Log formatted content result
    console.log('AnalysisContent: Formatting complete', {
      hasContent: !!formattedContent,
      timestamp: new Date().toISOString()
    });

    return (
      <div className="prose max-w-none">
        <div className="space-y-4">
          {formattedContent || <p className="text-gray-500">No analysis content available.</p>}
        </div>
      </div>
    );
  } catch (error) {
    console.error('Error in AnalysisContent:', error);
    return (
      <div className="bg-red-50 p-4 rounded-lg">
        <p className="text-red-600">Failed to render analysis content. Please try again.</p>
        <p className="text-xs text-red-400 mt-2">{error instanceof Error ? error.message : 'Unknown error'}</p>
      </div>
    );
  }
}