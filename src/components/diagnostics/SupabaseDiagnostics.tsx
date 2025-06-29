import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { runSupabaseDiagnostics } from '../../lib/supabase-diagnostics';

interface DiagnosticsResult {
  environmentVariables: any;
  networkConnectivity: any;
  corsTest: any;
  recommendations: string[];
}

export function SupabaseDiagnostics() {
  const [results, setResults] = useState<DiagnosticsResult | null>(null);
  const [loading, setLoading] = useState(false);

  const runDiagnostics = async () => {
    setLoading(true);
    try {
      const diagnostics = await runSupabaseDiagnostics();
      setResults(diagnostics);
    } catch (error) {
      console.error('Diagnostics failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: boolean | undefined) => {
    if (status === true) return <CheckCircle className="w-5 h-5 text-green-500" />;
    if (status === false) return <XCircle className="w-5 h-5 text-red-500" />;
    return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Supabase Connection Diagnostics</h2>
        <button
          onClick={runDiagnostics}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Running...' : 'Run Diagnostics'}
        </button>
      </div>

      {results && (
        <div className="space-y-6">
          {/* Environment Variables */}
          <div className="border rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              {getStatusIcon(results.environmentVariables.hasUrl && results.environmentVariables.hasAnonKey)}
              Environment Variables
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Supabase URL:</span>
                <span className={`ml-2 ${results.environmentVariables.hasUrl ? 'text-green-600' : 'text-red-600'}`}>
                  {results.environmentVariables.hasUrl ? '✓ Set' : '✗ Missing'}
                </span>
              </div>
              <div>
                <span className="font-medium">Anon Key:</span>
                <span className={`ml-2 ${results.environmentVariables.hasAnonKey ? 'text-green-600' : 'text-red-600'}`}>
                  {results.environmentVariables.hasAnonKey ? '✓ Set' : '✗ Missing'}
                </span>
              </div>
              <div className="col-span-2">
                <span className="font-medium">URL:</span>
                <span className="ml-2 text-gray-600 font-mono text-xs">
                  {results.environmentVariables.urlValue}
                </span>
              </div>
            </div>
          </div>

          {/* Network Connectivity */}
          <div className="border rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              {getStatusIcon(results.networkConnectivity.reachable)}
              Network Connectivity
            </h3>
            <div className="text-sm space-y-2">
              {results.networkConnectivity.reachable ? (
                <div className="text-green-600">
                  ✓ Supabase API is reachable (Status: {results.networkConnectivity.status})
                </div>
              ) : (
                <div className="text-red-600">
                  ✗ Cannot reach Supabase API
                  {results.networkConnectivity.error && (
                    <div className="mt-1 text-xs text-gray-600">
                      Error: {results.networkConnectivity.error}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* CORS Test */}
          <div className="border rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              {getStatusIcon(results.corsTest.corsAllowed)}
              CORS Configuration
            </h3>
            <div className="text-sm">
              {results.corsTest.corsAllowed ? (
                <div className="text-green-600">✓ CORS is properly configured</div>
              ) : (
                <div className="text-red-600">
                  ✗ CORS issue detected
                  {results.corsTest.error && (
                    <div className="mt-1 text-xs text-gray-600">
                      Error: {results.corsTest.error}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Recommendations */}
          {results.recommendations.length > 0 && (
            <div className="border rounded-lg p-4 bg-yellow-50">
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
                Recommendations
              </h3>
              <ul className="text-sm space-y-1">
                {results.recommendations.map((rec, index) => (
                  <li key={index} className="text-gray-700">
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Quick Fix Guide */}
          <div className="border rounded-lg p-4 bg-blue-50">
            <h3 className="text-lg font-semibold mb-3 text-blue-900">Quick Fix Guide</h3>
            <div className="text-sm text-blue-800 space-y-2">
              <div>
                <strong>1. Check CORS Settings:</strong>
                <ul className="ml-4 mt-1 space-y-1">
                  <li>• Go to Supabase Dashboard → Project Settings → API</li>
                  <li>• Under "CORS", add: <code className="bg-white px-1 rounded">http://localhost:5173</code></li>
                  <li>• For development, you can temporarily use: <code className="bg-white px-1 rounded">*</code></li>
                </ul>
              </div>
              <div>
                <strong>2. Verify Environment Variables:</strong>
                <ul className="ml-4 mt-1 space-y-1">
                  <li>• Check your <code className="bg-white px-1 rounded">.env</code> file</li>
                  <li>• Ensure <code className="bg-white px-1 rounded">VITE_SUPABASE_URL</code> and <code className="bg-white px-1 rounded">VITE_SUPABASE_ANON_KEY</code> are set</li>
                  <li>• Restart your development server after changes</li>
                </ul>
              </div>
              <div>
                <strong>3. Network Issues:</strong>
                <ul className="ml-4 mt-1 space-y-1">
                  <li>• Check your internet connection</li>
                  <li>• Disable VPN temporarily</li>
                  <li>• Check firewall settings</li>
                  <li>• Visit <a href="https://status.supabase.com/" target="_blank" rel="noopener noreferrer" className="underline">status.supabase.com</a> for service status</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {!results && !loading && (
        <div className="text-center py-8 text-gray-500">
          Click "Run Diagnostics" to check your Supabase connection
        </div>
      )}
    </div>
  );
}