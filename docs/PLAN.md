# Untouched — Master Execution Plan

> **Purpose:** Step-by-step implementation plan synthesised from all project documentation.
> Read **before** writing any code. Build phases in strict order — each phase must compile and work end-to-end before proceeding.

---

## Table of Contents

1. [Project Summary](#project-summary)
2. [Architecture Overview](#architecture-overview)
3. [Critical Architectural Guardrails](#critical-architectural-guardrails)
4. [Phase 0 — Scaffold & Environment](#phase-0--scaffold--environment)
5. [Phase 1 — Smart Contracts (Arc Studio & Arc Testnet)](#phase-1--smart-contracts)
6. [Phase 2 — Backend Proxy, Discovery & Nanopayments](#phase-2--backend-proxy-discovery--nanopayments)
7. [Phase 3 — World ID Verification Flows](#phase-3--world-id-verification-flows)
8. [Phase 4 — Dual-Device Frontend](#phase-4--dual-device-frontend)
9. [Phase 5 — Chainlink CRE Workflow & Final Polish](#phase-5--chainlink-cre-workflow--final-polish)
10. [Sponsor Qualification Matrix](#sponsor-qualification-matrix)
11. [Demo Script (≤ 3 min)](#demo-script)

---

## Project Summary

**Untouched** is a principal-protected LLM & MCP API Gateway on **Arc Testnet**.

A user deposits **$10+ USDC** (with UI presets for $50, $100, $250, or Custom) into a vault, gets an instant credit advance (14 days of projected 5% APY yield — e.g., $0.095 for $50, $0.192 for $100), and receives a drop-in OpenAI/Anthropic-compatible API key (`https://untouched.dev/v1`). The principal stays isolated and *untouched* — only yield pays for AI prompts via **Circle Nanopayments**. A **World ID** gate prevents Sybil abuse, and a **World ID Agent Pass** enforces biometric step-up for expensive calls. A **Chainlink CRE** workflow auto-reconciles yield to repay the credit reserve. **100% free upstream LLM routing** via OpenRouter `:free` models, Groq, or Gemini ensures zero API costs.

**Target Sponsors (3 slots):**

| Slot | Sponsor | Prize Pool | Key Integration |
|------|---------|-----------|-----------------|
| 1 | **Arc** | $9,000 (3 tracks) | Arc Studio contracts, Marketplace Discovery API, Circle Nanopayments |
| 2 | **World** | $7,500 (2 tracks) | World IDKit (Sybil gate) + Agent Pass (biometric step-up) |
| 3 | **Chainlink** | $5,000 (CRE track) | Onchain oracle reads (`AggregatorV3Interface`) + CRE workflow |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                     CLIENT LAYER (SSE real-time sync)              │
│                                                                     │
│  ┌──────────────────────────┐   ┌─────────────────────────────┐     │
│  │  PC Developer Dashboard  │   │  Mobile Companion App       │     │
│  │  /dashboard              │   │  /mobile                    │     │
│  │  • API Key + Base URL    │   │  • Green Safe Box ($10+)    │     │
│  │  • AI Playground         │   │  • Blue Yield Battery       │     │
│  │  • Vault Telemetry       │   │  • Spend Slider             │     │
│  │  • 14-Day Simulator      │   │  • World ID Step-Up Modal   │     │
│  └────────────┬─────────────┘   └──────────────┬──────────────┘     │
│               │          Split-Screen: /demo    │                   │
└───────────────┼─────────────────────────────────┼───────────────────┘
                │                                 │
                ▼                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│              NEXT.JS BACKEND & PROXY GATEWAY                        │
│                                                                     │
│  /api/v1/chat/completions   ← OpenAI/Anthropic-compatible proxy    │
│  /api/discovery             ← Arc Marketplace Discovery            │
│  /api/world/verify-idkit    ← World IDKit server-side verify       │
│  /api/world/step-up-decision← Agent Pass approve/block             │
│  /api/vault/*               ← Contract interactions                │
│  /api/simulate              ← 14-day fast-forward                  │
│  /api/events                ← SSE event stream                     │
│                                                                     │
│  Agent Signer EOA Manager   ← viem privateKeyToAccount             │
│  Policy Engine              ← cost vs maxPerCallLimit check        │
│  Nanopayment Engine         ← @circle-fin/x402-batching            │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
              ┌────────────┼────────────┐
              ▼                         ▼
┌──────────────────────────┐ ┌───────────────────────────────────┐
│  ARC TESTNET (5042002)   │ │  EXTERNAL SERVICES                │
│                          │ │                                   │
│  PrincipalCreditVault    │ │  Circle GatewayWallet             │
│  MockUSYCOracle          │ │  World ID Verification API        │
│  Arc USDC (0x3600…)      │ │  Chainlink CRE Workflow           │
└──────────────────────────┘ │  OpenAI / Anthropic / OpenRouter  │
                             │  Groq / Gemini (free tier)        │
                             └───────────────────────────────────┘
```

---

## Critical Architectural Guardrails

> **MANDATORY:** These 4 guardrails must be applied during implementation. Every phase references them by number (G1–G4). Violating any of them will cause demo failures or sponsor disqualification.

### G1 — Global Singleton for Next.js 15 Route Sharing

Next.js 15 App Router may instantiate separate module scopes for each API route handler in development (and potentially across serverless workers in production). All in-memory shared state **must** be attached to `globalThis` to guarantee a single instance across all routes.

**Rule:** In `src/lib/agent-store.ts` and `src/lib/sse.ts`, attach both the user state `Map` and the SSE `EventEmitter` to `globalThis`:

```
// agent-store.ts
globalThis.__untouchedStore ??= new Map<string, UserState>();
export const store = globalThis.__untouchedStore;

// sse.ts
globalThis.__untouchedSSE ??= new EventEmitter();
export const sseBus = globalThis.__untouchedSSE;
```

**Why:** Without this, `/api/v1/chat/completions` would write to one Map instance while `/api/world/step-up-decision` reads from a different one — the step-up Promise would never resolve, the battery would never update, and the SSE stream would miss events. The following routes **must** share the exact same memory space:
- `/api/v1/chat/completions` (reads/writes user state, emits SSE)
- `/api/world/step-up-decision` (resolves pending approval Promise, emits SSE)
- `/api/vault/simulate` (updates battery, emits SSE)
- `/api/events` (reads SSE EventEmitter to stream to clients)

**TypeScript:** Extend `globalThis` typing in `src/lib/types.ts`:
```
declare global {
  var __untouchedStore: Map<string, UserState> | undefined;
  var __untouchedSSE: import('events').EventEmitter | undefined;
}
```

### G2 — Exact Battery Math without Gas Bleed (Scales to Any Deposit)

On Arc Testnet (`5042002`), **USDC is the native gas token**. If the Agent Signer EOA pays gas for the `approve()` + `deposit()` transactions that fund the GatewayWallet, the actual balance available for Nanopayments will be less than the computed advance (e.g., $0.0947 instead of $0.0950 for a $50 deposit) — breaking the clean UI battery math and confusing judges.

**Rule:** The Agent Signer EOA's credit advance must arrive in the GatewayWallet **net of all gas costs**. Choose one of these strategies:

| Strategy | How It Works | Recommended? |
|----------|-------------|--------------|
| **A. Vault-Funded Gas Buffer** | `PrincipalCreditVault.depositWithCreditAdvance()` sends `advanceUsdc + gasPadding` (e.g., `95000 + 500` = `95500` for a $50 deposit). The extra `500` (= $0.0005) covers the `approve()` + `GatewayWallet.deposit()` gas. After deposit, exactly the computed advance lands in the Gateway balance. | ✅ Cleanest |
| **B. Operator Pre-Funded Gateway** | The protocol operator pre-deposits the full advance into the GatewayWallet on behalf of the Agent Signer EOA during the backend registration flow, using the operator's own gas funds. The vault advance reimburses the operator. | ✅ Also clean |
| **C. Backend-Only Deposit** | The backend (which holds the Agent Signer private key) executes the GatewayWallet deposit using a separate operator-funded gas wallet, then attributes the full advance balance to the Agent Signer EOA. | ⚠️ More complex |

**Impact on Phases:** Phase 1 (`PrincipalCreditVault.sol`) may need a tiny `gasBuffer` parameter. Phase 2 (`agent-store.ts`, `nanopayments.ts`) must ensure the UI battery always initialises at exactly the computed advance amount (e.g., `0.095000` for $50, `0.191780` for $100) by accounting for gas costs.

### G3 — Promise-Based HTTP Hold for Step-Up Flow

When a prompt costs more than the user's `maxPerCallUsdc` (e.g., $0.020 > $0.005), the `/api/v1/chat/completions` route must **hold the HTTP connection open** while the Mobile Companion displays the World ID Agent Pass step-up modal.

**Rule:** Implement a Promise-based hold pattern with a 60-second timeout:

```
// In /api/v1/chat/completions handler (pseudo-code):

if (policyResult === 'REQUIRES_STEP_UP') {
  // 1. Create a Promise that will be resolved externally
  const { promise, resolve } = Promise.withResolvers<StepUpDecision>();

  // 2. Store the resolver in the globalThis store (G1)
  pendingApproval.resolver = resolve;
  store.get(userId).pendingApproval = pendingApproval;

  // 3. Immediately emit SSE so Mobile slides up the modal
  sseBus.emit('STEP_UP_REQUESTED', { challengeId, model, cost });

  // 4. Await the decision with a 60-second timeout
  const decision = await Promise.race([
    promise,
    new Promise<StepUpDecision>((_, reject) =>
      setTimeout(() => reject(new Error('STEP_UP_TIMEOUT')), 60_000)
    ),
  ]);

  // 5. Handle outcome
  if (decision.action === 'BLOCKED') {
    return Response.json({ error: 'Blocked by World ID Agent Pass' }, { status: 403 });
  }
  // else: sign Nanopayment, call LLM, stream response...
}
```

**The other side — `/api/world/step-up-decision`:**
```
// 1. Read the pending approval from globalThis store (G1)
const pending = store.get(userId).pendingApproval;

// 2. Resolve the Promise that /api/v1/chat/completions is awaiting
pending.resolver({ action: 'APPROVED', proof });   // or 'BLOCKED'

// 3. Emit SSE so both screens update
sseBus.emit('STEP_UP_RESOLVED', { status: 'APPROVED' });
```

**Why this works:** G1 guarantees both routes share the same `store` Map and the same Promise reference. The HTTP connection on `/api/v1/chat/completions` stays open (Next.js App Router supports long-running route handlers) until the resolver fires or the 60s timeout elapses.

**Edge cases to handle:**
- **Timeout (60s):** Return HTTP `408 Request Timeout` with a `TIMED_OUT` receipt.
- **User disconnects:** Clean up the pending approval from the store.
- **Multiple concurrent step-ups:** Each `PendingApproval` is keyed by a unique `challengeId`.

### G4 — Mandatory World Developer Feedback Debrief

World's hackathon bounty rules require a dedicated developer feedback debrief section in the project README. Omitting this can result in prize disqualification even if the integration is technically correct.

**Rule:** In Phase 5.4 (`README.md`), include a section titled exactly:

```markdown
## World ID & Agent Pass Developer Feedback Debrief
```

This section must answer the following questions (paraphrased from World's standard hackathon debrief template):

1. **What did you build with World ID / Agent Pass?** — One paragraph describing the integration.
2. **Which verification level(s) did you use and why?** — e.g., Orb / Device / Cloud, and rationale.
3. **What was the developer experience like?** — Honest feedback on docs, SDKs, error messages, onboarding.
4. **What challenges did you encounter?** — Specific bugs, unclear docs, missing features.
5. **What would you improve about the World ID / Agent Pass developer experience?** — Constructive suggestions.
6. **Would you use World ID / Agent Pass in a production app? Why or why not?** — Honest assessment.

**Impact on Phases:** Phase 5.4 (README.md) is updated below to include this as a mandatory sub-task.

---

## Phase 0 — Scaffold & Environment

**Goal:** Bootable Next.js 15 project with all dependencies, typed config, and project skeleton.

### Tasks

- [ ] **0.1 — Initialize Next.js 15 (App Router, TypeScript)**
  ```bash
  npx create-next-app@latest untouched --app --ts --tailwind --eslint --src-dir
  ```

- [ ] **0.2 — Install all dependencies**
  ```bash
  # Core
  npm i viem wagmi @tanstack/react-query

  # Circle / Arc
  npm i @circle-fin/x402-batching

  # World ID
  npm i @worldcoin/idkit

  # Chainlink (Solidity interface only — used in contracts)
  # npm i @chainlink/contracts (or inline interface)

  # LLM proxy
  npm i openai

  # UI
  npm i framer-motion lucide-react tailwind-merge clsx

  # Fonts
  npm i @fontsource/inter @fontsource/jetbrains-mono
  # OR use next/font/google
  ```

- [ ] **0.3 — Project directory structure**
  ```
  src/
  ├── app/
  │   ├── layout.tsx                    # Root layout, fonts, providers
  │   ├── page.tsx                      # Redirect to /demo
  │   ├── demo/page.tsx                 # Split-screen judge view (default)
  │   ├── dashboard/page.tsx            # PC Developer Command Center
  │   ├── mobile/page.tsx               # Mobile Companion App
  │   └── api/
  │       ├── v1/chat/completions/route.ts
  │       ├── discovery/route.ts
  │       ├── world/
  │       │   ├── verify-idkit/route.ts
  │       │   └── step-up-decision/route.ts
  │       ├── vault/
  │       │   ├── deposit/route.ts
  │       │   ├── withdraw/route.ts
  │       │   ├── status/route.ts
  │       │   └── simulate/route.ts
  │       └── events/route.ts           # SSE endpoint
  ├── components/
  │   ├── mobile/
  │   │   ├── MobileCompanion.tsx
  │   │   ├── SafeBoxCard.tsx           # Green $50 card
  │   │   ├── YieldBatteryCard.tsx      # Blue $0.095 card
  │   │   ├── SpendSlider.tsx
  │   │   ├── StepUpModal.tsx           # World ID Agent Pass modal
  │   │   └── ReceiptFeed.tsx
  │   ├── pc/
  │   │   ├── PcDashboard.tsx
  │   │   ├── ApiKeyCard.tsx
  │   │   ├── VaultTelemetry.tsx
  │   │   ├── SimulatorCard.tsx         # Fast-Forward 14 Days
  │   │   ├── AiPlayground.tsx
  │   │   ├── ModelSelector.tsx
  │   │   ├── DiscoveryBadges.tsx
  │   │   └── AuditLog.tsx
  │   ├── shared/
  │   │   ├── SplitScreenView.tsx       # Judge demo mode
  │   │   ├── IPhoneFrame.tsx
  │   │   └── Header.tsx
  │   └── providers/
  │       ├── WagmiProvider.tsx
  │       └── AppStateProvider.tsx       # React context for SSE state
  ├── lib/
  │   ├── contracts.ts                  # ABIs + deployed addresses
  │   ├── abi.ts                        # Generated ABIs
  │   ├── agent-store.ts               # Agent Signer EOA manager + state
  │   ├── nanopayments.ts             # Circle x402 batching integration
  │   ├── discovery.ts                 # Arc Marketplace Discovery client
  │   ├── policy-engine.ts            # Cost check + step-up routing
  │   ├── world-id.ts                  # World IDKit + Agent Pass helpers
  │   ├── sse.ts                       # SSE event bus
  │   ├── constants.ts                 # Chain config, addresses, costs
  │   └── types.ts                     # Shared TypeScript types
  └── styles/
      └── globals.css                  # Tailwind + custom tokens
  contracts/
  ├── UntouchedVault.sol               # PrincipalCreditVault + MockUSYCOracle
  └── README.md                        # Arc Studio deployment notes
  cre-workflow/
  ├── reconcile-yield.ts               # Chainlink CRE workflow script
  └── README.md
  ```

- [ ] **0.4 — Environment variables (`.env.local`)**
  ```env
  # Arc Testnet
  NEXT_PUBLIC_ARC_TESTNET_RPC=https://rpc.testnet.arc.network
  NEXT_PUBLIC_ARC_CHAIN_ID=5042002
  NEXT_PUBLIC_USDC_ADDRESS=0x3600000000000000000000000000000000000000
  NEXT_PUBLIC_GATEWAY_WALLET=0x0077777d7EBA4688BDeF3E311b846F25870A19B9

  # Deployed Contracts (fill after Phase 1)
  NEXT_PUBLIC_VAULT_ADDRESS=
  NEXT_PUBLIC_ORACLE_ADDRESS=

  # Agent Signer (backend only)
  AGENT_SIGNER_PRIVATE_KEY=

  # World ID
  NEXT_PUBLIC_WORLD_APP_ID=
  WORLD_ACTION_IDKIT=verify-human-deposit
  WORLD_ACTION_AGENT_PASS=approve-high-spend-prompt

  # LLM Keys (Enhancement 2 — free tier routing)
  OPENAI_API_KEY=
  ANTHROPIC_API_KEY=
  OPENROUTER_API_KEY=
  GROQ_API_KEY=
  GEMINI_API_KEY=
  ```

- [ ] **0.5 — Tailwind config with design tokens**
  Define the colour palette from DESIGN_REQUIREMENTS:
  - Background: `#090A0F`, Card surface: `#12141D`, Border: `#1E2230`
  - Green (Safe Box): `#10B981` / `#059669`
  - Blue (Yield Battery): `#3B82F6` → `#06B6D4`
  - Amber (Step-Up Alert): `#F59E0B`
  - Red (Blocked): `#EF4444`

- [ ] **0.6 — Font setup**
  Configure `Inter` / `Plus Jakarta Sans` for UI, `JetBrains Mono` (`tabular-nums`) for all monetary values, API keys, and hashes.

---

## Phase 1 — Smart Contracts

**Goal:** Deploy `MockUSYCOracle` and `PrincipalCreditVault` via **Arc Studio** on Arc Testnet (`5042002`). Export ABIs + addresses to `src/lib/contracts.ts`.

### Tasks

- [ ] **1.1 — `MockUSYCOracle.sol`**
  - Implements `AggregatorV3Interface` (`latestRoundData()`)
  - NAV starts at `100_000_000` (8 decimals = $1.00000000)
  - `simulateDaysPassed(uint256 daysCount)`: increases NAV by `13698` per day (14 days → `100_191_780` = $1.00191780)
  - Emits `NavUpdated(roundId, newNav, daysSimulated)`

- [ ] **1.2 — `PrincipalCreditVault.sol`** ⚠️ **G2 + Enhancement 1 (Flexible Deposits)**
  - Constructor: `(address _usdc, address _usycOracle)`
  - **⮕ Enhancement 1:** `MIN_DEPOSIT_USDC = 10_000000` ($10 minimum). No hardcoded $50 cap — any amount ≥ $10 is accepted. The advance formula scales linearly: `advance = (amountUsdc * 500 * 14) / (10000 * 365)`. Examples: $10→$0.0192, $50→$0.0959, $100→$0.1918, $250→$0.4795.
  - `fundReservePool(uint256 amountUsdc)` — protocol operator seeds CreditReservePool
  - `depositWithCreditAdvance(uint256 amountUsdc, address agentSignerEOA, bytes32 worldIdNullifier)`:
    - `require(amountUsdc >= MIN_DEPOSIT_USDC)` — enforces $10 minimum
    - Sybil check: `require(!usedWorldIdNullifiers[worldIdNullifier])`
    - Reads `usycOracle.latestRoundData()` (**onchain state-changing read — Chainlink requirement**)
    - Mints shares: `shares = (amountUsdc * 1e20) / currentNav`
    - Computes advance dynamically: `advance = (amountUsdc * 500 * 14) / (10000 * 365)`
    - Transfers advance from CreditReservePool → agentSignerEOA
    - Sets `maxPerCallLimitUsdc = 5000` ($0.005 default)
    - **⮕ G2:** If using Strategy A (Vault-Funded Gas Buffer), add an optional `gasBufferUsdc` parameter or hardcode a small gas padding (e.g., `500` = $0.0005) so the Agent Signer EOA receives `advance + gasBuffer`. This ensures the EOA can pay the `approve()` + `GatewayWallet.deposit()` gas and the full advance lands in the Gateway balance. The UI battery initialises at the exact advance amount for their deposit (e.g., $0.0950 for $50, $0.1918 for $100). Document the chosen strategy in comments.
  - `reconcileAndRepay(address user)`:
    - Reads NAV, calculates surplus, redeems shares, repays pool
  - `withdrawPrincipal()`:
    - Early-exit solvency: `payout = principal - max(0, unpaidAdvance - surplus)`
  - `updateSpendPolicy(uint256 newMax, address newAgent)`
  - `getAccruedSurplusUsdc(address user)` — view function

- [ ] **1.3 — Deploy via Arc Studio**
  - Open `studio.arc.com`, paste the generation prompt from `contracts_arc_studio_prompts.md`
  - Compile, test, deploy to Arc Testnet
  - **Save the shareable Arc Studio project URL** for README + submission
  - **Record the studio.arc.com screen** (first 15–20 sec of demo video)

- [ ] **1.4 — Export to codebase**
  - Write deployed addresses + ABIs to `src/lib/contracts.ts`
  - Create `src/lib/abi.ts` with typed ABI arrays
  - Seed the CreditReservePool with USDC via `fundReservePool()`

---

## Phase 2 — Backend Proxy, Discovery & Nanopayments ✅ **COMPLETE**

**Status:** ✅ All tasks completed (November 1, 2026)  
**See:** `docs/PHASE2_COMPLETION.md` for full report

**Goal:** Build the OpenAI-compatible proxy gateway with Circle Nanopayments and Arc Marketplace Discovery.

### Tasks

- [x] **2.1 — Constants & Types (`src/lib/constants.ts`, `src/lib/types.ts`)** ⚠️ **Enhancement 1 + Enhancement 2**
  Define:
  - **⮕ Enhancement 1:** `MIN_DEPOSIT_USDC = 10_000000`. Deposit presets: `[10, 50, 100, 250]` (UI uses these as quick buttons; any custom amount ≥ $10 is accepted).
  - **⮕ Enhancement 2:** Model cost map with free-tier models:
    ```
    MODELS = {
      // Routine tier ($0.001/call — auto-approve)
      "gpt-4o-mini": { cost: 0.001, provider: "openrouter", modelId: "openai/gpt-4o-mini" },
      "claude-3-5-haiku": { cost: 0.001, provider: "openrouter", modelId: "anthropic/claude-3.5-haiku" },
      "deepseek-v3": { cost: 0.001, provider: "openrouter", modelId: "deepseek/deepseek-chat:free" },
      "llama-3.3-70b": { cost: 0.001, provider: "openrouter", modelId: "meta-llama/llama-3.3-70b-instruct:free" },
      "gemini-2.0-flash": { cost: 0.001, provider: "gemini", modelId: "gemini-2.0-flash" },
      // Heavy reasoning tier ($0.020/call — triggers phone step-up)
      "claude-3-opus-deep-research": { cost: 0.020, provider: "openrouter", modelId: "anthropic/claude-3-opus" },
      "o3-pro-analyst": { cost: 0.020, provider: "openrouter", modelId: "openai/o3-pro" },
    }
    ```
  - `UserState` type includes `principalUsdc`, `maxBatteryCapacityUsdc` (= computed advance for their deposit), `yieldBatteryUsdc`, etc.
  - `Receipt`, `PendingApproval`, `StepUpDecision`, `DiscoveredTool` types
  - Arc chain config for Viem/Wagmi

- [x] **2.2 — Agent Signer EOA Manager (`src/lib/agent-store.ts`)** ⚠️ **G1 + G2**
  - **⮕ G1:** Attach the state Map to `globalThis.__untouchedStore` so all API routes (`/api/v1/chat/completions`, `/api/world/step-up-decision`, `/api/vault/simulate`, `/api/events`) share the exact same memory space. Never use a module-level `const store = new Map()` — Next.js 15 App Router may create separate module instances per route.
  - Generate isolated Agent Signer EOA per user (`viem` `generatePrivateKey()` + `privateKeyToAccount`)
  - In-memory store (Map) tracking per-user:
    - `principalUsdc` (variable — $10, $50, $100, $250, or custom ≥ $10)
    - `maxBatteryCapacityUsdc` (= advance for their deposit: `principal * 500 * 14 / (10000 * 365)`)
    - `yieldBatteryUsdc` (starts at `maxBatteryCapacityUsdc`, depletes with each prompt)
    - `unpaidAdvanceUsdc` (= `maxBatteryCapacityUsdc` initially)
    - `maxPerCallUsdc` (default $0.005), `worldIdVerified`
    - `receipts: Receipt[]`, `pendingApproval: PendingApproval | null`
    - `pendingApproval.resolver: ((decision: StepUpDecision) => void) | null` ← **G3** Promise resolver
  - **The Agent Signer EOA never has allowance over principal** — only holds the advance credit
  - **⮕ G2:** Initialise `yieldBatteryUsdc` at exactly the computed advance amount after the GatewayWallet deposit. Account for gas costs using one of the G2 strategies (vault gas buffer, operator pre-fund, or backend deposit) so the battery never starts below the expected value (e.g., not $0.0947 when $0.0950 was expected).

- [x] **2.3 — SSE Event Bus (`src/lib/sse.ts`)** ⚠️ **G1**
  - **⮕ G1:** Attach the EventEmitter to `globalThis.__untouchedSSE` so all API routes emit and listen on the same bus. Never use a module-level `const emitter = new EventEmitter()`.
  - In-memory event emitter broadcasting to connected clients
  - Events: `BATTERY_UPDATE`, `RECEIPT_ADDED`, `STEP_UP_REQUESTED`, `STEP_UP_RESOLVED`, `VAULT_UPDATE`, `SLIDER_CHANGED`
  - `/api/events/route.ts` — SSE endpoint streaming events to PC + Mobile

- [x] **2.4 — Arc Marketplace Discovery (`src/lib/discovery.ts`, `/api/discovery/route.ts`)**
  - Fetch from `GET https://api.circle.com/v2/x402/discovery/resources?supportsCircleGateway=true&limit=20`
  - Parse and categorise: `WEB_SEARCH_RESEARCH`, `CREATIVE`, `PREDICTION_MARKETS`, `FINANCIAL_ANALYSIS`
  - Cache results in-memory with TTL (+ hardcoded fallback for offline/Wi-Fi drops)
  - Return badge-ready data to frontend

- [x] **2.5 — Circle Nanopayments Engine (`src/lib/nanopayments.ts`)** ⚠️ **G2**
  - `GatewayClient` (`@circle-fin/x402-batching/client`):
    - Deposits the computed advance USDC into `GatewayWallet` (`0x0077777d7EBA4688BDeF3E311b846F25870A19B9`) on `eip155:5042002`
    - **⮕ G2:** The deposit transaction itself costs gas (paid in USDC on Arc). Ensure the Agent Signer EOA has enough to cover gas **on top of** the advance (Strategy A: vault sends extra gas buffer; Strategy B: operator pre-funds the Gateway; Strategy C: operator wallet pays gas). After deposit, verify the Gateway balance reads exactly the computed advance amount before initialising the UI battery.
    - Signs EIP-3009 `TransferWithAuthorization` per prompt
  - `BatchFacilitatorClient` (`@circle-fin/x402-batching/server`):
    - Verifies and settles offchain signatures (<0.5s, zero gas)
  - Returns structured `x402Receipt` with signature hash, amount, timestamp

- [x] **2.6 — Policy Engine (`src/lib/policy-engine.ts`)**
  - Input: `estimatedCost`, `userState.maxPerCallUsdc`
  - Output: `AUTO_APPROVE` | `REQUIRES_STEP_UP`
  - If `cost <= maxPerCallUsdc` → auto-sign Nanopayment
  - If `cost > maxPerCallUsdc` → create `PendingApproval`, push `STEP_UP_REQUESTED` via SSE

- [x] **2.7 — OpenAI/Anthropic Proxy (`/api/v1/chat/completions/route.ts`)** ⚠️ **G1 + G3 + Enhancement 2**
  - Accepts standard OpenAI chat completion format
  - **⮕ Enhancement 2 — Free LLM Routing:** Configure the `openai` SDK client with a provider cascade:
    1. **OpenRouter** (`OPENROUTER_API_KEY` → `https://openrouter.ai/api/v1`): Use `:free` model suffixes (e.g., `deepseek/deepseek-chat:free`, `meta-llama/llama-3.3-70b-instruct:free`) for $0 upstream cost. Paid models (`openai/gpt-4o-mini`, `anthropic/claude-3-opus`) also route here.
    2. **Groq** (`GROQ_API_KEY` → `https://api.groq.com/openai/v1`): Fast free inference for Llama/Mixtral.
    3. **Google Gemini** (`GEMINI_API_KEY` → `https://generativelanguage.googleapis.com/v1beta/openai`): Free tier Gemini 2.0 Flash.
    4. **Built-in mock streaming fallback**: If **no API key** is set in `.env.local`, return a realistic SSE-streamed mock response (with model name, token usage, and latency simulation) so the full flow is demo-able offline.
  - Provider selection: `resolveProvider(modelName)` checks which key is available and maps to the correct base URL + model ID.
  - Flow:
    1. Authenticate via `Authorization: Bearer unt_live_xxx`
    2. Estimate cost from model name (lookup `MODELS` map from 2.1)
    3. Run Policy Engine check
    4. **Auto-approve path**: Sign Nanopayment → call upstream LLM via resolved provider → stream response → deduct from battery → broadcast SSE update → return response + `x402Receipt`
    5. **Step-up path** ⚠️ **G3 — Promise-Based HTTP Hold:**
       - Create a `PendingApproval` with a `Promise.withResolvers<StepUpDecision>()` — store the `resolver` function in the `globalThis.__untouchedStore` (G1) under the user's `pendingApproval`
       - Immediately emit `STEP_UP_REQUESTED` SSE event via `globalThis.__untouchedSSE` (G1) so the Mobile Companion slides up the World ID Agent Pass modal
       - **Hold the HTTP connection open** by awaiting the Promise with a 60-second timeout via `Promise.race([promise, timeoutPromise])`
       - When `/api/world/step-up-decision` calls `resolver()` (G1 guarantees same Promise reference), the await unblocks:
         - **BLOCKED →** Return HTTP `403 Forbidden`, log Crimson receipt, battery unchanged
         - **APPROVED →** Sign Nanopayment, call LLM, stream response, deduct battery
       - **TIMEOUT (60s) →** Return HTTP `408 Request Timeout`, log a `TIMED_OUT` receipt, clean up `pendingApproval`
       - **Client disconnect →** Clean up `pendingApproval` from store to prevent memory leaks
    6. If `attachMarketplaceTools: true`, query Discovery API and inject x402 tool context into prompt
  - Graceful mock streaming fallback if LLM API keys are missing

- [x] **2.8 — Phase 2 Verification Script**
  - Provide `curl` commands and/or a Node.js script to test:
    - `GET /api/discovery` — returns categorised Arc Marketplace resources
    - `POST /api/v1/chat/completions` — auto-approve path with mock streaming
    - `GET /api/events` — SSE stream emits battery updates
    - `GET /api/vault/status` — returns user state

---

## Phase 3 — World ID Verification Flows

**Goal:** Implement both World ID flows with the **mandatory Blocked/Denied path** for the demo.

### Tasks

- [ ] **3.1 — World IDKit Deposit Gate (`/api/world/verify-idkit/route.ts`)**
  - Receive `@worldcoin/idkit` proof from frontend registration flow
  - Server-side verify against World Developer Portal API
  - Extract `nullifierHash` → pass to `depositWithCreditAdvance()` on-chain
  - 1 human = 1 active credit line (prevents Sybil drain of CreditReservePool)
  - Return verified status + nullifier to frontend

- [ ] **3.2 — Agent Pass Step-Up Decision (`/api/world/step-up-decision/route.ts`)** ⚠️ **G1 + G3**
  - **⮕ G1 + G3:** This route is the **resolver side** of the Promise-based HTTP hold. It reads `globalThis.__untouchedStore` (G1) to find the user's `pendingApproval`, then calls `pendingApproval.resolver(decision)` which unblocks the awaiting `/api/v1/chat/completions` handler (G3). Both routes **must** reference the same `globalThis` singleton — if they don't, the resolver fires on a different Promise instance and the HTTP hold never unblocks.
  - Receives decision from Mobile Companion App modal:
  - **Path 1 — REJECT / BLOCKED (Mandatory for World bounty)**:
    - `action: "REJECT_OR_UNVERIFIED"`
    - Marks pending request as `BLOCKED_BY_POLICY`
    - Agent Signer signs **zero** Nanopayment
    - Broadcasts `STEP_UP_RESOLVED` SSE event with `status: "BLOCKED"`
    - Returns HTTP `403 Forbidden: Blocked by Untouched Spend Policy & World ID Agent Pass` to the waiting `/v1/chat/completions` caller
    - Logs a **Crimson Red BLOCKED** receipt on both screens
    - `yieldBatteryUsdc` unchanged
  - **Path 2 — APPROVED (with proof)**:
    - `action: "APPROVE_WITH_PROOF"` + World ID Agent Pass proof
    - Verifies proof server-side
    - Agent Signer EOA signs the `$0.020` EIP-3009 Nanopayment
    - Upstream LLM call executes and streams response
    - Broadcasts `STEP_UP_RESOLVED` SSE event with `status: "APPROVED"`
    - Logs a **Green STEP-UP APPROVED** receipt
    - Deducts from `yieldBatteryUsdc`

- [ ] **3.3 — World ID React Components**
  - `<WorldIDKitButton />` — triggers IDKit widget for initial deposit verification
  - `<AgentPassModal />` — slide-up modal on mobile with Block + Approve buttons

---

## Phase 4 — Dual-Device Frontend

**Goal:** Build the full UI per DESIGN_REQUIREMENTS with real-time SSE sync between PC and Mobile.

### 4.A — Shared Infrastructure

- [ ] **4.A.1 — App State Provider (`src/components/providers/AppStateProvider.tsx`)**
  - React Context wrapping SSE connection to `/api/events`
  - Exposes: `userState`, `receipts`, `pendingApproval`, `discoveredTools`, `vaultStatus`
  - Auto-reconnect on disconnect

- [ ] **4.A.2 — Wagmi Provider (`src/components/providers/WagmiProvider.tsx`)**
  - Arc Testnet chain config (`chainId: 5042002`, RPC: `https://rpc.testnet.arc.network`)
  - Wallet connection for depositor wallet (MetaMask, WalletConnect)

- [ ] **4.A.3 — Root Layout (`src/app/layout.tsx`)**
  - Dark mode (`bg-[#090A0F]`), fonts (Inter + JetBrains Mono), providers

### 4.B — Mobile Companion App (`/mobile`)

- [ ] **4.B.1 — Green Safe Box Card**
  - Label: `PROTECTED SAVINGS (UNTOUCHED)`
  - Value: `$10.00` / `$50.00` / `$100.00` / `$250.00` USDC (JetBrains Mono, `tabular-nums` — displays the actual deposit amount)
  - Sub-badge: `🔒 Isolated in USYC Vault (~5.0% APY) • AI Key Has Zero Access`
  - "Withdraw Principal" link with transparent preview

- [ ] **4.B.2 — Blue Yield Battery Card**
  - Label: `API KEY YIELD BATTERY (14-DAY ADVANCE)`
  - Animated horizontal battery bar (Framer Motion)
  - Value: Scales to deposit — e.g., `$0.0192` for $10, `$0.0950` for $50, `$0.1918` for $100, `$0.4795` for $250
  - Dynamic prompt count: `≈ X Free AI Prompts Remaining Today` (computed from battery ÷ $0.001)
  - Sub-badge: `⚡ Auto-refills from your interest via Chainlink`

- [ ] **4.B.3 — Spend Controls Card**
  - Interactive slider: `$0.001` → `$0.050` (default `$0.005`)
  - Daily cap badge: `$0.050 / day`
  - World ID status pill: `🟢 Verified Human (1 Credit Line Active)`

- [ ] **4.B.4 — World ID Agent Pass Step-Up Modal**
  - Slides up from bottom when step-up SSE event received
  - Shows: calling app, model, tool, cost, impact on savings ($0.00)
  - Two buttons:
    - `🚫 Block Request (Demo Denied Path)` → Crimson Red result
    - `🌐 Approve with World ID Agent Pass` → Emerald Green result

- [ ] **4.B.5 — Receipt Feed**
  - Apple Wallet–style list: model + tool, cost, savings balance, timestamp
  - Color-coded: green (auto-approved), amber (step-up approved), red (blocked)

### 4.C — PC Developer Command Center (`/dashboard`)

- [ ] **4.C.1 — Left Column: API Key, Vault & Simulator**
  - **API Key Card**: Base URL + key with copy buttons, snippet tabs (Cursor, OpenAI SDK, cURL)
  - **Vault Telemetry**: Live contract state — USYC shares, NAV price, outstanding advance, Agent Signer EOA address
  - **Fast-Forward Simulator Card**: `⏩ Simulate +14 Days USYC Yield & Run Chainlink CRE Reconcile` button — calls `/api/vault/simulate` which invokes `MockUSYCOracle.simulateDaysPassed(14)` + `PrincipalCreditVault.reconcileAndRepay()` and animates battery refill

- [ ] **4.C.2 — Center Column: AI & MCP Playground**
  - **Model Selector**: Routine tier ($0.001 — auto-approve) vs Heavy tier ($0.020 — step-up)
  - **Arc Marketplace Discovery toggle**: Live badges from Discovery API
  - **Chat Console**: Streams LLM response + expandable x402 Nanopayment Inspector (EIP-3009 payload, Gateway receipt, deduction)

- [ ] **4.C.3 — Right Column: Audit Log**
  - Real-time chart: Cumulative AI Value vs Principal Deducted ($0.00 flat line)
  - Receipt table: Timestamp, Model + Tool, Cost, Auth Status, Signature Hash

### 4.D — Split-Screen Judge Demo View (`/demo`)

- [ ] **4.D.1 — Split-Screen Layout**
  - **Default landing page** at `/demo`
  - Left: PC Dashboard (65% width)
  - Right: iPhone 16 frame with Mobile Companion (35% width)
  - Both connected to same SSE stream → real-time sync

- [ ] **4.D.2 — Header View Switcher**
  - Tabs: `🖥️+📱 Split-Screen Judge Demo` | `🖥️ PC Dashboard` | `📱 Mobile Companion`
  - Prominent `🖥️+📱 Split-Screen Judge Demo Mode` toggle in top header

---

## Phase 5 — Chainlink CRE Workflow & Final Polish

**Goal:** Package the CRE workflow, verify every sponsor checklist item, rehearse the demo.

### Tasks

- [ ] **5.1 — Chainlink CRE Workflow (`cre-workflow/reconcile-yield.ts`)**
  - Monitors `PrincipalCreditVault.getAccruedSurplusUsdc(user)`
  - When surplus > 0 and covers advance, triggers `reconcileAndRepay(user)`
  - Include README with CRE workflow setup instructions

- [ ] **5.2 — `/api/vault/simulate/route.ts` (Demo Fast-Forward)**
  - Calls `MockUSYCOracle.simulateDaysPassed(14)` on-chain
  - Then calls `PrincipalCreditVault.reconcileAndRepay(user)` on-chain
  - Broadcasts `VAULT_UPDATE` + `BATTERY_UPDATE` SSE events
  - Battery animates refilling to full capacity (scales to deposit: $0.0192 for $10, $0.0950 for $50, $0.1918 for $100, etc.) on both PC + Mobile

- [ ] **5.3 — Sponsor Checklist Verification**

  **Arc ($9,000 — 3 tracks):**
  - [ ] Contracts built, tested, deployed in Arc Studio (`studio.arc.com`)
  - [ ] Shareable Arc Studio link in README + ETHGlobal submission
  - [ ] Arc Studio shown in first 15–20s of demo video
  - [ ] USDC settlement on Arc Testnet (`0x3600…`)
  - [ ] Marketplace Discovery API queried and displayed
  - [ ] Gasless EIP-3009 Nanopayments via `@circle-fin/x402-batching`
  - [ ] Mobile consumer controls (slider, step-up modal, receipt feed)
  - [ ] Mobile UI uses plain English (no crypto jargon)
  - [ ] Advanced stablecoin logic (principal isolation, reserve float, NAV reconciliation, early-exit)
  - [ ] Reusable module documented

  **World ($7,500 — 2 tracks):**
  - [ ] World ID Agent Pass enforces step-up in backend
  - [ ] **Denied/Blocked path demonstrated in demo** (HTTP 403, $0.00 spent)
  - [ ] **Approved path demonstrated in demo** ($0.020 paid, response streams)
  - [ ] Server-side IDKit proof verification
  - [ ] Nullifier hash passed to `depositWithCreditAdvance()` (1 human = 1 credit line)
  - [ ] **⮕ G4:** `## World ID & Agent Pass Developer Feedback Debrief` section present in README with all 6 debrief answers

  **Chainlink ($5,000 — CRE track):**
  - [ ] **No frontend-only price feed reads** (anti-disqualification)
  - [ ] `usycOracle.latestRoundData()` called inside `deposit()` and `reconcileAndRepay()` — mutating onchain storage
  - [ ] CRE workflow script included (`cre-workflow/reconcile-yield.ts`)

- [ ] **5.4 — README.md** ⚠️ **G4**
  - Hero banner + tagline
  - Arc Studio link (prominent, top of file)
  - Architecture diagram
  - Setup instructions
  - Sponsor integration table
  - Demo video link
  - **⮕ G4 — Mandatory World Developer Feedback Debrief:** Include a dedicated section titled exactly `## World ID & Agent Pass Developer Feedback Debrief` answering all 6 of World's standard hackathon debrief questions:
    1. What did you build with World ID / Agent Pass?
    2. Which verification level(s) did you use and why?
    3. What was the developer experience like?
    4. What challenges did you encounter?
    5. What would you improve about the World ID / Agent Pass developer experience?
    6. Would you use World ID / Agent Pass in a production app? Why or why not?
  - License

- [ ] **5.5 — End-to-End Demo Rehearsal (≤ 3 minutes)**
  Verify all 4 beats work on Split-Screen view in < 90 seconds each.

---

## Demo Script

> **Total time: ≤ 3 minutes.** Show Split-Screen view (`/demo`) for the entire demo.

| Beat | Time | PC (Left) | Mobile (Right) | Sponsor Hit |
|------|------|-----------|----------------|-------------|
| **0** | 0:00–0:20 | Show Arc Studio (`studio.arc.com`) with contracts | — | Arc Track A, C |
| **1** | 0:20–0:50 | — | World IDKit verify → Deposit $50 USDC (or $100, $250) → Battery appears (scales to deposit) | World IDKit, Arc |
| **2** | 0:50–1:20 | Send `gpt-4o-mini` + Arc Marketplace Search ($0.001) | Battery ticks down. Receipt appears. Savings unchanged. | Arc Track B, Nanopayments |
| **3a** | 1:20–1:50 | Send `claude-3-opus-deep-research` ($0.020) | Step-up modal → tap **🚫 Block** → Crimson **BLOCKED** receipt, $0.00 spent | World Agent Pass **Denied Path** |
| **3b** | 1:50–2:20 | Send `claude-3-opus-deep-research` again ($0.020) | Step-up modal → tap **🌐 Approve** → Green receipt, response streams on PC | World Agent Pass **Approved Path** |
| **4** | 2:20–2:50 | Click `⏩ Fast-Forward 14 Days` → CRE reconcile runs | Battery animates back to full. Savings unchanged. | Chainlink CRE, Oracle |
| **5** | 2:50–3:00 | Show Audit Log: all receipts, $0 principal deducted | — | All sponsors |

---

## Key Financial Constants

| Constant | Value | Notes |
|----------|-------|-------|
| Minimum deposit | $10.00 USDC (6 decimals: `10_000000`) | **Enhancement 1:** Flexible deposits ≥ $10 |
| Deposit presets (UI) | $10, $50, $100, $250 + Custom | Quick buttons, any amount ≥ $10 accepted |
| Principal examples | $10 / $50 / $100 / $250 USDC | Locked in vault, untouched |
| APY | 5% | USYC NAV appreciation |
| 14-day advance formula | `(principal × 500 × 14) / (10000 × 365)` | Dynamic scaling: $10→$0.0192, $50→$0.0959, $100→$0.1918, $250→$0.4795 |
| 14-day advance ($50 example) | $0.095000 USDC (`95000`) | `50 × 0.05 × 14/365` |
| Daily yield | `principal × 0.05 / 365` | $10→$0.00137, $50→$0.00685, $100→$0.01370 |
| Default per-call limit | $0.005 USDC (`5000`) | Auto-approve threshold |
| Routine prompt cost | $0.001 USDC | **Enhancement 2:** Free-tier models (DeepSeek, Llama, Gemini) |
| Heavy prompt cost | $0.020 USDC | Opus, o3-pro (triggers step-up) |
| NAV start | `100_000_000` (8 decimals) | $1.00000000 |
| NAV after 14 days | `100_191_780` | $1.00191780 |
| NAV daily increment | `13_698` per day | ~0.0136986% |
| GatewayWallet | `0x0077777d7EBA4688BDeF3E311b846F25870A19B9` | Circle on Arc Testnet |
| Arc USDC | `0x3600000000000000000000000000000000000000` | Arc Testnet |
| Arc Chain ID | `5042002` (`eip155:5042002`) | Arc Testnet |

