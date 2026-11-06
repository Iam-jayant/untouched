#!/usr/bin/env node
/**
 * Fund the vault reserve pool
 * Usage: node scripts/fund-reserve-pool.mjs <private-key> <amount-usdc>
 */

import { ethers } from 'ethers';

const RPC = 'https://rpc.testnet.arc.network';
const VAULT_ADDRESS = '0x649a09b10c70fffe9ef5f8d70e5a7de292b793df';
const USDC_ADDRESS = '0x3600000000000000000000000000000000000000';

const VAULT_ABI = [
  'function fundReservePool(uint256 amountUsdc)',
  'function creditReservePool() view returns (uint256)',
];

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

async function fundReserve(privateKey, amountUsdc) {
  const provider = new ethers.providers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(privateKey, provider);
  
  console.log('💰 Funding Vault Reserve Pool\n');
  console.log('Your address:', wallet.address);
  console.log('Amount:', amountUsdc, 'USDC\n');
  
  const vaultContract = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, wallet);
  const usdcContract = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, wallet);
  
  // Check balance
  console.log('1️⃣ Checking your USDC balance...');
  const balance = await usdcContract.balanceOf(wallet.address);
  const balanceFormatted = ethers.utils.formatUnits(balance, 6);
  console.log('   Balance:', balanceFormatted, 'USDC');
  
  if (parseFloat(balanceFormatted) < amountUsdc) {
    console.log('   ❌ Insufficient USDC balance!\n');
    return;
  }
  console.log('   ✅ Sufficient balance\n');
  
  // Check allowance
  console.log('2️⃣ Checking USDC allowance...');
  const allowance = await usdcContract.allowance(wallet.address, VAULT_ADDRESS);
  const amountWei = ethers.utils.parseUnits(amountUsdc.toString(), 6);
  
  if (allowance.lt(amountWei)) {
    console.log('   Need to approve USDC...');
    const approveTx = await usdcContract.approve(VAULT_ADDRESS, amountWei);
    console.log('   Approval tx:', approveTx.hash);
    await approveTx.wait();
    console.log('   ✅ Approved\n');
  } else {
    console.log('   ✅ Already approved\n');
  }
  
  // Fund reserve pool
  console.log('3️⃣ Funding reserve pool...');
  const fundTx = await vaultContract.fundReservePool(amountWei);
  console.log('   Transaction:', fundTx.hash);
  console.log('   Waiting for confirmation...');
  const receipt = await fundTx.wait();
  console.log('   ✅ Confirmed in block:', receipt.blockNumber, '\n');
  
  // Check new balance
  console.log('4️⃣ Checking new reserve pool balance...');
  const newReserve = await vaultContract.creditReservePool();
  console.log('   Reserve pool:', ethers.utils.formatUnits(newReserve, 6), 'USDC');
  console.log('\n✅ Reserve pool funded successfully!');
  console.log('   Users can now deposit!\n');
}

// Parse command line arguments
const privateKey = process.argv[2];
const amount = parseFloat(process.argv[3]);

if (!privateKey || !amount) {
  console.error('Usage: node scripts/fund-reserve-pool.mjs <private-key> <amount-usdc>');
  console.error('Example: node scripts/fund-reserve-pool.mjs 0x123... 10000');
  process.exit(1);
}

fundReserve(privateKey, amount).catch(console.error);
