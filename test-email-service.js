// Test script for the new email service
const fetch = require('node-fetch');
require('dotenv').config();

// Configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://etmmuzwxtcjipwphdola.supabase.co';
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0bW11end4dGNqaXB3cGhkb2xhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg1MjczODIsImV4cCI6MjA1NDEwMzM4Mn0.QEPZS6OKIJBzlUKBNKHh25nRjRUzSpJzXyiZxHPr78k';

// Test sending a test email
async function testSendTestEmail(email) {
  try {
    console.log(`Testing test email to ${email}...`);
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/test_email_sending`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': ANON_KEY,
          'Authorization': `Bearer ${ANON_KEY}`
        },
        body: JSON.stringify({
          to_email: email
        })
      }
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Test email response:', JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error('Test email failed:', error);
    return { success: false, error: error.message };
  }
}

// Test sending a team invitation
async function testSendTeamInvitation(email, teamName) {
  try {
    console.log(`Testing team invitation to ${email} for team ${teamName}...`);
    
    // First create a test invitation
    const inviteResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/invitations`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': ANON_KEY,
          'Authorization': `Bearer ${ANON_KEY}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          email: email,
          status: 'pending',
          team_id: '00000000-0000-0000-0000-000000000000', // Test team ID
          role: 'member',
          decision_role: 'contributor'
        })
      }
    );
    
    if (!inviteResponse.ok) {
      throw new Error(`HTTP error creating invitation! Status: ${inviteResponse.status}`);
    }
    
    const invitation = await inviteResponse.json();
    console.log('Created test invitation:', invitation[0].id);
    
    // Now send the invitation email
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/send_team_invitation_email`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': ANON_KEY,
          'Authorization': `Bearer ${ANON_KEY}`
        },
        body: JSON.stringify({
          invitation_uuid: invitation[0].id,
          to_email: email,
          team_name: teamName,
          inviter_name: 'Test Script'
        })
      }
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Team invitation response:', JSON.stringify(data, null, 2));
    
    // Clean up test invitation
    await fetch(
      `${SUPABASE_URL}/rest/v1/invitations?id=eq.${invitation[0].id}`,
      {
        method: 'DELETE',
        headers: {
          'apikey': ANON_KEY,
          'Authorization': `Bearer ${ANON_KEY}`
        }
      }
    );
    
    return data;
  } catch (error) {
    console.error('Team invitation test failed:', error);
    return { success: false, error: error.message };
  }
}

// Test error handling with invalid email
async function testErrorHandling() {
  try {
    console.log('Testing error handling with invalid email...');
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/test_email_sending`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': ANON_KEY,
          'Authorization': `Bearer ${ANON_KEY}`
        },
        body: JSON.stringify({
          to_email: 'not-an-email'
        })
      }
    );
    
    const data = await response.json();
    console.log('Error handling response:', JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error('Error handling test failed:', error);
    return { success: false, error: error.message };
  }
}

// Run tests
async function runTests() {
  console.log('\n=== Testing Email Service ===');
  console.log('Using Supabase URL:', SUPABASE_URL);
  console.log('');
  
  // Get test email address from command line
  const testEmail = process.argv[2] || 'test@example.com';
  const teamName = 'Test Team';
  
  console.log(`\nTesting with email: ${testEmail}`);
  
  // Run tests
  console.log('\n1. Testing test email:');
  await testSendTestEmail(testEmail);
  
  console.log('\n2. Testing team invitation:');
  await testSendTeamInvitation(testEmail, teamName);
  
  console.log('\n3. Testing error handling:');
  await testErrorHandling();
  
  console.log('\n=== Tests completed ===');
}

// Run the tests
runTests().catch(error => {
  console.error('\nTest script error:', error);
  process.exit(1);
});