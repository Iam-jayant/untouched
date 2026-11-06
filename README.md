# Untouched

OpenAI-compatible API gateway. Deposit USDC on Arc Testnet, get an API key, and prompts spend a prepaid yield balance. The deposit itself stays in the vault.

A $50 deposit at 5% APY advances about $0.0959 for 14 days. Calls that exceed the per-call cap, or the remaining balance, are rejected and cost nothing.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

- Landing: http://localhost:3000/landing
- Dashboard: http://localhost:3000/dashboard
- Mobile vault: http://localhost:3000/mobile

Put at least one LLM key in `.env.local` (`OPENROUTER_API_KEY`, `GROQ_API_KEY`, or `GEMINI_API_KEY`). Without Supabase, vault state stays in memory.

## Call the API

```bash
curl -X POST http://localhost:3000/api/v1/chat/completions \
  -H "Authorization: Bearer unt_live_demo_key" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"Hello"}]}'
```

Use the same request shape as the OpenAI Chat Completions API. Point an OpenAI SDK at `http://localhost:3000/api/v1`.

| Status | Meaning |
| --- | --- |
| 200 | Call completed and the yield balance was charged |
| 402 | Yield balance cannot cover the estimate |
| 403 | Estimate is over the per-call cap. Nothing was spent |
| 401 | Missing or unknown API key |

Other routes: `POST /api/vault/deposit`, `POST /api/vault/withdraw`, `GET /api/vault/status`, `GET /api/events` (SSE), `POST /api/vault/simulate` (fast-forward yield in dev).

## Contracts

Arc Testnet, chain id `5042002`. RPC `https://rpc.testnet.arc.network`.

| Contract | Address |
| --- | --- |
| PrincipalCreditVault | `0x649a09b10c70fffe9ef5f8d70e5a7de292b793df` |
| MockUSYCOracle | `0x3cc26da603767966929c57f9b5c69030feaac4bf` |
| USDC | `0x3600000000000000000000000000000000000000` |

Source, tests, and the deploy script are in `contracts/`. Yield reconciliation for Chainlink CRE is in `cre-workflow/`.

Deposits call `depositWithCreditAdvance(amount, agentSigner, nullifier)`. The nullifier must be unique and nonzero. The copy deployed above was compiled when that argument was named `worldIdNullifier` and the getter was `usedWorldIdNullifiers`. The selectors for deposit, positions, and withdraw are unchanged. Call `usedWorldIdNullifiers` on that deployment; call `usedNullifiers` only after redeploying this source.

## Environment

See `.env.example`.

| Variable | Required |
| --- | --- |
| `OPENROUTER_API_KEY`, `GROQ_API_KEY`, or `GEMINI_API_KEY` | One provider key |
| `NEXT_PUBLIC_VAULT_ADDRESS`, `NEXT_PUBLIC_ORACLE_ADDRESS` | Yes, for on-chain deposits |
| `AGENT_SIGNER_PRIVATE_KEY` | Yes, for the backend signer |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | No. Omit them for in-memory state |

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run verify:phase2
```
