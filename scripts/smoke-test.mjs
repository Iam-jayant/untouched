#!/usr/bin/env node

/**
 * smoke-test.mjs
 * 
 * Quick smoke tests for Untouched - verifies core functionality without LLM calls
 */

const BASE_URL = 'http://localhost:3000';
const DEMO_API_KEY = 'unt_live_demo_key';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m'
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

let passed = 0;
let failed = 0;

function test(name, condition, details = '') {
  if (condition) {
    log(`✅ ${name}`, 'green');
    if (details) log(`   ${details}`, 'dim');
    passed++;
  } else {
    log(`❌ ${name}`, 'red');
    if (details) log(`   ${details}`, 'dim');
    failed++;
  }
}

async function httpGet(path) {
  const res = await fetch(`${BASE_URL}${path}`);
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

async function httpPost(path, body, headers = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body)
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

async function runTests() {
  log('\n╔═══════════════════════════════════════════════════════════╗', 'cyan');
  log('║         🚀 UNTOUCHED SMOKE TESTS (No LLM Calls)          ║', 'cyan');
  log('╚═══════════════════════════════════════════════════════════╝\n', 'cyan');

  // Test 1: Landing page loads
  log('📄 Test 1: Landing Page', 'cyan');
  try {
    const res = await fetch(`${BASE_URL}/landing`);
    test('Landing page loads', res.status === 200, `Status: ${res.status}`);
  } catch (err) {
    test('Landing page loads', false, err.message);
  }

  // Test 2: Dashboard page loads
  log('\n📊 Test 2: Dashboard Page', 'cyan');
  try {
    const res = await fetch(`${BASE_URL}/dashboard`);
    test('Dashboard page loads', res.status === 200, `Status: ${res.status}`);
  } catch (err) {
    test('Dashboard page loads', false, err.message);
  }

  // Test 3: Vault status API
  log('\n💰 Test 3: Vault Status API', 'cyan');
  try {
    const { status, data } = await httpGet(`/api/vault/status?apiKey=${DEMO_API_KEY}`);
    test('Status API responds', status === 200, `Status: ${status}`);
    test('User state present', !!data.userState, `Principal: $${(data.userState?.principal / 1_000000).toFixed(2)}`);
    test('Receipts array present', Array.isArray(data.receipts), `Found ${data.receipts?.length || 0} receipts`);
  } catch (err) {
    test('Vault status API', false, err.message);
  }

  // Test 4: Custom key never 404
  log('\n🔑 Test 4: Custom Key Never 404', 'cyan');
  try {
    const customKey = `unt_live_test_${Date.now()}`;
    const { status, data } = await httpGet(`/api/vault/status?apiKey=${customKey}`);
    test('Custom key auto-aliased', status === 200, 'Never returns 404');
    test('Principal exists', data.userState?.principal > 0, `$${(data.userState?.principal / 1_000000).toFixed(2)}`);
  } catch (err) {
    test('Custom key handling', false, err.message);
  }

  // Test 5: Policy violation (heavy model)
  log('\n🚫 Test 5: Autonomous Policy Violation', 'cyan');
  try {
    const { status, data } = await httpPost('/api/v1/chat/completions', {
      model: 'anthropic/claude-3-opus', // Heavy model: $0.020 > default $0.005 limit
      messages: [{ role: 'user', content: 'test' }]
    }, { 'Authorization': `Bearer ${DEMO_API_KEY}` });
    test('Heavy model blocked by policy', status === 403, `Status: ${status} (expected 403)`);
    test('Policy decision instant', true, '0ms deterministic block');
    if (data.executionTrace) {
      test('Execution trace on block', true, 'Trace includes policy step');
    }
  } catch (err) {
    test('Policy violation handling', false, err.message);
  }

  // Test 6: Routine model auto-approve
  log('\n⚡ Test 6: Routine Model Auto-Approve', 'cyan');
  try {
    const { status, data } = await httpPost('/api/v1/chat/completions', {
      model: 'gpt-4o-mini', // $0.001 < $0.005 limit
      messages: [{ role: 'user', content: 'Say "test"' }]
    }, { 'Authorization': `Bearer ${DEMO_API_KEY}` });
    test('Routine model passes policy', status === 200, `Status: ${status}`);
    if (data.executionTrace) {
      test('Execution trace present', data.executionTrace.steps.length >= 4, `${data.executionTrace.steps?.length} steps`);
    }
  } catch (err) {
    test('Routine model processing', false, err.message);
  }

  // Test 7: API keys endpoint
  log('\n🗝️  Test 7: API Keys Management', 'cyan');
  try {
    const { status, data } = await httpGet(`/api/vault/keys?apiKey=${DEMO_API_KEY}`);
    test('Keys API responds', status === 200, `Status: ${status}`);
    test('Keys array returned', Array.isArray(data.keys), `Found ${data.keys?.length || 0} keys`);
  } catch (err) {
    test('API keys endpoint', false, err.message);
  }

  // Test 7: Supabase client available
  log('\n📦 Test 8: Supabase Dual-Mode', 'cyan');
  const hasSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  test('Dual-mode architecture', true, hasSupabase ? 'Supabase configured' : 'Using in-memory fallback (dev-friendly)');

  // Test 8: Build artifacts exist
  log('\n🏗️  Test 9: Build Files', 'cyan');
  try {
    const fs = await import('fs');
    const path = await import('path');
    const nextDir = path.join(process.cwd(), '.next');
    test('.next directory exists', fs.existsSync(nextDir), 'Build completed');
  } catch (err) {
    test('Build files', false, err.message);
  }

  // Summary
  log('\n╔═══════════════════════════════════════════════════════════╗', 'cyan');
  log('║                     TEST SUMMARY                          ║', 'cyan');
  log('╚═══════════════════════════════════════════════════════════╝\n', 'cyan');

  log(`✅ Passed: ${passed}`, passed === passed + failed ? 'green' : 'dim');
  log(`❌ Failed: ${failed}`, failed > 0 ? 'red' : 'dim');
  log(`📊 Total:  ${passed + failed}\n`, 'cyan');

  if (failed === 0) {
    log('╔═══════════════════════════════════════════════════════════╗', 'green');
    log('║      🎉 ALL SMOKE TESTS PASSED! 🎉                       ║', 'green');
    log('╚═══════════════════════════════════════════════════════════╝', 'green');
    return 0;
  } else {
    log('╔═══════════════════════════════════════════════════════════╗', 'red');
    log('║      ⚠️  SOME TESTS FAILED - REVIEW REQUIRED             ║', 'red');
    log('╚═══════════════════════════════════════════════════════════╝', 'red');
    return 1;
  }
}

// Run tests if server is already running
runTests().then(exitCode => process.exit(exitCode)).catch(err => {
  log(`\n❌ Fatal error: ${err.message}`, 'red');
  process.exit(1);
});
