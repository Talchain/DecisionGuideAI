// Supabase Connection Diagnostics Tool
// Run this to help diagnose connection issues

export async function runSupabaseDiagnostics() {
  const results = {
    environmentVariables: {},
    networkConnectivity: {},
    corsTest: {},
    recommendations: []
  };

  // Check environment variables
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  results.environmentVariables = {
    hasUrl: !!supabaseUrl,
    hasAnonKey: !!supabaseAnonKey,
    urlFormat: supabaseUrl ? 'Valid' : 'Missing',
    urlValue: supabaseUrl || 'Not set'
  };

  if (!supabaseUrl) {
    results.recommendations.push('❌ VITE_SUPABASE_URL is missing from .env file');
  }
  
  if (!supabaseAnonKey) {
    results.recommendations.push('❌ VITE_SUPABASE_ANON_KEY is missing from .env file');
  }

  // Test basic network connectivity to Supabase
  if (supabaseUrl) {
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        method: 'HEAD',
        headers: {
          'apikey': supabaseAnonKey || '',
          'Authorization': `Bearer ${supabaseAnonKey || ''}`
        }
      });
      
      results.networkConnectivity = {
        status: response.status,
        statusText: response.statusText,
        reachable: response.ok
      };

      if (!response.ok) {
        results.recommendations.push(`❌ Supabase API returned ${response.status}: ${response.statusText}`);
      } else {
        results.recommendations.push('✅ Supabase API is reachable');
      }
    } catch (error) {
      results.networkConnectivity = {
        error: error.message,
        reachable: false
      };
      
      if (error.message.includes('Failed to fetch')) {
        results.recommendations.push('❌ Network connectivity issue detected. Check:');
        results.recommendations.push('  • Internet connection');
        results.recommendations.push('  • VPN/Firewall settings');
        results.recommendations.push('  • Supabase project status');
        results.recommendations.push('  • CORS configuration in Supabase dashboard');
      }
    }
  }

  // CORS test
  try {
    const corsTestUrl = `${supabaseUrl}/rest/v1/organisations?select=count&limit=1`;
    const corsResponse = await fetch(corsTestUrl, {
      method: 'GET',
      headers: {
        'apikey': supabaseAnonKey || '',
        'Authorization': `Bearer ${supabaseAnonKey || ''}`,
        'Content-Type': 'application/json'
      }
    });

    results.corsTest = {
      status: corsResponse.status,
      corsAllowed: corsResponse.status !== 0
    };

    if (corsResponse.status === 0) {
      results.recommendations.push('❌ CORS error detected. Add your origin to Supabase CORS settings:');
      results.recommendations.push('  • Go to Supabase Dashboard > Project Settings > API');
      results.recommendations.push('  • Under CORS, add: http://localhost:5173');
      results.recommendations.push('  • For development, you can temporarily use: *');
    }
  } catch (error) {
    results.corsTest = {
      error: error.message,
      corsAllowed: false
    };
  }

  return results;
}

// Helper function to display diagnostics in console
export function displayDiagnostics(results: any) {
  console.group('🔍 Supabase Connection Diagnostics');
  
  console.group('📋 Environment Variables');
  console.table(results.environmentVariables);
  console.groupEnd();
  
  console.group('🌐 Network Connectivity');
  console.table(results.networkConnectivity);
  console.groupEnd();
  
  console.group('🔒 CORS Test');
  console.table(results.corsTest);
  console.groupEnd();
  
  console.group('💡 Recommendations');
  results.recommendations.forEach(rec => console.log(rec));
  console.groupEnd();
  
  console.groupEnd();
}