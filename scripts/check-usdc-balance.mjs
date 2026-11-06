#!/usr/bin/env node
/**
 * Check USDC balance with different contract addresses
 * This helps debug which USDC contract is the real one
 */

import { ethers } from 'ethers';

const RPC = 'https://rpc.testnet.arc.network';
const WALLET_ADDRESS = process.argv[2];

if (!WALLET_ADDRESS) {
  console.error('Usage: node scripts/check-usdc-balance.mjs <wallet-address>');
  process.exit(1);
}

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
];

// Common USDC addresses to try
const USDC_CANDIDATES = [
  '0x3600000000000000000000000000000000000000', // Current (likely wrong)
  '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d', // Common testnet USDC
  '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // Sepolia USDC
  '0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8', // Another common testnet
];

async function checkBalance(address) {
  const provider = new ethers.providers.JsonRpcProvider(RPC);
  
  console.log(`\n🔍 Checking USDC at: ${address}`);
  console.log(`   Wallet: ${WALLET_ADDRESS}\n`);
  
  for (const usdcAddress of USDC_CANDIDATES) {
    try {
      const contract = new ethers.Contract(usdcAddress, ERC20_ABI, provider);
      
      const [balance, decimals, symbol, name] = await Promise.all([
        contract.balanceOf(WALLET_ADDRESS),
        contract.decimals(),
        contract.symbol(),
        contract.name(),
      ]);
      
      const formatted = ethers.utils.formatUnits(balance, decimals);
      
      console.log(`✅ ${usdcAddress}`);
      console.log(`   Name: ${name}`);
      console.log(`   Symbol: ${symbol}`);
      console.log(`   Balance: ${formatted} ${symbol}`);
      console.log(`   Raw: ${balance.toString()}`);
      
      if (parseFloat(formatted) > 0) {
        console.log(`   🎉 FOUND BALANCE! Use this address in .env.local`);
      }
      console.log('');
    } catch (error) {
      console.log(`❌ ${usdcAddress} - Not a valid ERC20 or network error`);
      console.log(`   Error: ${error.message}\n`);
    }
  }
}

checkBalance(WALLET_ADDRESS);
