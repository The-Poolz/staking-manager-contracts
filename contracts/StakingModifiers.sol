// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import "./StakingState.sol";

abstract contract StakingModifiers is StakingState {
    modifier amountGreaterThanZero(uint256 amount) {
        if (amount == 0) revert AmountMustBeGreaterThanZero();
        _;
    }
}
