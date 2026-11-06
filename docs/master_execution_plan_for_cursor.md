# Untouched — Master Implementation Plan (`PLAN.md`)

> **Instructions for Cursor AI:**  
> Read `ABOUT_PROJECT.md`, `TECHNICAL_ARCHITECTURE.md`, `DESIGN_REQUIREMENTS.md`, `TECH_STACK.md`, `CONTRACTS_AND_ARC_STUDIO.md`, and `SPONSOR_BOUNTY_CHECKLIST.md` before writing code.  
> Build the project following the 5 phases below in strict order. Every phase must compile and work end-to-end before moving to the next.

---

## Phase 1: Smart Contracts (Arc Studio & Arc Testnet `5042002`)
**Goal:** Deploy and verify the contracts in **Arc Studio** (`studio.arc.com`) and export their ABIs and addresses into `src/lib/contracts.ts`.

* [ ] **1.1 `MockUSYCOracle.sol` & `MockUSYC.sol`:**
  * Implement Chainlink's `AggregatorV3Interface` (`latestRoundData()`) returning the USYC NAV price with 8 decimals (starts at `1_00000000` = `$1.00000000`).
  * Add `simulateDaysPassed(uint256 daysCount)` which increases NAV at `5% APY` (`~0.0136986%` per day, so 14 days increases NAV to `1_00191780`).
* [ ] **1.2 `PrincipalCreditVault.sol`:**
  * Hold `CreditReservePool` liquidity in Arc USDC (`0x3600000000000000000000000000000000000000` or local testable ERC20 fallback).
  * `deposit(uint256 amount, address agentSignerEOA, bytes32 nullifier)`:
    * Require `nullifier` has not been used.
    * Read `usycOracle.latestRoundData()` onchain (mandatory Chainlink state-changing read).
    * Mint simulated USYC shares for `amount` (`$50.00 USDC`).
    * Compute 14-day projected yield advance: `advance = (amount * 500 * 14) / (10000 * 365)` (capped at `$0.095 USDC` for `$50`).
    * Transfer `advance` (`$0.095 USDC`) from `CreditReservePool` to `agentSignerEOA` so it can fund Circle `GatewayWallet`.
  * `reconcileAndRepay(address user)` (Callable by Chainlink CRE workflow):
    * Read current NAV from `usycOracle.latestRoundData()`.
    * Calculate `currentValue = (userShares * currentNav) / 1e8`.
    * Require `currentValue > userPrincipal`.
    * Redeem only `surplus = currentValue - userPrincipal` shares to repay `CreditReservePool` (`unpaidAdvance = 0`) and credit remaining surplus to `agentSignerEOA`.
  * `withdraw()`:
    * Enforce early-exit solvency: `payout = userPrincipal - remainingUnpaidAdvance`.

---

## Phase 2: Backend Proxy, Discovery API & Circle Nanopayments
**Goal:** Build the OpenAI-compatible `/api/v1/chat/completions` gateway, isolated Agent Signer EOA manager, and Arc Marketplace Discovery integration.

* [ ] **2.1 Isolated Agent Signer & State Store (`src/lib/agent-store.ts`):**
  * Create deterministic or session-stored **Agent Signer EOA** (`viem/accounts`) for the user, completely separate from their depositor wallet.
  * Track live balances (`principalUsdc: 50.00`, `yieldBatteryUsdc: 0.0950`, `unpaidAdvanceUsdc: 0.0950`, `maxPerCallUsdc: 0.0050`) and receipt history.
* [ ] **2.2 Arc Marketplace Discovery Service (`src/app/api/discovery/route.ts`):**
  * Fetch live resources from `GET https://api.circle.com/v2/x402/discovery/resources?supportsCircleGateway=true&limit=20`.
  * Parse `accepts` arrays (`scheme`, `network`, `asset`, `amount`) and group into `WEB_SEARCH_RESEARCH`, `CREATIVE`, `PREDICTION_MARKETS`, and `FINANCIAL_ANALYSIS` (include high-availability cached fallback of real Circle Discovery entries in case venue Wi-Fi drops).
* [ ] **2.3 Circle Nanopayments Engine (`src/lib/nanopayments.ts`):**
  * Integrate `@circle-fin/x402-batching/client` (`GatewayClient`) and `@circle-fin/x402-batching/server` (`BatchFacilitatorClient`) on Arc Testnet (`eip155:5042002`, GatewayWallet `0x0077777d7EBA4688BDeF3E311b846F25870A19B9`).
  * Generate real EIP-3009 `TransferWithAuthorization` signatures signed by the isolated `AgentSignerEOA` for every approved prompt.
* [ ] **2.4 OpenAI/Claude Proxy Endpoint (`src/app/api/v1/chat/completions/route.ts`):**
  * Accept standard OpenAI chat completion payloads (`model`, `messages`, `attachMarketplaceTools`).
  * Calculate prompt cost (`$0.0010` for `gpt-4o-mini` / `claude-3-5-haiku`; `$0.0200` for `claude-3-opus-deep-research`).
  * **Branch 1 (`cost <= maxPerCallUsdc`):** Auto-sign EIP-3009 Nanopayment via Agent Signer EOA, deduct from `yieldBatteryUsdc`, attach discovered Arc Marketplace tool output, and return response + `x402Receipt`.
  * **Branch 2 (`cost > maxPerCallUsdc`):** Return HTTP 403 immediately. Do not sign a payment.

---

## Phase 3: Spend policy
**Goal:** Reject over-cap calls in the gateway. Deposits use a unique nullifier, not an identity proof.

* [x] **3.1 Policy engine**
  * `403` when estimated cost exceeds `maxPerCallUsdc`.
  * `402` when the yield balance is too small.
* [x] **3.2 Deposit nullifier**
  * `depositWithCreditAdvance` stores a unique nonzero `bytes32` and rejects reuse.

---

## Phase 4: Dual-Device Frontend (PC Command Center + Mobile Remote + Split-Screen Mode)
**Goal:** Build the responsive UI matching `DESIGN_REQUIREMENTS.md` with instant synchronization between PC and Phone.

* [ ] **4.1 Unified Header with View Switcher:**
  * Tabs: `🖥️+📱 Split-Screen Judge Demo (Default)` | `🖥️ PC Developer Dashboard` | `📱 Mobile Companion App`.
* [ ] **4.2 Mobile Companion Component (`src/components/MobileCompanion.tsx`):**
  * Green Safe Box (`$50.00 USDC Protected Savings`).
  * Blue Yield Battery (`$0.0950 USDC` animated progress bar + `95 Prompts Left`).
  * Interactive `Max Per-Prompt Spend Slider` (`$0.001` – `$0.025`, default `$0.005`).
  * Deposit, withdraw, and the per-call spend slider.
  * Receipt feed.
* [ ] **4.3 PC Developer Command Center (`src/components/PcDashboard.tsx`):**
  * API Key & Base URL card with copyable snippets for **Cursor IDE**, **OpenAI SDK**, and **cURL**.
  * Live AI Playground with Model Selector (`gpt-4o-mini ($0.001)` vs. `claude-3-opus-deep-research ($0.020)`) and live **Arc Marketplace Discovery API** tool selector.
  * **Onchain Vault & Chainlink CRE Simulator Card** featuring the **`⏩ Fast-Forward 14 Days (+5% APY) & Reconcile`** button.
  * Live EIP-3009 Signature & Receipt Inspector table.

---

## Phase 5: Chainlink CRE Workflow & Final Polish
**Goal:** Package the Chainlink CRE workflow script and verify every sponsor checklist item.

* [ ] **5.1 Chainlink CRE Workflow (`cre-workflow/reconcile-yield.ts`):**
  * Write the clean CRE workflow script that reads `PrincipalCreditVault.getVaultStatus(user)` and triggers `reconcileAndRepay(user)` when accrued USYC NAV surplus covers the advance.
* [ ] **5.2 End-to-End Demo Rehearsal:**
  * Verify all 4 demo beats work in `<90 seconds` on the Split-Screen view:
    1. Deposit `$50.00 USDC` -> `$0.0950` battery unlocks.
    2. Run `$0.001` Haiku/GPT-4o-mini prompt with Arc Marketplace Search -> Auto-pays via Nanopayment; Savings stays `$50.00`.
    3. Run a `$0.020` Opus prompt over the cap -> HTTP 403, $0 spent. Raise the cap and run it again to see a normal charge.
    4. Click **Fast-Forward 14 Days** -> Chainlink CRE reconciles USYC NAV growth, repays Reserve Pool, and recharges Battery to `$0.0950`.