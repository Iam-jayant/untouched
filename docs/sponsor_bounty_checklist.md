# Untouched — Sponsor Qualification & Anti-Disqualification Checklist

We use all **3 Partner Prize Slots** allowed by ETHGlobal Mumbai. Every requirement below must be present in our code, README, and 3-minute demo video.

## Slot 1: Arc (\$9,000 Eligible across 3 New-Project Tracks)

### Track A: Best DeFi or Onchain Finance Application Built End to End in Arc Studio (\$3,000)

* \[ \] **Arc Studio Starting Point:** Project contracts (`PrincipalCreditVault.sol` & `MockUSYCOracle.sol`) are prompted, tested, and deployed inside `https://studio.arc.com`.

* \[ \] **Shareable Arc Studio Link:** Include the `studio.arc.com` project URL at the top of the README and ETHGlobal submission form.

* \[ \] **Show Arc Studio in Video:** Record the `studio.arc.com` workspace (prompts + contract compile/deploy) in the first 15–20 seconds of the demo video.

* \[ \] **USDC Settlement on Arc:** Uses Arc Testnet USDC (`0x3600000000000000000000000000000000000000`) for principal lock, credit reserve advance, and yield repayment.

### Track B: Best Mobile Web Consumer Agent Using the Marketplace Discovery API (\$3,000)

* \[ \] **Marketplace Discovery API Integration:** Queries `GET https://api.circle.com/v2/x402/discovery/resources?supportsCircleGateway=true` and dynamically selects services (`WEB_SEARCH_RESEARCH`, `CREATIVE`, `PREDICTION_MARKETS`).

* \[ \] **Per-Use Nanopayments:** Executes gasless EIP-3009 payments via `@circle-fin/x402-batching` (`GatewayClient` & `BatchFacilitatorClient`) from the isolated Agent Signer EOA.

* \[ \] **Consumer Controls:** Mobile view has a clear **Per-Prompt Spend Limit Slider (`$0.005`)**, **Step-Up Approval Modal**, and **Receipt History**.

* \[ \] **Mobile-First, Plain English UI:** The Mobile Companion screen avoids crypto jargon (uses *"Protected Savings: \$50.00"* and *"API Key Yield Battery: \$0.095 — 95 Prompts Left"*).

### Track C: Best Smart Contracts with Advanced Stablecoin Logic, In Arc Studio (\$3,000)

* \[ \] **Conditional & Automated Stablecoin Flows:** Enforces hard principal-vs-yield isolation, instant 14-day reserve float advancement, automated NAV surplus reconciliation, and early-exit debt deduction.

* \[ \] **Reusable Module:** Document how any other AI agent builder on Arc can call `PrincipalCreditVault` to give their users principal-protected Nanopayment allowances.

## Slot 2: Chainlink (\$5,000 Eligible — CRE Workflow Track)

### Track: Best Workflow with Chainlink Runtime Environment (CRE) (\$1,500+)

* \[ \] **CRITICAL Anti-Disqualification Rule:** **Frontend reads of Chainlink Price Feeds DO NOT QUALIFY.**

* \[ \] **Onchain State Change:** `PrincipalCreditVault.sol` calls `usycOracle.latestRoundData()` (`AggregatorV3Interface`) directly inside `depositWithCreditAdvance()` and `reconcileAndRepay()`, mutating onchain storage variables (`usycShares`, `unpaidAdvanceUsdc`, `creditReservePoolUsdc`).

* \[ \] **CRE Workflow Script:** Include the CRE workflow (`cre-workflow/reconcile-yield.ts`) that monitors accrued USYC NAV surplus and triggers `reconcileAndRepay(user)`.