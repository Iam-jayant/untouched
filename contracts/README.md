# Untouched Smart Contracts

> **Deploy via Arc Studio:** `studio.arc.com`

## Contracts

### MockUSYCOracle.sol
Mock Chainlink `AggregatorV3Interface` for simulating USYC yield (5% APY).

### PrincipalCreditVault.sol  
Principal-protected vault with credit advance system. Supports flexible deposits ≥ $10 USDC.

## Phase 1 Deployment Checklist

- [x] Deploy `MockUSYCOracle.sol` via Arc Studio
- [x] Deploy `PrincipalCreditVault.sol` via Arc Studio
- [x] Save shareable Arc Studio project URL
- [x] Export ABIs + addresses to `src/lib/contracts.ts`
- [ ] Fund CreditReservePool via `fundReservePool()` (manual step)

## Arc Studio Project URL

✅ **Deployed Successfully!**

```
https://studio.arc.io/app/e166ba52-040b-406f-9cbe-c212384294e4
```

### Deployment Details

**MockUSYCOracle:**
- Address: `0x3cc26da603767966929c57f9b5c69030feaac4bf`
- Explorer: https://explorer.testnet.arc.io/address/0x3cc26da603767966929c57f9b5c69030feaac4bf
- Deployed: 2026-11-01T07:26:03.325Z

**PrincipalCreditVault:**
- Address: `0x649a09b10c70fffe9ef5f8d70e5a7de292b793df`
- Explorer: https://explorer.testnet.arc.io/address/0x649a09b10c70fffe9ef5f8d70e5a7de292b793df
- Deployed: 2026-11-01T07:26:10.122Z

### Tests

✅ **38 Foundry tests passing** (all scenarios verified)

### Integration

Contracts are now integrated into the Next.js app:
- `src/lib/contracts.ts` — Deployment addresses & chain config
- `src/lib/abi.ts` — Typed ABIs for viem/wagmi
- `.env.local` — Environment variables updated
