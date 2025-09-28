import React from 'react';
import { Layers, BarChart3 } from 'lucide-react';

interface CanvasNode {
  id: string;
  type: string;
  title: string;
  score: number;
  pros: string[];
  cons: string[];
}

interface CanvasPaneProps {
  nodes: CanvasNode[];
  templateName: string;
  seed: number;
  isSimplified?: boolean;
}

export default function CanvasPane({ nodes, templateName, seed, isSimplified = false }: CanvasPaneProps) {
  const getScoreColor = (score: number) => {
    if (score >= 8.5) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 7.5) return 'text-blue-600 bg-blue-50 border-blue-200';
    if (score >= 6.5) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getScoreIcon = (score: number) => {
    if (score >= 8.0) return '🌟';
    if (score >= 7.0) return '✅';
    if (score >= 6.0) return '⚠️';
    return '❌';
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 h-full flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Layers className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-medium text-gray-900">Canvas</h2>
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
              <Layers className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">No template selected</p>
              <p className="text-sm">Choose a starter template to begin</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Canvas visualization area */}
            <div className="relative bg-gray-50 rounded-lg p-6 min-h-96">
              <div className="grid gap-4">
                {nodes.map((node, index) => (
                  <div
                    key={node.id}
                    className="relative bg-white rounded-lg border-2 border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow"
                    style={{
                      transform: `translate(${(index % 2) * 250}px, ${Math.floor(index / 2) * 150}px)`,
                      position: index === 0 ? 'relative' : 'absolute',
                      width: '240px',
                      zIndex: nodes.length - index,
                    }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-sm font-medium text-gray-900 pr-2 leading-tight">
                        {node.title}
                      </h3>
                      <div className={`flex items-center space-x-1 px-2 py-1 rounded-full border text-xs font-medium ${getScoreColor(node.score)}`}>
                        <span>{getScoreIcon(node.score)}</span>
                        <span>{node.score}</span>
                      </div>
                    </div>

                    {!isSimplified && (
                      <div className="space-y-2 text-xs">
                        {node.pros.length > 0 && (
                          <div>
                            <div className="font-medium text-green-700 mb-1">Pros:</div>
                            <ul className="space-y-0.5 text-green-600">
                              {node.pros.slice(0, 2).map((pro, i) => (
                                <li key={i} className="flex items-start">
                                  <span className="mr-1">+</span>
                                  <span>{pro}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {node.cons.length > 0 && (
                          <div>
                            <div className="font-medium text-red-700 mb-1">Cons:</div>
                            <ul className="space-y-0.5 text-red-600">
                              {node.cons.slice(0, 2).map((con, i) => (
                                <li key={i} className="flex items-start">
                                  <span className="mr-1">-</span>
                                  <span>{con}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Connection lines between nodes */}
              {nodes.length > 1 && (
                <svg className="absolute inset-0 pointer-events-none" style={{ zIndex: 1 }}>
                  {nodes.slice(1).map((_, index) => {
                    const startX = 120; // Center of first node
                    const startY = 75;
                    const endX = ((index + 1) % 2) * 250 + 120; // Center of target node
                    const endY = Math.floor((index + 1) / 2) * 150 + 75;

                    return (
                      <line
                        key={index}
                        x1={startX}
                        y1={startY}
                        x2={endX}
                        y2={endY}
                        stroke="#e5e7eb"
                        strokeWidth="2"
                        strokeDasharray="5,5"
                      />
                    );
                  })}
                </svg>
              )}
            </div>

            {/* Node count summary */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <BarChart3 className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-700">
                  {nodes.length} option{nodes.length !== 1 ? 's' : ''} in analysis
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