import { supabase } from './supabase';

// Test user profile creation
async function testUserProfile() {
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error testing user_profiles:', error);
    return false;
  }
  console.log('user_profiles table accessible:', !!profile);
  return true;
}

// Test decisions table
async function testDecisions() {
  const { data: decisions, error } = await supabase
    .from('decisions')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error testing decisions:', error);
    return false;
  }
  console.log('decisions table accessible:', !!decisions);
  return true;
}

// Test decision_data table
async function testDecisionData() {
  const { data: decisionData, error } = await supabase
    .from('decision_data')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error testing decision_data:', error);
    return false;
  }
  console.log('decision_data table accessible:', !!decisionData);
  return true;
}

// Run all tests
async function runDatabaseTests() {
  console.log('Testing database schema...');
  
  const results = await Promise.all([
    testUserProfile(),
    testDecisions(),
    testDecisionData()
  ]);

  const allPassed = results.every(result => result);
  console.log('All tests passed:', allPassed);
}

runDatabaseTests();