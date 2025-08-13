// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/Errors.sol";

/// @title StakingModifiers
/// @dev Contains modifiers for the StakingManager contract to ensure proper conditions are met before executing
abstract contract StakingModifiers {
    /// @notice Reverts if amount is zero
    modifier amountGreaterThanZero(uint256 amount) {
        if (amount == 0) revert Errors.AmountMustBeGreaterThanZero();
        _;
    }

    /// @notice Reverts if the caller does not have enough shares
    modifier hasEnoughShares(uint256 shares) {
        if (IERC20(address(this)).balanceOf(msg.sender) < shares) revert Errors.InsufficientShares();
        _;
    }

    /// @notice Reverts if zero address is provided
    modifier notZeroAddress(address addr) {
        if (addr == address(0)) revert Errors.ZeroAddress();
        _;
    }

    /// @notice Reverts if zero fee is provided
    modifier validFee(uint256 fee) {
        if (fee == 0) revert Errors.NoFeesToWithdraw();
        _;
    }

}
