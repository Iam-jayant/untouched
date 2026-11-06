# Untouched — Project Overview

## 1. Brand & Positioning
* **Project Name:** Untouched
* **Brand Line:** Your savings. Your AI API key's spending power. Separate by design.
* **Short Card Subtitle (ETHGlobal Portal < 75 chars):** Fund OpenAI, Claude & MCP keys with instant yield credit—your $50 stays untouched.
* **Full Hero Tagline:** Deposit $50 USDC once. Unlock an instant, self-repaying Nanopayment credit line that pays for your OpenAI, Claude, and Arc Marketplace API calls per prompt—while your principal stays isolated and untouched.

---

## 2. The Problem (Why This Must Exist)
1. **Subscription Fatigue & Draining API Balances:** Developers and everyday AI users hate paying $20/month for multiple subscriptions or watching their OpenAI, Anthropic, and OpenRouter API balances constantly drain to zero.
2. **Wallet Drain Risk with Autonomous Agents:** If you connect an autonomous coding agent (like Cursor, Claude Code, or Cline) directly to an x402 crypto wallet, a single infinite loop or prompt injection can wipe out your entire USDC savings balance overnight.
3. **The "Day-1 Zero Yield" Flaw in DeFi:** Traditional "spend-your-yield" vaults fail for normal users because a $50 deposit at 5% APY earns `$0.0000` at minute 1—meaning you would have to wait weeks before making a single API call, or lock up $4,800 just to cover a $20 bill.

---

## 3. The Solution (What Untouched Does in Plain English)
**Untouched** is a principal-protected LLM & MCP API Gateway built on **Arc**. 

1. **Lock $50 in the Safe Box (Vault):** You verify once as a unique human using **World IDKit** and deposit **$50.00 USDC** into our `PrincipalCreditVault` on Arc Testnet. Your AI API key has **zero access** to this $50.
2. **Get $0.095 of Instant "API Lunch Money" on Day 1:** The moment you deposit, our vault's onchain `CreditReservePool` fronts you **14 days of projected 5% APY interest ($0.095 USDC)** inside an isolated **Agent Signer EOA** wallet on Circle Gateway—and gives you a drop-in OpenAI/Claude-compatible API Key & Base URL (`https://untouched.dev/v1`).
3. **Why 9.5 Cents Is Massive for AI Prompts:** Because LLM prompts (GPT-4o-mini, Claude 3.5 Haiku, DeepSeek) and Arc Marketplace x402 calls cost **$0.0005 to $0.001 each**, and **Arc Nanopayments** settle gaslessly down to `$0.000001`, your `$0.095` advance gives you **95 to 190 real AI prompts and live tool calls immediately on Day 1**.
4. **Dual-Screen Control (PC Dashboard + Mobile Companion):**
   * **On PC:** You paste your `untouched` API key into Cursor/Cline (or use our PC Web Dashboard) and watch real-time token telemetry, live Arc Marketplace tool discovery, and Nanopayment receipts.
   * **On Phone:** Your mobile web app acts as the live security remote control. Routine cheap prompts (`<$0.005`) auto-approve silently. If your agent requests a heavy reasoning model (`Claude Opus` or `Deep Research` costing `$0.020`), your phone pauses the HTTP request and triggers a **World ID Agent Pass** biometric step-up check.
5. **Self-Repaying Yield Loop & Fair Early Exit:** Over the next 14 days, your locked $50 accrues simulated retail **USYC** NAV appreciation (~5% APY). A **Chainlink Runtime Environment (CRE)** workflow reads the onchain USYC NAV Oracle (`AggregatorV3Interface`), redeems only the yield surplus above `$50.00`, repays the `CreditReservePool`, and refills your API key battery. If you withdraw your $50 after 5 minutes before earning interest, the vault deducts only the unpaid advance (returning `$49.905`), guaranteeing 100% protocol solvency.

---

## 4. Target Users
* **Developers & Vibe Coders (Cursor / Claude Code / Cline users):** Drop-in OpenAI/Anthropic base URL that never touches their savings wallet and caps rogue loops to a few cents of yield credit.
* **Everyday AI Power Users:** Access paid models and live x402 web search/research tools from the PC/Mobile Playground without paying monthly subscriptions.

---

## 5. Why Our 3 Target Sponsors Are Mandatory
1. **Arc (Slot 1 — Eligible for $9,000 across 3 New-Project Tracks):**
   * Built end-to-end in **Arc Studio** (`PrincipalCreditVault.sol` on Arc Testnet `5042002`).
   * Uses **Circle Gateway Nanopayments** (`@circle-fin/x402-batching`) for gasless per-prompt settlement and **<0.5s finality** (compared to 13–19 minutes for Gateway deposits on Ethereum/Base).
   * Queries the **Arc Marketplace Discovery API** (`GET /v2/x402/discovery/resources?supportsCircleGateway=true`) to dynamically attach live x402 tools (`WEB_SEARCH_RESEARCH`, `CREATIVE`, `FINANCIAL_ANALYSIS`) to LLM prompts.
2. **World (Slot 2 — Eligible for $7,500 across IDKit & Agent Pass):**
   * **World IDKit:** Prevents Sybil bots from spinning up 1,000 wallets to drain free Day-1 OpenAI/Claude credit advances from our `CreditReservePool`.
   * **World ID Agent Pass:** Enforces human-in-the-loop biometric step-up when an API call exceeds the user's `$0.005` per-prompt auto-approve threshold (demonstrating both the **Blocked/Denied Path** and **Approved Path**).
3. **Chainlink (Slot 3 — Eligible for $5,000 across CRE & CCIP 2.0):**
   * **Onchain Oracle Read:** `PrincipalCreditVault.sol` reads the `AggregatorV3Interface` USYC NAV price and USDC/USD feed onchain to compute credit advances and redeemable yield surplus.
   * **Chainlink CRE Workflow:** Automates the periodic `reconcileAndRepay()` transaction when USYC share value rises above `$50.00`.