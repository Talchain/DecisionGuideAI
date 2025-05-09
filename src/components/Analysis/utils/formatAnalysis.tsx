import React from 'react';
import {
  BarChart,
  CheckCircle,
  AlertTriangle,
  Info,
  List,
  Table as TableIcon
} from 'lucide-react';

interface ContentSection {
  type: 'text' | 'list' | 'table' | 'chart' | 'warning' | 'info' | 'success';
  content: any;
}

export function formatAnalysis(content: string | null): React.ReactNode {
  if (!content) return null;

  // Add debug logging
  console.log('Formatting analysis content:', {
    type: typeof content,
    length: content?.length,
    isJson: isJsonString(content),
    timestamp: new Date().toISOString()
  });

  try {
    // Try to parse if content is JSON
    const sections: ContentSection[] = JSON.parse(content);
    return renderStructuredContent(sections);
  } catch (error) {
    // Log parsing error and fallback to regular text formatting
    console.warn('Error parsing content as JSON:', error);
    return formatTextContent(content);
  }
}

function isJsonString(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
}

function safeToString(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }
  
  if (typeof value === 'string') {
    return value;
  }
  
  if (value instanceof Date) {
    return value.toISOString();
  }
  
  if (typeof value === 'object' || Array.isArray(value)) {
    try {
      return JSON.stringify(value, null, 2); // Pretty print JSON
    } catch (e) {
      console.warn('Failed to stringify object:', e);
      return '[Object]';
    }
  }
  
  // For other primitive types (number, boolean)
  return String(value);
}

function renderStructuredContent(sections: ContentSection[]): React.ReactNode {
  if (!Array.isArray(sections)) {
    console.warn('Invalid sections format:', sections);
    return null;
  }

  // Add debug logging for sections
  console.log('Rendering sections:', {
    count: sections.length,
    types: sections.map(s => s.type),
    timestamp: new Date().toISOString()
  });

  return (
    <div className="space-y-4">
      {sections.map((section, index) => {
        if (!section || typeof section !== 'object') {
          console.warn('Invalid section:', section);
          return null;
        }

        try {
          switch (section.type) {
            case 'text':
              return (
                <p key={index} className="text-gray-800">
                  {safeToString(section.content)}
                </p>
              );
            
            case 'list':
              if (!Array.isArray(section.content)) {
                console.warn('Invalid list content:', section.content);
                console.warn('Section causing issue:', section);
                return null;
              }
              return (
                <div key={index} className="flex items-start gap-2">
                  <List className="h-5 w-5 text-gray-400 mt-1" />
                  <ul className="list-disc list-inside space-y-2">
                    {section.content.map((item: any, i: number) => (
                      <li key={i} className="text-gray-800">
                        {safeToString(item)}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            
            case 'table':
              if (!section.content?.headers || !section.content?.rows) {
                console.warn('Invalid table content:', section.content);
                console.warn('Section causing issue:', section);
                return null;
              }
              return (
                <div key={index} className="rounded-lg border border-gray-200 overflow-hidden">
                  <div className="flex items-center gap-2 p-2 bg-gray-50 border-b border-gray-200">
                    <TableIcon className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-700">
                      {section.content.title || 'Table'}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          {section.content.headers.map((header: any, i: number) => (
                            <th
                              key={i}
                              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                            >
                              {safeToString(header)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {section.content.rows.map((row: any[], i: number) => (
                          <tr key={i}>
                            {row.map((cell: any, j: number) => (
                              <td
                                key={j}
                                className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                              >
                                {safeToString(cell)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            
            case 'warning':
              return (
                <div key={index} className="flex items-start gap-2 p-4 bg-yellow-50 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-yellow-400" />
                  <div className="flex-1">
                    <h4 className="font-medium text-yellow-800">Warning</h4>
                    <p className="text-yellow-700">
                      {safeToString(section.content)}
                    </p>
                  </div>
                </div>
              );
            
            case 'info':
              return (
                <div key={index} className="flex items-start gap-2 p-4 bg-blue-50 rounded-lg">
                  <Info className="h-5 w-5 text-blue-400" />
                  <div className="flex-1">
                    <h4 className="font-medium text-blue-800">Information</h4>
                    <p className="text-blue-700">
                      {safeToString(section.content)}
                    </p>
                  </div>
                </div>
              );
            
            case 'success':
              return (
                <div key={index} className="flex items-start gap-2 p-4 bg-green-50 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-400" />
                  <div className="flex-1">
                    <h4 className="font-medium text-green-800">Success</h4>
                    <p className="text-green-700">
                      {safeToString(section.content)}
                    </p>
                  </div>
                </div>
              );
            
            default:
              console.warn('Unknown section type:', section.type);
              return null;
          }
        } catch (error) {
          console.error('Error rendering section:', error, section);
          return null;
        }
      })}
    </div>
  );
}

function formatTextContent(content: string): React.ReactNode {
  if (typeof content !== 'string') {
    console.warn('Invalid content type:', typeof content);
    return null;
  }

  // Add debug logging for text content
  console.log('Formatting text content:', {
    length: content.length,
    lines: content.split('\n').length,
    timestamp: new Date().toISOString()
  });

  return content.split('\n').map((line, index) => {
    if (!line.trim()) return null;

    if (line.trim().startsWith('•')) {
      return (
        <li key={index} className="ml-6 list-disc">
          {line.replace('•', '').trim()}
        </li>
      );
    }

    if (line.match(/^\d+\./)) {
      return (
        <h3 key={index} className="font-semibold mt-4 mb-2">
          {line}
        </h3>
      );
    }

    return (
      <p key={index} className="mb-2">
        {line}
      </p>
    );
  });
}