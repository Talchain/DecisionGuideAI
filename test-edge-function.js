// Test script for the send-team-invite Edge Function
// Run with: node test-edge-function.js

const fetch = require('node:fetch');

// Configuration
const SUPABASE_URL = 'https://etmmuzwxtcjipwphdola.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0bW11end4dGNqaXB3cGhkb2xhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg1MjczODIsImV4cCI6MjA1NDEwMzM4Mn0.QEPZS6OKIJBzlUKBNKHh25nRjRUzSpJzXyiZxHPr78k';
const TEST_EMAIL = 'test@example.com'; // Change to your email for testing

// Test health check
async function testHealthCheck() {
  console.log('Testing health check endpoint...');
  
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-team-invite/health`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    console.log('Health check response:', {
      status: response.status,
      data
    });
    
    return data;
  } catch (error) {
    console.error('Health check failed:', error);
    return null;
  }
}

// Test sending an invitation
async function testSendInvite() {
  console.log('Testing send invite endpoint...');
  
  const payload = {
    invitation_id: crypto.randomUUID(),
    email: TEST_EMAIL,
    team_id: crypto.randomUUID(),
    team_name: "Test Team",
    inviter_id: null // This would normally be a user ID
  };
  
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-team-invite`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    console.log('Send invite response:', {
      status: response.status,
      data
    });
    
    return data;
  } catch (error) {
    console.error('Send invite failed:', error);
    return null;
  }
}

// Run tests
async function runTests() {
  console.log('=== EDGE FUNCTION TESTS ===');
  
  // Test health check
  const healthResult = await testHealthCheck();
  console.log('\nHealth check result:', healthResult ? 'PASSED' : 'FAILED');
  
  // Only test sending if health check passes
  if (healthResult && healthResult.success) {
    const sendResult = await testSendInvite();
    console.log('\nSend invite result:', sendResult ? 'PASSED' : 'FAILED');
  } else {
    console.log('\nSkipping send invite test due to failed health check');
  }
  
  console.log('\n=== TESTS COMPLETE ===');
}

runTests();