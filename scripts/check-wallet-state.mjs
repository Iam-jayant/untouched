#!/usr/bin/env node
/**
 * Check Wallet State on Arc Testnet
 * 
 * Reads actual blockchain state for a wallet:
 * - USDC balance
 * - Vault position (principal, shares, unpaid advance)
 */

import { ethers } from 'ethers';

const WALLET_ADDRESS = '0xce86a572686F22E7D1B9f6763c7B695F79762854';
const VAULT_ADDRESS = '0x649a09b10c70fffe9ef5f8d70e5a7de292b793df';
const USDC_ADDRESS = '0x3600000000000000000000000000000000000000';
const RPC_URL = 'https://rpc.testnet.arc.network';

const VAULT_ABI = [
  'function positions(address) view returns (uint256 principalUsdc, uint256 shares, uint256 maxPerCallUsdc, address agentSignerEOA, uint256 unpaidAdvanceUsdc, bytes32 nullifier)',
];

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
];

async function checkWallet() {
  console.log('🔍 Checking wallet state on Arc Testnet...\n');
  console.log('Wallet:', WALLET_ADDRESS);
  console.log('Vault:', VAULT_ADDRESS);
  console.log('USDC:', USDC_ADDRESS);
  console.log('RPC:', RPC_URL);
  console.log('─'.repeat(80));

  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);

  try {
    // Check USDC balance
    const usdcContract = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, provider);
    const usdcBalance = await usdcContract.balanceOf(WALLET_ADDRESS);
    const usdcDecimals = await usdcContract.decimals();
    const usdcSymbol = await usdcContract.symbol();
    
    console.log('\n💰 USDC Balance:');
    console.log('  Raw:', usdcBalance.toString());
    console.log('  Formatted:', ethers.utils.formatUnits(usdcBalance, usdcDecimals), usdcSymbol);

    // Check vault position
    const vaultContract = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, provider);
    const position = await vaultContract.positions(WALLET_ADDRESS);

    console.log('\n🏦 Vault Position:');
    console.log('  Principal USDC:', ethers.utils.formatUnits(position.principalUsdc, 6));
    console.log('  Shares:', position.shares.toString());
    console.log('  Max Per Call USDC:', ethers.utils.formatUnits(position.maxPerCallUsdc, 6));
    console.log('  Agent Signer EOA:', position.agentSignerEOA);
    console.log('  Unpaid Advance USDC:', ethers.utils.formatUnits(position.unpaidAdvanceUsdc, 6));
    console.log('  Nullifier:', position.nullifier);

    // Calculate estimated advance (5% APY * 14 days)
    const principalFloat = parseFloat(ethers.utils.formatUnits(position.principalUsdc, 6));
    const unpaidFloat = parseFloat(ethers.utils.formatUnits(position.unpaidAdvanceUsdc, 6));
    const estimatedAdvance = principalFloat * 0.05 * 14 / 365;
    const remaining = Math.max(0, estimatedAdvance - unpaidFloat);

    console.log('\n📊 Calculated Balances:');
    console.log('  Estimated Advance (5% APY * 14 days):', estimatedAdvance.toFixed(6), 'USDC');
    console.log('  Unpaid Advance:', unpaidFloat.toFixed(6), 'USDC');
    console.log('  Remaining Battery:', remaining.toFixed(6), 'USDC');

    console.log('\n✅ Blockchain state read successfully!');
  } catch (error) {
    console.error('\n❌ Error reading blockchain:', error.message);
    process.exit(1);
  }
}

checkWallet();
