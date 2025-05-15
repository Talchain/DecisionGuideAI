// Simple script to test the Edge Function
const fetch = require('node-fetch');

// Configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://etmmuzwxtcjipwphdola.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0bW11end4dGNqaXB3cGhkb2xhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg1MjczODIsImV4cCI6MjA1NDEwMzM4Mn0.QEPZS6OKIJBzlUKBNKHh25nRjRUzSpJzXyiZxHPr78k';

// Test health endpoint
async function testHealth() {
  console.log('Testing health endpoint...');
  
  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/send-team-invite/health`,
      {
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      }
    );
    
    const data = await response.json();
    console.log('Health check response:', {
      status: response.status,
      data
    });
    
    return data;
  } catch (error) {
    console.error('Health check failed:', error);
    return { success: false, error: error.message };
  }
}

// Test sending an invitation
async function testSendInvite(email = 'test@example.com') {
  console.log(`Testing send invite to ${email}...`);
  
  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/send-team-invite`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          invitation_id: "07b9c936-2568-4da6-88a5-dc578d13b8a2",
          email: email,
          team_id: "39df9c1a-3d7c-4ffb-97a0-74d15d7d50bf",
          team_name: "Test Team",
          inviter_id: "26f20858-f0d3-4da8-9139-d9c74c6a3eef"
        })
      }
    );
    
    const data = await response.json();
    console.log('Send invite response:', {
      status: response.status,
      data
    });
    
    return data;
  } catch (error) {
    console.error('Send invite failed:', error);
    return { success: false, error: error.message };
  }
}

// Run tests
async function runTests() {
  console.log('=== EDGE FUNCTION TEST ===');
  
  // Test health endpoint
  const healthResult = await testHealth();
  
  // Only test send invite if health check passes
  if (healthResult.success) {
    // You can change this email to test with your own
    await testSendInvite('your-email@example.com');
  } else {
    console.log('Skipping send invite test due to health check failure');
  }
  
  console.log('=== TEST COMPLETE ===');
}

runTests();