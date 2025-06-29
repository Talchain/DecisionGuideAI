import { supabase } from './supabase';

interface DiagnosticsResult {
  environmentVariables: {
    hasUrl: boolean;
    hasAnonKey: boolean;
    urlValue: string;
    keyPrefix: string;
  };
  networkConnectivity: {
    reachable: boolean;
    status?: number;
    error?: string;
    responseTime?: number;
  };
  corsTest: {
    corsAllowed: boolean;
    error?: string;
    details?: string;
  };
  supabaseQuery: {
    success: boolean;
    error?: string;
    details?: string;
  };
  recommendations: string[];
}

export async function runSupabaseDiagnostics(): Promise<DiagnosticsResult> {
  const result: DiagnosticsResult = {
    environmentVariables: {
      hasUrl: false,
      hasAnonKey: false,
      urlValue: '',
      keyPrefix: ''
    },
    networkConnectivity: {
      reachable: false
    },
    corsTest: {
      corsAllowed: false
    },
    supabaseQuery: {
      success: false
    },
    recommendations: []
  };

  // Check environment variables
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  result.environmentVariables = {
    hasUrl: !!supabaseUrl,
    hasAnonKey: !!supabaseAnonKey,
    urlValue: supabaseUrl || 'Not set',
    keyPrefix: supabaseAnonKey ? supabaseAnonKey.slice(0, 8) + '...' : 'Not set'
  };

  if (!supabaseUrl || !supabaseAnonKey) {
    result.recommendations.push('Set up environment variables: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
    return result;
  }

  // Test basic network connectivity
  try {
    const startTime = Date.now();
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'HEAD',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`
      }
    });
    
    const responseTime = Date.now() - startTime;
    result.networkConnectivity = {
      reachable: response.ok,
      status: response.status,
      responseTime
    };

    if (!response.ok) {
      result.networkConnectivity.error = `HTTP ${response.status}: ${response.statusText}`;
    }
  } catch (error: any) {
    result.networkConnectivity = {
      reachable: false,
      error: error.message || 'Network request failed'
    };
    
    if (error.message?.includes('Failed to fetch')) {
      result.corsTest.corsAllowed = false;
      result.corsTest.error = 'CORS policy blocking request';
      result.corsTest.details = 'The browser is blocking the request due to CORS policy. This usually means the Supabase project needs to allow your development origin.';
    }
  }

  // Test CORS specifically
  if (result.networkConnectivity.reachable) {
    try {
      const corsResponse = await fetch(`${supabaseUrl}/rest/v1/`, {
        method: 'OPTIONS',
        headers: {
          'Origin': window.location.origin,
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'apikey,authorization,content-type'
        }
      });
      
      result.corsTest.corsAllowed = corsResponse.ok;
      if (!corsResponse.ok) {
        result.corsTest.error = `CORS preflight failed: ${corsResponse.status}`;
      }
    } catch (error: any) {
      result.corsTest.corsAllowed = false;
      result.corsTest.error = error.message;
    }
  }

  // Test Supabase client query
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('key')
      .limit(1);
    
    if (error) {
      result.supabaseQuery.success = false;
      result.supabaseQuery.error = error.message;
      result.supabaseQuery.details = error.details || error.hint || 'No additional details';
    } else {
      result.supabaseQuery.success = true;
    }
  } catch (error: any) {
    result.supabaseQuery.success = false;
    result.supabaseQuery.error = error.message || 'Unknown error';
  }

  // Generate recommendations
  if (!result.networkConnectivity.reachable) {
    result.recommendations.push('Check your internet connection and Supabase project status');
  }
  
  if (!result.corsTest.corsAllowed) {
    result.recommendations.push(`Add "${window.location.origin}" to your Supabase project's CORS settings`);
    result.recommendations.push('Go to Supabase Dashboard → Project Settings → API → CORS');
  }
  
  if (!result.supabaseQuery.success && result.networkConnectivity.reachable) {
    result.recommendations.push('Check your Supabase project permissions and RLS policies');
  }

  if (result.networkConnectivity.responseTime && result.networkConnectivity.responseTime > 5000) {
    result.recommendations.push('Slow response time detected - check your network connection');
  }

  return result;
}

export function displayDiagnostics(diagnostics: DiagnosticsResult) {
  console.group('🔍 Supabase Connection Diagnostics');
  
  console.log('📋 Environment Variables:');
  console.log(`  URL: ${diagnostics.environmentVariables.hasUrl ? '✅' : '❌'} ${diagnostics.environmentVariables.urlValue}`);
  console.log(`  Key: ${diagnostics.environmentVariables.hasAnonKey ? '✅' : '❌'} ${diagnostics.environmentVariables.keyPrefix}`);
  
  console.log('🌐 Network Connectivity:');
  console.log(`  Reachable: ${diagnostics.networkConnectivity.reachable ? '✅' : '❌'}`);
  if (diagnostics.networkConnectivity.status) {
    console.log(`  Status: ${diagnostics.networkConnectivity.status}`);
  }
  if (diagnostics.networkConnectivity.responseTime) {
    console.log(`  Response Time: ${diagnostics.networkConnectivity.responseTime}ms`);
  }
  if (diagnostics.networkConnectivity.error) {
    console.log(`  Error: ${diagnostics.networkConnectivity.error}`);
  }
  
  console.log('🔒 CORS Test:');
  console.log(`  Allowed: ${diagnostics.corsTest.corsAllowed ? '✅' : '❌'}`);
  if (diagnostics.corsTest.error) {
    console.log(`  Error: ${diagnostics.corsTest.error}`);
  }
  
  console.log('🗄️ Supabase Query:');
  console.log(`  Success: ${diagnostics.supabaseQuery.success ? '✅' : '❌'}`);
  if (diagnostics.supabaseQuery.error) {
    console.log(`  Error: ${diagnostics.supabaseQuery.error}`);
  }
  
  if (diagnostics.recommendations.length > 0) {
    console.log('💡 Recommendations:');
    diagnostics.recommendations.forEach((rec, i) => {
      console.log(`  ${i + 1}. ${rec}`);
    });
  }
  
  console.groupEnd();
}