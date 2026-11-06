// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

interface Vm {
    function prank(address) external;
    function startPrank(address) external;
    function stopPrank() external;
    function deal(address, uint256) external;
    function etch(address, bytes calldata) external;
    function warp(uint256) external;
    function expectRevert(bytes4) external;
    function expectRevert(bytes calldata) external;
    function envOr(string calldata, address) external returns (address);
    function startBroadcast() external;
    function stopBroadcast() external;
}

abstract contract Test {
    bool public IS_TEST = true;
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function assertEq(uint256 a, uint256 b) internal pure {
        require(a == b, "assertEq uint");
    }

    function assertEq(address a, address b) internal pure {
        require(a == b, "assertEq addr");
    }
}

abstract contract Script {
    bool public IS_SCRIPT = true;
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
}
