# Untouched — UI/UX & Dual-Device Design Requirements

## 1. Visual Identity & Aesthetic Direction
* **Vibe:** High-craft fintech neobank meets developer observability (think **Stripe + Linear + Revolut**). Inspired by premium landing page design with elegant animations and refined typography.
* **Color Palette:**
  * **Backgrounds:** Pure black (`#000000` base) with elevated cards (`#12141D`), subtle 1px borders in white/10 opacity.
  * **Safe Principal Accent (The "Green Box"):** Emerald Vault Green (`#10B981` primary, `#059669` border glow) — always associated with locked, untouchable savings.
  * **Yield Battery Accent (The "Blue Box"):** Electric Cyan/Blue (`#3B82F6` to `#06B6D4` gradient) — represents rechargeable API energy and Nanopayment flow.
  * **Warning / Step-Up Alert:** Amber Gold (`#F59E0B`) when an API call pauses for World ID Agent Pass approval.
  * **Blocked / Denied Path:** Crimson Red (`#EF4444`) when a rogue or high-cost prompt is blocked.
  * **Accent Gradients:** Subtle gradient overlays on cards for visual depth (emerald-500/10, cyan-500/10, amber-500/10).
* **Typography:**
  * **Display/Headings:** `Instrument Serif` for large display text (hero numbers, section titles)
  * **Body/UI:** `Instrument Sans` for all UI elements, buttons, labels
  * **Code/Monospace:** `JetBrains Mono` for dollar amounts, API keys, tx hashes, token counters (`tabular-nums` mandatory so numbers never jitter when ticking down by `$0.0005`).
  * **Font Variables:**
    - `--font-instrument` → Instrument Sans
    - `--font-instrument-serif` → Instrument Serif  
    - `--font-jetbrains-mono` → JetBrains Mono
  * **Tailwind Classes:**
    - `font-sans` → Instrument Sans
    - `font-display` → Instrument Serif
    - `font-mono` → JetBrains Mono

---

## 2. Why We Show Both PC and Phone in the Demo
During the ETHGlobal demo video, we show **both views working together in real time** (or via a built-in **"Split-Screen Demo Mode"** toggle in the top navbar so judges can see PC + Mobile side-by-side on one monitor!):
1. **PC View ("Developer Command Center & Usage Tracker"):** Where developers generate their API key, test prompts in the Playground (or Cursor IDE), inspect live Arc Marketplace Discovery tools, and track token/Nanopayment telemetry.
2. **Mobile View ("Consumer Wallet & Biometric Remote Control"):** Directly satisfies Arc's **$3,000 Best Mobile Web Consumer Agent** requirement—where users deposit `$50 USDC`, adjust their spend-limit slider in plain English, and approve or block high-cost prompts with **World ID Agent Pass**.

---

## 3. View 1: Mobile Web App (`390px x 844px` Frame or Responsive Mobile)
**No crypto jargon on the main consumer cards.**

### A. Top Dual-Vault Hero Cards
1. **Card 1 — The Green Safe Box (Protected Principal):**
   * Label: `PROTECTED SAVINGS (UNTOUCHED)`
   * Big Monospace Value: `$50.00 USDC`
   * Sub-badge: `🔒 Isolated in USYC Vault (~5.0% APY) • AI Key Has Zero Access`
   * Action Link: `Withdraw Principal` (shows transparent preview: `$50.00 - unpaid advance`).
2. **Card 2 — The Blue Yield Battery (API Spending Power):**
   * Label: `API KEY YIELD BATTERY (14-DAY ADVANCE)`
   * Big Monospace Value: `$0.0950 USDC`
   * Animated Horizontal Battery Bar (`100% Charged`)
   * Plain-English Counter: `≈ 95 Free AI Prompts Remaining Today`
   * Sub-badge: `⚡ Auto-refills from your $50 interest via Chainlink`

### B. Consumer Spend Controls Card (Mandatory for Arc Track 2)
* **Interactive Slider:** `Auto-Approve Prompt Limit: $0.005 / call` (Range: `$0.001` to `$0.050`).
* **Daily Cap Badge:** `Daily Yield Cap: $0.050 / day`.
* **World ID Status Pill:** `🟢 Verified Human (1 Credit Line Active)` + `🛡️ World ID Agent Pass Active for >$0.005 calls`.

### C. Real-Time Push Approval Modal (World ID Agent Pass Step-Up)
* Automatically slides up from the bottom of the phone screen whenever the PC sends a prompt costing `> $0.005` (e.g., `Claude Opus + Deep Research — $0.020 USDC`).
* Shows:
  * Calling App: `Cursor IDE / Untouched API Key (unt_live_...8f2a)`
  * Requested Model & Tool: `Claude Opus + Arc Marketplace Exa Search`
  * Cost: `$0.0200 USDC` *(Exceeds your $0.005 auto-approve limit)*
  * Impact on $50 Savings: `$0.00 (Principal Untouched)`
* **Two Big Action Buttons (For Demoing Both Paths):**
  1. **`🚫 Block Request (Demo Denied Path)`** -> Turns card Crimson Red: `"Blocked by Spend Policy — $0.0000 Spent"`.
  2. **`🌐 Approve with World ID Agent Pass`** -> Triggers World ID verification -> Turns card Emerald Green: `"Approved — $0.0200 Paid via Nanopayment"`.

### D. Compact Mobile Receipt Feed
* Clean Apple-Wallet style list of recent prompts:
  * `GPT-4o-mini + Exa Search` • `-$0.0010 from Yield` • `Savings: $50.00` • `0.4s ago`
  * `Claude Opus Deep Research` • `BLOCKED (Exceeded $0.005 limit)` • `$0.0000`

---

## 4. View 2: PC Web Dashboard ("Developer Command Center")
Designed for desktop (`1440px+`) with a 3-column observability layout:

### Left Column: API Key, Vault Telemetry & Demo Time-Machine
1. **Drop-In Endpoint Config Card:**
   * Base URL: `https://untouched.dev/api/v1` (with 1-click Copy)
   * API Key: `unt_live_98a7bc...` (with 1-click Copy & snippet tabs for **Cursor IDE**, **OpenAI Node SDK**, and **cURL**).
2. **Onchain Vault & Reserve Solvency Monitor:**
   * Shows live contract state from `PrincipalCreditVault.sol` on Arc Testnet (`5042002`):
     * User USYC Shares: `50.000000 USYC`
     * Current USYC Oracle NAV (`AggregatorV3Interface`): `$1.000000`
     * Outstanding Yield Advance: `$0.095000 USDC`
     * Isolated Agent Signer EOA (`GatewayWallet`): `0x71C...9A2`
3. **"Fast-Forward 14 Days" Simulator Card (Judge Demo Cheat Code):**
   * Button: **`⏩ Simulate +14 Days USYC Yield & Run Chainlink CRE Reconcile`**
   * Clicking this updates `MockUSYCOracle.sol` NAV from `$1.000000` to `$1.001918`, triggers the **Chainlink CRE** `reconcileAndRepay()` workflow onchain, repays the `CreditReservePool`, and visibly animates the Blue Yield Battery refilling back to `$0.0950 USDC` on both PC and Phone!

### Center Column: Live AI & MCP Prompt Playground
1. **Model & Cost Selector:**
   * **Routine Tier (`$0.001/call` — Auto-Approves):** `gpt-4o-mini`, `claude-3-5-haiku`, `deepseek-v3`
   * **Heavy Reasoning Tier (`$0.020/call` — Triggers Phone Step-Up):** `claude-3-opus-deep-research`, `o3-pro-analyst`
2. **Toggle: "Attach Live Arc Marketplace x402 Tools":**
   * Shows live badges fetched from `GET https://api.circle.com/v2/x402/discovery/resources?supportsCircleGateway=true` (`WEB_SEARCH_RESEARCH`, `CREATIVE`, `PREDICTION_MARKETS`, `FINANCIAL_ANALYSIS`).
3. **Interactive Chat / Prompt Console:**
   * Streams the LLM response alongside an expandable **"x402 Nanopayment & Discovery Inspector"** showing the exact EIP-3009 signature payload, Gateway batch receipt, and `$0.001` deduction.

### Right Column: Live PC Usage Tracker & Audit Log
* Real-time chart comparing **Cumulative AI Value Consumed ($)** vs. **Principal Deducted ($0.00 flat line)**.
* Live table of every API call with columns: `Timestamp`, `Model + Discovered Tool`, `Cost (USDC)`, `Auth Status (Auto / World ID Pass / Blocked)`, and `EIP-3009 Signature Hash`.

---

## 5. Built-In "Judge Split-Screen View" (Must-Have Feature)
Add a prominent toggle button in the top header: **`🖥️+📱 Split-Screen Judge Demo Mode`**.
* When toggled ON, the browser renders the **PC Developer Command Center on the left (65% width)** and an interactive **iPhone 16 Frame with the Mobile Companion App on the right (35% width)** on the exact same screen.
* Why: In the 3-minute demo video, the judge watches you send a prompt on the PC (left) and **instantly** sees the battery tick down or the World ID Agent Pass modal pop up on the Phone (right) with zero video splicing!