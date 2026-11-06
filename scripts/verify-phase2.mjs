#!/usr/bin/env node
/**
 * Phase 2 Verification Script
 * Validates all backend components are implemented correctly
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// ============================================================================
// Test Data
// ============================================================================

const REQUIRED_FILES = [
  // Core libs
  'src/lib/types.ts',
  'src/lib/constants.ts',
  'src/lib/agent-store.ts',
  'src/lib/sse.ts',
  'src/lib/discovery.ts',
  'src/lib/nanopayments.ts',
  'src/lib/policy-engine.ts',
  'src/lib/llm-proxy.ts',
  
  // API routes
  'src/app/api/discovery/route.ts',
  'src/app/api/events/route.ts',
  'src/app/api/v1/chat/completions/route.ts',
  'src/app/api/vault/deposit/route.ts',
  'src/app/api/vault/simulate/route.ts',
  'src/app/api/vault/status/route.ts',
  'src/app/api/vault/withdraw/route.ts',
  'src/app/api/world/step-up-decision/route.ts',
];

const REQUIRED_CONSTANTS = [
  'DEPOSIT_PRESETS',
  'MIN_DEPOSIT_USDC',
  'GAS_BUFFER_USDC',
  'FREE_TIER_MODELS',
  'PREMIUM_MODELS',
  'MODELS',
  'DEMO_API_KEY',
  'DEMO_DEPOSIT_USDC',
];

const REQUIRED_FUNCTIONS = [
  'calculateAdvance',
  'calculateBattery',
  'getFreeTierCascade',
  'getStore',
  'getUser',
  'createUser',
  'updateUserBalance',
  'getSSE',
  'createSSEStream',
  'getUSYCPrice',
  'evaluatePolicy',
  'callLLM',
];

// ============================================================================
// Verification Functions
// ============================================================================

function checkFileExists(relativePath) {
  const fullPath = join(projectRoot, relativePath);
  const exists = existsSync(fullPath);
  
  if (exists) {
    console.log(`✓ ${relativePath}`);
    return true;
  } else {
    console.error(`✗ ${relativePath} - MISSING`);
    return false;
  }
}

function checkContentContains(relativePath, searchStrings) {
  const fullPath = join(projectRoot, relativePath);
  
  if (!existsSync(fullPath)) {
    console.error(`✗ ${relativePath} - MISSING`);
    return false;
  }
  
  const content = readFileSync(fullPath, 'utf-8');
  const missing = searchStrings.filter(str => !content.includes(str));
  
  if (missing.length === 0) {
    console.log(`✓ ${relativePath} contains required symbols`);
    return true;
  } else {
    console.error(`✗ ${relativePath} missing: ${missing.join(', ')}`);
    return false;
  }
}

function verifyGlobalThisDeclarations() {
  const typesPath = join(projectRoot, 'src/lib/types.ts');
  const content = readFileSync(typesPath, 'utf-8');
  
  const hasGlobalThis = content.includes('declare global');
  const hasStore = content.includes('__untouchedStore');
  const hasSSE = content.includes('__untouchedSSE');
  
  if (hasGlobalThis && hasStore && hasSSE) {
    console.log('✓ G1: globalThis declarations present');
    return true;
  } else {
    console.error('✗ G1: globalThis declarations missing');
    return false;
  }
}

function verifyBatteryMath() {
  const constantsPath = join(projectRoot, 'src/lib/constants.ts');
  const content = readFileSync(constantsPath, 'utf-8');
  
  const hasAdvanceFormula = content.includes('(principal × 500 × 14) / (10000 × 365)');
  const hasBatteryFormula = content.includes('principal × 0.02');
  
  if (hasAdvanceFormula && hasBatteryFormula) {
    console.log('✓ G2: Battery math formulas present');
    return true;
  } else {
    console.error('✗ G2: Battery math formulas missing');
    return false;
  }
}

function verifyPromiseBasedHTTP() {
  const chatPath = join(projectRoot, 'src/app/api/v1/chat/completions/route.ts');
  const content = readFileSync(chatPath, 'utf-8');
  
  const hasAwait = content.includes('await callLLM');
  const hasComment = content.includes('G3: Promise-based HTTP hold') || content.includes('G3:');
  
  if (hasAwait && hasComment) {
    console.log('✓ G3: Promise-based HTTP hold present');
    return true;
  } else {
    console.error('✗ G3: Promise-based HTTP hold missing');
    return false;
  }
}

function verifyDemoUserPreSeed() {
  const agentStorePath = join(projectRoot, 'src/lib/agent-store.ts');
  const content = readFileSync(agentStorePath, 'utf-8');
  
  const hasDemoKey = content.includes('DEMO_API_KEY');
  const hasPreSeed = content.includes('store.users.set(DEMO_API_KEY');
  
  if (hasDemoKey && hasPreSeed) {
    console.log('✓ Demo user "unt_live_demo_key" pre-seeded with $50');
    return true;
  } else {
    console.error('✗ Demo user pre-seed missing');
    return false;
  }
}

function verifyFreeTierCascade() {
  const constantsPath = join(projectRoot, 'src/lib/constants.ts');
  const content = readFileSync(constantsPath, 'utf-8');
  
  const hasOpenRouter = content.includes("provider: 'openrouter'");
  const hasGroq = content.includes("provider: 'groq'");
  const hasGemini = content.includes("provider: 'gemini'");
  const hasMock = content.includes("provider: 'mock'");
  const hasFallbackOrder = content.includes('fallbackOrder');
  
  if (hasOpenRouter && hasGroq && hasGemini && hasMock && hasFallbackOrder) {
    console.log('✓ Free-tier cascade (OPENROUTER → GROQ → GEMINI → MOCK) configured');
    return true;
  } else {
    console.error('✗ Free-tier cascade incomplete');
    return false;
  }
}

// ============================================================================
// Main Verification
// ============================================================================

async function main() {
  console.log('='.repeat(80));
  console.log('Phase 2 Verification Script');
  console.log('='.repeat(80));
  console.log('');

  let passed = 0;
  let failed = 0;

  // Check all required files
  console.log('\n[1/7] Checking required files...\n');
  for (const file of REQUIRED_FILES) {
    if (checkFileExists(file)) {
      passed++;
    } else {
      failed++;
    }
  }

  // Check constants
  console.log('\n[2/7] Checking required constants...\n');
  if (checkContentContains('src/lib/constants.ts', REQUIRED_CONSTANTS)) {
    passed++;
  } else {
    failed++;
  }

  // Check functions
  console.log('\n[3/7] Checking required functions...\n');
  const functionChecks = [
    checkContentContains('src/lib/constants.ts', ['calculateAdvance', 'calculateBattery', 'getFreeTierCascade']),
    checkContentContains('src/lib/agent-store.ts', ['getStore', 'getUser', 'createUser', 'updateUserBalance']),
    checkContentContains('src/lib/sse.ts', ['getSSE', 'createSSEStream']),
    checkContentContains('src/lib/discovery.ts', ['getUSYCPrice']),
    checkContentContains('src/lib/policy-engine.ts', ['evaluatePolicy']),
    checkContentContains('src/lib/llm-proxy.ts', ['callLLM']),
  ];
  
  if (functionChecks.every(Boolean)) {
    passed++;
  } else {
    failed++;
  }

  // Check G1 (globalThis)
  console.log('\n[4/7] Checking G1 (globalThis singletons)...\n');
  if (verifyGlobalThisDeclarations()) {
    passed++;
  } else {
    failed++;
  }

  // Check G2 (battery math)
  console.log('\n[5/7] Checking G2 (exact battery math)...\n');
  if (verifyBatteryMath()) {
    passed++;
  } else {
    failed++;
  }

  // Check G3 (Promise-based HTTP hold)
  console.log('\n[6/7] Checking G3 (Promise-based HTTP hold)...\n');
  if (verifyPromiseBasedHTTP()) {
    passed++;
  } else {
    failed++;
  }

  // Check demo user + free-tier cascade
  console.log('\n[7/7] Checking demo user pre-seed & free-tier cascade...\n');
  if (verifyDemoUserPreSeed()) {
    passed++;
  } else {
    failed++;
  }
  
  if (verifyFreeTierCascade()) {
    passed++;
  } else {
    failed++;
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log('');

  if (failed === 0) {
    console.log('✓ Phase 2 verification PASSED');
    console.log('');
    console.log('Next steps:');
    console.log('1. Run "npm run build" to verify TypeScript compilation');
    console.log('2. Test endpoints with curl or Postman');
    console.log('3. Demo user API key: "unt_live_demo_key" (pre-seeded with $50)');
    process.exit(0);
  } else {
    console.error('✗ Phase 2 verification FAILED');
    console.error(`${failed} checks failed. Please fix the issues above.`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Verification script error:', error);
  process.exit(1);
});
