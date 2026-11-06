/**
 * Untouched Smart Contract ABIs
 * Generated from Arc Studio deployment
 */

export const MockUSYCOracleABI = [
  {
    type: 'function',
    name: 'latestRoundData',
    inputs: [],
    outputs: [
      { name: '', type: 'uint80', internalType: 'uint80' },
      { name: '', type: 'int256', internalType: 'int256' },
      { name: '', type: 'uint256', internalType: 'uint256' },
      { name: '', type: 'uint256', internalType: 'uint256' },
      { name: '', type: 'uint80', internalType: 'uint80' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'currentNav',
    inputs: [],
    outputs: [{ name: '', type: 'int256', internalType: 'int256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'decimals',
    inputs: [],
    outputs: [{ name: '', type: 'uint8', internalType: 'uint8' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'simulateDaysPassed',
    inputs: [{ name: 'daysCount', type: 'uint256', internalType: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'NavUpdated',
    inputs: [
      { name: 'roundId', type: 'uint80', indexed: false },
      { name: 'newNav', type: 'int256', indexed: false },
      { name: 'daysSimulated', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },
] as const;

export const PrincipalCreditVaultABI = [
  {
    type: 'constructor',
    inputs: [
      { name: '_usdc', type: 'address', internalType: 'address' },
      { name: '_usycOracle', type: 'address', internalType: 'address' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'MIN_DEPOSIT_USDC',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'GAS_BUFFER_USDC',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'fundReservePool',
    inputs: [{ name: 'amountUsdc', type: 'uint256', internalType: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'fundYieldBacking',
    inputs: [{ name: 'amountUsdc', type: 'uint256', internalType: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'depositWithCreditAdvance',
    inputs: [
      { name: 'amountUsdc', type: 'uint256', internalType: 'uint256' },
      { name: 'agentSignerEOA', type: 'address', internalType: 'address' },
      { name: 'nullifier', type: 'bytes32', internalType: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getAccruedSurplusUsdc',
    inputs: [{ name: 'user', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'reconcileAndRepay',
    inputs: [{ name: 'user', type: 'address', internalType: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'withdrawPrincipal',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'updateSpendPolicy',
    inputs: [
      { name: 'newMaxPerCallUsdc', type: 'uint256', internalType: 'uint256' },
      { name: 'newAgentSignerEOA', type: 'address', internalType: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'positions',
    inputs: [{ name: '', type: 'address', internalType: 'address' }],
    outputs: [
      { name: 'principalUsdc', type: 'uint256', internalType: 'uint256' },
      { name: 'shares', type: 'uint256', internalType: 'uint256' },
      { name: 'maxPerCallUsdc', type: 'uint256', internalType: 'uint256' },
      { name: 'agentSignerEOA', type: 'address', internalType: 'address' },
      { name: 'unpaidAdvanceUsdc', type: 'uint256', internalType: 'uint256' },
      { name: 'nullifier', type: 'bytes32', internalType: 'bytes32' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'creditReservePool',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'yieldBackingUsdc',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'DepositWithAdvance',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'principalUsdc', type: 'uint256', indexed: false },
      { name: 'advanceUsdc', type: 'uint256', indexed: false },
      { name: 'shares', type: 'uint256', indexed: false },
      { name: 'agentSignerEOA', type: 'address', indexed: false },
      { name: 'nullifier', type: 'bytes32', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'YieldReconciled',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'surplusUsdc', type: 'uint256', indexed: false },
      { name: 'repaidUsdc', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'PrincipalWithdrawn',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'payoutUsdc', type: 'uint256', indexed: false },
      { name: 'unpaidShortfallUsdc', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },
] as const;
