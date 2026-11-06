/**
 * Chainlink CRE - USYC Yield Reconciliation
 * 
 * This script runs every 6 hours via Chainlink CronTrigger to:
 * 1. Read USYC NAV from MockUSYCOracle
 * 2. Calculate accrued surplus in PrincipalCreditVault
 * 3. Call reconcileAndRepay() to repay the Credit Reserve Pool
 * 
 * Arc Testnet (Chain ID: 5042002)
 * - MockUSYCOracle: 0x3cc26da603767966929c57f9b5c69030feaac4bf
 * - PrincipalCreditVault: 0x649a09b10c70fffe9ef5f8d70e5a7de292b793df
 */

import { ethers } from 'ethers';

// Contract ABIs
const ORACLE_ABI = [
  'function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
];

const VAULT_ABI = [
  'function getAccruedSurplusUsdc() external view returns (uint256)',
  'function reconcileAndRepay(address user) external returns (uint256 repaidAmount)',
  'function totalPrincipalUsdc() external view returns (uint256)',
  'function totalAdvanceUsdc() external view returns (uint256)',
];

// Configuration
const ARC_TESTNET_RPC = process.env.ARC_TESTNET_RPC || 'https://sepolia.arc.io';
const USYC_ORACLE_ADDRESS = '0x3cc26da603767966929c57f9b5c69030feaac4bf';
const VAULT_ADDRESS = '0x649a09b10c70fffe9ef5f8d70e5a7de292b793df';
const MIN_SURPLUS_THRESHOLD_USDC = 1_000000; // $1 minimum (6-decimal USDC)

/**
 * Main reconciliation function
 */
export async function reconcileYield() {
  console.log('[CRE] Starting USYC yield reconciliation...');

  // Connect to Arc Testnet
  const provider = new ethers.JsonRpcProvider(ARC_TESTNET_RPC);
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

  // Initialize contracts
  const oracle = new ethers.Contract(USYC_ORACLE_ADDRESS, ORACLE_ABI, provider);
  const vault = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, signer);

  try {
    // Step 1: Read USYC NAV from oracle
    const [, answer] = await oracle.latestRoundData();
    const usycNav = Number(answer) / 1e8; // Oracle returns 8-decimal price
    console.log(`[CRE] Current USYC NAV: $${usycNav.toFixed(8)}`);

    // Step 2: Read accrued surplus from vault
    const surplusUsdc = await vault.getAccruedSurplusUsdc();
    const surplusUSD = Number(surplusUsdc) / 1_000000;
    console.log(`[CRE] Accrued Surplus: $${surplusUSD.toFixed(6)} USDC`);

    // Step 3: Check if surplus meets threshold
    if (Number(surplusUsdc) < MIN_SURPLUS_THRESHOLD_USDC) {
      console.log(`[CRE] Surplus below threshold ($${(MIN_SURPLUS_THRESHOLD_USDC / 1_000000).toFixed(2)}). Skipping reconciliation.`);
      return {
        success: true,
        skipped: true,
        reason: 'Below threshold',
        surplusUsdc: Number(surplusUsdc),
      };
    }

    // Step 4: Read vault stats
    const totalPrincipal = await vault.totalPrincipalUsdc();
    const totalAdvance = await vault.totalAdvanceUsdc();
    console.log(`[CRE] Total Principal: $${(Number(totalPrincipal) / 1_000000).toFixed(2)}`);
    console.log(`[CRE] Total Advance: $${(Number(totalAdvance) / 1_000000).toFixed(6)}`);

    // Step 5: Call reconcileAndRepay() for each user
    // In production, this would iterate through all users
    // For demo, we use msg.sender (Chainlink node wallet)
    console.log('[CRE] Calling reconcileAndRepay()...');
    const tx = await vault.reconcileAndRepay(signer.address);
    const receipt = await tx.wait();

    console.log(`[CRE] ✅ Reconciliation complete!`);
    console.log(`[CRE] Transaction: ${receipt.hash}`);
    console.log(`[CRE] Gas used: ${receipt.gasUsed.toString()}`);

    return {
      success: true,
      txHash: receipt.hash,
      gasUsed: receipt.gasUsed.toString(),
      surplusUsdc: Number(surplusUsdc),
      usycNav,
    };
  } catch (error) {
    console.error('[CRE] ❌ Reconciliation failed:', error);
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

// Run if executed directly
if (require.main === module) {
  reconcileYield()
    .then((result) => {
      console.log('[CRE] Result:', JSON.stringify(result, null, 2));
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('[CRE] Fatal error:', error);
      process.exit(1);
    });
}
