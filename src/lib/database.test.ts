import { describe, it, expect } from 'vitest';
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

// Vitest suite
describe('database schema smoke tests', () => {
  it('user_profiles accessible', async () => {
    expect(await testUserProfile()).toBe(true);
  });
  it('decisions accessible', async () => {
    expect(await testDecisions()).toBe(true);
  });
  it('decision_data accessible', async () => {
    expect(await testDecisionData()).toBe(true);
  });
});