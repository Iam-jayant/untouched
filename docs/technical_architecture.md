# Untouched — Technical Architecture & System Flows

## 1. High-Level System Architecture

```
+-----------------------------------------------------------------------------------+
|                        CLIENT LAYER (REAL-TIME SYNC VIA SSE/WS)                   |
|                                                                                   |
|  +-------------------------------------+   +-----------------------------------+  |
|  |     PC DEVELOPER COMMAND CENTER     |   |    MOBILE REMOTE & APPROVAL APP   |  |
|  | - API Key & Base URL Config         |   | - Green Safe Box ($50.00 USDC)    |  |
|  | - Live Prompt / IDE Playground      |   | - Blue Yield Battery ($0.095)     |  |
|  | - Real-Time Telemetry & Cost Graph  |   | - Per-Call Spend Slider ($0.005)  |  |
|  | - Fast-Forward 14d Yield Simulator  |   | - Deposit, withdraw, spend cap    |  |
|  +------------------+------------------+   +-----------------+-----------------+  |
+---------------------|----------------------------------------|--------------------+
                      |                                        |
                      v                                        v
+-----------------------------------------------------------------------------------+
|                     UNTOUCHED NEXT.JS BACKEND & PROXY GATEWAY                     |
|                                                                                   |
|  1. /api/v1/chat/completions (OpenAI & Anthropic Compatible Proxy)                |
|  2. Policy Engine (Checks model cost vs. user Per-Prompt Limit: default $0.005)   |
|  3. Arc Marketplace Discovery Router (GET /v2/x402/discovery/resources)           |
|  4. Isolated Agent Signer Manager (Manages EOA private keys funded with $0.095)   |
|  5. Circle x402 Batch Facilitator (@circle-fin/x402-batching/server & client)     |
+---------------------+----------------------------------------+--------------------+
                      |                                        |
                      v                                        v
+-----------------------------------------+  +--------------------------------------+
|       ARC TESTNET (Chain ID: 5042002)   |  |   EXTERNAL INFRASTRUCTURE & ORACLES  |
|                                         |  |                                      |
| - PrincipalCreditVault.sol (Arc Studio) |  | - Circle GatewayWallet               |
| - MockUSYC & MockUSYCOracle.sol         |  |   (0x0077777d7EBA4688BDeF3E311...)   |
| - CreditReservePool (Fronts $0.095)     |  | - LLM providers (OpenRouter, Groq, Gemini) |
| - Arc USDC (0x360000...0000)            |  |                                      |
+-----------------------------------------+  +--------------------------------------+
```

---

## 2. Core Financial & Cryptographic Invariants

### A. Yield Math & 14-Day Credit Advance Formula
Given a principal deposit $P = 50.00\text{ USDC}$ and an annual percentage yield $r = 5\% = 0.05$:
$$\text{Daily Yield} = \frac{P \times r}{365} = \frac{50 \times 0.05}{365} \approx \$0.006849\text{ USDC/day}$$
$$\text{14-Day Advance } (A_{14}) = 50 \times 0.05 \times \frac{14}{365} \approx \$0.09589\text{ USDC} \rightarrow \text{Capped at }\$0.095000\text{ USDC}$$

### B. USYC Share NAV Accounting (No Staking Reward Tokens)
Real USYC accrues yield via rising token Net Asset Value (NAV) price, not separate reward distributions.
1. **At Deposit ($t_0$):** User deposits $P = 50.00\text{ USDC}$. Current oracle NAV price is $NAV_0 = \$1.000000$. User receives:
   $$\text{Shares} = \frac{P}{NAV_0} = 50.000000\text{ USYC Shares}$$
2. **Instant Advance ($t_0$):** The vault's `CreditReservePool` transfers $A_{14} = \$0.095000\text{ USDC}$ to the user's isolated **Agent Signer EOA**, which immediately deposits `$0.095000 USDC` into Circle's `GatewayWallet` (`0x0077777d7EBA4688BDeF3E311b846F25870A19B9`).
   * User's `unpaidAdvance` is recorded as `$0.095000 USDC`.
3. **After 14 Days ($t_{14}$):** Oracle NAV rises by $\approx 0.1917\%$ to $NAV_{14} = \$1.001918$.
   $$\text{Current Position Value } (V) = \text{Shares} \times NAV_{14} = 50.00 \times 1.001918 = \$50.095900\text{ USDC}$$
   $$\text{Redeemable Surplus } (S) = V - P = \$0.095900\text{ USDC}$$
4. **Reconciliation (`reconcileAndRepay`):**
   * Redeems $\frac{S}{NAV_{14}}$ shares for `$0.095900 USDC`.
   * Sends `$0.095000 USDC` back to `CreditReservePool` (setting `unpaidAdvance = 0`).
   * Forwards remaining surplus (`$0.000900 USDC`) + a fresh 14-day advance to the Agent Signer EOA's Gateway balance.
5. **Early Withdrawal Solvency Rule (`withdraw` before $t_{14}$):**
   * If a user withdraws when `unpaidAdvance > 0`, first apply any accrued surplus $S$ toward `unpaidAdvance`.
   * Let $\text{remainingDebt} = \max(0, \text{unpaidAdvance} - S)$.
   * User receives:
     $$\text{Withdrawable USDC} = P - \text{remainingDebt}$$
   * `CreditReservePool` receives $\text{remainingDebt}$, ensuring **zero protocol bad debt**.

---

## 3. Segregated Agent Signer EOA & Circle Nanopayments Flow
Circle Gateway Nanopayments (`@circle-fin/x402-batching`) require **EOA signatures** (`TransferWithAuthorization` / EIP-3009) and **do not support ERC-1271 smart contract signatures**.
* Therefore, when a user registers on Untouched, our backend generates an isolated **Agent Signer EOA** (`viem/accounts` `generatePrivateKey()`) mapped strictly to that user.
* That EOA **never** holds user principal and has zero allowance on `PrincipalCreditVault.sol`.
* It only holds the `$0.095 USDC` deposited into Circle's `GatewayWallet` on Arc Testnet (`eip155:5042002`).

---

## 4. End-to-End Request Lifecycle (`/api/v1/chat/completions`)

### Scenario A: Routine Prompt (`gpt-4o-mini` / `claude-3-5-haiku` — Cost `$0.001` <= `$0.005` Limit)
1. PC IDE (Cursor) or PC Web Dashboard sends `POST /api/v1/chat/completions` with `Authorization: Bearer unt_live_xxx`.
2. Gateway estimates cost (`$0.001 USDC`). Since `$0.001 <= user.maxPerCallLimit ($0.005)`, no human step-up is needed.
3. If tool-use/search is enabled, Gateway queries `GET https://api.circle.com/v2/x402/discovery/resources?supportsCircleGateway=true`, selects a matching resource (e.g., `WEB_SEARCH_RESEARCH`), and verifies its `accepts` array supports `eip155:5042002` / Circle Gateway.
4. The user's isolated **Agent Signer EOA** uses `GatewayClient` (`@circle-fin/x402-batching/client`) to sign an offchain EIP-3009 Nanopayment for `$0.001 USDC`.
5. Our server's `BatchFacilitatorClient` (`@circle-fin/x402-batching/server`) verifies and settles the payment via Circle Gateway.
6. LLM response streams back to PC; real-time event broadcasts to both **PC Dashboard** and **Mobile App** updating the Blue Yield Battery from `$0.0950` to `$0.0940`.

### Scenario B: High-Cost Model (`claude-3-opus` / `deep-research` — Cost `$0.020` > `$0.005` Limit)
1. Request arrives for `model: "claude-3-opus-deep-research"` (`estimatedCost = $0.020 USDC`).
2. Policy engine sees `$0.020 > $0.005`.
3. The route returns HTTP 403. Nothing is signed and nothing is spent. Raise `maxPerCallUsdc` if that model should be allowed.