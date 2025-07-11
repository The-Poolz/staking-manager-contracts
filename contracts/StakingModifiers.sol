// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./StakingState.sol";

/// @title StakingModifiers
/// @dev Contains modifiers for the StakingManager contract to ensure proper conditions are met before executing
abstract contract StakingModifiers is StakingState {
    /// @notice Reverts if amount is zero
    modifier amountGreaterThanZero(uint256 amount) {
        if (amount == 0) revert AmountMustBeGreaterThanZero();
        _;
    }

    /// @notice Reverts if the caller does not have enough shares
    modifier hasEnoughShares(uint256 shares) {
        if (balanceOf(msg.sender) < shares) revert InsufficientShares();
        _;
    }
}
