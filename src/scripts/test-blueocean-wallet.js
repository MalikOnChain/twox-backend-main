/**
 * Test script for BlueOcean Wallet Integration
 * Run this script to test your wallet endpoints locally
 */

import crypto from 'crypto';

// Configuration
const BASE_URL = 'http://localhost:5000/api/slots-casino/blueocean/wallet';
const SALT_KEY = process.env.BLUEOCEAN_SALT_KEY || 'your_salt_key_here';

// Test parameters
const TEST_REMOTE_ID = 'test_user_123';
const TEST_SESSION_ID = 'test_session_456';
const TEST_AMOUNT = 100;
const TEST_TRANSACTION_ID = `txn_${Date.now()}`;

/**
 * Generate BlueOcean signature
 */
function generateSignature(params) {
  const sortedParams = Object.keys(params)
    .sort()
    .map(param => `${param}=${params[param]}`)
    .join('&');
  
  return crypto.createHash('sha1').update(SALT_KEY + sortedParams).digest('hex');
}

/**
 * Test balance endpoint
 */
async function testBalance() {
  console.log('\n🧪 Testing Balance Endpoint...');
  
  const params = {
    action: 'balance',
    remote_id: TEST_REMOTE_ID,
    session_id: TEST_SESSION_ID,
  };
  
  const key = generateSignature(params);
  const queryString = new URLSearchParams({ ...params, key }).toString();
  const url = `${BASE_URL}/balance?${queryString}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('✅ Balance Response:', data);
    return data;
  } catch (error) {
    console.error('❌ Balance Error:', error);
  }
}

/**
 * Test debit endpoint
 */
async function testDebit() {
  console.log('\n🧪 Testing Debit Endpoint...');
  
  const params = {
    action: 'debit',
    remote_id: TEST_REMOTE_ID,
    session_id: TEST_SESSION_ID,
    amount: TEST_AMOUNT,
    transactionid: TEST_TRANSACTION_ID,
  };
  
  const key = generateSignature(params);
  const queryString = new URLSearchParams({ ...params, key }).toString();
  const url = `${BASE_URL}/debit?${queryString}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('✅ Debit Response:', data);
    return data;
  } catch (error) {
    console.error('❌ Debit Error:', error);
  }
}

/**
 * Test credit endpoint
 */
async function testCredit() {
  console.log('\n🧪 Testing Credit Endpoint...');
  
  const params = {
    action: 'credit',
    remote_id: TEST_REMOTE_ID,
    session_id: TEST_SESSION_ID,
    amount: 50, // Win 50 back
    transactionid: `${TEST_TRANSACTION_ID}_win`,
  };
  
  const key = generateSignature(params);
  const queryString = new URLSearchParams({ ...params, key }).toString();
  const url = `${BASE_URL}/credit?${queryString}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('✅ Credit Response:', data);
    return data;
  } catch (error) {
    console.error('❌ Credit Error:', error);
  }
}

/**
 * Test rollback endpoint
 */
async function testRollback() {
  console.log('\n🧪 Testing Rollback Endpoint...');
  
  const params = {
    action: 'rollback',
    remote_id: TEST_REMOTE_ID,
    session_id: TEST_SESSION_ID,
    transactionid: TEST_TRANSACTION_ID,
  };
  
  const key = generateSignature(params);
  const queryString = new URLSearchParams({ ...params, key }).toString();
  const url = `${BASE_URL}/rollback?${queryString}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('✅ Rollback Response:', data);
    return data;
  } catch (error) {
    console.error('❌ Rollback Error:', error);
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('🚀 Starting BlueOcean Wallet Integration Tests');
  console.log('===============================================');
  
  // Test balance
  await testBalance();
  
  // Test debit
  await testDebit();
  
  // Test credit
  await testCredit();
  
  // Test final balance
  await testBalance();
  
  // Test rollback
  await testRollback();
  
  // Test final balance after rollback
  await testBalance();
  
  console.log('\n✅ All tests completed!');
  console.log('\n📝 Next Steps:');
  console.log('1. Provide BlueOcean with your wallet endpoint URLs:');
  console.log(`   - Balance: ${BASE_URL}/balance`);
  console.log(`   - Debit: ${BASE_URL}/debit`);
  console.log(`   - Credit: ${BASE_URL}/credit`);
  console.log(`   - Rollback: ${BASE_URL}/rollback`);
  console.log('2. Provide your IP addresses for whitelisting');
  console.log('3. Get your BlueOcean API credentials');
  console.log('4. Test with real BlueOcean API');
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}

export { runTests, testBalance, testDebit, testCredit, testRollback };

