import React from 'react';
import { Brain, GitBranch as CodeBranch, Sparkles, UserCog, ArrowRight, Target } from 'lucide-react';

export default function About() {
  return (
    <div className="max-w-4xl mx-auto space-y-16">
      {/* Hero Section */}
      <div className="text-center space-y-6">
        <div className="inline-flex items-center justify-center p-3 rounded-2xl mb-6 animate-fade-in">
          <Brain className="h-14 w-14 text-indigo-600" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">      Better decisions faster.
          </span>
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
 Olumi empowers individuals and teams with science-backed methods and AI-powered insights for smarter decision-making.
        </p>
      </div>

      {/* Features Grid */}
      <div className="grid md:grid-cols-2 gap-8">
        <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-8 border border-gray-100">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-indigo-50 rounded-lg">
              <Target className="h-6 w-6 text-indigo-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900">The Challenge</h3>
          </div>
          <p className="text-gray-600 leading-relaxed">
            Making good decisions is hard — whether personal or professional. We face cognitive biases, 
            emotional influences, and a lack of intuitive techniques, leading to stress, regret, and 
            missed opportunities.
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-8 border border-gray-100">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-green-50 rounded-lg">
              <Sparkles className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900">Our Solution</h3>
          </div>
          <p className="text-gray-600 leading-relaxed">
            DecisionGuide.AI combines advanced artificial intelligence with proven principles from 
            behavioral science, cognitive psychology, and neuroscience to guide better decision-making.
          </p>
        </div>
      </div>

      {/* Key Benefits */}
      <div className="py-16">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-8 text-center">
          How We Help
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 transform hover:-translate-y-1 group">
            <div className="p-3 bg-indigo-50 rounded-lg w-12 h-12 flex items-center justify-center mb-4">
              <CodeBranch className="h-6 w-6 text-indigo-600 transition-transform duration-300 ease-in-out group-hover:scale-110 group-hover:rotate-45" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Science-backed</h3>
            <p className="text-gray-600">
              Proven frameworks to analyse options, risks/rewards, and potential outcomes.
            </p>
          </div>

          <div className="p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 transform hover:-translate-y-1 group">
            <div className="p-3 bg-green-50 rounded-lg w-12 h-12 flex items-center justify-center mb-4">
              <Brain className="h-6 w-6 text-green-600 transition-transform duration-300 ease-in-out group-hover:scale-110 group-hover:animate-pulse" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Bias mitigation</h3>
            <p className="text-gray-600">
              Cognitive bias awareness and emotional regulation through real-time analysis and recommendations.
            </p>
          </div>

          <div className="p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 transform hover:-translate-y-1 group">
            <div className="p-3 bg-purple-50 rounded-lg w-12 h-12 flex items-center justify-center mb-4">
              <Sparkles className="h-6 w-6 text-purple-600 transition-transform duration-300 ease-in-out group-hover:animate-[sparkle_0.5s_ease-in-out]" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">AI-powered</h3>
            <p className="text-gray-600">
              Powerful insights, overlooked influences, alternative perspectives, and optimal choices.
            </p>
          </div>

          <div className="p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 transform hover:-translate-y-1 group">
            <div className="p-3 bg-blue-50 rounded-lg w-12 h-12 flex items-center justify-center mb-4">
              <UserCog className="h-6 w-6 text-blue-600 transition-transform duration-300 ease-in-out group-hover:animate-[usercog_0.5s_ease-in-out]" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Personalised guidance</h3>
            <p className="text-gray-600">
              More effective outcomes, improved goal alignment, and deeper learning.
            </p>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="text-center">
        <a 
          href="/" 
          className="inline-flex items-center gap-2 px-6 py-3 text-lg font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Start Making Better Decisions
          <ArrowRight className="h-5 w-5" />
        </a>
      </div>
    </div>
  );
}