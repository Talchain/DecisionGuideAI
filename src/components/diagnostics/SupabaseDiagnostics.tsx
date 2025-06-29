import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, XCircle, RefreshCw, Database, Globe, Settings, Server } from 'lucide-react';
import { runSupabaseDiagnostics } from '../../lib/supabase-diagnostics';

interface DiagnosticsResult {
  environmentVariables: any;
  networkConnectivity: any;
  corsTest: any;
  supabaseQuery: any;
  recommendations: string[];
}

export default function SupabaseDiagnostics() {
  const [results, setResults] = useState<DiagnosticsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Run diagnostics on component mount
  useEffect(() => {
    runDiagnostics();
  }, []);

  const runDiagnostics = async () => {
    setLoading(true);
    setError(null);
    try {
      const diagnostics = await runSupabaseDiagnostics();
      setResults(diagnostics);
    } catch (error) {
      console.error('Diagnostics failed:', error);
      setError(error instanceof Error ? error.message : 'Failed to run diagnostics');
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
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Database className="h-6 w-6 text-indigo-600" />
            <h2 className="text-2xl font-bold text-gray-900">Supabase Connection Diagnostics</h2>
          </div>
          <button
            onClick={runDiagnostics}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Running...' : 'Run Diagnostics'}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-6">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Error running diagnostics</p>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          </div>
        )}

        {loading && !results && (
          <div className="flex flex-col items-center justify-center py-12">
            <RefreshCw className="h-10 w-10 text-indigo-600 animate-spin mb-4" />
            <p className="text-gray-600">Running connection diagnostics...</p>
          </div>
        )}

        {results && (
          <div className="space-y-6">
            {/* Environment Variables */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b flex items-center gap-2">
                <Settings className="h-5 w-5 text-gray-600" />
                <h3 className="text-lg font-semibold text-gray-900">Environment Variables</h3>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center">
                    <span className="font-medium mr-2">Supabase URL:</span>
                    <span className={`${results.environmentVariables.hasUrl ? 'text-green-600' : 'text-red-600'}`}>
                      {results.environmentVariables.hasUrl ? '✓ Set' : '✗ Missing'}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-medium mr-2">Anon Key:</span>
                    <span className={`${results.environmentVariables.hasAnonKey ? 'text-green-600' : 'text-red-600'}`}>
                      {results.environmentVariables.hasAnonKey ? '✓ Set' : '✗ Missing'}
                    </span>
                  </div>
                  <div className="col-span-1 md:col-span-2">
                    <span className="font-medium mr-2">URL:</span>
                    <span className="text-gray-600 font-mono text-xs">
                      {results.environmentVariables.urlValue}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Network Connectivity */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b flex items-center gap-2">
                <Globe className="h-5 w-5 text-gray-600" />
                <h3 className="text-lg font-semibold text-gray-900">Network Connectivity</h3>
              </div>
              <div className="p-4">
                <div className="text-sm space-y-2">
                  {results.networkConnectivity.reachable ? (
                    <div className="flex items-center text-green-600">
                      <CheckCircle className="h-5 w-5 mr-2" />
                      <span>Supabase API is reachable (Status: {results.networkConnectivity.status})</span>
                    </div>
                  ) : (
                    <div className="text-red-600">
                      <div className="flex items-center">
                        <XCircle className="h-5 w-5 mr-2 flex-shrink-0" />
                        <span>Cannot reach Supabase API</span>
                      </div>
                      {results.networkConnectivity.error && (
                        <div className="mt-2 ml-7 text-sm bg-red-50 p-3 rounded-lg">
                          Error: {results.networkConnectivity.error}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {results.networkConnectivity.responseTime && (
                    <div className="flex items-center text-gray-600 mt-2">
                      <span className="font-medium mr-2">Response Time:</span>
                      <span className={results.networkConnectivity.responseTime > 1000 ? 'text-yellow-600' : 'text-green-600'}>
                        {results.networkConnectivity.responseTime}ms
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* CORS Test */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b flex items-center gap-2">
                <Server className="h-5 w-5 text-gray-600" />
                <h3 className="text-lg font-semibold text-gray-900">CORS Configuration</h3>
              </div>
              <div className="p-4">
                <div className="text-sm">
                  {results.corsTest.corsAllowed ? (
                    <div className="flex items-center text-green-600">
                      <CheckCircle className="h-5 w-5 mr-2" />
                      <span>CORS is properly configured</span>
                    </div>
                  ) : (
                    <div className="text-red-600">
                      <div className="flex items-center">
                        <XCircle className="h-5 w-5 mr-2 flex-shrink-0" />
                        <span>CORS issue detected</span>
                      </div>
                      {results.corsTest.error && (
                        <div className="mt-2 ml-7 text-sm">
                          Error: {results.corsTest.error}
                        </div>
                      )}
                      {results.corsTest.details && (
                        <div className="mt-2 ml-7 text-sm bg-red-50 p-3 rounded-lg">
                          {results.corsTest.details}
                        </div>
                      )}
                      <div className="mt-4 ml-7 bg-yellow-50 p-3 rounded-lg">
                        <p className="font-medium text-yellow-800">How to fix CORS issues:</p>
                        <ol className="mt-2 space-y-1 text-yellow-700 list-decimal list-inside">
                          <li>Go to your Supabase Dashboard</li>
                          <li>Navigate to Project Settings → API</li>
                          <li>Under "CORS", add: <code className="bg-white px-1 rounded">{window.location.origin}</code></li>
                          <li>Save changes and refresh this page</li>
                        </ol>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Supabase Query Test */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b flex items-center gap-2">
                <Database className="h-5 w-5 text-gray-600" />
                <h3 className="text-lg font-semibold text-gray-900">Supabase Query Test</h3>
              </div>
              <div className="p-4">
                <div className="text-sm">
                  {results.supabaseQuery.success ? (
                    <div className="flex items-center text-green-600">
                      <CheckCircle className="h-5 w-5 mr-2" />
                      <span>Supabase queries working correctly</span>
                    </div>
                  ) : (
                    <div className="text-red-600">
                      <div className="flex items-center">
                        <XCircle className="h-5 w-5 mr-2 flex-shrink-0" />
                        <span>Supabase query failed</span>
                      </div>
                      {results.supabaseQuery.error && (
                        <div className="mt-2 ml-7 text-sm">
                          Error: {results.supabaseQuery.error}
                        </div>
                      )}
                      {results.supabaseQuery.details && (
                        <div className="mt-2 ml-7 text-sm bg-red-50 p-3 rounded-lg">
                          {results.supabaseQuery.details}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Recommendations */}
            {results.recommendations.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-yellow-50 px-4 py-3 border-b flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  <h3 className="text-lg font-semibold text-yellow-800">Recommendations</h3>
                </div>
                <div className="p-4 bg-yellow-50">
                  <ul className="text-sm space-y-2">
                    {results.recommendations.map((rec, index) => (
                      <li key={index} className="flex items-start gap-2 text-yellow-800">
                        <span className="font-bold">{index + 1}.</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Quick Fix Guide */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-blue-50 px-4 py-3 border-b flex items-center gap-2">
                <Settings className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-blue-800">Quick Fix Guide</h3>
              </div>
              <div className="p-4 bg-blue-50">
                <div className="text-sm text-blue-800 space-y-4">
                  <div>
                    <strong className="block mb-2">1. Check CORS Settings:</strong>
                    <ul className="ml-4 space-y-1">
                      <li>• Go to Supabase Dashboard → Project Settings → API</li>
                      <li>• Under "CORS", add: <code className="bg-white px-1 rounded">{window.location.origin}</code></li>
                      <li>• For development, you can temporarily use: <code className="bg-white px-1 rounded">*</code></li>
                      <li>• Save changes and restart your development server</li>
                    </ul>
                  </div>
                  <div>
                    <strong className="block mb-2">2. Verify Environment Variables:</strong>
                    <ul className="ml-4 space-y-1">
                      <li>• Check your <code className="bg-white px-1 rounded">.env</code> file</li>
                      <li>• Ensure <code className="bg-white px-1 rounded">VITE_SUPABASE_URL</code> and <code className="bg-white px-1 rounded">VITE_SUPABASE_ANON_KEY</code> are set</li>
                      <li>• Restart your development server after changes</li>
                    </ul>
                  </div>
                  <div>
                    <strong className="block mb-2">3. Network Issues:</strong>
                    <ul className="ml-4 space-y-1">
                      <li>• Check your internet connection</li>
                      <li>• Disable VPN temporarily</li>
                      <li>• Check firewall settings</li>
                      <li>• Visit <a href="https://status.supabase.com/" target="_blank" rel="noopener noreferrer" className="underline">status.supabase.com</a> for service status</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {!results && !loading && !error && (
          <div className="text-center py-8 text-gray-500">
            <div className="mb-4">
              <p className="text-lg font-medium text-gray-700 mb-2">Supabase Connection Issues?</p>
              <p>Click "Run Diagnostics" to identify and resolve connection problems</p>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-left max-w-md mx-auto">
              <p className="text-sm text-yellow-800">
                <strong>Common Issue:</strong> If you're seeing "Failed to fetch" errors, 
                this is usually a CORS configuration problem that can be easily fixed.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}