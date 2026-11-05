// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @title Minimal NAV aggregator interface
/// @notice Provides an eight-decimal NAV and its round metadata.
interface IAggregatorV3 {
    /// @notice Returns the number of decimals used by the answer.
    /// @return The answer precision.
    function decimals() external view returns (uint8);

    /// @notice Returns the latest published NAV round.
    /// @return roundId The round identifier.
    /// @return answer The signed NAV answer.
    /// @return startedAt The round start timestamp.
    /// @return updatedAt The answer update timestamp.
    /// @return answeredInRound The round in which the answer was computed.
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    );
}

/// @title Mock USYC NAV oracle
/// @notice Owner-controlled, cumulative linear 5% annualized NAV simulation; not a live price feed.
contract MockUSYCOracle is Ownable, IAggregatorV3 {
    /// @notice Current published round, initially one.
    uint80 public roundId = 1;
    /// @notice Current eight-decimal NAV, initially 1.00000000.
    int256 public currentNav = 100_000_000;
    /// @notice Timestamp at which this simulation began.
    uint256 public startedAt;
    /// @notice Timestamp of the latest NAV update.
    uint256 public updatedAt;
    /// @notice Cumulative simulated days, independent of elapsed wall-clock time.
    uint256 public totalDaysSimulated;

    error InvalidDaysCount(uint256 daysCount);
    error NavOutOfRange();

    event NavUpdated(uint80 roundId, int256 newNav, uint256 daysSimulated);

    /// @notice Initializes the timestamps and makes the deployer the owner.
    constructor() Ownable(msg.sender) {
        startedAt = block.timestamp;
        updatedAt = block.timestamp;
    }

    /// @notice Returns the NAV precision.
    /// @return Always eight decimals.
    function decimals() external pure override returns (uint8) {
        return 8;
    }

    /// @notice Describes this simulated feed.
    /// @return A human-readable feed description.
    function description() external pure returns (string memory) {
        return "Mock USYC / USDC NAV";
    }

    /// @notice Returns the mock feed version.
    /// @return Always one.
    function version() external pure returns (uint256) {
        return 1;
    }

    /// @notice Returns the current NAV and round metadata.
    /// @return The current round identifier.
    /// @return The current signed, eight-decimal NAV.
    /// @return The simulation start timestamp.
    /// @return The latest update timestamp.
    /// @return The current round identifier as answeredInRound.
    function latestRoundData() external view override returns (uint80, int256, uint256, uint256, uint80) {
        return (roundId, currentNav, startedAt, updatedAt, roundId);
    }

    /// @notice Advances the cumulative NAV simulation; callable only by the owner.
    /// @dev Uses cumulative days to avoid per-update truncation drift. Fourteen days yields 100191780.
    /// @param daysCount Days to add, between one and 3650 inclusive.
    function simulateDaysPassed(uint256 daysCount) external onlyOwner {
        if (daysCount == 0 || daysCount > 3650) revert InvalidDaysCount(daysCount);
        uint256 newTotal = totalDaysSimulated + daysCount;
        uint256 growth = Math.mulDiv(newTotal, 1_369_863, 100);
        if (growth > uint256(type(int256).max) - 100_000_000) revert NavOutOfRange();
        totalDaysSimulated = newTotal;
        roundId += 1;
        updatedAt = block.timestamp;
        currentNav = int256(100_000_000 + growth);
        emit NavUpdated(roundId, currentNav, daysCount);
    }
}

/// @title Untouched principal credit vault
/// @notice Holds six-decimal USDC principal and advances reserve-funded credit to an agent signer.
/// @dev NAV is assumed to use eight decimals. Simulated yield is not cash: only separately funded
/// yieldBackingUsdc can be consumed. At completed transaction boundaries, for standard non-rebasing,
/// non-fee-on-transfer USDC, balanceOf(this) >= sum of live principals + creditReservePool +
/// yieldBackingUsdc. Early exits retain unpaid credit shortfalls from principal and restore reserves.
/// Nullifiers are unique opaque identifiers, not verified World ID proofs. Signers are nonzero
/// addresses; their EOA status is not enforced. No freshness interval is imposed on this mock feed.
contract PrincipalCreditVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Minimum principal deposit in six-decimal USDC units ($10).
    uint256 public constant MIN_DEPOSIT_USDC = 10_000000;
    /// @notice Reserve-funded agent gas buffer in six-decimal USDC units.
    uint256 public constant GAS_BUFFER_USDC = 500;
    /// @notice Initial per-call spend policy in six-decimal USDC units.
    uint256 public constant DEFAULT_MAX_PER_CALL_USDC = 5000;
    /// @notice Annual advance rate in basis points.
    uint256 public constant ADVANCE_BPS = 500;
    /// @notice Number of days prepaid by the advance.
    uint256 public constant ADVANCE_DAYS = 14;
    uint256 private constant SHARE_SCALE = 1e20;

    /// @notice The constructor-supplied six-decimal USDC token.
    IERC20 public immutable usdc;
    /// @notice The constructor-supplied eight-decimal NAV oracle.
    IAggregatorV3 public immutable usycOracle;

    /// @notice Principal, synthetic NAV shares, agent policy, credit debt, and identity identifier.
    struct Position {
        uint256 principalUsdc;
        uint256 shares;
        uint256 maxPerCallUsdc;
        address agentSignerEOA;
        uint256 unpaidAdvanceUsdc;
        bytes32 worldIdNullifier;
    }

    /// @notice Position by depositor; zero shares means no active position.
    mapping(address => Position) public positions;
    /// @notice Available reserve USDC, excluding advances and gas buffers already sent.
    uint256 public creditReservePool;
    /// @notice Separately funded cash available to back simulated surplus.
    uint256 public yieldBackingUsdc;
    /// @notice Whether a nullifier has ever been used, including for closed positions.
    mapping(bytes32 => bool) public usedWorldIdNullifiers;
    /// @notice Number of successful state-recording NAV reads.
    uint256 public oracleReadCount;
    /// @notice Latest NAV observed by a state-recording read.
    int256 public lastObservedNav;
    /// @notice Latest round observed by a state-recording read.
    uint80 public lastObservedRound;

    error ZeroAddress();
    error ZeroAmount();
    error DepositBelowMinimum(uint256 amountUsdc);
    error InvalidNullifier();
    error NullifierAlreadyUsed(bytes32 nullifier);
    error PositionAlreadyExists(address user);
    error PositionNotFound(address user);
    error ZeroShares();
    error InsufficientReserve(uint256 availableUsdc, uint256 requiredUsdc);
    error InvalidOracleAnswer(int256 answer);
    error InvalidOracleRound(uint80 roundId, uint80 answeredInRound, uint256 updatedAt);

    event ReservePoolFunded(uint256 amount);
    event DepositWithAdvance(address indexed user, uint256 principalUsdc, uint256 advanceUsdc, uint256 shares, address agentSignerEOA, bytes32 worldIdNullifier);
    event YieldReconciled(address indexed user, uint256 surplusUsdc, uint256 repaidUsdc);
    event PrincipalWithdrawn(address indexed user, uint256 payoutUsdc, uint256 unpaidShortfallUsdc);
    event SpendPolicyUpdated(address indexed user, uint256 newMaxPerCallUsdc, address newAgentSignerEOA);
    event YieldBackingFunded(uint256 amount);

    /// @notice Initializes the token, oracle, and deployer ownership.
    /// @param _usdc Nonzero address of the six-decimal USDC token.
    /// @param _usycOracle Nonzero address of the eight-decimal NAV oracle.
    constructor(address _usdc, address _usycOracle) Ownable(msg.sender) {
        if (_usdc == address(0) || _usycOracle == address(0)) revert ZeroAddress();
        usdc = IERC20(_usdc);
        usycOracle = IAggregatorV3(_usycOracle);
    }

    /// @notice Funds available advance reserves from the owner, who must approve USDC first.
    /// @param amountUsdc Positive amount of six-decimal USDC to transfer.
    function fundReservePool(uint256 amountUsdc) external onlyOwner nonReentrant {
        if (amountUsdc == 0) revert ZeroAmount();
        creditReservePool += amountUsdc;
        usdc.safeTransferFrom(msg.sender, address(this), amountUsdc);
        emit ReservePoolFunded(amountUsdc);
    }

    /// @notice Funds real cash backing for simulated yield; the owner must approve USDC first.
    /// @param amountUsdc Positive amount of six-decimal USDC to transfer.
    function fundYieldBacking(uint256 amountUsdc) external onlyOwner nonReentrant {
        if (amountUsdc == 0) revert ZeroAmount();
        yieldBackingUsdc += amountUsdc;
        usdc.safeTransferFrom(msg.sender, address(this), amountUsdc);
        emit YieldBackingFunded(amountUsdc);
    }

    /// @notice Deposits principal and sends a 14-day credit advance plus gas buffer to the agent.
    /// @dev Requires prior USDC approval and an unused nullifier; no maximum deposit is imposed.
    /// All effects precede token interactions. Nullifiers remain consumed after withdrawal.
    /// @param amountUsdc Principal in six-decimal USDC, at least MIN_DEPOSIT_USDC.
    /// @param agentSignerEOA Nonzero recipient of the advance and future reconciled excess yield.
    /// @param worldIdNullifier Nonzero, previously unused opaque identity identifier.
    function depositWithCreditAdvance(uint256 amountUsdc, address agentSignerEOA, bytes32 worldIdNullifier)
        external nonReentrant
    {
        if (amountUsdc < MIN_DEPOSIT_USDC) revert DepositBelowMinimum(amountUsdc);
        if (agentSignerEOA == address(0)) revert ZeroAddress();
        if (worldIdNullifier == bytes32(0)) revert InvalidNullifier();
        if (usedWorldIdNullifiers[worldIdNullifier]) revert NullifierAlreadyUsed(worldIdNullifier);
        if (positions[msg.sender].shares != 0) revert PositionAlreadyExists(msg.sender);
        usedWorldIdNullifiers[worldIdNullifier] = true;

        uint256 nav = _readNavAndRecord();
        uint256 shares = Math.mulDiv(amountUsdc, SHARE_SCALE, nav);
        if (shares == 0) revert ZeroShares();
        uint256 advance = Math.mulDiv(amountUsdc, ADVANCE_BPS * ADVANCE_DAYS, 10_000 * 365);
        uint256 reserveCost = advance + GAS_BUFFER_USDC;
        if (creditReservePool < reserveCost) revert InsufficientReserve(creditReservePool, reserveCost);
        creditReservePool -= reserveCost;
        positions[msg.sender] = Position({
            principalUsdc: amountUsdc,
            shares: shares,
            maxPerCallUsdc: DEFAULT_MAX_PER_CALL_USDC,
            agentSignerEOA: agentSignerEOA,
            unpaidAdvanceUsdc: advance,
            worldIdNullifier: worldIdNullifier
        });
        usdc.safeTransferFrom(msg.sender, address(this), amountUsdc);
        usdc.safeTransfer(agentSignerEOA, reserveCost);
        emit DepositWithAdvance(msg.sender, amountUsdc, advance, shares, agentSignerEOA, worldIdNullifier);
    }

    /// @notice Returns simulated accrued surplus without capping it to available cash backing.
    /// @dev Validates the oracle but does not record the read. Returns zero for absent positions
    /// after oracle validation; this value is not a promise of immediately payable cash.
    /// @param user Depositor whose surplus is requested.
    /// @return Surplus in six-decimal USDC units, floored at zero.
    function getAccruedSurplusUsdc(address user) external view returns (uint256) {
        return _rawSurplus(positions[user], _navView());
    }

    /// @notice Permissionlessly settles fully coverable credit and sends backed excess to the agent.
    /// @dev If backed surplus cannot fully cover debt, only oracle records and the event change.
    /// Consumed yield burns shares rounded upward; principal remains fully accounted for in cash.
    /// @param user Depositor whose active position is reconciled.
    function reconcileAndRepay(address user) external nonReentrant {
        Position storage position = positions[user];
        if (position.shares == 0) revert PositionNotFound(user);
        uint256 nav = _readNavAndRecord();
        uint256 s = Math.min(_rawSurplus(position, nav), yieldBackingUsdc);
        uint256 repaid;
        if (s >= position.unpaidAdvanceUsdc && s > 0) {
            uint256 burnedShares = Math.min(Math.mulDiv(s, SHARE_SCALE, nav, Math.Rounding.Ceil), position.shares);
            position.shares -= burnedShares;
            yieldBackingUsdc -= s;
            repaid = position.unpaidAdvanceUsdc;
            creditReservePool += repaid;
            position.unpaidAdvanceUsdc = 0;
            uint256 excess = s - repaid;
            if (excess > 0) usdc.safeTransfer(position.agentSignerEOA, excess);
        }
        emit YieldReconciled(user, s, repaid);
    }

    /// @notice Closes the caller's position and pays principal plus backed yield minus unpaid credit.
    /// @dev Consumes backed surplus first, retains any remaining credit shortfall from principal,
    /// and restores the entire unpaid advance to reserves. The gas buffer is not recovered.
    /// Zero-yield early exit is supported. The nullifier remains permanently consumed.
    function withdrawPrincipal() external nonReentrant {
        Position storage position = positions[msg.sender];
        if (position.shares == 0) revert PositionNotFound(msg.sender);
        uint256 nav = _readNavAndRecord();
        uint256 s = Math.min(_rawSurplus(position, nav), yieldBackingUsdc);
        uint256 advance = position.unpaidAdvanceUsdc;
        uint256 shortfall;
        uint256 payout;
        if (s >= advance) {
            payout = position.principalUsdc + (s - advance);
        } else {
            shortfall = advance - s;
            payout = position.principalUsdc - shortfall;
        }
        yieldBackingUsdc -= s;
        creditReservePool += advance;
        delete positions[msg.sender];
        usdc.safeTransfer(msg.sender, payout);
        emit PrincipalWithdrawn(msg.sender, payout, shortfall);
    }

    /// @notice Updates the caller's positive per-call limit and optionally replaces their signer.
    /// @dev This stores an off-chain gateway policy; the vault does not execute agent spending.
    /// @param newMaxPerCallUsdc New positive six-decimal USDC limit, always applied.
    /// @param newAgentSignerEOA Replacement signer, or zero to retain the existing signer.
    function updateSpendPolicy(uint256 newMaxPerCallUsdc, address newAgentSignerEOA) external {
        Position storage position = positions[msg.sender];
        if (position.shares == 0) revert PositionNotFound(msg.sender);
        if (newMaxPerCallUsdc == 0) revert ZeroAmount();
        position.maxPerCallUsdc = newMaxPerCallUsdc;
        if (newAgentSignerEOA != address(0)) position.agentSignerEOA = newAgentSignerEOA;
        emit SpendPolicyUpdated(msg.sender, newMaxPerCallUsdc, position.agentSignerEOA);
    }

    /// @dev Validates the latest oracle round and records a state-changing observation.
    function _readNavAndRecord() internal returns (uint256 nav) {
        (int256 answer, uint80 round) = _validatedRound();
        lastObservedNav = answer;
        lastObservedRound = round;
        oracleReadCount += 1;
        return uint256(answer);
    }

    /// @dev Performs identical oracle validation without recording an observation.
    function _navView() internal view returns (uint256) {
        (int256 answer,) = _validatedRound();
        return uint256(answer);
    }

    /// @dev Rejects nonpositive answers, uninitialized timestamps, and incomplete rounds.
    function _validatedRound() private view returns (int256 answer, uint80 round) {
        uint256 updatedAt;
        uint80 answeredInRound;
        (round, answer,, updatedAt, answeredInRound) = usycOracle.latestRoundData();
        if (answer <= 0) revert InvalidOracleAnswer(answer);
        if (updatedAt == 0 || answeredInRound < round) {
            revert InvalidOracleRound(round, answeredInRound, updatedAt);
        }
    }

    /// @dev Calculates floor(shares * nav / 1e20) minus principal, floored at zero.
    function _rawSurplus(Position storage position, uint256 nav) private view returns (uint256) {
        uint256 value = Math.mulDiv(position.shares, nav, SHARE_SCALE);
        return value > position.principalUsdc ? value - position.principalUsdc : 0;
    }
}
