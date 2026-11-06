#!/usr/bin/env node
/**
 * Check vault reserve pool status
 */

import { ethers } from 'ethers';

const RPC = 'https://rpc.testnet.arc.network';
const VAULT_ADDRESS = '0x649a09b10c70fffe9ef5f8d70e5a7de292b793df';

const VAULT_ABI = [
  'function creditReservePool() view returns (uint256)',
  'function yieldBackingUsdc() view returns (uint256)',
  'function fundReservePool(uint256 amountUsdc)',
  'function fundYieldBacking(uint256 amountUsdc)',
  'function owner() view returns (address)',
];

async function checkReserves() {
  const provider = new ethers.providers.JsonRpcProvider(RPC);
  const vaultContract = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, provider);
  
  console.log('🏦 Vault Reserve Pool Status\n');
  console.log('Vault:', VAULT_ADDRESS, '\n');
  
  try {
    const [creditPool, yieldBacking, owner] = await Promise.all([
      vaultContract.creditReservePool(),
      vaultContract.yieldBackingUsdc(),
      vaultContract.owner(),
    ]);
    
    console.log('📊 Current Status:');
    console.log('  Credit Reserve Pool:', ethers.utils.formatUnits(creditPool, 6), 'USDC');
    console.log('  Yield Backing:', ethers.utils.formatUnits(yieldBacking, 6), 'USDC');
    console.log('  Owner:', owner);
    console.log('');
    
    if (creditPool.eq(0)) {
      console.log('❌ PROBLEM: Credit Reserve Pool is EMPTY!');
      console.log('');
      console.log('💡 Solution:');
      console.log('  The vault owner needs to fund the reserve pool.');
      console.log('  They should call: vault.fundReservePool(amount)');
      console.log('');
      console.log('  Example: Fund with 10,000 USDC');
      console.log('  vault.fundReservePool(10000 * 1e6)');
      console.log('');
      console.log('  Or using cast (Foundry):');
      console.log(`  cast send ${VAULT_ADDRESS} "fundReservePool(uint256)" 10000000000 --private-key YOUR_KEY --rpc-url ${RPC}`);
      console.log('');
    } else {
      console.log('✅ Reserve pool has funds');
      
      // Estimate how many deposits it can handle
      const advancePerDeposit = 10 * 1e6 * 0.05 * (14 / 365) + 0.5 * 1e6; // ~$10 deposit advance + gas buffer
      const maxDeposits = Math.floor(creditPool / advancePerDeposit);
      console.log(`  Can handle ~${maxDeposits} deposits before needing refill`);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkReserves().catch(console.error);
