# Untouched — Complete Technology Stack & Tool Guide

The stack is Arc for settlement and a Next.js gateway in front of the LLM providers.

---

## 1. Blockchain & Smart Contract Layer

| Tool / Primitive | Version / Address | Exact Role in Untouched |
| :--- | :--- | :--- |
| **Arc Testnet** | Chain ID: `5042002` (`eip155:5042002`)<br>RPC: `https://rpc.testnet.arc.network` | Primary L1 execution environment offering `<0.5s` deterministic finality and USDC-native gas fees. |
| **Arc Studio** | `https://studio.arc.com` | **Mandatory for Arc Bounties.** AI-assisted Web IDE used to prompt, generate, test, and deploy `PrincipalCreditVault.sol` and `MockUSYCOracle.sol`. |
| **Arc Testnet USDC** | `0x3600000000000000000000000000000000000000` | Base deposit asset (`$50.00` principal) and Nanopayment settlement asset (`$0.095` credit advance). |
| **Circle GatewayWallet** | `0x0077777d7EBA4688BDeF3E311b846F25870A19B9` (Arc Testnet) | Official Circle contract holding the isolated Agent Signer EOA's funded `$0.095` Nanopayment balance. |

---

## 2. Payments, Discovery & Agent Infrastructure (Arc / Circle Stack)

| Tool / SDK | Package / Endpoint | Exact Role in Untouched |
| :--- | :--- | :--- |
| **Circle x402 Batching SDK (Client)** | `@circle-fin/x402-batching/client` (`GatewayClient`) | Used by our isolated **Agent Signer EOA** to deposit the `$0.095` credit advance into `GatewayWallet` and sign gasless EIP-3009 (`TransferWithAuthorization`) Nanopayments per prompt. |
| **Circle x402 Batching SDK (Server)** | `@circle-fin/x402-batching/server` (`BatchFacilitatorClient`) | Wraps our `/api/v1/chat/completions` proxy to verify and settle offchain EIP-3009 signatures in `<0.5s` with zero gas cost. |
| **Arc Marketplace Discovery API** | `GET https://api.circle.com/v2/x402/discovery/resources?supportsCircleGateway=true` | Public Circle endpoint queried by our gateway to discover live x402 tools (`WEB_SEARCH_RESEARCH`, `CREATIVE`, `PREDICTION_MARKETS`, `FINANCIAL_ANALYSIS`) and inspect their `accepts` payment schema. |

---

## 3. Full-Stack Web, Proxy & Real-Time Sync

| Tool / Library | Purpose |
| :--- | :--- |
| **Next.js 15 (App Router, TypeScript)** | Unified full-stack app hosting the PC Dashboard (`/dashboard`), Mobile Companion (`/mobile`), Split-Screen Judge View (`/demo`), and API routes (`/api/v1/chat/completions`). |
| **Viem & Wagmi (`viem`, `wagmi`)** | Wallet connection for user's main wallet (`$50 USDC` deposit) AND backend management of the isolated **Agent Signer EOA** (`privateKeyToAccount`). |
| **OpenAI / OpenRouter SDK (`openai`)** | Used inside `/api/v1/chat/completions` after Nanopayment verification to stream real responses from GPT-4o-mini, Claude 3.5 Haiku, or DeepSeek (with graceful fallback mock streaming if offline). |
| **Tailwind CSS + Lucide Icons + Framer Motion** | High-craft dark-mode fintech UI, smooth battery depletion/refill animations, and slide-up mobile approval modals. |
| **Server-Sent Events (SSE) / In-Memory State Bus** | Pushes receipts and balance updates to the dashboard and the mobile vault. |