// Test script for the send-team-invite Edge Function
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Check if node-fetch is installed
try {
  require.resolve('node-fetch');
} catch (e) {
  console.error('node-fetch is not installed. Please run: npm install node-fetch');
  process.exit(1);
}

// Configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://etmmuzwxtcjipwphdola.supabase.co';
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0bW11end4dGNqaXB3cGhkb2xhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg1MjczODIsImV4cCI6MjA1NDEwMzM4Mn0.QEPZS6OKIJBzlUKBNKHh25nRjRUzSpJzXyiZxHPr78k';
const SMTP_URL = process.env.SMTP_URL || 'smtps://8cfdcc001@smtp-brevo.com:xsmtpsib-ddac0f4d8da36c3710407b5b4d546f9f41da176d1d87d2ee014012116f4c2175-DPKANEXQnp7FHmRT@smtp-relay.brevo.com:587';

// Test health check
async function testHealthCheck() {
  try {
    console.log(`Testing health check endpoint at ${SUPABASE_URL}/functions/v1/send-team-invite/health...`);
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/send-team-invite/health`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${ANON_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('Health check status:', response.status);
    
    const data = await response.json();
    console.log('Health check response:', JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error('Health check failed:', error);
    return { success: false, error: error.message };
  }
}

// Test sending an invitation
async function testSendInvitation(email) {
  try {
    console.log(`Testing invitation to ${email} via ${SUPABASE_URL}/functions/v1/send-team-invite...`);
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/send-team-invite`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          invitation_id: '00000000-0000-0000-0000-000000000000',
          email: email,
          team_id: '00000000-0000-0000-0000-000000000000',
          team_name: 'Test Team',
          inviter_id: null
        })
      }
    );
    console.log('Send invitation status:', response.status);
    
    const data = await response.json();
    console.log('Send invitation response:', JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error('Send invitation failed:', error);
    return { success: false, error: error.message };
  }
}

// Run tests
async function runTests() {
  console.log('\n=== Testing send-team-invite Edge Function ===');
  console.log('Using SMTP URL:', SMTP_URL.replace(/:[^:@]+@/, ':***@'));
  console.log('Using Supabase URL:', SUPABASE_URL);
  console.log('');
  
  // Test health check
  const healthResult = await testHealthCheck();
  console.log('\nHealth check success:', healthResult.success);
  
  // Only test sending if health check passes
  if (healthResult.success) {
    const testEmail = process.argv[2] || 'test@example.com';
    console.log(`\nHealth check passed, testing invitation to: ${testEmail}`);
    await testSendInvitation(testEmail);
  } else {
    console.log('\nSkipping invitation test due to failed health check');
  }
  
  console.log('\n=== Tests completed ===');
}

// Run the tests
runTests().catch(error => {
  console.error('\nTest script error:', error);
  process.exit(1);
});