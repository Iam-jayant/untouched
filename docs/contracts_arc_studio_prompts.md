# Untouched — Arc Studio Prompts & Smart Contract Specifications

> **CRITICAL ARC BOUNTY RULE:**  
> To qualify for Arc's **$9,000** prize pool across the 3 tracks, our smart contracts **MUST** be generated, tested, and deployed inside **Arc Studio (`https://studio.arc.com`)**, and we must record `studio.arc.com` in the first 20 seconds of our demo video.

---

## 1. Exact Prompt to Paste into Arc Studio (`studio.arc.com`)

Copy and paste this exact prompt into **Arc Studio** to generate and deploy our contracts on **Arc Testnet (`Chain ID: 5042002`)**:

```text
Build and deploy a modular smart contract suite on Arc Testnet (Chain ID 5042002) for "Untouched", a principal-protected AI Nanopayment credit vault with Chainlink AggregatorV3Interface oracle accounting.

Generate two contracts in a single file or linked files with unit tests:

1. MockUSYCOracle (implements Chainlink AggregatorV3Interface):
- Stores an 8-decimal NAV share price for simulated USYC starting at 100000000 ($1.00000000).
- Implements latestRoundData() returning (roundId, answer, startedAt, updatedAt, answeredInRound).
- Includes a public function simulateDaysPassed(uint256 daysCount) that increases the NAV price at 5% APY (approx 136986 per day per 1e8, so 14 days adds 1917808 -> $1.00191780) so we can demonstrate yield accrual and Chainlink CRE reconciliation live in our demo.

2. PrincipalCreditVault (reusable by other agent builders):
- Uses Arc Testnet USDC (6 decimals) and reads MockUSYCOracle via AggregatorV3Interface.
- Holds two isolated accounting buckets:
  a) User Principal Shares (simulated USYC shares valued via the Oracle NAV).
  b) A protocol CreditReservePool (funded with USDC) that fronts 14 days of projected yield on Day 1.
- Struct UserPosition:
  - uint256 principalUsdc (6 decimals, e.g., 50_000000 for $50)
  - uint256 usycShares (18 decimals)
  - uint256 entryNavPrice (8 decimals)
  - uint256 unpaidAdvanceUsdc (6 decimals)
  - uint256 totalYieldRepaidUsdc (6 decimals)
  - address agentSignerEOA (isolated EOA wallet for Circle Gateway Nanopayments)
  - uint256 maxPerCallLimitUsdc (default 5000 = $0.005 USDC)
  - bool worldIdVerified
- Function depositWithCreditAdvance(uint256 amountUsdc, address agentSignerEOA, bytes32 worldIdNullifier):
  - Requires !usedNullifiers[worldIdNullifier] to prevent Sybil draining of the CreditReservePool.
  - Reads current NAV price from MockUSYCOracle.latestRoundData() (causes onchain state change).
  - Transfers amountUsdc from msg.sender into the vault and calculates usycShares = (amountUsdc * 1e20) / currentNav.
  - Calculates 14-day projected yield at 5% APY: advanceUsdc = (amountUsdc * 500 * 14) / (10000 * 365).
  - Transfers advanceUsdc from CreditReservePool directly to agentSignerEOA so the agent can fund Circle GatewayWallet without ever having allowance over the user's principal.
  - Emits DepositAndCreditAdvanced(msg.sender, agentSignerEOA, amountUsdc, advanceUsdc, currentNav).
- Function reconcileAndRepay(address user) (Designed for Chainlink CRE automation):
  - Reads currentNav from MockUSYCOracle.latestRoundData().
  - Calculates currentPositionValueUsdc = (pos.usycShares * currentNav) / 1e20.
  - Requires currentPositionValueUsdc > pos.principalUsdc.
  - Calculates surplusUsdc = currentPositionValueUsdc - pos.principalUsdc.
  - Burns the exact USYC shares corresponding to surplusUsdc, reduces pos.unpaidAdvanceUsdc, replenishes CreditReservePool, and credits any excess yield to pos.agentSignerEOA.
  - Emits YieldReconciledAndRepaid(user, surplusUsdc, pos.unpaidAdvanceUsdc).
- Function withdrawPrincipal():
  - Reads currentNav to apply any accrued surplus first.
  - Enforces solvency: if pos.unpaidAdvanceUsdc > 0, deducts remaining unpaidAdvanceUsdc from principalUsdc and returns it to CreditReservePool; sends (principalUsdc - unpaidAdvanceUsdc) back to the user.
- Function updateSpendPolicy(uint256 newMaxPerCallLimitUsdc, address newAgentSignerEOA):
  - Allows consumer to update their per-call Nanopayment limit onchain.
```

---

## 2. Reference Solidity Implementation (`contracts/UntouchedVault.sol`)

Include this file in `/contracts/UntouchedVault.sol` in your repo so Cursor can generate TypeScript ABIs (`src/lib/abi.ts`) immediately:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface AggregatorV3Interface {
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
}

contract MockUSYCOracle is AggregatorV3Interface {
    int256 public currentNav = 100_000_000; // $1.00000000 (8 decimals)
    uint80 public roundId = 1;
    uint256 public updatedAt;

    event NavUpdated(uint80 indexed roundId, int256 newNav, uint256 daysSimulated);

    constructor() {
        updatedAt = block.timestamp;
    }

    function latestRoundData()
        external
        view
        override
        returns (uint80, int256, uint256, uint256, uint80)
    {
        return (roundId, currentNav, updatedAt, updatedAt, roundId);
    }

    /// @notice Simulates USYC NAV appreciation at ~5.0% APY (~0.0136986% per day)
    function simulateDaysPassed(uint256 daysCount) external {
        int256 gain = int256(daysCount * 13698); // +0.00191772 over 14 days
        currentNav += gain;
        roundId++;
        updatedAt = block.timestamp;
        emit NavUpdated(roundId, currentNav, daysCount);
    }
}

contract PrincipalCreditVault {
    IERC20 public immutable usdc;
    AggregatorV3Interface public immutable usycOracle;

    uint256 public creditReservePoolUsdc;
    mapping(bytes32 => bool) public usedWorldIdNullifiers;

    struct UserPosition {
        uint256 principalUsdc;        // 6 decimals (e.g., 50_000000 = $50.00)
        uint256 usycShares;           // 18 decimals
        uint256 entryNavPrice;        // 8 decimals
        uint256 unpaidAdvanceUsdc;    // 6 decimals (e.g., 95000 = $0.095)
        uint256 totalYieldRepaidUsdc; // 6 decimals
        address agentSignerEOA;       // Segregated EOA for Circle Gateway Nanopayments
        uint256 maxPerCallLimitUsdc;  // 6 decimals (default 5000 = $0.005)
        bool worldIdVerified;
    }

    mapping(address => UserPosition) public positions;

    event ReserveFunded(address indexed funder, uint256 amountUsdc);
    event DepositAndCreditAdvanced(
        address indexed user,
        address indexed agentSignerEOA,
        uint256 principalUsdc,
        uint256 advanceUsdc,
        uint256 navPrice
    );
    event YieldReconciledAndRepaid(
        address indexed user,
        uint256 surplusHarvestedUsdc,
        uint256 remainingUnpaidAdvanceUsdc,
        uint256 newNavPrice
    );
    event PrincipalWithdrawn(
        address indexed user,
        uint256 returnedToUserUsdc,
        uint256 deductedForUnpaidAdvanceUsdc
    );
    event SpendPolicyUpdated(address indexed user, uint256 maxPerCallLimitUsdc, address agentSignerEOA);

    constructor(address _usdc, address _usycOracle) {
        usdc = IERC20(_usdc);
        usycOracle = AggregatorV3Interface(_usycOracle);
    }

    function fundReservePool(uint256 amountUsdc) external {
        require(usdc.transferFrom(msg.sender, address(this), amountUsdc), "Reserve transfer failed");
        creditReservePoolUsdc += amountUsdc;
        emit ReserveFunded(msg.sender, amountUsdc);
    }

    function depositWithCreditAdvance(
        uint256 amountUsdc,
        address agentSignerEOA,
        bytes32 worldIdNullifier
    ) external {
        require(amountUsdc > 0, "Zero deposit");
        require(agentSignerEOA != address(0) && agentSignerEOA != msg.sender, "Agent EOA must be isolated");
        require(!usedWorldIdNullifiers[worldIdNullifier], "World ID already claimed advance");

        (, int256 navAnswer, , , ) = usycOracle.latestRoundData();
        require(navAnswer > 0, "Invalid oracle NAV");
        uint256 currentNav = uint256(navAnswer);

        require(usdc.transferFrom(msg.sender, address(this), amountUsdc), "Deposit transfer failed");

        usedWorldIdNullifiers[worldIdNullifier] = true;

        // 14-day projected yield at 5% APY: amount * 5% * 14 / 365
        uint256 advanceUsdc = (amountUsdc * 500 * 14) / (10000 * 365);
        require(creditReservePoolUsdc >= advanceUsdc, "Insufficient CreditReservePool");

        uint256 mintedShares = (amountUsdc * 1e20) / currentNav;

        UserPosition storage pos = positions[msg.sender];
        pos.principalUsdc += amountUsdc;
        pos.usycShares += mintedShares;
        pos.entryNavPrice = currentNav;
        pos.unpaidAdvanceUsdc += advanceUsdc;
        pos.agentSignerEOA = agentSignerEOA;
        pos.maxPerCallLimitUsdc = 5000; // Default $0.005 per call
        pos.worldIdVerified = true;

        creditReservePoolUsdc -= advanceUsdc;
        require(usdc.transfer(agentSignerEOA, advanceUsdc), "Advance transfer failed");

        emit DepositAndCreditAdvanced(msg.sender, agentSignerEOA, amountUsdc, advanceUsdc, currentNav);
    }

    function getAccruedSurplusUsdc(address user) public view returns (uint256 surplusUsdc, uint256 currentNav) {
        UserPosition memory pos = positions[user];
        if (pos.usycShares == 0) return (0, 0);
        (, int256 navAnswer, , , ) = usycOracle.latestRoundData();
        currentNav = uint256(navAnswer);
        uint256 currentValUsdc = (pos.usycShares * currentNav) / 1e20;
        if (currentValUsdc > pos.principalUsdc) {
            surplusUsdc = currentValUsdc - pos.principalUsdc;
        }
    }

    /// @notice Triggered by Chainlink CRE Workflow when NAV appreciation covers advance
    function reconcileAndRepay(address user) external {
        UserPosition storage pos = positions[user];
        require(pos.usycShares > 0, "No active position");

        (uint256 surplusUsdc, uint256 currentNav) = getAccruedSurplusUsdc(user);
        require(surplusUsdc > 0, "No yield surplus to reconcile");

        uint256 sharesToRedeem = (surplusUsdc * 1e20) / currentNav;
        pos.usycShares -= sharesToRedeem;

        if (surplusUsdc >= pos.unpaidAdvanceUsdc) {
            uint256 repaid = pos.unpaidAdvanceUsdc;
            pos.unpaidAdvanceUsdc = 0;
            pos.totalYieldRepaidUsdc += repaid;
            creditReservePoolUsdc += repaid;
        } else {
            pos.unpaidAdvanceUsdc -= surplusUsdc;
            pos.totalYieldRepaidUsdc += surplusUsdc;
            creditReservePoolUsdc += surplusUsdc;
        }

        emit YieldReconciledAndRepaid(user, surplusUsdc, pos.unpaidAdvanceUsdc, currentNav);
    }

    function withdrawPrincipal() external {
        UserPosition storage pos = positions[msg.sender];
        uint256 principal = pos.principalUsdc;
        require(principal > 0, "Nothing to withdraw");

        (uint256 surplusUsdc, ) = getAccruedSurplusUsdc(msg.sender);
        uint256 unpaid = pos.unpaidAdvanceUsdc;

        if (surplusUsdc >= unpaid) {
            creditReservePoolUsdc += unpaid;
            unpaid = 0;
        } else {
            creditReservePoolUsdc += surplusUsdc;
            unpaid -= surplusUsdc;
        }

        uint256 payoutToUser = principal - unpaid;
        if (unpaid > 0) {
            creditReservePoolUsdc += unpaid;
        }

        pos.principalUsdc = 0;
        pos.usycShares = 0;
        pos.unpaidAdvanceUsdc = 0;

        require(usdc.transfer(msg.sender, payoutToUser), "Withdraw transfer failed");
        emit PrincipalWithdrawn(msg.sender, payoutToUser, unpaid);
    }

    function updateSpendPolicy(uint256 newMaxPerCallLimitUsdc, address newAgentSignerEOA) external {
        UserPosition storage pos = positions[msg.sender];
        require(pos.principalUsdc > 0, "No active vault");
        pos.maxPerCallLimitUsdc = newMaxPerCallLimitUsdc;
        if (newAgentSignerEOA != address(0)) {
            pos.agentSignerEOA = newAgentSignerEOA;
        }
        emit SpendPolicyUpdated(msg.sender, newMaxPerCallLimitUsdc, pos.agentSignerEOA);
    }
}
```