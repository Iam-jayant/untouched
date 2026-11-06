# Untouched — Sponsor Qualification & Anti-Disqualification Checklist

We use all **3 Partner Prize Slots** allowed by ETHGlobal Mumbai. Every requirement below must be present in our code, README, and 3-minute demo video.

## Slot 1: Arc (\$9,000 Eligible across 3 New-Project Tracks)

### Track A: Best DeFi or Onchain Finance Application Built End to End in Arc Studio (\$3,000)

* \[x\] **Arc Studio Starting Point:** `UntouchedVaultV2.sol` was compiled, tested, and deployed in Arc Studio. Workspace: https://studio.arc.io/app/34d39cc3-0fb6-4f0e-bb3b-503fe2e06425. Studio deployment: `0x494ef27eb33165407982ffc024c8d992f20dfa9f`.

* \[x\] **Shareable Arc Studio Link:** The workspace URL is at the top of the README. Paste the same URL on the ETHGlobal submission form.

* \[ \] **Show Arc Studio in Video:** Record the workspace (prompt, tests, and the deployed vault) in the first 15–20 seconds of the demo video.

* \[x\] **USDC Settlement on Arc:** Uses Arc Testnet USDC (`0x3600000000000000000000000000000000000000`) for native stake, ERC-20 stake, and withdraw.

### Track B: Best Mobile Web Consumer Agent Using the Marketplace Discovery API (\$3,000)

Not targeted. The phone screen is stake, yield battery, withdraw, and usage only.

* \[ \] **Marketplace Discovery API Integration:** Queries `GET https://api.circle.com/v2/x402/discovery/resources?supportsCircleGateway=true` and dynamically selects services (`WEB_SEARCH_RESEARCH`, `CREATIVE`, `PREDICTION_MARKETS`).

* \[ \] **Per-Use Nanopayments:** Executes gasless EIP-3009 payments via `@circle-fin/x402-batching` (`GatewayClient` & `BatchFacilitatorClient`) from the isolated Agent Signer EOA.

* \[ \] **Consumer Controls:** Mobile view has a clear **Per-Prompt Spend Limit Slider (`$0.005`)**, **Step-Up Approval Modal**, and **Receipt History**.

* \[ \] **Mobile-First, Plain English UI:** The Mobile Companion screen avoids crypto jargon (uses *"Protected Savings: \$50.00"* and *"API Key Yield Battery: \$0.095 — 95 Prompts Left"*).

### Track C: Best Smart Contracts with Advanced Stablecoin Logic, In Arc Studio (\$3,000)

* \[x\] **Conditional & Automated Stablecoin Flows:** `UntouchedVaultV2` keeps principal separate from the 14-day 5% yield battery, records usage only inside that battery, and returns principal minus used credit on withdraw.

* \[ \] **Reusable Module:** Document how another Arc app can call `depositNative`, `positions`, and `withdraw` on `UntouchedVaultV2`.