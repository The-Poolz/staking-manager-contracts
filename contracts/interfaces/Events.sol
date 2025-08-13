// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import "@openzeppelin/contracts/interfaces/IERC4626.sol";

interface Events {
    /// @notice Emitted when a user stakes assets.
    event Stake(address indexed user, uint256 assets, uint256 shares);

    /// @notice Emitted when a user unstakes their shares.
    event Unstake(address indexed user, uint256 shares, uint256 assets);

    /// @notice Emitted when the staking vault is set.
    event StakingVaultSet(IERC4626 stakingVault, IERC20 token);

    /// @notice Emitted when fees are collected during staking.
    event InputFeeCollected(uint256 feeAmount);

    /// @notice Emitted when fees are collected during unstaking.
    event OutputFeeCollected(uint256 feeAmount);

    /// @notice Emitted when the input fee rate is updated.
    event InputFeeRateUpdated(uint256 oldFeeRate, uint256 newFeeRate);

    /// @notice Emitted when the output fee rate is updated.
    event OutputFeeRateUpdated(uint256 oldFeeRate, uint256 newFeeRate);

    /// @notice Emitted when fees are withdrawn.
    event FeesWithdrawn(address indexed recipient, uint256 amount);
}
