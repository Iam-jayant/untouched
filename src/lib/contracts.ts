/**
 * Deployed Untouched smart contracts on Arc Testnet (Chain ID: 5042002)
 * 
 * Deployed via Arc Studio: https://studio.arc.io/app/e166ba52-040b-406f-9cbe-c212384294e4
 * 
 * Phase 1 deployment addresses (Arc Testnet)
 */

export const CONTRACTS = {
  MockUSYCOracle: {
    address: '0x3cc26da603767966929c57f9b5c69030feaac4bf' as `0x${string}`,
    explorer: 'https://explorer.testnet.arc.io/address/0x3cc26da603767966929c57f9b5c69030feaac4bf',
    deployedAt: '2026-11-01T07:26:03.325Z',
  },
  PrincipalCreditVault: {
    address: '0x649a09b10c70fffe9ef5f8d70e5a7de292b793df' as `0x${string}`,
    explorer: 'https://explorer.testnet.arc.io/address/0x649a09b10c70fffe9ef5f8d70e5a7de292b793df',
    deployedAt: '2026-11-01T07:26:10.122Z',
  },
} as const;

export const ARC_TESTNET_CONFIG = {
  chainId: 5042002,
  name: 'Arc Testnet',
  rpcUrl: 'https://rpc.testnet.arc.network',
  explorerUrl: 'https://explorer.testnet.arc.io',
  nativeCurrency: {
    name: 'USDC',
    symbol: 'USDC',
    decimals: 6,
  },
  usdc: '0x3600000000000000000000000000000000000000' as `0x${string}`,
  gatewayWallet: '0x0077777d7EBA4688BDeF3E311b846F25870A19B9' as `0x${string}`,
} as const;
