# Chainlink CRE yield reconciliation

This workflow reads Arc Testnet and the Untouched spend ledger, then prepares `reconcile(address,uint256)` on the vault. It does not use a price feed.

## Trigger

Every 6 hours:

```yaml
triggers:
  - type: cron
    schedule: "0 */6 * * *"
```

## Reads

| Source | What it reads |
| --- | --- |
| Vault | `depositorCount()`, `depositors(uint256)`, `positions(address)` on `0xcA9F8D931b6a0dE64ED74757A66aCB203413f2C1` |
| USYC | `balanceOf(vault)` on official USYC `0xe9185f0c5f296ed1797aae4238d26ccabeadb86c` |
| Ledger | `GET /api/v1/ledger`, the gateway's off-chain spend record |

Arc Testnet is chain id `5042002`. RPC is `https://rpc.testnet.arc.network`. Calls are single JSON-RPC requests because the public Arc RPC rejects batched calls.

## Write

When a depositor has used yield and the vault holds USYC, the workflow calls:

```solidity
reconcile(address user, uint256 surplus6Dec)
```

Only `creCaller` can call it. The call restores used credit and emits `Reconciled`.

## Files

- `workflow.yaml` — trigger, reads, and the reconcile action
- `src/reconcile-yield.ts` — the same reads and the write
- `simulate.mjs` — local read of the vault, USYC, and chain head

The Arc Studio copy of this vault is `0x494ef27eb33165407982ffc024c8d992f20dfa9f`. Its `creCaller` is the Studio deployer, so this workflow targets the live app vault.
