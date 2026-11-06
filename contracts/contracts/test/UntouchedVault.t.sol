// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {MockUSYCOracle, PrincipalCreditVault} from "../UntouchedVault.sol";

/// @dev Minimal 6-decimal ERC20 used as USDC.
contract MockUSDC6 {
    string public constant name = "Mock USDC";
    string public constant symbol = "mUSDC";
    uint8 public constant decimals = 6;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
        emit Transfer(address(0), to, amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _move(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 a = allowance[from][msg.sender];
        if (a != type(uint256).max) {
            require(a >= amount, "allowance");
            allowance[from][msg.sender] = a - amount;
        }
        _move(from, to, amount);
        return true;
    }

    function _move(address from, address to, uint256 amount) internal {
        require(balanceOf[from] >= amount, "balance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}

abstract contract UntouchedVaultBase is Test {
    MockUSDC6 internal usdc;
    MockUSYCOracle internal oracle;
    PrincipalCreditVault internal vault;

    address internal owner = makeAddr("owner");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal agent = makeAddr("agent");
    address internal agent2 = makeAddr("agent2");
    address internal rando = makeAddr("rando");

    bytes32 internal constant N1 = keccak256("nullifier-1");
    bytes32 internal constant N2 = keccak256("nullifier-2");

    uint256 internal constant POOL = 100_000e6;
    uint256 internal constant BACKING = 100_000e6;

    function setUp() public virtual {
        usdc = new MockUSDC6();
        vm.startPrank(owner);
        oracle = new MockUSYCOracle();
        vault = new PrincipalCreditVault(address(usdc), address(oracle));
        usdc.mint(owner, POOL + BACKING);
        usdc.approve(address(vault), type(uint256).max);
        vault.fundReservePool(POOL);
        vault.fundYieldBacking(BACKING);
        vm.stopPrank();

        usdc.mint(alice, 10_000_000e6);
        usdc.mint(bob, 10_000_000e6);
        vm.prank(alice);
        usdc.approve(address(vault), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(vault), type(uint256).max);
    }

    function _deposit(address who, uint256 amt, address signer, bytes32 n) internal {
        vm.prank(who);
        vault.depositWithCreditAdvance(amt, signer, n);
    }

    function _pos(address who)
        internal
        view
        returns (uint256 principal, uint256 shares, uint256 maxPerCall, address signer, uint256 unpaid, bytes32 n)
    {
        return vault.positions(who);
    }

    function _sim(uint256 d) internal {
        vm.prank(owner);
        oracle.simulateDaysPassed(d);
    }
}

contract UntouchedVaultTest is UntouchedVaultBase {
    // ---------- (1) $50 deposit ----------
    function test_Deposit50() public {
        uint256 poolBefore = vault.creditReservePool();
        uint256 agentBefore = usdc.balanceOf(agent);
        uint256 aliceBefore = usdc.balanceOf(alice);

        vm.expectEmit(true, false, false, true, address(vault));
        emit PrincipalCreditVault.DepositWithAdvance(alice, 50e6, 95890, 50e18, agent, N1);
        _deposit(alice, 50e6, agent, N1);

        (uint256 p, uint256 sh, uint256 mx, address sg, uint256 unpaid, bytes32 n) = _pos(alice);
        assertEq(p, 50e6);
        assertEq(sh, 50e18);
        assertEq(mx, 5000);
        assertEq(sg, agent);
        assertEq(unpaid, 95890);
        assertEq(n, N1);
        assertEq(usdc.balanceOf(agent) - agentBefore, 96390);
        assertEq(aliceBefore - usdc.balanceOf(alice), 50e6);
        assertEq(poolBefore - vault.creditReservePool(), 96390);
        assertTrue(vault.usedNullifiers(N1));
        assertEq(vault.oracleReadCount(), 1);
    }

    // ---------- (2) $100 and other sizes ----------
    function test_Deposit100() public {
        _deposit(alice, 100e6, agent, N1);
        (, uint256 sh,,, uint256 unpaid,) = _pos(alice);
        assertEq(sh, 100e18);
        assertEq(unpaid, 191780);
        assertEq(usdc.balanceOf(agent), 192280);
    }

    function test_Deposit10And250Advances() public {
        _deposit(alice, 10e6, agent, N1);
        (,,,, uint256 u1,) = _pos(alice);
        assertEq(u1, 19178);
        assertEq(usdc.balanceOf(agent), 19178 + 500);

        _deposit(bob, 250e6, agent2, N2);
        (,,,, uint256 u2,) = _pos(bob);
        assertEq(u2, 479452);
        assertEq(usdc.balanceOf(agent2), 479452 + 500);
    }

    // ---------- (3) oracle + reconcile ----------
    function test_SimulateDays14() public {
        vm.expectEmit(false, false, false, true, address(oracle));
        emit MockUSYCOracle.NavUpdated(2, 100_191_780, 14);
        _sim(14);
        assertEq(oracle.currentNav(), 100_191_780);
        assertEq(oracle.roundId(), 2);
        assertEq(oracle.totalDaysSimulated(), 14);
    }

    function test_SimulateDaysOnlyOwner() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        oracle.simulateDaysPassed(14);
    }

    function test_SimulateDaysInvalidCount() public {
        vm.startPrank(owner);
        vm.expectRevert(abi.encodeWithSelector(MockUSYCOracle.InvalidDaysCount.selector, 0));
        oracle.simulateDaysPassed(0);
        vm.expectRevert(abi.encodeWithSelector(MockUSYCOracle.InvalidDaysCount.selector, 3651));
        oracle.simulateDaysPassed(3651);
        vm.stopPrank();
    }

    function _reconcileCase(uint256 amt, uint256 advance) internal {
        _deposit(alice, amt, agent, N1);
        _sim(14);
        uint256 pool = vault.creditReservePool();
        uint256 backing = vault.yieldBackingUsdc();
        uint256 agentBal = usdc.balanceOf(agent);
        uint256 reads = vault.oracleReadCount();

        assertEq(vault.getAccruedSurplusUsdc(alice), advance);

        vm.expectEmit(true, false, false, true, address(vault));
        emit PrincipalCreditVault.YieldReconciled(alice, advance, advance);
        vm.prank(rando);
        vault.reconcileAndRepay(alice);

        (uint256 p, uint256 sh,,, uint256 unpaid,) = _pos(alice);
        assertEq(unpaid, 0);
        assertEq(p, amt);
        assertLt(sh, amt * 1e12);
        assertEq(vault.creditReservePool(), pool + advance);
        assertEq(vault.yieldBackingUsdc(), backing - advance);
        assertEq(vault.oracleReadCount(), reads + 1);
        assertEq(vault.lastObservedNav(), 100_191_780);
        assertEq(vault.lastObservedRound(), 2);
        assertEq(usdc.balanceOf(agent), agentBal); // no excess
        // surplus fully consumed
        assertEq(vault.getAccruedSurplusUsdc(alice), 0);
    }

    function test_ReconcileAfter14Days_50() public {
        _reconcileCase(50e6, 95890);
    }

    function test_ReconcileAfter14Days_100() public {
        _reconcileCase(100e6, 191780);
    }

    function test_ReconcileNoPositionReverts() public {
        vm.expectRevert(abi.encodeWithSelector(PrincipalCreditVault.PositionNotFound.selector, alice));
        vault.reconcileAndRepay(alice);
    }

    function test_ReconcileBeforeYieldDoesNotRepay() public {
        _deposit(alice, 50e6, agent, N1);
        vault.reconcileAndRepay(alice);
        (,,,, uint256 unpaid,) = _pos(alice);
        assertEq(unpaid, 95890);
        assertEq(vault.oracleReadCount(), 2);
    }

    function test_ReconcileSendsExcessToAgent() public {
        _deposit(alice, 50e6, agent, N1);
        _sim(28);
        uint256 s = vault.getAccruedSurplusUsdc(alice);
        assertGt(s, 95890);
        uint256 agentBal = usdc.balanceOf(agent);
        vault.reconcileAndRepay(alice);
        assertEq(usdc.balanceOf(agent) - agentBal, s - 95890);
        (,,,, uint256 unpaid,) = _pos(alice);
        assertEq(unpaid, 0);
    }

    // ---------- (4) withdrawals ----------
    function test_EarlyExitWithdraw() public {
        uint256 poolStart = vault.creditReservePool();
        uint256 backing = vault.yieldBackingUsdc();
        _deposit(alice, 50e6, agent, N1);
        uint256 poolAfterDeposit = vault.creditReservePool();
        uint256 aliceBefore = usdc.balanceOf(alice);

        vm.expectEmit(true, false, false, true, address(vault));
        emit PrincipalCreditVault.PrincipalWithdrawn(alice, 50_000000 - 95890, 95890);
        vm.prank(alice);
        vault.withdrawPrincipal();

        assertEq(usdc.balanceOf(alice) - aliceBefore, 50_000000 - 95890);
        assertEq(vault.creditReservePool(), poolAfterDeposit + 95890);
        assertEq(vault.creditReservePool(), poolStart - 500); // only gas buffer lost
        assertEq(vault.yieldBackingUsdc(), backing);
        (uint256 p, uint256 sh, uint256 mx, address sg, uint256 u, bytes32 n) = _pos(alice);
        assertEq(p, 0);
        assertEq(sh, 0);
        assertEq(mx, 0);
        assertEq(sg, address(0));
        assertEq(u, 0);
        assertEq(n, bytes32(0));
    }

    function test_WithdrawAfter14DaysReturnsFullPrincipal() public {
        uint256 backing = vault.yieldBackingUsdc();
        uint256 poolStart = vault.creditReservePool();
        _deposit(alice, 50e6, agent, N1);
        _sim(14);
        uint256 aliceBefore = usdc.balanceOf(alice);

        vm.expectEmit(true, false, false, true, address(vault));
        emit PrincipalCreditVault.PrincipalWithdrawn(alice, 50e6, 0);
        vm.prank(alice);
        vault.withdrawPrincipal();

        assertEq(usdc.balanceOf(alice) - aliceBefore, 50e6);
        assertEq(vault.yieldBackingUsdc(), backing - 95890);
        assertEq(vault.creditReservePool(), poolStart - 500);
        (, uint256 sh,,,,) = _pos(alice);
        assertEq(sh, 0);
    }

    function test_WithdrawAfterReconcileReturnsFullPrincipal() public {
        _deposit(alice, 100e6, agent, N1);
        _sim(14);
        vault.reconcileAndRepay(alice);
        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        vault.withdrawPrincipal();
        assertEq(usdc.balanceOf(alice) - aliceBefore, 100e6);
    }

    function test_WithdrawPartialYieldAfter7Days() public {
        _deposit(alice, 50e6, agent, N1);
        _sim(7);
        uint256 s = 47945; // floor(50e18 * 100_095_890 / 1e20) - 50e6
        assertEq(vault.getAccruedSurplusUsdc(alice), s);
        uint256 backing = vault.yieldBackingUsdc();
        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        vault.withdrawPrincipal();
        assertEq(usdc.balanceOf(alice) - aliceBefore, 50e6 - (95890 - s));
        assertEq(vault.yieldBackingUsdc(), backing - s);
    }

    function test_WithdrawYieldCappedByBacking() public {
        // fresh vault with zero yield backing: yield is simulated only, never paid
        vm.startPrank(owner);
        PrincipalCreditVault v = new PrincipalCreditVault(address(usdc), address(oracle));
        usdc.mint(owner, 10_000e6);
        usdc.approve(address(v), type(uint256).max);
        v.fundReservePool(10_000e6);
        vm.stopPrank();
        vm.prank(alice);
        usdc.approve(address(v), type(uint256).max);
        vm.prank(alice);
        v.depositWithCreditAdvance(50e6, agent, N1);
        _sim(14);
        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        v.withdrawPrincipal();
        assertEq(usdc.balanceOf(alice) - aliceBefore, 50e6 - 95890);
    }

    function test_WithdrawNoPositionReverts() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(PrincipalCreditVault.PositionNotFound.selector, alice));
        vault.withdrawPrincipal();
    }

    // ---------- (5) deposit nullifier ----------
    function test_SameNullifierSecondDepositReverts() public {
        _deposit(alice, 50e6, agent, N1);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(PrincipalCreditVault.NullifierAlreadyUsed.selector, N1));
        vault.depositWithCreditAdvance(50e6, agent2, N1);
    }

    function test_SameNullifierRevertsFromSameAddressAfterWithdrawal() public {
        _deposit(alice, 50e6, agent, N1);
        vm.prank(alice);
        vault.withdrawPrincipal();
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(PrincipalCreditVault.NullifierAlreadyUsed.selector, N1));
        vault.depositWithCreditAdvance(50e6, agent, N1);
    }

    function test_SameNullifierRevertsFromOtherAddressAfterWithdrawal() public {
        _deposit(alice, 50e6, agent, N1);
        vm.prank(alice);
        vault.withdrawPrincipal();
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(PrincipalCreditVault.NullifierAlreadyUsed.selector, N1));
        vault.depositWithCreditAdvance(50e6, agent, N1);
    }

    function test_FreshNullifierAfterWithdrawalSucceeds() public {
        _deposit(alice, 50e6, agent, N1);
        vm.prank(alice);
        vault.withdrawPrincipal();
        _deposit(alice, 50e6, agent, N2);
        (, uint256 sh,,,,) = _pos(alice);
        assertEq(sh, 50e18);
    }

    function test_ZeroNullifierReverts() public {
        vm.prank(alice);
        vm.expectRevert(PrincipalCreditVault.InvalidNullifier.selector);
        vault.depositWithCreditAdvance(50e6, agent, bytes32(0));
    }

    // ---------- (6) minimum ----------
    function test_BelowMinimumReverts() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(PrincipalCreditVault.DepositBelowMinimum.selector, 9_990000));
        vault.depositWithCreditAdvance(9_990000, agent, N1);
    }

    function test_ExactMinimumSucceeds() public {
        _deposit(alice, 10_000000, agent, N1);
        (uint256 p,,,,,) = _pos(alice);
        assertEq(p, 10_000000);
    }

    // ---------- misc ----------
    function test_ZeroSignerDepositReverts() public {
        vm.prank(alice);
        vm.expectRevert(PrincipalCreditVault.ZeroAddress.selector);
        vault.depositWithCreditAdvance(50e6, address(0), N1);
    }

    function test_DoubleDepositSameAddressReverts() public {
        _deposit(alice, 50e6, agent, N1);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(PrincipalCreditVault.PositionAlreadyExists.selector, alice));
        vault.depositWithCreditAdvance(50e6, agent, N2);
    }

    function test_ReserveTooSmallReverts() public {
        vm.startPrank(owner);
        PrincipalCreditVault v = new PrincipalCreditVault(address(usdc), address(oracle));
        usdc.mint(owner, 96389);
        usdc.approve(address(v), type(uint256).max);
        v.fundReservePool(96389);
        vm.stopPrank();
        vm.prank(alice);
        usdc.approve(address(v), type(uint256).max);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(PrincipalCreditVault.InsufficientReserve.selector, 96389, 96390));
        v.depositWithCreditAdvance(50e6, agent, N1);
    }

    function test_FundEventsAndState() public {
        usdc.mint(owner, 3e6);
        vm.startPrank(owner);
        uint256 pool = vault.creditReservePool();
        uint256 backing = vault.yieldBackingUsdc();
        vm.expectEmit(false, false, false, true, address(vault));
        emit PrincipalCreditVault.ReservePoolFunded(1e6);
        vault.fundReservePool(1e6);
        vm.expectEmit(false, false, false, true, address(vault));
        emit PrincipalCreditVault.YieldBackingFunded(2e6);
        vault.fundYieldBacking(2e6);
        vm.stopPrank();
        assertEq(vault.creditReservePool(), pool + 1e6);
        assertEq(vault.yieldBackingUsdc(), backing + 2e6);
    }

    function test_FundZeroReverts() public {
        vm.startPrank(owner);
        vm.expectRevert(PrincipalCreditVault.ZeroAmount.selector);
        vault.fundReservePool(0);
        vm.expectRevert(PrincipalCreditVault.ZeroAmount.selector);
        vault.fundYieldBacking(0);
        vm.stopPrank();
    }

    function test_NonOwnerCannotFund() public {
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        vault.fundReservePool(1e6);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        vault.fundYieldBacking(1e6);
        vm.stopPrank();
    }

    function test_ConstructorZeroAddressReverts() public {
        vm.expectRevert(PrincipalCreditVault.ZeroAddress.selector);
        new PrincipalCreditVault(address(0), address(oracle));
        vm.expectRevert(PrincipalCreditVault.ZeroAddress.selector);
        new PrincipalCreditVault(address(usdc), address(0));
    }

    // ---------- updateSpendPolicy ----------
    function test_UpdateSpendPolicyKeepsSignerOnZero() public {
        _deposit(alice, 50e6, agent, N1);
        vm.expectEmit(true, false, false, true, address(vault));
        emit PrincipalCreditVault.SpendPolicyUpdated(alice, 7777, agent);
        vm.prank(alice);
        vault.updateSpendPolicy(7777, address(0));
        (,, uint256 mx, address sg,,) = _pos(alice);
        assertEq(mx, 7777);
        assertEq(sg, agent);
    }

    function test_UpdateSpendPolicyReplacesSigner() public {
        _deposit(alice, 50e6, agent, N1);
        vm.expectEmit(true, false, false, true, address(vault));
        emit PrincipalCreditVault.SpendPolicyUpdated(alice, 1234, agent2);
        vm.prank(alice);
        vault.updateSpendPolicy(1234, agent2);
        (,, uint256 mx, address sg,,) = _pos(alice);
        assertEq(mx, 1234);
        assertEq(sg, agent2);
    }

    function test_UpdateSpendPolicyReverts() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(PrincipalCreditVault.PositionNotFound.selector, alice));
        vault.updateSpendPolicy(1, address(0));

        _deposit(alice, 50e6, agent, N1);
        vm.prank(alice);
        vm.expectRevert(PrincipalCreditVault.ZeroAmount.selector);
        vault.updateSpendPolicy(0, agent2);
    }

    // ---------- fuzz ----------
    function testFuzz_Deposit(uint256 amt) public {
        amt = bound(amt, 10_000000, 1_000_000e6);
        uint256 advance = amt * 7000 / 3_650_000;
        uint256 poolBefore = vault.creditReservePool();
        uint256 balBefore = usdc.balanceOf(address(vault));
        _deposit(alice, amt, agent, N1);
        (uint256 p, uint256 sh,,, uint256 unpaid,) = _pos(alice);
        assertEq(p, amt);
        assertEq(sh, amt * 1e12);
        assertEq(unpaid, advance);
        assertEq(usdc.balanceOf(agent), advance + 500);
        assertEq(poolBefore - vault.creditReservePool(), advance + 500);
        assertEq(usdc.balanceOf(address(vault)) - balBefore, amt - advance - 500);
    }

    function testFuzz_EarlyExitPayout(uint256 amt) public {
        amt = bound(amt, 10_000000, 1_000_000e6);
        uint256 advance = amt * 7000 / 3_650_000;
        _deposit(alice, amt, agent, N1);
        uint256 before = usdc.balanceOf(alice);
        vm.prank(alice);
        vault.withdrawPrincipal();
        assertEq(usdc.balanceOf(alice) - before, amt - advance);
    }

    function testFuzz_DepositThenYieldThenWithdrawNeverLosesMoreThanAdvance(uint256 amt, uint256 d) public {
        amt = bound(amt, 10_000000, 1_000_000e6);
        d = bound(d, 1, 400);
        uint256 advance = amt * 7000 / 3_650_000;
        _deposit(alice, amt, agent, N1);
        _sim(d);
        uint256 before = usdc.balanceOf(alice);
        vm.prank(alice);
        vault.withdrawPrincipal();
        assertGe(usdc.balanceOf(alice) - before, amt - advance);
    }
}

/// @dev Drives bounded random action sequences against the vault.
contract VaultHandler is Test {
    PrincipalCreditVault public vault;
    MockUSDC6 public usdc;
    MockUSYCOracle public oracle;
    address[] public actors;
    uint256 public nonce;

    constructor(PrincipalCreditVault v, MockUSDC6 u, MockUSYCOracle o) {
        vault = v;
        usdc = u;
        oracle = o;
        for (uint256 i = 0; i < 5; i++) {
            actors.push(makeAddr(string(abi.encodePacked("actor", i))));
        }
    }

    function actorCount() external view returns (uint256) {
        return actors.length;
    }

    function deposit(uint256 seed, uint256 amt) external {
        address a = actors[seed % actors.length];
        (, uint256 shares,,,,) = vault.positions(a);
        if (shares != 0) return;
        amt = bound(amt, 10_000000, 10_000e6);
        usdc.mint(a, amt);
        vm.startPrank(a);
        usdc.approve(address(vault), amt);
        vault.depositWithCreditAdvance(amt, makeAddr("sig"), keccak256(abi.encode(++nonce)));
        vm.stopPrank();
    }

    function reconcile(uint256 seed) external {
        address a = actors[seed % actors.length];
        (, uint256 shares,,,,) = vault.positions(a);
        if (shares == 0) return;
        vault.reconcileAndRepay(a);
    }

    function withdraw(uint256 seed) external {
        address a = actors[seed % actors.length];
        (, uint256 shares,,,,) = vault.positions(a);
        if (shares == 0) return;
        vm.prank(a);
        vault.withdrawPrincipal();
    }

    function warpDays(uint256 d) external {
        d = bound(d, 1, 30);
        oracle.simulateDaysPassed(d);
    }
}

contract UntouchedVaultInvariantTest is UntouchedVaultBase {
    VaultHandler internal handler;

    function setUp() public override {
        super.setUp();
        handler = new VaultHandler(vault, usdc, oracle);
        vm.prank(owner);
        oracle.transferOwnership(address(handler));
        targetContract(address(handler));
    }

    // PROPERTY: vault cash always covers live principals + reserve pool + yield backing.
    function invariant_Solvency() public view {
        uint256 sum;
        for (uint256 i = 0; i < handler.actorCount(); i++) {
            (uint256 p,,,,,) = vault.positions(handler.actors(i));
            sum += p;
        }
        assertGe(usdc.balanceOf(address(vault)), sum + vault.creditReservePool() + vault.yieldBackingUsdc());
    }
}
