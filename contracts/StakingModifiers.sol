// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import "./StakingState.sol";

abstract contract StakingModifiers is StakingState {
    modifier amountGreaterThanZero(uint256 amount) {
        if (amount == 0) revert AmountMustBeGreaterThanZero();
        _;
    }

    modifier hasEnoughShares(
        mapping(address => uint256) storage userShares,
        address user,
        uint256 shares
    ) {
        if (shares > userShares[user]) revert InsufficientShares();
        _;
    }
}
