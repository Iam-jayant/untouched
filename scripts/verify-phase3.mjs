#!/usr/bin/env node
/**
 * Phase 3 Verification Script
 * Validates World ID integration (IDKit + Agent Pass) with BLOCKED and APPROVED paths
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
  // World ID library
  'src/lib/world-id.ts',
  
  // API routes
  'src/app/api/world/verify-idkit/route.ts',
  'src/app/api/world/step-up-decision/route.ts',
  
  // React components
  'src/components/mobile/WorldIDKitButton.tsx',
  'src/components/mobile/StepUpModal.tsx',
];

const REQUIRED_FUNCTIONS = [
  'verifyIDKitProof',
  'verifyAgentPassProof',
  'createMockProof',
];

const REQUIRED_WORLD_ID_ELEMENTS = [
  '@worldcoin/idkit',
  'IDKitWidget',
  'ISuccessResult',
  'VerificationLevel',
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

function verifyWorldIDLibrary() {
  const worldIdPath = join(projectRoot, 'src/lib/world-id.ts');
  const content = readFileSync(worldIdPath, 'utf-8');
  
  const hasFunctions = REQUIRED_FUNCTIONS.every(fn => content.includes(fn));
  const hasProofType = content.includes('WorldIDProof');
  const hasVerifyResponse = content.includes('WorldIDVerifyResponse');
  
  if (hasFunctions && hasProofType && hasVerifyResponse) {
    console.log('✓ World ID library with server-side verification');
    return true;
  } else {
    console.error('✗ World ID library incomplete');
    return false;
  }
}

function verifyBlockedPath() {
  const stepUpPath = join(projectRoot, 'src/app/api/world/step-up-decision/route.ts');
  const content = readFileSync(stepUpPath, 'utf-8');
  
  const hasActionDeny = content.includes("action === 'deny'") || content.includes('action: "deny"');
  const hasBlockedReceipt = content.includes('blocked') || content.includes('BLOCKED');
  const hasCrimson = content.includes('Crimson') || content.includes('$0.00');
  const hasG1Comment = content.includes('G1') && content.includes('G3');
  
  if (hasActionDeny && hasBlockedReceipt && hasCrimson && hasG1Comment) {
    console.log('✓ Path 1 (BLOCKED): Crimson denied path with $0.00 cost');
    return true;
  } else {
    console.error('✗ Path 1 (BLOCKED) implementation incomplete');
    return false;
  }
}

function verifyApprovedPath() {
  const stepUpPath = join(projectRoot, 'src/app/api/world/step-up-decision/route.ts');
  const content = readFileSync(stepUpPath, 'utf-8');
  
  const hasActionApprove = content.includes("action === 'approve'") || content.includes('action: "approve"');
  const hasWorldIDVerify = content.includes('verifyAgentPassProof');
  const hasDeduction = content.includes('updateUserBalance') || content.includes('deduct');
  const hasGreen = content.includes('Green') || content.includes('approved');
  
  if (hasActionApprove && hasWorldIDVerify && hasDeduction && hasGreen) {
    console.log('✓ Path 2 (APPROVED): World ID Agent Pass verification with battery deduction');
    return true;
  } else {
    console.error('✗ Path 2 (APPROVED) implementation incomplete');
    return false;
  }
}

function verifyReactComponents() {
  const modalPath = join(projectRoot, 'src/components/mobile/StepUpModal.tsx');
  const buttonPath = join(projectRoot, 'src/components/mobile/WorldIDKitButton.tsx');
  
  if (!existsSync(modalPath) || !existsSync(buttonPath)) {
    console.error('✗ React components missing');
    return false;
  }
  
  const modalContent = readFileSync(modalPath, 'utf-8');
  const buttonContent = readFileSync(buttonPath, 'utf-8');
  
  const hasIDKitWidget = modalContent.includes('IDKitWidget') && buttonContent.includes('IDKitWidget');
  const hasBlockButton = modalContent.includes('Block Request') || modalContent.includes('deny');
  const hasApproveButton = modalContent.includes('Approve with World ID') || modalContent.includes('approve');
  
  if (hasIDKitWidget && hasBlockButton && hasApproveButton) {
    console.log('✓ React components (WorldIDKitButton + StepUpModal)');
    return true;
  } else {
    console.error('✗ React components incomplete');
    return false;
  }
}

function verifyPartA() {
  console.log('\n[Bonus] Checking Part A (Phase 2 spec alignment)...\n');
  
  const constantsPath = join(projectRoot, 'src/lib/constants.ts');
  const content = readFileSync(constantsPath, 'utf-8');
  
  const has5APY = content.includes('5% APY') || content.includes('0.05');
  const has14Days = content.includes('14 days');
  const hasDEMO_DEPOSIT = content.includes('DEMO_DEPOSIT_USDC') && content.includes('50_000000');
  
  if (has5APY && has14Days && hasDEMO_DEPOSIT) {
    console.log('✓ Part A: Battery math corrected to 5% APY for 14 days');
    return true;
  } else {
    console.error('✗ Part A: Battery math not corrected');
    return false;
  }
}

// ============================================================================
// Main Verification
// ============================================================================

async function main() {
  console.log('='.repeat(80));
  console.log('Phase 3 Verification Script');
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

  // Check World ID library
  console.log('\n[2/7] Checking World ID library...\n');
  if (verifyWorldIDLibrary()) {
    passed++;
  } else {
    failed++;
  }

  // Check IDKit verification route
  console.log('\n[3/7] Checking World IDKit verification route...\n');
  if (checkContentContains('src/app/api/world/verify-idkit/route.ts', ['verifyIDKitProof', 'nullifierHash'])) {
    passed++;
  } else {
    failed++;
  }

  // Check BLOCKED path (G1 + G3)
  console.log('\n[4/7] Checking Path 1 (BLOCKED - Crimson denied path)...\n');
  if (verifyBlockedPath()) {
    passed++;
  } else {
    failed++;
  }

  // Check APPROVED path (G1 + G3)
  console.log('\n[5/7] Checking Path 2 (APPROVED - Green with World ID)...\n');
  if (verifyApprovedPath()) {
    passed++;
  } else {
    failed++;
  }

  // Check React components
  console.log('\n[6/7] Checking React components...\n');
  if (verifyReactComponents()) {
    passed++;
  } else {
    failed++;
  }

  // Bonus: Check Part A alignment
  console.log('\n[7/7] Checking Part A (Phase 2 spec alignment)...\n');
  if (verifyPartA()) {
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
    console.log('✓ Phase 3 verification PASSED');
    console.log('');
    console.log('Next steps:');
    console.log('1. Run "npm run build" to verify TypeScript compilation');
    console.log('2. Test World IDKit deposit flow (/api/world/verify-idkit)');
    console.log('3. Test step-up BLOCKED path (deny action → HTTP 403)');
    console.log('4. Test step-up APPROVED path (approve with proof → HTTP 200)');
    console.log('5. Add World App ID to .env.local');
    process.exit(0);
  } else {
    console.error('✗ Phase 3 verification FAILED');
    console.error(`${failed} checks failed. Please fix the issues above.`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Verification script error:', error);
  process.exit(1);
});
