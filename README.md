# Untouched

Arc Studio workspace: https://studio.arc.io/app/34d39cc3-0fb6-4f0e-bb3b-503fe2e06425

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
  -d '{"model":"gemini-2.5-flash","messages":[{"role":"user","content":"Hello"}]}'
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

| Contract | Address | Role |
| --- | --- | --- |
| UntouchedVaultV2 | `0xcA9F8D931b6a0dE64ED74757A66aCB203413f2C1` | Live app. Stakes, yield battery, and `recordUsage` |
| UntouchedVaultV2 | `0x494ef27eb33165407982ffc024c8d992f20dfa9f` | Arc Studio deployment. [Explorer](https://testnet.arcscan.app/address/0x494ef27eb33165407982ffc024c8d992f20dfa9f) |
| USDC | `0x3600000000000000000000000000000000000000` | Arc native gas token and ERC-20 precompile |
| USYC | `0xe9185f0c5f296ed1797aae4238d26ccabeadb86c` | Official Arc USYC |

Source, tests, and the deploy script are in `contracts/`. The Arc Studio workspace compiled this vault, ran the 7 tests, and deployed the Studio copy. The live app keeps the earlier vault because that deployment holds existing stakes and its owner can record usage.

`depositNative()` stakes native USDC. `deposit(uint256)` stakes the 6-decimal ERC-20. Principal stays in the vault. The yield battery is 14 days at 5% APY: `(amount * 500 * 14) / (10000 * 365)`. `withdraw()` returns principal minus used credit.

## Environment

See `.env.example`.

| Variable | Required |
| --- | --- |
| `OPENROUTER_API_KEY`, `GROQ_API_KEY`, or `GEMINI_API_KEY` | One provider key |
| `NEXT_PUBLIC_VAULT_ADDRESS` | Yes, for on-chain deposits |
| `AGENT_SIGNER_PRIVATE_KEY` | Yes, for the backend signer |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | No. Omit them for in-memory state |

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run verify:phase2
```
