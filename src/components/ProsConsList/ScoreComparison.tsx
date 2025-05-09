import React, { useState, useMemo } from 'react';
import { 
  BarChart2, X, ThumbsUp, ThumbsDown, HelpCircle, Star, 
  ChevronUp, ChevronDown, ArrowUpDown, Trophy
} from 'lucide-react';
import { OptionScore } from './types';
import Tooltip from '../Tooltip';

interface ScoreComparisonProps {
  scores: OptionScore[];
  onClose: () => void;
}

type SortKey = 'name' | 'totalScore' | 'prosScore' | 'consScore';
type SortDirection = 'asc' | 'desc';

export default function ScoreComparison({ scores, onClose }: ScoreComparisonProps) {
  const [sortKey, setSortKey] = useState<SortKey>('totalScore');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const sortedScores = useMemo(() => {
    return [...scores].sort((a, b) => {
      const modifier = sortDirection === 'asc' ? 1 : -1;
      if (sortKey === 'name') {
        return modifier * a.name.localeCompare(b.name);
      }
      return modifier * (a[sortKey] - b[sortKey]);
    });
  }, [scores, sortKey, sortDirection]);

  const maxScore = Math.max(...scores.map(s => Math.abs(s.totalScore)));
  const maxIndividualScore = Math.max(
    ...scores.flatMap(s => [Math.abs(s.prosScore), Math.abs(s.consScore)])
  );

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ active }: { active: boolean }) => {
    if (!active) return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
    return sortDirection === 'asc' ? 
      <ChevronUp className="h-4 w-4 text-indigo-500" /> : 
      <ChevronDown className="h-4 w-4 text-indigo-500" />;
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto animate-fadeIn"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div 
        className="bg-white rounded-2xl shadow-xl w-full max-w-5xl my-8 animate-slideUp overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-white sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-lg">
              <BarChart2 className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Decision Analysis</h2>
              <p className="text-sm text-gray-500">Compare and evaluate your options</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* Decision Summary */}
          <section>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedScores.map((score, index) => (
                <div 
                  key={score.name}
                  className={`p-4 rounded-lg border ${
                    index === 0 ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-gray-900">{score.name}</h4>
                    {index === 0 && (
                      <Tooltip content="Highest scoring option">
                        <div className="p-1 bg-indigo-100 rounded-full">
                          <Trophy className="h-4 w-4 text-indigo-600" />
                        </div>
                      </Tooltip>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Total Score</span>
                      <span className={`font-medium ${
                        score.totalScore > 0 ? 'text-green-600' : 
                        score.totalScore < 0 ? 'text-red-600' : 
                        'text-gray-600'
                      }`}>
                        {score.totalScore}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ease-out ${
                          score.totalScore > 0 ? 'bg-green-500' : 'bg-red-500'
                        }`}
                        style={{
                          width: `${(Math.abs(score.totalScore) / maxScore) * 100}%`
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Comparison Table */}
          <section>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Detailed Comparison</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center gap-2">
                        Option
                        <SortIcon active={sortKey === 'name'} />
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('totalScore')}
                    >
                      <div className="flex items-center gap-2">
                        Total Score
                        <SortIcon active={sortKey === 'totalScore'} />
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('prosScore')}
                    >
                      <div className="flex items-center gap-2">
                        Pros Score
                        <SortIcon active={sortKey === 'prosScore'} />
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('consScore')}
                    >
                      <div className="flex items-center gap-2">
                        Cons Score
                        <SortIcon active={sortKey === 'consScore'} />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedScores.map((score, index) => (
                    <tr 
                      key={score.name}
                      className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {score.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className={`font-medium ${
                          score.totalScore > 0 ? 'text-green-600' : 
                          score.totalScore < 0 ? 'text-red-600' : 
                          'text-gray-600'
                        }`}>
                          {score.totalScore}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-500 transition-all duration-500"
                              style={{
                                width: `${(score.prosScore / maxIndividualScore) * 100}%`
                              }}
                            />
                          </div>
                          <span className="text-sm font-medium text-green-600">
                            {score.prosScore}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-red-500 transition-all duration-500"
                              style={{
                                width: `${(score.consScore / maxIndividualScore) * 100}%`
                              }}
                            />
                          </div>
                          <span className="text-sm font-medium text-red-600">
                            {score.consScore}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Legend */}
          <section className="border-t border-gray-200 pt-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-900 mb-3">How to Read This Analysis</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span>Positive impact (pros)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span>Negative impact (cons)</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-gray-400" />
                    <span>Each item rated 0-5 stars</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <BarChart2 className="h-4 w-4 text-gray-400" />
                    <span>Longer bars = stronger impact</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}