// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {UntouchedVaultV2} from "../UntouchedVaultV2.sol";

contract DeployVaultV2 is Script {
    function run() external returns (UntouchedVaultV2 vault) {
        address cre = vm.envOr("CRE_CALLER", msg.sender);
        vm.startBroadcast();
        vault = new UntouchedVaultV2(cre);
        vm.stopBroadcast();
    }
}
