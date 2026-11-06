// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title Untouched vault
/// @notice Stakes Arc USDC. Principal stays put. A 14-day 5% APY quota pays inference.
/// @dev Native msg.value is 18-decimal USDC. The ERC-20 precompile is the same asset at 6 decimals.
///      1 micro-USDC = 1e12 wei. Never reads prevrandao. Timestamp checks use >=.
contract UntouchedVaultV2 {
    address public constant USDC = 0x3600000000000000000000000000000000000000;
    uint256 public constant NATIVE_PER_MICRO = 1e12;
    uint256 public constant MIN_DEPOSIT = 10_000000;

    address public owner;
    address public creCaller;
    uint256 public lastReconciledAt;

    struct Position {
        uint256 principal;
        uint256 yieldQuota;
        uint256 usedCredit;
    }

    mapping(address => Position) public positions;
    address[] public depositors;
    mapping(address => bool) public isDepositor;

    error NotOwner();
    error NotCre();
    error ZeroAmount();
    error BelowMinimum(uint256 amount6Dec);
    error NoPosition();
    error QuotaExceeded();
    error TransferFailed();
    error StaleTimestamp();

    event Deposited(address indexed user, uint256 amount6Dec, uint256 quotaAdded);
    event UsageRecorded(address indexed user, uint256 amount6Dec, uint256 usedCredit);
    event Withdrawn(address indexed user, uint256 payout6Dec);
    event Reconciled(address indexed user, uint256 surplus6Dec, uint256 repaid);
    event CreCallerSet(address indexed creCaller);

    constructor(address cre) {
        owner = msg.sender;
        creCaller = cre == address(0) ? msg.sender : cre;
        lastReconciledAt = block.timestamp;
    }

    function setCreCaller(address cre) external {
        if (msg.sender != owner) revert NotOwner();
        if (cre == address(0)) revert ZeroAmount();
        creCaller = cre;
        emit CreCallerSet(cre);
    }

    function depositNative() external payable {
        uint256 amount6Dec = msg.value / NATIVE_PER_MICRO;
        if (amount6Dec < MIN_DEPOSIT) revert BelowMinimum(amount6Dec);
        uint256 kept = amount6Dec * NATIVE_PER_MICRO;
        uint256 dust = msg.value - kept;
        _credit(msg.sender, amount6Dec);
        if (dust > 0) {
            (bool ok, ) = payable(msg.sender).call{value: dust}("");
            if (!ok) revert TransferFailed();
        }
    }

    function deposit(uint256 amount6Dec) external {
        if (amount6Dec < MIN_DEPOSIT) revert BelowMinimum(amount6Dec);
        bool ok = IERC20(USDC).transferFrom(msg.sender, address(this), amount6Dec);
        if (!ok) revert TransferFailed();
        _credit(msg.sender, amount6Dec);
    }

    function recordUsage(address user, uint256 amount6Dec) external {
        if (msg.sender != owner) revert NotOwner();
        if (amount6Dec == 0) revert ZeroAmount();
        Position storage pos = positions[user];
        if (pos.principal == 0) revert NoPosition();
        if (pos.usedCredit + amount6Dec > pos.yieldQuota) revert QuotaExceeded();
        pos.usedCredit += amount6Dec;
        emit UsageRecorded(user, amount6Dec, pos.usedCredit);
    }

    function withdraw() external {
        Position storage pos = positions[msg.sender];
        if (pos.principal == 0 && pos.usedCredit == 0 && pos.yieldQuota == 0) revert NoPosition();
        uint256 payout6Dec = pos.principal > pos.usedCredit ? pos.principal - pos.usedCredit : 0;
        pos.principal = 0;
        pos.yieldQuota = 0;
        pos.usedCredit = 0;
        if (payout6Dec > 0) {
            uint256 nativeAmount = payout6Dec * NATIVE_PER_MICRO;
            if (address(this).balance >= nativeAmount) {
                (bool ok, ) = payable(msg.sender).call{value: nativeAmount}("");
                if (!ok) revert TransferFailed();
            } else {
                bool ok = IERC20(USDC).transfer(msg.sender, payout6Dec);
                if (!ok) revert TransferFailed();
            }
        }
        emit Withdrawn(msg.sender, payout6Dec);
    }

    /// @notice CRE repays used yield and restores the quota. Same-second blocks are allowed.
    function reconcile(address user, uint256 surplus6Dec) external {
        if (msg.sender != creCaller) revert NotCre();
        if (block.timestamp < lastReconciledAt) revert StaleTimestamp();
        lastReconciledAt = block.timestamp;
        Position storage pos = positions[user];
        uint256 repay = surplus6Dec < pos.usedCredit ? surplus6Dec : pos.usedCredit;
        pos.usedCredit -= repay;
        pos.yieldQuota += repay;
        emit Reconciled(user, surplus6Dec, repay);
    }

    function depositorCount() external view returns (uint256) {
        return depositors.length;
    }

    function quotaFor(uint256 amount6Dec) public pure returns (uint256) {
        return (amount6Dec * 500 * 14) / (10000 * 365);
    }

    function _credit(address user, uint256 amount6Dec) internal {
        uint256 quota = quotaFor(amount6Dec);
        if (!isDepositor[user]) {
            isDepositor[user] = true;
            depositors.push(user);
        }
        Position storage pos = positions[user];
        pos.principal += amount6Dec;
        pos.yieldQuota += quota;
        emit Deposited(user, amount6Dec, quota);
    }
}
