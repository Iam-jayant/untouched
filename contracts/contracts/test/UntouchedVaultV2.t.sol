// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {UntouchedVaultV2} from "../UntouchedVaultV2.sol";

contract MockUSDC {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "bal");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(allowance[from][msg.sender] >= amount, "allow");
        require(balanceOf[from] >= amount, "bal");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract UntouchedVaultV2Test is Test {
    UntouchedVaultV2 vault;
    MockUSDC token;
    address alice = address(uint160(uint256(keccak256("alice"))));
    address bob = address(uint160(uint256(keccak256("bob"))));
    address cre = address(uint160(uint256(keccak256("cre"))));
    address constant USDC = 0x3600000000000000000000000000000000000000;

    function setUp() public {
        vault = new UntouchedVaultV2(cre);
        token = new MockUSDC();
        vm.etch(USDC, address(token).code);
        MockUSDC(USDC).mint(alice, 1_000_000000);
        vm.deal(alice, 1_000 ether);
        vm.deal(bob, 1_000 ether);
    }

    function testNativeDepositAndTopUp() public {
        vm.prank(alice);
        vault.depositNative{value: 50 ether}();
        (uint256 principal, uint256 quota, uint256 used) = vault.positions(alice);
        assertEq(principal, 50_000000);
        assertEq(quota, 95890);
        assertEq(used, 0);

        vm.prank(alice);
        vault.depositNative{value: 10 ether}();
        (principal, quota, used) = vault.positions(alice);
        assertEq(principal, 60_000000);
        assertEq(quota, 95890 + 19178);
        assertEq(vault.depositorCount(), 1);
    }

    function testErc20Deposit() public {
        vm.startPrank(alice);
        MockUSDC(USDC).approve(address(vault), 100_000000);
        vault.deposit(100_000000);
        vm.stopPrank();
        (uint256 principal, uint256 quota, ) = vault.positions(alice);
        assertEq(principal, 100_000000);
        assertEq(quota, 191780);
        assertEq(MockUSDC(USDC).balanceOf(address(vault)), 100_000000);
    }

    function testRecordUsageAndPrincipalFirstWithdraw() public {
        vm.prank(alice);
        vault.depositNative{value: 50 ether}();
        vault.recordUsage(alice, 30000);
        vm.prank(alice);
        vault.withdraw();
        (uint256 principal, uint256 quota, uint256 used) = vault.positions(alice);
        assertEq(principal, 0);
        assertEq(quota, 0);
        assertEq(used, 0);
        assertEq(alice.balance, 1_000 ether - 50 ether + (50_000000 - 30000) * 1e12);
    }

    function testQuotaExceeded() public {
        vm.prank(alice);
        vault.depositNative{value: 50 ether}();
        vm.expectRevert(UntouchedVaultV2.QuotaExceeded.selector);
        vault.recordUsage(alice, 95891);
    }

    function testCreReconcileRefillsQuota() public {
        vm.prank(alice);
        vault.depositNative{value: 50 ether}();
        vault.recordUsage(alice, 30000);
        uint256 ts = block.timestamp;
        vm.warp(ts);
        vm.prank(cre);
        vault.reconcile(alice, 30000);
        (, uint256 quota, uint256 used) = vault.positions(alice);
        assertEq(used, 0);
        assertEq(quota, 95890 + 30000);
    }

    function testGatewayCannotReconcile() public {
        vm.prank(alice);
        vault.depositNative{value: 50 ether}();
        vault.recordUsage(alice, 1);
        vm.expectRevert(UntouchedVaultV2.NotCre.selector);
        vault.reconcile(alice, 1);
    }

    function testBelowMinimum() public {
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(UntouchedVaultV2.BelowMinimum.selector, 1_000000));
        vault.depositNative{value: 1 ether}();
    }
}
