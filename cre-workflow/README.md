# Chainlink Runtime Environment (CRE) Workflow

## Overview

This workflow automates USYC Treasury yield reconciliation on Arc Testnet using Chainlink's decentralized off-chain computation platform.

## How It Works

### 1. Trigger (Every 6 Hours)

```yaml
triggers:
  - type: cron
    schedule: "0 */6 * * *"
```

Chainlink CRE executes the workflow every 6 hours at:
- 00:00 UTC
- 06:00 UTC
- 12:00 UTC
- 18:00 UTC

### 2. Data Sources (EVM Read)

#### A. Read USYC NAV from Oracle

```solidity
MockUSYCOracle.latestRoundData()
// Returns: (uint80 roundId, int256 answer, ...)
// Example: answer = 100191780 (8-decimal) = $1.00191780
```

**Contract:** `0x3cc26da603767966929c57f9b5c69030feaac4bf`

#### B. Read Accrued Surplus from Vault

```solidity
PrincipalCreditVault.getAccruedSurplusUsdc()
// Returns: uint256 surplusUsdc (6-decimal USDC)
// Example: 95890 = $0.095890
```

**Contract:** `0x649a09b10c70fffe9ef5f8d70e5a7de292b793df`

### 3. Consensus (Chainlink OCR)

```yaml
consensus:
  type: chainlink-ocr
  participants: 4
  threshold: 3
```

- **4 Chainlink nodes** independently read data sources
- **3-of-4 consensus** required to proceed
- Prevents single point of failure or manipulation

### 4. Action (EVM Write)

If surplus ≥ $1 (threshold), execute:

```solidity
PrincipalCreditVault.reconcileAndRepay(address user)
```

This on-chain function:
1. Calculates USYC yield since last reconciliation
2. Repays the Credit Reserve Pool (battery replenishment)
3. Emits `YieldReconciled(user, repaidAmount, newNav)` event

## Arc Testnet Deployment

**Chain ID:** 5042002  
**RPC:** https://sepolia.arc.io

| Contract | Address |
|----------|---------|
| MockUSYCOracle | `0x3cc26da603767966929c57f9b5c69030feaac4bf` |
| PrincipalCreditVault | `0x649a09b10c70fffe9ef5f8d70e5a7de292b793df` |
| Circle Gateway Wallet | `0x0077777d7EBA4688BDeF3E311b846F25870A19B9` |

## Local Testing

### Simulate Fast-Forward 14 Days

The `/api/vault/simulate` endpoint provides instant yield reconciliation for testing:

```bash
curl -X POST http://localhost:3000/api/vault/simulate \
  -H "Authorization: Bearer unt_live_demo_key" \
  -H "Content-Type: application/json"
```

**Response:**

```json
{
  "success": true,
  "message": "⏩ Fast-forwarded 14 days: Chainlink CRE reconciled USYC yield and repaid Credit Reserve Pool",
  "principal": 50000000,
  "principalUSD": 50.0,
  "batteryBefore": 12345,
  "batteryAfter": 95890,
  "batteryReplenished": 83545,
  "usycNavBefore": 1.0,
  "usycNavAfter": 1.00191780,
  "usycYield": 0.00191780
}
```

### Run CRE Script Locally

```bash
cd cre-workflow
npm install ethers
export ARC_TESTNET_RPC="https://sepolia.arc.io"
export PRIVATE_KEY="your_private_key_here"
npx ts-node src/reconcile-yield.ts
```

**Output:**

```
[CRE] Starting USYC yield reconciliation...
[CRE] Current USYC NAV: $1.00191780
[CRE] Accrued Surplus: $0.095890 USDC
[CRE] Total Principal: $50.00
[CRE] Total Advance: $0.095890
[CRE] Calling reconcileAndRepay()...
[CRE] ✅ Reconciliation complete!
[CRE] Transaction: 0x1234...
[CRE] Gas used: 123456
```

## Integration with Dashboard

The Dashboard's **"⏩ Fast-Forward 14 Days"** button simulates this workflow:

1. User clicks button
2. Frontend calls `POST /api/vault/simulate` with apiKey
3. Backend resets `user.remaining` to full battery capacity
4. SSE broadcasts `balance_update` event
5. Dashboard shows replenished battery + USYC NAV increase

This provides instant feedback for demos without waiting 6 hours.

## Revenue Model

USYC yields **5.0% APY** from US Treasury holdings. Untouched captures:

- **25 bps** (0.25%) Treasury yield spread
- **15%** wholesale-to-retail x402 compute margin
- **5%** yield advance origination fee

Example (14-day period):

| Metric | Value |
|--------|-------|
| Principal | $50.00 |
| USYC Yield (5% APY × 14 days) | $0.095890 |
| Battery Replenished | $0.095890 |
| Untouched Revenue (25 bps) | $0.000240 |

## Production Deployment

### 1. Deploy to Chainlink Functions

```bash
npx hardhat functions-deploy-client --network arc-testnet
```

### 2. Register CronTrigger

```bash
npx hardhat functions-register-trigger \
  --schedule "0 */6 * * *" \
  --workflow workflow.yaml
```

### 3. Monitor Execution

```bash
npx hardhat functions-read-logs --network arc-testnet
```

## Security Considerations

1. **Decentralized Oracle Network**: Chainlink OCR prevents single point of failure
2. **Threshold Consensus**: 3-of-4 nodes must agree on data
3. **On-Chain Verification**: Vault contract validates all inputs
4. **Gas Limit**: 200,000 gas cap prevents runaway execution
5. **Min Threshold**: $1 surplus required to trigger reconciliation

## Links

- [Chainlink Functions Docs](https://docs.chain.link/chainlink-functions)
- [Arc Testnet Explorer](https://arc-testnet.explorer.io)
- [USYC Documentation](https://www.circle.com/usyc)
