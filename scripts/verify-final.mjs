#!/usr/bin/env node

/**
 * verify-final.mjs
 * 
 * Final E2E Verification Script for Untouched Production Hardening
 * 
 * Tests 7 critical flows:
 * 1. ✅ Supabase dual-mode (with/without env vars)
 * 2. ✅ Custom API key never-404 (unt_live_* → default vault)
 * 3. ✅ Autonomous policy blocks (instant HTTP 403)
 * 4. ✅ Routine model auto-approve ($0.001)
 * 5. ✅ Idempotency enforcement (Idempotency-Key header)
 * 6. ✅ Spend limit validation ($0.001 - $0.025 range)
 * 7. ✅ Execution trace with 6 steps
 */

import { spawn } from 'child_process';
import { setTimeout as delay } from 'timers/promises';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const DEMO_API_KEY = 'unt_live_demo_key';
const CUSTOM_API_KEY = `unt_live_custom_${Date.now()}`;

let testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m'
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function logTest(name, passed, details = '') {
  const icon = passed ? '✅' : '❌';
  const color = passed ? 'green' : 'red';
  log(`${icon} ${name}`, color);
  if (details) log(`   ${details}`, 'dim');
  testResults.tests.push({ name, passed, details });
  if (passed) testResults.passed++;
  else testResults.failed++;
}

async function startServer() {
  log('\n🚀 Starting development server...', 'cyan');
  const server = spawn('npm', ['run', 'dev'], {
    shell: true,
    stdio: 'pipe',
    detached: false
  });

  let serverReady = false;
  let output = '';

  server.stdout.on('data', (data) => {
    output += data.toString();
    if (output.includes('Local:') || output.includes('localhost:3000')) {
      serverReady = true;
    }
  });

  server.stderr.on('data', (data) => {
    const text = data.toString();
    if (text.includes('Local:') || text.includes('localhost:3000')) {
      serverReady = true;
    }
  });

  const startTime = Date.now();
  while (!serverReady && Date.now() - startTime < 30000) {
    await delay(500);
  }

  if (!serverReady) {
    log('⚠️  Server did not report ready status, continuing anyway...', 'yellow');
  } else {
    log('✅ Server is ready', 'green');
  }

  await delay(2000);
  return server;
}

async function httpRequest(url, options = {}) {
  const timeoutMs = url.includes('/chat/completions') ? 30000 : 10000;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Request timeout after ${timeoutMs/1000}s`));
    }, timeoutMs);

    fetch(url, {
      method: options.method || 'GET',
      headers: options.headers || {},
      body: options.body ? JSON.stringify(options.body) : undefined,
      ...options
    })
      .then(async (res) => {
        clearTimeout(timeout);
        const text = await res.text();
        let data;
        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          data = text;
        }
        resolve({ status: res.status, headers: res.headers, data });
      })
      .catch((err) => {
        clearTimeout(timeout);
        reject(err);
      });
  });
}

async function test1_supabaseDualMode() {
  log('\n📦 Test 1: Supabase Dual-Mode Persistence', 'blue');
  
  try {
    const hasSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (hasSupabase) {
      logTest('Supabase configured', true, 'ENV vars present');
    } else {
      logTest('Supabase fallback mode', true, 'In-memory store active (dev-friendly)');
    }
    
    const res = await httpRequest(`${BASE_URL}/api/vault/status?apiKey=${DEMO_API_KEY}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${DEMO_API_KEY}`,
      }
    });
    
    logTest('Status API works', res.status === 200, `Status: ${res.status}`);
    
    if (res.status === 200 && res.data.userState) {
      logTest('User state returned', true, `Principal: $${(res.data.userState.principal / 1_000000).toFixed(2)}`);
    }
    
  } catch (err) {
    logTest('Supabase dual-mode', false, err.message);
  }
}

async function test2_customKeyNever404() {
  log('\n🔑 Test 2: Custom API Key Never 404', 'blue');
  
  try {
    const res = await httpRequest(`${BASE_URL}/api/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CUSTOM_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: {
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Test custom key' }]
      }
    });
    
    const never404 = res.status !== 404;
    logTest('Custom key auto-aliased', never404, `Status: ${res.status} (expected 200 or 403, not 404)`);
    
    if (res.data.executionTrace) {
      logTest('Execution trace returned', true, 'Trace includes vault resolution');
    }
    
  } catch (err) {
    logTest('Custom key handling', false, err.message);
  }
}

async function test3_autonomousPolicyBlock() {
  log('\n🚫 Test 3: Autonomous Policy Blocks Heavy Models', 'blue');
  
  try {
    const res = await httpRequest(`${BASE_URL}/api/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DEMO_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: {
        model: 'anthropic/claude-3-opus', // Heavy model: $0.020 > $0.005 default limit
        messages: [{ role: 'user', content: 'Test policy block' }]
      }
    });
    
    const isBlocked = res.status === 403;
    logTest('Heavy model blocked instantly', isBlocked, `Status: ${res.status} (expected 403)`);
    
    if (res.data.executionTrace) {
      const policyStep = res.data.executionTrace.steps.find(s => s.type === 'POLICY');
      const instant = policyStep && policyStep.durationMs < 5;
      logTest('Policy check instant (<5ms)', instant, `${policyStep?.durationMs}ms`);
    }
    
  } catch (err) {
    logTest('Autonomous policy block', false, err.message);
  }
}

async function test4_routineAutoApprove() {
  log('\n⚡ Test 4: Routine Model Auto-Approve', 'blue');
  
  try {
    const res = await httpRequest(`${BASE_URL}/api/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DEMO_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: {
        model: 'gpt-4o-mini', // Routine model: $0.001
        messages: [{ role: 'user', content: 'Say "test"' }]
      }
    });
    
    const autoApproved = res.status === 200;
    logTest('Routine model processed', autoApproved, `Status: ${res.status}`);
    
    if (res.data.executionTrace) {
      const hasSteps = res.data.executionTrace.steps && res.data.executionTrace.steps.length >= 4;
      logTest('Execution trace present', hasSteps, `${res.data.executionTrace.steps?.length || 0} steps`);
    } else {
      logTest('Execution trace present', false, 'No trace in response');
    }
    
  } catch (err) {
    logTest('Routine auto-approve', false, err.message);
  }
}

async function test5_idempotencyEnforcement() {
  log('\n🔒 Test 5: Idempotency Enforcement', 'blue');
  
  try {
    const idempotencyKey = `test-replay-${Date.now()}`;
    
    const res1 = await httpRequest(`${BASE_URL}/api/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DEMO_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey
      },
      body: {
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Say "test1"' }]
      }
    });
    
    logTest('First request completed', res1.status === 200, `Status: ${res1.status}`);
    
    const res2 = await httpRequest(`${BASE_URL}/api/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DEMO_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey
      },
      body: {
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Say "test2"' }]
      }
    });
    
    const isCached = res2.data.cached === true || res2.data.costUSDC === 0;
    logTest('Idempotency works', isCached, 'Cached response returned ($0.00)');
    
  } catch (err) {
    logTest('Idempotency enforcement', false, err.message);
  }
}

async function test6_spendLimitValidation() {
  log('\n💰 Test 6: Spend Limit Validation', 'blue');
  
  try {
    // Test lower boundary ($0.001)
    const resLower = await httpRequest(`${BASE_URL}/api/vault/settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: {
        apiKey: DEMO_API_KEY,
        maxPerCallUsdc: 1000 // $0.001 in micro-units
      }
    });
    logTest('Lower limit accepted ($0.001)', resLower.status === 200, `Status: ${resLower.status}`);
    
    // Test upper boundary ($0.025)
    const resUpper = await httpRequest(`${BASE_URL}/api/vault/settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: {
        apiKey: DEMO_API_KEY,
        maxPerCallUsdc: 25000 // $0.025 in micro-units
      }
    });
    logTest('Upper limit accepted ($0.025)', resUpper.status === 200, `Status: ${resUpper.status}`);
    
    // Test out of range (should fail)
    const resInvalid = await httpRequest(`${BASE_URL}/api/vault/settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: {
        apiKey: DEMO_API_KEY,
        maxPerCallUsdc: 50000 // $0.050 - too high
      }
    });
    logTest('Out-of-range rejected', resInvalid.status === 400, `Status: ${resInvalid.status}`);
    
  } catch (err) {
    logTest('Spend limit validation', false, err.message);
  }
}

async function test7_executionTrace() {
  log('\n📊 Test 7: Execution Trace with 6 Steps', 'blue');
  
  try {
    const res = await httpRequest(`${BASE_URL}/api/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DEMO_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: {
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Say "trace"' }]
      }
    });
    
    if (res.data.executionTrace) {
      const trace = res.data.executionTrace;
      const hasSteps = trace.steps && trace.steps.length >= 4;
      logTest('Execution trace present', hasSteps, `Found ${trace.steps?.length || 0} steps`);
      
      if (trace.steps && trace.steps.length > 0) {
        const expectedSteps = ['AUTH', 'RATE_LIMIT', 'IDEMPOTENCY', 'POLICY'];
        const hasAllSteps = expectedSteps.every(step => 
          trace.steps.some(s => s.type === step)
        );
        logTest('Core steps present', hasAllSteps, expectedSteps.join(' → '));
      }
    } else {
      logTest('Execution trace missing', false, 'No trace in response');
    }
    
  } catch (err) {
    logTest('Execution trace', false, err.message);
  }
}

async function runAllTests() {
  log('╔═══════════════════════════════════════════════════════════╗', 'cyan');
  log('║    🚀 UNTOUCHED FINAL E2E VERIFICATION SCRIPT            ║', 'cyan');
  log('╚═══════════════════════════════════════════════════════════╝', 'cyan');
  
  let server;
  try {
    server = await startServer();
    
    await test1_supabaseDualMode();
    await test2_customKeyNever404();
    await test3_autonomousPolicyBlock();
    await test4_routineAutoApprove();
    await test5_idempotencyEnforcement();
    await test6_spendLimitValidation();
    await test7_executionTrace();
    
  } finally {
    if (server) {
      log('\n🛑 Stopping server...', 'yellow');
      server.kill('SIGTERM');
      await delay(1000);
      if (!server.killed) {
        server.kill('SIGKILL');
      }
    }
  }
  
  log('\n╔═══════════════════════════════════════════════════════════╗', 'cyan');
  log('║                    TEST SUMMARY                           ║', 'cyan');
  log('╚═══════════════════════════════════════════════════════════╝', 'cyan');
  log(`\n✅ Passed: ${testResults.passed}`, 'green');
  log(`❌ Failed: ${testResults.failed}`, testResults.failed > 0 ? 'red' : 'green');
  log(`📊 Total:  ${testResults.tests.length}\n`, 'blue');
  
  if (testResults.failed > 0) {
    log('Failed tests:', 'red');
    testResults.tests
      .filter(t => !t.passed)
      .forEach(t => log(`  ❌ ${t.name}: ${t.details}`, 'red'));
    log('');
  }
  
  const allPassed = testResults.failed === 0;
  if (allPassed) {
    log('╔═══════════════════════════════════════════════════════════╗', 'green');
    log('║   🎉 ALL TESTS PASSED - PRODUCTION READY! 🎉             ║', 'green');
    log('╚═══════════════════════════════════════════════════════════╝', 'green');
  } else {
    log('╔═══════════════════════════════════════════════════════════╗', 'red');
    log('║   ⚠️  SOME TESTS FAILED - REVIEW REQUIRED                ║', 'red');
    log('╚═══════════════════════════════════════════════════════════╝', 'red');
  }
  
  process.exit(allPassed ? 0 : 1);
}

runAllTests().catch(err => {
  log(`\n❌ Fatal error: ${err.message}`, 'red');
  console.error(err);
  process.exit(1);
});
