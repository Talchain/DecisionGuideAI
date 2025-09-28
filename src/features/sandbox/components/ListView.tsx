import React, { useRef, useEffect } from 'react';
import { List, BarChart3 } from 'lucide-react';

interface CanvasNode {
  id: string;
  type: string;
  title: string;
  score: number;
  pros: string[];
  cons: string[];
}

interface ListViewProps {
  nodes: CanvasNode[];
  templateName: string;
  seed: number;
  isVisible: boolean;
  onFocus?: () => void;
}

export default function ListView({ nodes, templateName, seed, isVisible, onFocus }: ListViewProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Focus management: focus heading when List View opens
  useEffect(() => {
    if (isVisible && headingRef.current) {
      headingRef.current.focus();
      onFocus?.();
    }
  }, [isVisible, onFocus]);

  const getScoreColor = (score: number) => {
    if (score >= 8.5) return 'text-green-700 bg-green-50';
    if (score >= 7.5) return 'text-blue-700 bg-blue-50';
    if (score >= 6.5) return 'text-yellow-700 bg-yellow-50';
    return 'text-red-700 bg-red-50';
  };

  const getScoreIcon = (score: number) => {
    if (score >= 8.0) return '🌟';
    if (score >= 7.0) return '✅';
    if (score >= 6.0) return '⚠️';
    return '❌';
  };

  if (!isVisible) return null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 h-full flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <List className="h-5 w-5 text-gray-500" />
            <h2
              ref={headingRef}
              className="text-lg font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
              tabIndex={-1}
            >
              List View
            </h2>
          </div>
          <div className="text-sm text-gray-500">
            {templateName} • Seed {seed}
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 overflow-y-auto">
        {nodes.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-gray-500">
            <div className="text-center">
              <List className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">No options to display</p>
              <p className="text-sm">Select a template to see options</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Stable keyboard order - sorted by ID for consistency */}
            {nodes
              .slice()
              .sort((a, b) => a.id.localeCompare(b.id))
              .map((node, index) => (
                <div
                  key={node.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 hover:shadow-sm transition-all focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500"
                  tabIndex={0}
                  role="listitem"
                  aria-label={`Option ${index + 1}: ${node.title}, Score ${node.score}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-base font-medium text-gray-900 flex-1 pr-4">
                      {node.title}
                    </h3>
                    <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-sm font-medium ${getScoreColor(node.score)}`}>
                      <span>{getScoreIcon(node.score)}</span>
                      <span>{node.score}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Pros */}
                    {node.pros.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-green-700 mb-2">Advantages</h4>
                        <ul className="space-y-1">
                          {node.pros.map((pro, i) => (
                            <li key={i} className="text-sm text-green-600 flex items-start">
                              <span className="mr-2 mt-1 text-green-500">+</span>
                              <span>{pro}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Cons */}
                    {node.cons.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-red-700 mb-2">Disadvantages</h4>
                        <ul className="space-y-1">
                          {node.cons.map((con, i) => (
                            <li key={i} className="text-sm text-red-600 flex items-start">
                              <span className="mr-2 mt-1 text-red-500">-</span>
                              <span>{con}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ))}

            {/* Summary footer */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg mt-6">
              <div className="flex items-center space-x-2">
                <BarChart3 className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-700">
                  {nodes.length} option{nodes.length !== 1 ? 's' : ''} listed
                </span>
              </div>
              <div className="text-sm text-gray-500">
                Avg score: {nodes.length > 0 ? (nodes.reduce((sum, node) => sum + node.score, 0) / nodes.length).toFixed(1) : '0.0'}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}